"""Weekly attendance overview for the HR/Admin dashboard."""

from collections import defaultdict
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsHROrAdmin
from attendance.models import AttendanceRecord, BreakPolicyRule
from employees.models import Employee, EmployeeScheduleAssignment
from hr_operations.models import LeaveRequest, RemoteWorkRequest

MAX_RANGE_DAYS = 7
DAY_CODES = {0: "MON", 1: "TUE", 2: "WED", 3: "THU", 4: "FRI", 5: "SAT", 6: "SUN"}
STATUS_LABELS = {"P": "Present", "A": "Absent", "L": "On Leave", "W": "Work From Home", "-": "Not Scheduled"}
BREAK_NAMES = {
    BreakPolicyRule.BreakType.LUNCH: "Lunch Break",
    BreakPolicyRule.BreakType.SHORT_BREAK: "Tea Break",
    BreakPolicyRule.BreakType.OTHER: "Other Break",
}


def _date_parameter(request, key):
    raw = request.query_params.get(key)
    if raw in (None, ""):
        return None
    value = parse_date(raw)
    if value is None:
        raise ValidationError({key: "Use a valid date in YYYY-MM-DD format."})
    return value


def _report_range(request):
    today = timezone.localdate()
    start = _date_parameter(request, "start_date")
    end = _date_parameter(request, "end_date")
    if start is None and end is None:
        end = today
        start = end - timedelta(days=MAX_RANGE_DAYS - 1)
    elif start is None:
        start = end - timedelta(days=MAX_RANGE_DAYS - 1)
    elif end is None:
        end = start + timedelta(days=MAX_RANGE_DAYS - 1)
    if start > end:
        raise ValidationError({"end_date": "End date must be on or after start date."})
    if (end - start).days >= MAX_RANGE_DAYS:
        raise ValidationError({"date_range": "The overview range cannot exceed 7 calendar days."})
    return start, end, [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _is_workday(schedule, day):
    return DAY_CODES[day.weekday()] in (schedule.workdays or [])


def _employee_active_on(employee, day):
    return employee.date_of_joining <= day and (employee.date_of_exit is None or employee.date_of_exit >= day)


def _assignment_for_day(assignments_by_employee, employee_id, day):
    # Assignments are ordered newest first; the most recent effective assignment wins.
    for assignment in assignments_by_employee.get(employee_id, ()):
        if assignment.effective_from <= day and (assignment.effective_until is None or assignment.effective_until >= day):
            schedule = assignment.work_schedule
            if not schedule.is_active or not schedule.break_policy.is_active:
                return None
            return assignment
    return None


def _schedule_for_day(assignments_by_employee, employee_id, day):
    assignment = _assignment_for_day(assignments_by_employee, employee_id, day)
    return assignment if assignment is not None and _is_workday(assignment.work_schedule, day) else None


def _zone_for_record(record):
    try:
        return ZoneInfo(record.schedule.timezone)
    except (ZoneInfoNotFoundError, ValueError, TypeError):
        return timezone.get_default_timezone()


def _is_late(record):
    local_check_in = record.check_in.astimezone(_zone_for_record(record))
    threshold = (datetime.combine(record.work_date, record.schedule.start_time) + timedelta(minutes=record.schedule.late_grace_minutes)).time()
    return local_check_in.time().replace(tzinfo=None) > threshold


def _record_work_minutes(record, now):
    end = min(record.check_out or now, now)
    if end <= record.check_in:
        return 0
    seconds = (end - record.check_in).total_seconds()
    for session in record.break_sessions.all():
        break_start = max(session.started_at, record.check_in)
        break_end = min(session.ended_at or end, end)
        if break_end > break_start:
            seconds -= (break_end - break_start).total_seconds()
    return max(0, int(seconds // 60))


def _format_hours(minutes):
    return f"{minutes // 60}h {minutes % 60:02d}m"


def _format_break_window(start, end):
    start_text = datetime.combine(date.min, start).strftime("%I:%M %p").lstrip("0")
    end_text = datetime.combine(date.min, end).strftime("%I:%M %p").lstrip("0")
    return f"{start_text} – {end_text}"


def _average_minutes(values):
    return "—" if not values else f"{round(sum(values) / len(values))}m"


def _break_overview(day, employees, assignments_by_employee, day_codes, records_by_employee_day):
    applicable_rules = defaultdict(list)
    eligible_ids = defaultdict(set)
    sessions_by_employee_type = defaultdict(list)

    for employee in employees:
        code = day_codes.get(employee.pk, {}).get(day, "-")
        # Approved leave and non-workdays do not contribute to expected break totals.
        if code not in {"P", "A", "W"}:
            continue
        assignment = _schedule_for_day(assignments_by_employee, employee.pk, day)
        if assignment is None:
            continue
        # Use the related objects preloaded by the main queryset; avoid one
        # extra rules query for each employee.
        rules = sorted(
            (rule for rule in assignment.work_schedule.break_policy.rules.all() if rule.is_active),
            key=lambda rule: (rule.allowed_start_time, rule.pk),
        )
        for rule in rules:
            applicable_rules[rule.break_type].append(rule)
            eligible_ids[rule.break_type].add(employee.pk)
        record = records_by_employee_day.get((employee.pk, day))
        if record:
            for session in record.break_sessions.all():
                sessions_by_employee_type[(employee.pk, session.rule.break_type)].append(session)

    result = []
    for break_type, rules in sorted(applicable_rules.items(), key=lambda item: item[0]):
        employee_ids = eligible_ids[break_type]
        taken_ids, on_time_ids, late_ids = set(), set(), set()
        windows = {(rule.allowed_start_time, rule.allowed_end_time) for rule in rules}
        for employee_id in employee_ids:
            sessions = sorted(sessions_by_employee_type.get((employee_id, break_type), ()), key=lambda item: item.started_at)
            if not sessions:
                continue
            session = sessions[0]
            taken_ids.add(employee_id)
            local_start = session.started_at.astimezone(_zone_for_record(session.attendance)).time().replace(tzinfo=None)
            if session.rule.allowed_start_time <= local_start < session.rule.allowed_end_time:
                on_time_ids.add(employee_id)
            else:
                late_ids.add(employee_id)
        if len(windows) == 1:
            start, end = next(iter(windows))
            window = _format_break_window(start, end)
        elif windows:
            window = "Varies by schedule"
        else:
            window = ""
        total, taken = len(employee_ids), len(taken_ids)
        result.append({
            "name": BREAK_NAMES.get(break_type, break_type.replace("_", " ").title()),
            "window": window,
            "taken": taken,
            "total": total,
            "on_time": len(on_time_ids),
            "late": len(late_ids),
            # There is no explicit missed-break model/event: null means untracked, not zero.
            "missed": None,
            "missed_tracking_available": False,
            "not_taken": max(0, total - taken),
        })
    return result


class AttendanceOverviewView(APIView):
    """Return the last seven days of attendance for HR/Admin dashboard use."""

    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def get(self, request):
        start_date, end_date, dates = _report_range(request)
        employees = list(
            Employee.objects.filter(
                employment_status=Employee.EmploymentStatus.ACTIVE,
                date_of_joining__lte=end_date,
            ).filter(Q(date_of_exit__isnull=True) | Q(date_of_exit__gte=start_date))
            .select_related("department")
            .order_by("employee_code", "id")
        )
        employee_ids = [employee.pk for employee in employees]

        assignments_by_employee = defaultdict(list)
        assignments = EmployeeScheduleAssignment.objects.filter(
            employee_id__in=employee_ids,
            effective_from__lte=end_date,
        ).filter(Q(effective_until__isnull=True) | Q(effective_until__gte=start_date))
        assignments = assignments.select_related(
            "work_schedule", "work_schedule__break_policy"
        ).prefetch_related("work_schedule__break_policy__rules").order_by(
            "employee_id", "-effective_from", "-id"
        )
        for assignment in assignments:
            assignments_by_employee[assignment.employee_id].append(assignment)

        record_query = AttendanceRecord.objects.filter(
            employee_id__in=employee_ids, work_date__gte=start_date, work_date__lte=end_date,
        ).select_related("schedule").prefetch_related("break_sessions__rule")
        records_by_employee_day = {(record.employee_id, record.work_date): record for record in record_query}

        leave_days = defaultdict(set)
        leaves = LeaveRequest.objects.filter(
            employee_id__in=employee_ids,
            status=LeaveRequest.Status.APPROVED,
            start_date__lte=end_date,
            end_date__gte=start_date,
        ).values_list("employee_id", "start_date", "end_date")
        for employee_id, leave_start, leave_end in leaves:
            for day in dates:
                if leave_start <= day <= leave_end:
                    leave_days[employee_id].add(day)

        approved_remote_days = set(RemoteWorkRequest.objects.filter(
            employee_id__in=employee_ids,
            status=RemoteWorkRequest.Status.APPROVED,
            work_date__gte=start_date,
            work_date__lte=end_date,
        ).values_list("employee_id", "work_date"))

        day_codes = defaultdict(dict)
        daily_late = defaultdict(int)
        for employee in employees:
            for day in dates:
                if not _employee_active_on(employee, day):
                    day_codes[employee.pk][day] = "-"
                    continue
                assignment = _schedule_for_day(assignments_by_employee, employee.pk, day)
                if assignment is None:
                    day_codes[employee.pk][day] = "-"
                    continue
                record = records_by_employee_day.get((employee.pk, day))
                if day in leave_days[employee.pk]:
                    code = "L"
                elif (employee.pk, day) in approved_remote_days:
                    code = "W"
                elif record is not None:
                    code = "P"
                else:
                    code = "A"
                day_codes[employee.pk][day] = code
                if record is not None and code in {"P", "W"} and _is_late(record):
                    daily_late[day] += 1

        week = []
        for day in dates:
            codes = [day_codes[employee.pk].get(day, "-") for employee in employees]
            present, absent, on_leave, wfh = (codes.count(code) for code in ("P", "A", "L", "W"))
            week.append({
                "date": day.isoformat(), "present": present, "absent": absent,
                "on_leave": on_leave, "wfh": wfh,
                "total": present + absent + on_leave + wfh,
                "late": daily_late[day],
            })

        end_codes = [day_codes[employee.pk].get(end_date, "-") for employee in employees]
        summary = {
            "total": sum(_employee_active_on(employee, end_date) for employee in employees),
            "present": end_codes.count("P"), "absent": end_codes.count("A"),
            "on_leave": end_codes.count("L"), "wfh": end_codes.count("W"),
            "late": daily_late[end_date],
        }

        now = timezone.now()
        work_minutes_by_employee = defaultdict(int)
        break_duration_minutes_by_employee = defaultdict(lambda: defaultdict(list))
        for (employee_id, _work_date), record in records_by_employee_day.items():
            work_minutes_by_employee[employee_id] += _record_work_minutes(record, now)
            for session in record.break_sessions.all():
                if session.ended_at is not None:
                    minutes = max(0, round((session.ended_at - session.started_at).total_seconds() / 60))
                    break_duration_minutes_by_employee[employee_id][session.rule.break_type].append(minutes)

        employee_rows = []
        for employee in employees:
            codes = day_codes[employee.pk]
            current_code = codes.get(end_date, "-")
            employee_rows.append({
                "id": employee.pk,
                "name": f"{employee.first_name} {employee.last_name}".strip(),
                "code": employee.employee_code,
                "department": employee.department.name,
                "days": {day.isoformat(): codes.get(day, "-") for day in dates},
                "present_days": sum(codes.get(day, "-") in {"P", "W"} for day in dates),
                "work_hours": _format_hours(work_minutes_by_employee[employee.pk]),
                "lunch_avg": _average_minutes(
                    break_duration_minutes_by_employee[employee.pk][BreakPolicyRule.BreakType.LUNCH]
                ),
                "tea_avg": _average_minutes(
                    break_duration_minutes_by_employee[employee.pk][BreakPolicyRule.BreakType.SHORT_BREAK]
                ),
                "status": STATUS_LABELS[current_code],
            })

        return Response({
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "dates": [day.isoformat() for day in dates],
            "summary": summary,
            "week": week,
            "breaks": _break_overview(end_date, employees, assignments_by_employee, day_codes, records_by_employee_day),
            "employees": employee_rows,
            "definitions": {
                "wfh": "Approved remote-work request for the date; not proof of check-in.",
                "absent": "Scheduled workday with no attendance record, approved leave, or approved remote-work request.",
                "missed_breaks_tracked": False,
            },
        })
