from django.conf import settings
from django.db import models
from django.db.models import F, Q


class LeaveType(models.Model):
    """A company-defined category of leave."""

    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_paid = models.BooleanField(default=True)
    max_consecutive_days = models.PositiveSmallIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class CompanyHoliday(models.Model):
    """A company-wide holiday excluded from leave-day calculations."""

    date = models.DateField(unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_company_holidays",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date", "name"]

    def __str__(self):
        return f"{self.date}: {self.name}"


class LeaveBalance(models.Model):
    """Yearly entitlement. Pending requests reserve days; approval consumes them."""

    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.PROTECT, related_name="leave_balances"
    )
    leave_type = models.ForeignKey(
        LeaveType, on_delete=models.PROTECT, related_name="balances"
    )
    year = models.PositiveSmallIntegerField()
    entitled_days = models.PositiveSmallIntegerField()
    used_days = models.PositiveSmallIntegerField(default=0)
    reserved_days = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["year", "leave_type__name", "employee__employee_code"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "leave_type", "year"],
                name="uniq_leave_balance_employee_type_year",
            ),
            models.CheckConstraint(
                condition=Q(entitled_days__gte=F("used_days") + F("reserved_days")),
                name="leave_balance_within_entitlement",
            ),
        ]
        indexes = [
            models.Index(fields=["employee", "year"], name="leave_bal_emp_year_idx"),
        ]

    @property
    def available_days(self):
        return self.entitled_days - self.used_days - self.reserved_days

    def __str__(self):
        return f"{self.employee.employee_code} / {self.leave_type.code} / {self.year}"


class LeaveRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        CANCELLED = "CANCELLED", "Cancelled"

    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.PROTECT, related_name="leave_requests"
    )
    leave_type = models.ForeignKey(
        LeaveType, on_delete=models.PROTECT, related_name="requests"
    )
    start_date = models.DateField()
    end_date = models.DateField()
    days_count = models.PositiveSmallIntegerField()
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    submitted_at = models.DateTimeField(auto_now_add=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="decided_leave_requests",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-submitted_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__gte=F("start_date")),
                name="leave_request_end_on_or_after_start",
            ),
            models.CheckConstraint(condition=Q(days_count__gt=0), name="leave_request_days_positive"),
        ]
        indexes = [
            models.Index(
                fields=["employee", "status", "start_date"],
                name="leave_emp_status_start_idx",
            ),
            models.Index(fields=["status", "submitted_at"], name="leave_status_submitted_idx"),
        ]

    def __str__(self):
        return f"{self.employee.employee_code}: {self.leave_type.code} {self.start_date}–{self.end_date} ({self.status})"


class LeaveRequestAllocation(models.Model):
    """Immutable record of how a request reserves days from each calendar-year balance."""

    leave_request = models.ForeignKey(
        LeaveRequest, on_delete=models.CASCADE, related_name="allocations"
    )
    balance = models.ForeignKey(
        LeaveBalance, on_delete=models.PROTECT, related_name="allocations"
    )
    days_count = models.PositiveSmallIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["leave_request", "balance"], name="uniq_leave_request_balance_allocation"
            ),
            models.CheckConstraint(condition=Q(days_count__gt=0), name="leave_allocation_days_positive"),
        ]


class Asset(models.Model):
    class Category(models.TextChoices):
        LAPTOP = "LAPTOP", "Laptop"
        DESKTOP = "DESKTOP", "Desktop"
        PHONE = "PHONE", "Phone"
        TABLET = "TABLET", "Tablet"
        ACCESSORY = "ACCESSORY", "Accessory"
        OTHER = "OTHER", "Other"

    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        ASSIGNED = "ASSIGNED", "Assigned"
        REPAIR = "REPAIR", "In repair"
        RETIRED = "RETIRED", "Retired"

    asset_tag = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.LAPTOP)
    manufacturer = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=120, blank=True, default="")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.AVAILABLE)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registered_assets",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["asset_tag", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["serial_number"],
                condition=~Q(serial_number=""),
                name="uniq_nonempty_asset_serial",
            ),
        ]
        indexes = [models.Index(fields=["status", "category"], name="asset_status_category_idx")]

    def __str__(self):
        return f"{self.asset_tag} - {self.name}"


class AssetAssignment(models.Model):
    """An assignment row is never deleted; return closes the active assignment."""

    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name="assignments")
    employee = models.ForeignKey(
        "employees.Employee", on_delete=models.PROTECT, related_name="asset_assignments"
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="asset_assignments_created",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    condition_on_assignment = models.CharField(max_length=250, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)
    returned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="asset_assignments_returned",
    )
    condition_on_return = models.CharField(max_length=250, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-assigned_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["asset"],
                condition=Q(returned_at__isnull=True),
                name="uniq_active_assignment_per_asset",
            ),
            models.CheckConstraint(
                condition=Q(returned_at__isnull=True) | Q(returned_at__gte=F("assigned_at")),
                name="asset_return_after_assignment",
            ),
        ]
        indexes = [
            models.Index(fields=["employee", "assigned_at"], name="asset_assign_emp_date_idx"),
        ]

    def __str__(self):
        return f"{self.asset.asset_tag} -> {self.employee.employee_code}"


class Notification(models.Model):
    class Kind(models.TextChoices):
        LEAVE_SUBMITTED = "LEAVE_SUBMITTED", "Leave submitted"
        LEAVE_APPROVED = "LEAVE_APPROVED", "Leave approved"
        LEAVE_REJECTED = "LEAVE_REJECTED", "Leave rejected"
        LEAVE_CANCELLED = "LEAVE_CANCELLED", "Leave cancelled"
        ASSET_ASSIGNED = "ASSET_ASSIGNED", "Asset assigned"
        ASSET_RETURNED = "ASSET_RETURNED", "Asset returned"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="hr_notifications"
    )
    kind = models.CharField(max_length=24, choices=Kind.choices)
    title = models.CharField(max_length=160)
    message = models.TextField()
    target_type = models.CharField(max_length=40, blank=True)
    target_id = models.CharField(max_length=40, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["recipient", "read_at", "created_at"], name="notif_recipient_read_idx"),
        ]

    def __str__(self):
        return f"{self.recipient_id}: {self.title}"
