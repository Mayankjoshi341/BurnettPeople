
from datetime import date, datetime, timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q

from attendance.models import BreakPolicy
from organization.models import Department, Designation, WorkLocation


VALID_WORKDAYS = {
    "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"
}


def default_workdays():
    return ["MON", "TUE", "WED", "THU", "FRI"]


def validate_workdays(value):
    if not isinstance(value, list) or not value:
        raise ValidationError("At least one workday is required.")

    if any(
        not isinstance(day, str) or day not in VALID_WORKDAYS
        for day in value
    ):
        raise ValidationError("Invalid weekday value.")

    if len(value) != len(set(value)):
        raise ValidationError("Workdays cannot contain duplicates.")


class WorkSchedule(models.Model):
    name = models.CharField(max_length=100, unique=True)

    start_time = models.TimeField()
    end_time = models.TimeField()

    workdays = models.JSONField(
        default=default_workdays,
        validators=[validate_workdays],
    )

    timezone = models.CharField(
        max_length=50,
        default="Asia/Kolkata",
    )

    break_policy = models.ForeignKey(
        BreakPolicy,
        on_delete=models.PROTECT,
        related_name="work_schedules",
    )

    # Applies to late-arrival calculation, not early checkout.
    late_grace_minutes = models.PositiveSmallIntegerField(default=5)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def scheduled_duration(self):
        """Return scheduled duration, including overnight shifts."""
        start = datetime.combine(date.min, self.start_time)
        end = datetime.combine(date.min, self.end_time)

        if end <= start:
            end += timedelta(days=1)

        return end - start

    def __str__(self):
        return self.name


class Employee(models.Model):
    class EmploymentType(models.TextChoices):
        FULL_TIME = "FULL_TIME", "Full-time"
        PART_TIME = "PART_TIME", "Part-time"
        INTERN = "INTERN", "Intern"
        CONTRACT = "CONTRACT", "Contract"

    class EmploymentStatus(models.TextChoices):
        PREBOARDING = "PREBOARDING", "Preboarding"
        ACTIVE = "ACTIVE", "Active"
        NOTICE_PERIOD = "NOTICE_PERIOD", "Notice period"
        EXITED = "EXITED", "Exited"

    # Nullable to support employee records without portal accounts.
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employee_profile",
    )

    employee_code = models.CharField(max_length=30, unique=True)
    official_email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)

    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="employees",
    )

    designation = models.ForeignKey(
        Designation,
        on_delete=models.PROTECT,
        related_name="employees",
    )

    manager = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="direct_reports",
    )

    work_location = models.ForeignKey(
        WorkLocation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="employees",
    )

    employment_type = models.CharField(
        max_length=20,
        choices=EmploymentType.choices,
        default=EmploymentType.FULL_TIME,
    )

    employment_status = models.CharField(
        max_length=20,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.PREBOARDING,
    )

    date_of_joining = models.DateField()
    date_of_exit = models.DateField(null=True, blank=True)
    phone_number = models.CharField(max_length=30, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_employee_profiles",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["employee_code"]
        indexes = [
            models.Index(
                fields=["department", "employment_status"],
                name="emp_dept_status_idx",
            ),
        ]

    def clean(self):
        super().clean()

        if (
            self.date_of_exit
            and self.date_of_joining
            and self.date_of_exit < self.date_of_joining
        ):
            raise ValidationError(
                {"date_of_exit": "Exit date cannot precede joining date."}
            )

        if self.manager_id and self.pk == self.manager_id:
            raise ValidationError(
                {"manager": "An employee cannot manage themselves."}
            )

    def __str__(self):
        return f"{self.employee_code} - {self.first_name} {self.last_name}"


class EmployeeScheduleAssignment(models.Model):
    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="schedule_assignments",
    )

    work_schedule = models.ForeignKey(
        WorkSchedule,
        on_delete=models.PROTECT,
        related_name="employee_assignments",
    )

    effective_from = models.DateField()
    effective_until = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-effective_from", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "effective_from"],
                name="uniq_emp_schedule_start",
            ),
            models.UniqueConstraint(
                fields=["employee"],
                condition=Q(effective_until__isnull=True),
                name="uniq_open_schedule_per_emp",
            ),
            models.CheckConstraint(
                condition=(
                    Q(effective_until__isnull=True)
                    | Q(effective_until__gte=F("effective_from"))
                ),
                name="emp_schedule_valid_dates",
            ),
        ]

    def clean(self):
        super().clean()

        if (
            self.effective_from
            and self.effective_until
            and self.effective_until < self.effective_from
        ):
            raise ValidationError(
                {"effective_until": "End date cannot precede start date."}
            )

    def __str__(self):
        return (
            f"{self.employee.employee_code} - "
            f"{self.work_schedule.name} from {self.effective_from}"
        )
