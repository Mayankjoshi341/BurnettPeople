
from django.db import models
from django.db.models import F, Q
from django.core.exceptions import ValidationError


class BreakPolicy(models.Model):
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=100)
    version = models.PositiveSmallIntegerField(default=1)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code", "version"]
        constraints = [
            models.UniqueConstraint(
                fields=["code", "version"],
                name="uniq_break_policy_version",
            ),
            models.CheckConstraint(
                condition=Q(version__gte=1),
                name="break_policy_version_positive",
            ),
        ]

    def __str__(self):
        return f"{self.name} (v{self.version})"


class BreakPolicyRule(models.Model):
    class BreakType(models.TextChoices):
        LUNCH = "LUNCH", "Lunch break"
        SHORT_BREAK = "SHORT_BREAK", "Short break"
        OTHER = "OTHER", "Other break"

    class DurationMode(models.TextChoices):
        FIXED = "FIXED", "Fixed duration"
        MINIMUM = "MINIMUM", "Minimum duration"
        MAXIMUM = "MAXIMUM", "Maximum duration"

    policy = models.ForeignKey(
        BreakPolicy,
        on_delete=models.PROTECT,
        related_name="rules",
    )
    break_type = models.CharField(
        max_length=20,
        choices=BreakType.choices,
    )
    allowed_start_time = models.TimeField()
    allowed_end_time = models.TimeField()
    duration_minutes = models.PositiveSmallIntegerField()
    duration_mode = models.CharField(
        max_length=10,
        choices=DurationMode.choices,
        default=DurationMode.FIXED,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["allowed_start_time", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["policy", "break_type"],
                name="uniq_break_type_per_policy",
            ),
            models.CheckConstraint(
                condition=Q(duration_minutes__gt=0),
                name="break_duration_positive",
            ),
            models.CheckConstraint(
                condition=Q(
                    allowed_start_time__lt=F("allowed_end_time")
                ),
                name="break_window_start_before_end",
            ),
        ]

    def clean(self):
        super().clean()

        if (
            self.allowed_start_time is not None
            and self.allowed_end_time is not None
            and self.allowed_start_time >= self.allowed_end_time
        ):
            raise ValidationError(
                "The permitted break window must end after it starts."
            )

    def __str__(self):
        return f"{self.policy.name} - {self.get_break_type_display()}"


# Day 3: operational attendance, break sessions, and reviewable exceptions.
from django.conf import settings


class AttendanceRecord(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        CLOSED = "CLOSED", "Closed"

    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.PROTECT, related_name="attendance_records"
    )
    work_date = models.DateField(db_index=True)
    schedule = models.ForeignKey(
        "employees.WorkSchedule", on_delete=models.PROTECT, related_name="attendance_records"
    )
    check_in = models.DateTimeField()
    check_out = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-work_date", "-check_in"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "work_date"], name="uniq_attendance_employee_day"),
            models.CheckConstraint(
                condition=Q(check_out__isnull=True) | Q(check_out__gte=F("check_in")),
                name="attendance_checkout_after_checkin",
            ),
        ]
        indexes = [models.Index(fields=["employee", "work_date"], name="att_emp_date_idx")]

    def __str__(self):
        return f"{self.employee.employee_code} - {self.work_date}"


class BreakSession(models.Model):
    attendance = models.ForeignKey(
        AttendanceRecord, on_delete=models.CASCADE, related_name="break_sessions"
    )
    rule = models.ForeignKey(
        BreakPolicyRule, on_delete=models.PROTECT, related_name="sessions"
    )
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["started_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(ended_at__isnull=True) | Q(ended_at__gte=F("started_at")),
                name="break_end_after_start",
            ),
        ]
        indexes = [models.Index(fields=["attendance", "started_at"], name="break_att_start_idx")]

    @property
    def duration_seconds(self):
        if self.ended_at is None:
            return None
        return max(0, int((self.ended_at - self.started_at).total_seconds()))

    def __str__(self):
        return f"{self.rule.get_break_type_display()} - attendance {self.attendance_id}"


class AttendanceException(models.Model):
    class ExceptionType(models.TextChoices):
        MISSED_CHECK_IN = "MISSED_CHECK_IN", "Missed check-in"
        MISSED_CHECK_OUT = "MISSED_CHECK_OUT", "Missed check-out"
        LATE_ARRIVAL = "LATE_ARRIVAL", "Late arrival"
        BREAK_OUTSIDE_WINDOW = "BREAK_OUTSIDE_WINDOW", "Break outside allowed window"
        BREAK_DURATION = "BREAK_DURATION", "Break duration violation"
        INCORRECT_HOURS = "INCORRECT_HOURS", "Incorrect work hours"
        OTHER = "OTHER", "Other"

    class ReviewStatus(models.TextChoices):
        PENDING = "PENDING", "Pending review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.PROTECT, related_name="attendance_exceptions"
    )
    attendance = models.ForeignKey(
        AttendanceRecord, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="exceptions",
    )
    break_session = models.ForeignKey(
        BreakSession, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="exceptions",
    )
    exception_type = models.CharField(max_length=30, choices=ExceptionType.choices)
    reason = models.TextField()
    review_status = models.CharField(
        max_length=10, choices=ReviewStatus.choices, default=ReviewStatus.PENDING, db_index=True
    )
    review_comment = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reviewed_attendance_exceptions",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=["employee", "review_status"], name="att_exc_emp_status_idx"),
            models.Index(fields=["exception_type", "submitted_at"], name="att_exc_type_date_idx"),
        ]

    def __str__(self):
        return f"{self.employee.employee_code} - {self.get_exception_type_display()}"
