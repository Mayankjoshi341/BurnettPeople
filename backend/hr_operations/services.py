import logging
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from employees.models import EmployeeScheduleAssignment
from hr_operations.models import CompanyHoliday, Notification
from hr_operations.tasks import send_notification_email

logger = logging.getLogger(__name__)


def calculate_leave_days_by_year(employee, start_date, end_date):
    """Count scheduled working days per calendar year, excluding active holidays.

    If a work schedule assignment covers a date, its configured workdays apply.
    Dates without an assignment use a Monday-Friday default. Requests can cross
    calendar years; allocations then reserve against each year's balance.
    """
    holidays = set(
        CompanyHoliday.objects.filter(
            is_active=True, date__gte=start_date, date__lte=end_date
        ).values_list("date", flat=True)
    )
    assignments = list(
        EmployeeScheduleAssignment.objects.filter(
            employee=employee,
            effective_from__lte=end_date,
        ).filter(
            # open-ended assignment or one whose end still intersects the request
            Q(effective_until__isnull=True) | Q(effective_until__gte=start_date)
        ).select_related("work_schedule").order_by("-effective_from", "-id")
    )
    weekdays = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")
    by_year = {}
    current = start_date
    while current <= end_date:
        if current not in holidays:
            schedule = next(
                (
                    assignment.work_schedule
                    for assignment in assignments
                    if assignment.effective_from <= current
                    and (assignment.effective_until is None or current <= assignment.effective_until)
                ),
                None,
            )
            is_workday = (
                weekdays[current.weekday()] in schedule.workdays
                if schedule is not None
                else current.weekday() < 5
            )
            if is_workday:
                by_year[current.year] = by_year.get(current.year, 0) + 1
        current += timedelta(days=1)
    return by_year


def _queue_email(notification_id):
    try:
        send_notification_email.delay(notification_id)
    except Exception:  # in-app notification remains persisted if Redis is down
        logger.exception("Could not queue notification email id=%s", notification_id)


def notify_user(user, *, kind, title, message, target_type="", target_id=""):
    if not user or not user.is_active:
        return None
    notification = Notification.objects.create(
        recipient=user,
        kind=kind,
        title=title,
        message=message,
        target_type=target_type,
        target_id=str(target_id or ""),
    )
    transaction.on_commit(lambda notification_id=notification.pk: _queue_email(notification_id))
    return notification


def notify_hr_or_admin(*, kind, title, message, target_type="", target_id=""):
    User = get_user_model()
    recipients = User.objects.filter(is_active=True, role__in=["ADMIN", "HR"]).order_by("id")
    return [
        notify_user(
            user,
            kind=kind,
            title=title,
            message=message,
            target_type=target_type,
            target_id=target_id,
        )
        for user in recipients
    ]


def notify_leave_submitted(leave_request):
    employee = leave_request.employee
    manager = employee.manager
    message = (
        f"{employee.first_name} {employee.last_name} requested "
        f"{leave_request.leave_type.name} from {leave_request.start_date} "
        f"to {leave_request.end_date} ({leave_request.days_count} working day(s))."
    )
    if manager and manager.user_id and manager.user.is_active:
        notify_user(
            manager.user,
            kind=Notification.Kind.LEAVE_SUBMITTED,
            title="Leave request needs review",
            message=message,
            target_type="leave_request",
            target_id=leave_request.pk,
        )
    else:
        notify_hr_or_admin(
            kind=Notification.Kind.LEAVE_SUBMITTED,
            title="Leave request needs review",
            message=message,
            target_type="leave_request",
            target_id=leave_request.pk,
        )
    notify_user(
        employee.user,
        kind=Notification.Kind.LEAVE_SUBMITTED,
        title="Leave request submitted",
        message=f"Your {leave_request.leave_type.name} request is pending review.",
        target_type="leave_request",
        target_id=leave_request.pk,
    )


def notify_leave_decision(leave_request):
    approved = leave_request.status == "APPROVED"
    kind = Notification.Kind.LEAVE_APPROVED if approved else (
        Notification.Kind.LEAVE_CANCELLED if leave_request.status == "CANCELLED" else Notification.Kind.LEAVE_REJECTED
    )
    label = "approved" if approved else ("cancelled" if leave_request.status == "CANCELLED" else "rejected")
    message = f"Your {leave_request.leave_type.name} request for {leave_request.start_date}–{leave_request.end_date} was {label}."
    if leave_request.decision_comment:
        message += f" Comment: {leave_request.decision_comment}"
    notify_user(
        leave_request.employee.user,
        kind=kind,
        title=f"Leave request {label}",
        message=message,
        target_type="leave_request",
        target_id=leave_request.pk,
    )
