"""Read-only attendance and schedule endpoints used by the HRMS dashboards."""

from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db.models import Q, Count
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from rest_framework.exceptions import PermissionDenied
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsHROrAdmin
from attendance.models import AttendanceException, AttendanceRecord
from attendance.serializers import AttendanceRecordSerializer
from attendance.views import _employee_for_user, _record_query, _zone
from employees.models import Employee, EmployeeScheduleAssignment
from attendance.reporting_serializers import EmployeeScheduleAssignmentReadSerializer
from hr_operations.models import AssetAssignment, LeaveRequest
from accounts.models import AccountInvitation


class AdminDashboardMetricsView(APIView):
    """Real, permission-scoped summary data for the administrator overview."""

    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def get(self, request):
        today = timezone.localdate()
        employees = Employee.objects.filter(employment_status=Employee.EmploymentStatus.ACTIVE)
        invitations = AccountInvitation.objects.filter(
            accepted_at__isnull=True, revoked_at__isnull=True,
            expires_at__gt=timezone.now(), user__is_active=False,
        )
        open_exceptions = AttendanceException.objects.filter(review_status=AttendanceException.ReviewStatus.PENDING)
        scheduled_ids = EmployeeScheduleAssignment.objects.filter(
            effective_from__lte=today,
        ).filter(Q(effective_until__isnull=True) | Q(effective_until__gte=today)).values("employee_id")
        no_schedule = employees.exclude(pk__in=scheduled_ids).count()
        pending_returns = AssetAssignment.objects.filter(returned_at__isnull=True).count()

        raw_days = request.query_params.get("working_days", "5")
        try:
            working_days = int(raw_days)
        except (TypeError, ValueError) as exc:
            raise ValidationError({"working_days": "Choose 5, 15, or 20 working days."}) from exc
        if working_days not in {5, 15, 20}:
            raise ValidationError({"working_days": "Choose 5, 15, or 20 working days."})
        dates = []
        cursor = today
        while len(dates) < working_days:
            if cursor.weekday() < 5:
                dates.append(cursor)
            cursor -= timedelta(days=1)
        dates.reverse()
        records = AttendanceRecord.objects.filter(work_date__in=dates).values("work_date").annotate(total=Count("id"))
        counts = {row["work_date"]: row["total"] for row in records}
        employees_total = Employee.objects.count()
        joined = employees.filter(date_of_joining__year=today.year, date_of_joining__month=today.month).count()
        today_count = AttendanceRecord.objects.filter(work_date=today).values("employee_id").distinct().count()
        attention = {
            "invitations": invitations.count(),
            "exceptions": open_exceptions.count(),
            "schedules": no_schedule,
            "assets": pending_returns,
        }
        return Response({
            "totals": {
                "employees": employees_total,
                "activeEmployees": employees.count(),
                "deactivatedEmployees": Employee.objects.filter(user__is_active=False).count(),
                "joinedThisMonth": joined,
                "activeToday": today_count,
                "invitations": invitations.count(),
                "exceptions": open_exceptions.count(),
            },
            "attendance": [counts.get(day, 0) for day in dates],
            "attendanceDates": [day.isoformat() for day in dates],
            "attention": attention,
            "attentionItems": [
                {"key": "invitations", "count": attention["invitations"], "target": "employees"},
                {"key": "exceptions", "count": attention["exceptions"], "target": "exceptions"},
                {"key": "schedules", "count": attention["schedules"], "target": "schedules"},
                {"key": "assets", "count": attention["assets"], "target": "assets"},
            ],
        })


def _is_scheduled(schedule, day):
    day_code = day.strftime("%a").upper()[:3]
    return day_code in schedule.workdays


def _elapsed(record):
    if not record.check_out:
        return ""
    seconds = int((record.check_out - record.check_in).total_seconds())
    seconds -= sum(
        max(0, int((item.ended_at - item.started_at).total_seconds()))
        for item in record.break_sessions.all() if item.ended_at
    )
    hours, rem = divmod(max(0, seconds), 3600)
    minutes = rem // 60
    return f"{hours}h {minutes:02d}m"


class ManagerDashboardView(APIView):
    """Return dashboard data for only the authenticated manager's direct reports."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if getattr(request.user, "role", None) != User.Role.MANAGER:
            raise PermissionDenied("Only managers can access this team dashboard.")
        try:
            manager = Employee.objects.get(user=request.user)
        except Employee.DoesNotExist as exc:
            raise PermissionDenied("Your account is not linked to a manager profile.") from exc

        employees = list(Employee.objects.filter(
            manager=manager, employment_status=Employee.EmploymentStatus.ACTIVE
        ).select_related("department", "designation").order_by("employee_code"))
        ids = [employee.id for employee in employees]
        today = timezone.localdate()
        assignments = {}
        for item in EmployeeScheduleAssignment.objects.filter(
            employee_id__in=ids
        ).select_related("work_schedule").order_by(
            "employee_id", "-effective_from", "-id"
        ):
            assignments.setdefault(item.employee_id, []).append(item)

        def effective(employee_id, day):
            for item in assignments.get(employee_id, ()):
                if item.effective_from <= day and (item.effective_until is None or item.effective_until >= day):
                    return item
            return None

        records = {(r.employee_id, r.work_date): r for r in AttendanceRecord.objects.filter(
            employee_id__in=ids, work_date__gte=today - timedelta(days=6), work_date__lte=today
        ).select_related("schedule").prefetch_related("break_sessions")}
        leaves = list(LeaveRequest.objects.filter(
            employee_id__in=ids, status=LeaveRequest.Status.APPROVED,
            start_date__lte=today, end_date__gte=today - timedelta(days=6),
        ).select_related("employee", "leave_type"))

        def status_for(employee, day):
            if any(leave.employee_id == employee.id and leave.start_date <= day <= leave.end_date for leave in leaves):
                return "On Leave"
            if (employee.id, day) in records:
                return "Present"
            assignment = effective(employee.id, day)
            if assignment and _is_scheduled(assignment.work_schedule, day):
                return "Absent"
            return "Not Scheduled"

        team = []
        schedules = []
        for employee in employees:
            assignment = effective(employee.id, today)
            record = records.get((employee.id, today))
            state = status_for(employee, today)
            name = f"{employee.first_name} {employee.last_name}".strip()
            check_in = check_out = hours = ""
            late = early = False
            if record:
                zone = ZoneInfo(record.schedule.timezone)
                check_in = record.check_in.astimezone(zone).strftime("%I:%M %p")
                if record.check_out:
                    check_out = record.check_out.astimezone(zone).strftime("%I:%M %p")
                    early = record.check_out.astimezone(zone).time().replace(tzinfo=None) < record.schedule.end_time
                start = record.check_in.astimezone(zone).time().replace(tzinfo=None)
                expected = (datetime.combine(record.work_date, record.schedule.start_time) +
                            timedelta(minutes=record.schedule.late_grace_minutes)).time()
                late = start > expected
                hours = _elapsed(record)
            team.append({
                "id": employee.id, "code": employee.employee_code, "name": name,
                "designation": employee.designation.title, "department": employee.department.name,
                "status": state, "check_in": check_in, "check_out": check_out,
                "work_hours": hours, "late": late, "early": early,
            })
            if assignment:
                schedule = assignment.work_schedule
                tomorrow = today + timedelta(days=1)
                next_assignment = effective(employee.id, tomorrow)
                fmt = lambda s: f"{s.start_time.strftime('%I:%M %p').lstrip('0')} – {s.end_time.strftime('%I:%M %p').lstrip('0')}"
                schedules.append({
                    "name": name, "department": employee.department.name,
                    "today": "Leave" if state == "On Leave" else fmt(schedule) if _is_scheduled(schedule, today) else "Not scheduled",
                    "tomorrow": fmt(next_assignment.work_schedule) if next_assignment and _is_scheduled(next_assignment.work_schedule, tomorrow) else "Not scheduled",
                    "status": state,
                })

        week = []
        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)
            counts = {"Present": 0, "On Leave": 0, "Absent": 0}
            for employee in employees:
                state = status_for(employee, day)
                if state in counts:
                    counts[state] += 1
            week.append({"date": day.isoformat(), "label": day.strftime("%d %b"), "sub": day.strftime("%a"),
                         "present": counts["Present"], "leave": counts["On Leave"], "absent": counts["Absent"]})

        assets = [{"id": item.id, "device": item.asset.name, "type": item.asset.get_category_display(),
                   "employee": f"{item.employee.first_name} {item.employee.last_name}".strip(),
                   "department": item.employee.department.name, "assignedOn": item.assigned_at.date().isoformat(),
                   "status": "Assigned"} for item in AssetAssignment.objects.filter(
                       employee_id__in=ids, returned_at__isnull=True
                   ).select_related("asset", "employee", "employee__department")]
        exceptions = AttendanceException.objects.filter(
            employee_id__in=ids, review_status=AttendanceException.ReviewStatus.PENDING
        ).select_related("employee").order_by("-submitted_at")[:20]
        leave_history = LeaveRequest.objects.filter(employee_id__in=ids).exclude(
            status=LeaveRequest.Status.PENDING
        ).select_related("employee", "leave_type", "decided_by").order_by("-decided_at")[:20]
        exception_history = AttendanceException.objects.filter(
            employee_id__in=ids,
            review_status__in=[AttendanceException.ReviewStatus.APPROVED, AttendanceException.ReviewStatus.REJECTED],
        ).select_related("employee", "reviewed_by").order_by("-reviewed_at")[:20]
        history = [{"id": f"leave-{item.id}", "employee": item.employee.employee_code,
                    "type": item.leave_type.name, "status": item.get_status_display(),
                    "decided_at": item.decided_at.isoformat() if item.decided_at else None,
                    "decided_by": item.decided_by.email if item.decided_by else None}
                   for item in leave_history]
        history.extend({"id": f"exception-{item.id}", "employee": item.employee.employee_code,
                        "type": item.get_exception_type_display(), "status": item.get_review_status_display(),
                        "decided_at": item.reviewed_at.isoformat() if item.reviewed_at else None,
                        "decided_by": item.reviewed_by.email if item.reviewed_by else None}
                       for item in exception_history)
        history.sort(key=lambda item: item["decided_at"] or "", reverse=True)
        return Response({
            "team": team, "week": week, "assets": assets, "schedule": schedules,
            "exceptions": [{"id": item.id, "employee": item.employee.employee_code,
                            "type": item.get_exception_type_display(), "status": item.get_review_status_display(),
                            "submitted_at": item.submitted_at} for item in exceptions],
            "approval_history": history[:20],
        })


class AttendanceRecordPagination(PageNumberPagination):
    """Bound report response sizes while allowing callers to move through pages."""

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


def _query_date(request, name, default=None):
    raw_value = request.query_params.get(name)
    if raw_value in (None, ""):
        return default

    parsed = parse_date(raw_value)
    if parsed is None:
        raise ValidationError({name: "Use a valid date in YYYY-MM-DD format."})
    return parsed


class MyWorkScheduleView(APIView):
    """Return only the authenticated employee's schedule effective today."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _employee_for_user(request.user)
        now = timezone.now()
        assignments = (
            EmployeeScheduleAssignment.objects.filter(employee=employee)
            .select_related("work_schedule", "work_schedule__break_policy")
            .prefetch_related("work_schedule__break_policy__rules")
            .order_by("-effective_from", "-id")
        )

        for assignment in assignments:
            schedule_local_date = now.astimezone(_zone(assignment.work_schedule)).date()
            is_effective = assignment.effective_from <= schedule_local_date and (
                assignment.effective_until is None
                or assignment.effective_until >= schedule_local_date
            )
            if is_effective:
                return Response(
                    {
                        "work_date": schedule_local_date.isoformat(),
                        "assignment": EmployeeScheduleAssignmentReadSerializer(assignment).data,
                    }
                )

        return Response(
            {
                "work_date": timezone.localdate().isoformat(),
                "assignment": None,
                "detail": "No work schedule is assigned for the current date.",
            }
        )


class AttendanceRecordListView(APIView):
    """List company attendance records for HR/Admin, with validated filters."""

    permission_classes = [IsAuthenticated, IsHROrAdmin]
    pagination_class = AttendanceRecordPagination

    def get(self, request):
        start_date = _query_date(request, "start_date")
        end_date = _query_date(request, "end_date")
        if start_date and end_date and start_date > end_date:
            raise ValidationError({"end_date": "End date must be on or after start date."})

        queryset = _record_query()
        if start_date:
            queryset = queryset.filter(work_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(work_date__lte=end_date)

        employee_id = request.query_params.get("employee_id")
        if employee_id not in (None, ""):
            try:
                employee_id = int(employee_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"employee_id": "Provide a valid employee ID."}) from exc
            if employee_id < 1:
                raise ValidationError({"employee_id": "Employee ID must be a positive integer."})
            queryset = queryset.filter(employee_id=employee_id)

        record_status = request.query_params.get("status")
        valid_statuses = {choice.value for choice in AttendanceRecord.Status}
        if record_status not in (None, ""):
            if record_status not in valid_statuses:
                raise ValidationError({"status": f"Choose one of: {', '.join(sorted(valid_statuses))}."})
            queryset = queryset.filter(status=record_status)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serialized = AttendanceRecordSerializer(page, many=True)
        return paginator.get_paginated_response(serialized.data)


class AttendanceSummaryView(APIView):
    """Return a factual attendance summary; it does not infer absences."""

    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def get(self, request):
        work_date = _query_date(request, "date", default=timezone.localdate())
        records = AttendanceRecord.objects.filter(work_date=work_date)
        pending_exceptions = AttendanceException.objects.filter(
            review_status=AttendanceException.ReviewStatus.PENDING
        ).count()

        return Response(
            {
                "date": work_date.isoformat(),
                "total_attendance_records": records.count(),
                "open_sessions": records.filter(status=AttendanceRecord.Status.OPEN).count(),
                "closed_sessions": records.filter(status=AttendanceRecord.Status.CLOSED).count(),
                "pending_exceptions_total": pending_exceptions,
            }
        )


class DailyAttendanceReportView(APIView):
    """Build a daily report from scheduled employee, leave, and attendance records."""
    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def get(self, request):
        day = _query_date(request, "date", default=timezone.localdate())
        employees = Employee.objects.filter(
            employment_status=Employee.EmploymentStatus.ACTIVE,
            date_of_joining__lte=day,
        ).select_related("department", "work_location").order_by("employee_code")
        department_id = request.query_params.get("department_id")
        if department_id:
            try:
                department_id = int(department_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"department_id": "Provide a valid department ID."}) from exc
            employees = employees.filter(department_id=department_id)
        employee_id = request.query_params.get("employee_id")
        if employee_id:
            try:
                employee_id = int(employee_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"employee_id": "Provide a valid employee ID."}) from exc
            employees = employees.filter(pk=employee_id)

        ids = list(employees.values_list("id", flat=True))
        assignments = {}
        for assignment in EmployeeScheduleAssignment.objects.filter(
            employee_id__in=ids, effective_from__lte=day,
        ).filter(Q(effective_until__isnull=True) | Q(effective_until__gte=day)).select_related(
            "work_schedule"
        ).order_by("employee_id", "-effective_from", "-id"):
            assignments.setdefault(assignment.employee_id, assignment)
        records = {item.employee_id: item for item in AttendanceRecord.objects.filter(
            employee_id__in=ids, work_date=day
        ).select_related("schedule").prefetch_related("break_sessions")}
        on_leave = set(LeaveRequest.objects.filter(
            employee_id__in=ids, status=LeaveRequest.Status.APPROVED,
            start_date__lte=day, end_date__gte=day,
        ).values_list("employee_id", flat=True))

        rows = []
        check_ins = []
        check_outs = []
        work_minutes = []
        late_count = 0
        missing_checkout = 0
        for employee in employees:
            assignment = assignments.get(employee.id)
            if not assignment or not _is_scheduled(assignment.work_schedule, day):
                continue
            record = records.get(employee.id)
            if employee.id in on_leave:
                state = "On Leave"
            elif record:
                state = "Present"
            else:
                state = "Absent"
            check_in = check_out = hours = ""
            remarks = ""
            if record:
                zone = ZoneInfo(record.schedule.timezone)
                in_local = record.check_in.astimezone(zone)
                check_in = in_local.strftime("%I:%M %p")
                check_ins.append(in_local.hour * 60 + in_local.minute)
                threshold = (datetime.combine(day, record.schedule.start_time) +
                             timedelta(minutes=record.schedule.late_grace_minutes)).time()
                if in_local.time().replace(tzinfo=None) > threshold:
                    late_count += 1
                if record.check_out:
                    out_local = record.check_out.astimezone(zone)
                    check_out = out_local.strftime("%I:%M %p")
                    check_outs.append(out_local.hour * 60 + out_local.minute)
                    elapsed = _elapsed(record)
                    hours = elapsed
                    duration = record.check_out - record.check_in
                    breaks = sum((item.ended_at - item.started_at for item in record.break_sessions.all() if item.ended_at), timedelta())
                    work_minutes.append(max(0, int((duration - breaks).total_seconds() // 60)))
                else:
                    missing_checkout += 1
                    remarks = "Check-out not recorded"
            rows.append({
                "name": f"{employee.first_name} {employee.last_name}".strip(),
                "code": employee.employee_code, "department": employee.department.name,
                "check_in": check_in, "check_out": check_out, "work_hours": hours,
                "status": state, "location": employee.work_location.name if employee.work_location_id else "",
                "remarks": remarks,
            })

        status_filter = request.query_params.get("status")
        valid_statuses = {"Present", "Absent", "On Leave"}
        if status_filter:
            if status_filter not in valid_statuses:
                raise ValidationError({"status": "Choose Present, Absent, or On Leave."})
            rows = [row for row in rows if row["status"] == status_filter]
        summary = {
            "total": len(rows),
            "present": sum(row["status"] == "Present" for row in rows),
            "absent": sum(row["status"] == "Absent" for row in rows),
            "leave": sum(row["status"] == "On Leave" for row in rows),
            # The model does not record daily work mode, so this value is unknown.
            "wfh": None,
        }
        def avg_clock(values):
            if not values:
                return "—"
            minutes = round(sum(values) / len(values))
            return datetime.combine(day, datetime.min.time()).replace(hour=minutes // 60, minute=minutes % 60).strftime("%I:%M %p")
        def avg_duration(values):
            if not values:
                return "—"
            total_minutes = round(sum(values) / len(values))
            return f"{total_minutes // 60}h {total_minutes % 60:02d}m"
        return Response({
            "date": day.isoformat(), "summary": summary,
            "metrics": [
                {"icon": "clock", "value": avg_clock(check_ins), "label": "Average Check-in"},
                {"icon": "logout", "value": avg_clock(check_outs), "label": "Average Check-out"},
                {"icon": "clock", "value": avg_duration(work_minutes), "label": "Average Work Hours"},
                {"icon": "alert", "value": str(late_count), "label": "Late Arrivals"},
                {"icon": "alert", "value": str(missing_checkout), "label": "Missing Check-out"},
            ],
            "employees": rows,
        })
