from calendar import monthrange
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from attendance.models import AttendanceRecord
from employees.models import Employee
from hr_operations.models import CompanyHoliday, LeaveRequest
from recognition.models import AchievementDefinition, EmployeeAchievement, ScoreLedger, ScoringRule


def award_event(*, record, activity, source_suffix, description):
    """Award configured points once for a server-verified attendance event."""
    rule = ScoringRule.objects.filter(activity=activity, active=True).first()
    if not rule or rule.points == 0 or not record.employee.user_id:
        return None
    try:
        with transaction.atomic():
            return ScoreLedger.objects.create(
                participant=record.employee.user,
                employee=record.employee,
                activity=activity,
                points=rule.points,
                source_event=f"attendance:{record.pk}:{source_suffix}",
                event_date=record.work_date,
                description=description,
            )
    except IntegrityError:
        return ScoreLedger.objects.filter(source_event=f"attendance:{record.pk}:{source_suffix}").first()


def attendance_eligibility(record):
    zone = ZoneInfo(record.schedule.timezone)
    local_checkin = record.check_in.astimezone(zone)
    shift_start = datetime.combine(record.work_date, record.schedule.start_time).replace(tzinfo=zone)
    on_time = local_checkin <= shift_start + timedelta(minutes=record.schedule.late_grace_minutes)
    return on_time


def record_checkin_awards(record):
    if attendance_eligibility(record):
        award_event(record=record, activity=ScoringRule.Activity.ON_TIME_CHECK_IN,
                    source_suffix="on-time-check-in", description="On-time check-in")


def record_checkout_award(record):
    if record.check_out and record.check_out >= record.check_in:
        award_event(record=record, activity=ScoringRule.Activity.COMPLETE_ATTENDANCE,
                    source_suffix="complete-attendance", description="Completed attendance record")


def award_verified_activity(*, participant, activity, source_event, event_date, description):
    """Award points for an activity only after its verifier changes it to complete."""
    rule = ScoringRule.objects.filter(activity=activity, active=True).first()
    if not rule or rule.points == 0:
        return None
    employee = getattr(participant, "employee_profile", None)
    try:
        with transaction.atomic():
            return ScoreLedger.objects.create(
                participant=participant, employee=employee, activity=activity,
                points=rule.points, source_event=source_event,
                event_date=event_date, description=description,
            )
    except IntegrityError:
        return ScoreLedger.objects.filter(source_event=source_event).first()


def award_activity_milestone(*, participant, key, threshold, count, period_key="lifetime"):
    if count < threshold:
        return None
    definition = AchievementDefinition.objects.filter(key=key, active=True).first()
    if definition is None:
        return None
    employee = getattr(participant, "employee_profile", None)
    achievement, created = EmployeeAchievement.objects.get_or_create(
        participant=participant, definition=definition, period_key=period_key,
        defaults={"employee": employee, "earned_at": timezone.now(), "metadata": {"verified_activities": count, "required_activities": threshold}},
    )
    if created and definition.bonus_points:
        ScoreLedger.objects.get_or_create(
            source_event=f"achievement:{participant.pk}:{definition.key}:{period_key}",
            defaults={"participant": participant, "employee": employee,
                "activity": ScoringRule.Activity.ON_TIME_CHECK_IN,
                "points": definition.bonus_points, "event_date": timezone.localdate(),
                "description": f"Achievement milestone: {definition.name}"},
        )
    return achievement if created else None


def current_streak(participant, *, maximum_days=60):
    """Count consecutive eligible scheduled workdays ending at the latest eligible day.

    Approved leave is skipped and does not break or increase the streak.
    """
    try:
        employee = Employee.objects.get(user=participant)
    except Employee.DoesNotExist:
        employee = None
    if employee is None:
        return 0
    today = timezone.localdate()
    today_assignment = _assignment_for_date(employee, today)
    if today_assignment:
        today = timezone.localdate(timezone=ZoneInfo(today_assignment.work_schedule.timezone))
    attendance = {r.work_date: r for r in AttendanceRecord.objects.filter(employee=employee, work_date__gte=today-timedelta(days=maximum_days))}
    leaves = list(LeaveRequest.objects.filter(employee=employee, status=LeaveRequest.Status.APPROVED,
                    start_date__lte=today, end_date__gte=today-timedelta(days=maximum_days)).values_list("start_date", "end_date"))
    holidays = set(CompanyHoliday.objects.filter(is_active=True, date__gte=today-timedelta(days=maximum_days), date__lte=today).values_list("date", flat=True))
    assignment_rows = list(employee.schedule_assignments.filter(effective_from__lte=today).filter(
        models_q_until(today-timedelta(days=maximum_days))).select_related("work_schedule").order_by("-effective_from"))
    streak = 0
    day = today
    while day >= today-timedelta(days=maximum_days):
        if day in holidays or any(start <= day <= end for start, end in leaves):
            day -= timedelta(days=1)
            continue
        assignment = next((a for a in assignment_rows if a.effective_from <= day and (a.effective_until is None or a.effective_until >= day)), None)
        if assignment is None:
            day -= timedelta(days=1)
            continue
        schedule = assignment.work_schedule
        weekday = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")[day.weekday()]
        if weekday not in schedule.workdays:
            day -= timedelta(days=1)
            continue
        record = attendance.get(day)
        if record is None or not record.check_out or not attendance_eligibility(record):
            break
        streak += 1
        day -= timedelta(days=1)
    return streak


def models_q_until(start):
    from django.db.models import Q
    return Q(effective_until__isnull=True) | Q(effective_until__gte=start)


def award_streak_achievement(participant, streak, *, now=None):
    try:
        employee = Employee.objects.get(user=participant)
    except Employee.DoesNotExist:
        employee = None
    earned = []
    for threshold, key in ((5, "on-time-streak-5"), (10, "consistency-10")):
        if streak < threshold:
            continue
        definition = AchievementDefinition.objects.filter(key=key, active=True).first()
        if definition is None:
            continue
        achievement, created = EmployeeAchievement.objects.get_or_create(
            participant=participant, definition=definition, period_key="lifetime",
            defaults={"employee": employee, "earned_at": now or timezone.now(), "metadata": {"eligible_workdays": streak}},
        )
        if created:
            earned.append(achievement)
            if definition.bonus_points:
                ScoreLedger.objects.get_or_create(
                    source_event=f"achievement:{participant.pk}:{definition.key}:lifetime",
                    defaults={"participant": participant, "employee": employee,
                        "activity": ScoringRule.Activity.ON_TIME_CHECK_IN,
                        "points": definition.bonus_points, "event_date": (now or timezone.now()).date(),
                        "description": f"Achievement milestone: {definition.name}"},
                )
    return earned


def _assignment_for_date(employee, day):
    return employee.schedule_assignments.filter(effective_from__lte=day).filter(
        models_q_until(day)
    ).select_related("work_schedule").order_by("-effective_from", "-id").first()


def _eligible_dates(employee, start, end):
    holidays = set(CompanyHoliday.objects.filter(is_active=True, date__gte=start, date__lte=end).values_list("date", flat=True))
    leave_ranges = list(LeaveRequest.objects.filter(employee=employee, status=LeaveRequest.Status.APPROVED,
        start_date__lte=end, end_date__gte=start).values_list("start_date", "end_date"))
    for offset in range((end-start).days+1):
        day = start + timedelta(days=offset)
        if day in holidays or any(a <= day <= b for a, b in leave_ranges):
            continue
        assignment = _assignment_for_date(employee, day)
        if not assignment:
            continue
        weekday = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")[day.weekday()]
        if weekday in assignment.work_schedule.workdays:
            yield day, assignment.work_schedule


def evaluate_periodic_achievements(employee, *, today=None):
    """Persist completed-period awards using only verified schedule/attendance/ledger data."""
    today = today or timezone.localdate()
    month_start = today.replace(day=1)
    last_month_end = month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    prior_month_end = last_month_start - timedelta(days=1)
    prior_month_start = prior_month_end.replace(day=1)

    participant = employee.user
    if participant is None:
        return []
    awards = []

    eligible = list(_eligible_dates(employee, last_month_start, last_month_end))
    if eligible:
        on_time = sum(1 for day, _schedule in eligible
            if (record := AttendanceRecord.objects.filter(employee=employee, work_date=day).first())
            and attendance_eligibility(record))
        definition = AchievementDefinition.objects.filter(key="punctuality-pro", active=True).first()
        required = float((definition.configuration if definition else {}).get("monthly_rate", .95))
        if definition and on_time / len(eligible) >= required:
            awards.extend(award_streak_achievement_for_definition(employee, definition, {
                "month": last_month_start.strftime("%Y-%m"), "on_time_days": on_time, "eligible_days": len(eligible)}))

    recent = list(_eligible_dates(employee, today-timedelta(days=120), today))[-20:]
    star = AchievementDefinition.objects.filter(key="attendance-star", active=True).first()
    if star and len(recent) >= int(star.configuration.get("period_days", 20)):
        period = recent[-int(star.configuration.get("period_days", 20)):]
        if all(AttendanceRecord.objects.filter(employee=employee, work_date=day, check_out__isnull=False).exists() for day, _ in period):
            awards.extend(award_streak_achievement_for_definition(employee, star, {
                "period": period[-1][0].isoformat(), "eligible_days": len(period)}))

    baseline = ScoreLedger.objects.filter(participant=participant, event_date__gte=prior_month_start, event_date__lte=prior_month_end).aggregate(total=Sum("points"))["total"] or 0
    improved = ScoreLedger.objects.filter(participant=participant, event_date__gte=last_month_start, event_date__lte=last_month_end).aggregate(total=Sum("points"))["total"] or 0
    most_improved = AchievementDefinition.objects.filter(key="most-improved", active=True).first()
    if most_improved and baseline > 0 and improved >= baseline + max(10, int(baseline * .20)):
        awards.extend(award_streak_achievement_for_definition(employee, most_improved, {
            "month": last_month_start.strftime("%Y-%m"), "comparison": "previous_completed_month",
            "baseline_points": baseline, "period_points": improved}))
    return awards


def award_streak_achievement_for_definition(employee, definition, metadata):
    participant = employee.user
    achievement, created = EmployeeAchievement.objects.get_or_create(
        participant=participant, definition=definition,
        period_key=metadata.get("month") or metadata.get("period") or "lifetime",
        defaults={"employee": employee, "earned_at": timezone.now(), "metadata": metadata},
    )
    if created and definition.bonus_points:
        ScoreLedger.objects.get_or_create(source_event=f"achievement:{participant.pk}:{definition.key}:{achievement.period_key}", defaults={
            "participant": participant, "employee": employee,
            "activity": ScoringRule.Activity.ON_TIME_CHECK_IN,
            "points": definition.bonus_points, "event_date": timezone.localdate(),
            "description": f"Achievement milestone: {definition.name}",
        })
    return [achievement] if created else []
