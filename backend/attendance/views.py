from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import AuditEvent, User
from accounts.permissions import IsHROrAdmin
from accounts.services.audit import record_audit_event
from attendance.models import AttendanceException, AttendanceRecord, BreakPolicyRule, BreakSession
from attendance.serializers import (
    AttendanceExceptionCreateSerializer, AttendanceExceptionReviewSerializer,
    AttendanceExceptionSerializer, AttendanceRecordSerializer,
)
from employees.models import Employee, EmployeeScheduleAssignment
from recognition.services import (
    record_checkin_awards, record_checkout_award, current_streak,
    award_streak_achievement, evaluate_periodic_achievements,
)


def _employee_for_user(user):
    try:
        return Employee.objects.select_related("user").get(user=user)
    except Employee.DoesNotExist as exc:
        raise PermissionDenied("Your account is not linked to an employee profile.") from exc


def _zone(schedule):
    try:
        return ZoneInfo(schedule.timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValidationError({"schedule": f"Invalid schedule timezone: {schedule.timezone}"}) from exc


def _assignment_for_now(employee, now=None):
    now = now or timezone.now()
    app_date = timezone.localdate(now)
    candidates = (
        EmployeeScheduleAssignment.objects
        .filter(employee=employee, effective_from__lte=app_date + timedelta(days=1))
        .filter(Q(effective_until__isnull=True) | Q(effective_until__gte=app_date - timedelta(days=1)))
        .select_related("work_schedule", "work_schedule__break_policy")
        .order_by("-effective_from", "-id")
    )
    for assignment in candidates:
        local_date = now.astimezone(_zone(assignment.work_schedule)).date()
        if assignment.effective_from <= local_date and (
            assignment.effective_until is None or local_date <= assignment.effective_until
        ):
            return assignment, local_date
    return None, None


def _local_datetime(day, clock, zone):
    return datetime.combine(day, clock).replace(tzinfo=zone)


def _is_workday(schedule, day):
    weekdays = ("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")
    return weekdays[day.weekday()] in schedule.workdays


def _open_record(employee):
    return (
        AttendanceRecord.objects.filter(employee=employee, check_out__isnull=True)
        .select_related("schedule", "schedule__break_policy", "employee")
        .order_by("-check_in").first()
    )


def _record_query():
    return AttendanceRecord.objects.select_related(
        "employee", "schedule", "schedule__break_policy"
    ).prefetch_related("break_sessions__rule")


def _record_exception(employee, record, exception_type, reason, break_session=None):
    return AttendanceException.objects.create(
        employee=employee, attendance=record, break_session=break_session,
        exception_type=exception_type, reason=reason,
    )


class MyAttendanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _employee_for_user(request.user)
        record = _open_record(employee)
        if record is None:
            assignment, work_date = _assignment_for_now(employee)
            if assignment is not None:
                record = _record_query().filter(employee=employee, work_date=work_date).first()
        if record is None:
            return Response({"attendance": None, "detail": "No attendance record for the current shift yet."})
        return Response({"attendance": AttendanceRecordSerializer(record).data})


class CheckInView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        employee = _employee_for_user(request.user)
        now = timezone.now()
        if _open_record(employee):
            raise ValidationError("You already have an open attendance session. Check out first.")
        assignment, work_date = _assignment_for_now(employee, now)
        if assignment is None:
            raise ValidationError("No work schedule is assigned to you for the current date. Contact HR.")
        schedule = assignment.work_schedule
        if not schedule.is_active or not schedule.break_policy.is_active:
            raise ValidationError("Your assigned schedule or break policy is inactive. Contact HR.")
        if not _is_workday(schedule, work_date):
            raise ValidationError("Today is not a configured workday for your assigned schedule.")
        if AttendanceRecord.objects.filter(employee=employee, work_date=work_date).exists():
            raise ValidationError("Attendance has already been recorded for this workday.")

        try:
            record = AttendanceRecord.objects.create(
                employee=employee, work_date=work_date, schedule=schedule,
                check_in=now, status=AttendanceRecord.Status.OPEN,
            )
        except IntegrityError as exc:
            raise ValidationError("Attendance has already been recorded for this workday.") from exc

        local_now = now.astimezone(_zone(schedule))
        shift_start = _local_datetime(work_date, schedule.start_time, _zone(schedule))
        allowed_until = shift_start + timedelta(minutes=schedule.late_grace_minutes)
        if local_now > allowed_until:
            minutes_late = int((local_now - shift_start).total_seconds() // 60)
            _record_exception(
                employee, record, AttendanceException.ExceptionType.LATE_ARRIVAL,
                f"Check-in was {minutes_late} minute(s) after scheduled shift start; "
                f"grace period is {schedule.late_grace_minutes} minute(s).",
            )
        record_checkin_awards(record)
        record_audit_event(
            action=AuditEvent.Action.ATTENDANCE_CHECKED_IN, actor=request.user,
            subject_user=request.user, subject_email=request.user.email,
            object_type="attendance", object_id=record.pk,
            metadata={"work_date": work_date.isoformat()},
        )
        return Response({"attendance": AttendanceRecordSerializer(record).data}, status=status.HTTP_201_CREATED)


class CheckOutView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        employee = _employee_for_user(request.user)
        record = _open_record(employee)
        if record is None:
            raise ValidationError("No open attendance session was found. Check in first.")
        if BreakSession.objects.filter(attendance=record, ended_at__isnull=True).exists():
            raise ValidationError("End your active break before checking out.")
        now = timezone.now()
        if now < record.check_in:
            raise ValidationError("Checkout time cannot be before check-in.")
        record.check_out = now
        record.status = AttendanceRecord.Status.CLOSED
        record.save(update_fields=["check_out", "status", "updated_at"])
        record_checkout_award(record)
        award_streak_achievement(request.user, current_streak(request.user), now=now)
        evaluate_periodic_achievements(employee, today=record.work_date)
        record_audit_event(
            action=AuditEvent.Action.ATTENDANCE_CHECKED_OUT, actor=request.user,
            subject_user=request.user, subject_email=request.user.email,
            object_type="attendance", object_id=record.pk,
            metadata={"work_date": record.work_date.isoformat()},
        )
        return Response({"attendance": AttendanceRecordSerializer(record).data})


class BreakStartView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        employee = _employee_for_user(request.user)
        record = _open_record(employee)
        if record is None:
            raise ValidationError("Check in before starting a break.")
        if BreakSession.objects.filter(attendance=record, ended_at__isnull=True).exists():
            raise ValidationError("A break is already active. End it before starting another.")
        break_type = request.data.get("break_type")
        valid_types = {choice.value for choice in BreakPolicyRule.BreakType}
        if break_type not in valid_types:
            raise ValidationError({"break_type": f"Choose one of: {', '.join(sorted(valid_types))}."})
        rule = BreakPolicyRule.objects.filter(
            policy=record.schedule.break_policy, break_type=break_type, is_active=True
        ).first()
        if rule is None:
            raise ValidationError("No active rule exists for this break type in your assigned policy.")
        now = timezone.now()
        session = BreakSession.objects.create(attendance=record, rule=rule, started_at=now)
        local_time = now.astimezone(_zone(record.schedule)).time().replace(tzinfo=None)
        if not (rule.allowed_start_time <= local_time < rule.allowed_end_time):
            _record_exception(
                employee, record, AttendanceException.ExceptionType.BREAK_OUTSIDE_WINDOW,
                f"{rule.get_break_type_display()} started at {local_time.strftime('%H:%M')}, "
                f"outside the permitted window {rule.allowed_start_time.strftime('%H:%M')}–"
                f"{rule.allowed_end_time.strftime('%H:%M')}.", break_session=session,
            )
        return Response({
            "break": {"id": session.pk, "break_type": rule.break_type, "started_at": session.started_at,
                      "ended_at": session.ended_at},
            "detail": "Break started. Policy deviations are recorded for review.",
        }, status=status.HTTP_201_CREATED)


class BreakEndView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        employee = _employee_for_user(request.user)
        record = _open_record(employee)
        if record is None:
            raise ValidationError("No open attendance session was found.")
        session = BreakSession.objects.filter(
            attendance=record, ended_at__isnull=True
        ).select_related("rule", "rule__policy").first()
        if session is None:
            raise ValidationError("No active break was found.")
        now = timezone.now()
        session.ended_at = now
        session.save(update_fields=["ended_at"])
        seconds = session.duration_seconds or 0
        actual_minutes = seconds / 60
        expected = session.rule.duration_minutes
        mode = session.rule.duration_mode
        violation = (
            (mode == BreakPolicyRule.DurationMode.FIXED and abs(actual_minutes - expected) > 1)
            or (mode == BreakPolicyRule.DurationMode.MINIMUM and actual_minutes < expected)
            or (mode == BreakPolicyRule.DurationMode.MAXIMUM and actual_minutes > expected)
        )
        if violation:
            _record_exception(
                employee, record, AttendanceException.ExceptionType.BREAK_DURATION,
                f"{session.rule.get_break_type_display()} lasted {actual_minutes:.1f} minute(s); "
                f"configured rule is {mode.lower()} {expected} minute(s).",
                break_session=session,
            )
        return Response({
            "break": {"id": session.pk, "break_type": session.rule.break_type,
                      "started_at": session.started_at, "ended_at": session.ended_at,
                      "duration_seconds": seconds},
            "policy_violation_recorded": bool(violation),
        })


class MyAttendanceHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _employee_for_user(request.user)
        records = _record_query().filter(employee=employee).order_by("-work_date")[:90]
        return Response(AttendanceRecordSerializer(records, many=True).data)


class AttendanceExceptionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.is_superuser or request.user.role in {User.Role.ADMIN, User.Role.HR}:
            exceptions = AttendanceException.objects.select_related("employee", "reviewed_by").all()
        else:
            employee = _employee_for_user(request.user)
            exceptions = AttendanceException.objects.filter(employee=employee).select_related("employee", "reviewed_by")
        status_filter = request.query_params.get("status")
        if status_filter in {choice.value for choice in AttendanceException.ReviewStatus}:
            exceptions = exceptions.filter(review_status=status_filter)
        return Response(AttendanceExceptionSerializer(exceptions[:200], many=True).data)

    @transaction.atomic
    def post(self, request):
        employee = _employee_for_user(request.user)
        serializer = AttendanceExceptionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = None
        attendance_id = serializer.validated_data.get("attendance_id")
        if attendance_id is not None:
            record = AttendanceRecord.objects.filter(pk=attendance_id, employee=employee).first()
            if record is None:
                raise NotFound("Attendance record not found for your employee profile.")
        exception = AttendanceException.objects.create(
            employee=employee, attendance=record,
            exception_type=serializer.validated_data["exception_type"],
            reason=serializer.validated_data["reason"],
        )
        record_audit_event(
            action=AuditEvent.Action.ATTENDANCE_EXCEPTION_SUBMITTED, actor=request.user,
            subject_user=employee.user, subject_email=employee.user.email,
            object_type="attendance_exception", object_id=exception.pk,
            metadata={"exception_type": exception.exception_type},
        )
        return Response(AttendanceExceptionSerializer(exception).data, status=status.HTTP_201_CREATED)


class AttendanceExceptionReviewView(APIView):
    permission_classes = [IsAuthenticated, IsHROrAdmin]

    @transaction.atomic
    def patch(self, request, pk):
        exception = (
            AttendanceException.objects
            .select_for_update()
            .select_related("employee")
            .filter(pk=pk)
            .first()
        )

        if exception is None:
            raise NotFound("Attendance exception not found.")

        # HR/Admin may review exceptions, but never their own.
        if exception.employee.user_id == request.user.pk:
            raise PermissionDenied(
                "You cannot review your own attendance exception."
            )

        if exception.review_status != AttendanceException.ReviewStatus.PENDING:
            raise ValidationError(
                "This exception has already been reviewed."
            )

        serializer = AttendanceExceptionReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        exception.review_status = serializer.validated_data["review_status"]
        exception.review_comment = (
            serializer.validated_data.get("review_comment", "").strip()
        )
        exception.reviewed_by = request.user
        exception.reviewed_at = timezone.now()

        exception.save(
            update_fields=[
                "review_status",
                "review_comment",
                "reviewed_by",
                "reviewed_at",
            ]
        )

        record_audit_event(
            action=AuditEvent.Action.ATTENDANCE_EXCEPTION_REVIEWED,
            actor=request.user,
            subject_user=exception.employee.user,
            subject_email=(
                exception.employee.user.email
                if exception.employee.user_id
                else ""
            ),
            object_type="attendance_exception",
            object_id=exception.pk,
            metadata={"review_status": exception.review_status},
        )

        return Response(AttendanceExceptionSerializer(exception).data)