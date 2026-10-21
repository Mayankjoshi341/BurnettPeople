# Generated for the Day 4 HR workflow implementation.
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("accounts", "0008_alter_auditevent_action_employment_status_changed"),
        ("employees", "0001_initial"),
    ]
    operations = [
        migrations.CreateModel(
            name="Asset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("asset_tag", models.CharField(max_length=50, unique=True)),
                ("name", models.CharField(max_length=120)),
                ("category", models.CharField(choices=[("LAPTOP", "Laptop"), ("DESKTOP", "Desktop"), ("PHONE", "Phone"), ("TABLET", "Tablet"), ("ACCESSORY", "Accessory"), ("OTHER", "Other")], default="LAPTOP", max_length=20)),
                ("manufacturer", models.CharField(blank=True, max_length=100)),
                ("model", models.CharField(blank=True, max_length=100)),
                ("serial_number", models.CharField(blank=True, default="", max_length=120)),
                ("status", models.CharField(choices=[("AVAILABLE", "Available"), ("ASSIGNED", "Assigned"), ("REPAIR", "In repair"), ("RETIRED", "Retired")], default="AVAILABLE", max_length=12)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="registered_assets", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["asset_tag", "id"]},
        ),
        migrations.CreateModel(
            name="CompanyHoliday",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField(unique=True)),
                ("name", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_company_holidays", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["date", "name"]},
        ),
        migrations.CreateModel(
            name="LeaveType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=30, unique=True)),
                ("name", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True)),
                ("is_paid", models.BooleanField(default=True)),
                ("max_consecutive_days", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["name", "id"]},
        ),
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("LEAVE_SUBMITTED", "Leave submitted"), ("LEAVE_APPROVED", "Leave approved"), ("LEAVE_REJECTED", "Leave rejected"), ("LEAVE_CANCELLED", "Leave cancelled"), ("ASSET_ASSIGNED", "Asset assigned"), ("ASSET_RETURNED", "Asset returned")], max_length=24)),
                ("title", models.CharField(max_length=160)),
                ("message", models.TextField()),
                ("target_type", models.CharField(blank=True, max_length=40)),
                ("target_id", models.CharField(blank=True, max_length=40)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("recipient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="hr_notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.CreateModel(
            name="LeaveBalance",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("year", models.PositiveSmallIntegerField()),
                ("entitled_days", models.PositiveSmallIntegerField()),
                ("used_days", models.PositiveSmallIntegerField(default=0)),
                ("reserved_days", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="leave_balances", to="employees.employee")),
                ("leave_type", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="balances", to="hr_operations.leavetype")),
            ],
            options={"ordering": ["year", "leave_type__name", "employee__employee_code"]},
        ),
        migrations.CreateModel(
            name="LeaveRequest",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                ("days_count", models.PositiveSmallIntegerField()),
                ("reason", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("PENDING", "Pending"), ("APPROVED", "Approved"), ("REJECTED", "Rejected"), ("CANCELLED", "Cancelled")], default="PENDING", max_length=12)),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                ("decided_at", models.DateTimeField(blank=True, null=True)),
                ("decision_comment", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("decided_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="decided_leave_requests", to=settings.AUTH_USER_MODEL)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="leave_requests", to="employees.employee")),
                ("leave_type", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="requests", to="hr_operations.leavetype")),
            ],
            options={"ordering": ["-submitted_at", "-id"]},
        ),
        migrations.CreateModel(
            name="AssetAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("assigned_at", models.DateTimeField(auto_now_add=True)),
                ("condition_on_assignment", models.CharField(blank=True, max_length=250)),
                ("returned_at", models.DateTimeField(blank=True, null=True)),
                ("condition_on_return", models.CharField(blank=True, max_length=250)),
                ("notes", models.TextField(blank=True)),
                ("asset", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="assignments", to="hr_operations.asset")),
                ("assigned_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="asset_assignments_created", to=settings.AUTH_USER_MODEL)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="asset_assignments", to="employees.employee")),
                ("returned_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="asset_assignments_returned", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-assigned_at", "-id"]},
        ),
        migrations.CreateModel(
            name="LeaveRequestAllocation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("days_count", models.PositiveSmallIntegerField()),
                ("balance", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="allocations", to="hr_operations.leavebalance")),
                ("leave_request", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="allocations", to="hr_operations.leaverequest")),
            ],
        ),
        migrations.AddConstraint(
            model_name="leavebalance",
            constraint=models.UniqueConstraint(fields=("employee", "leave_type", "year"), name="uniq_leave_balance_employee_type_year"),
        ),
        migrations.AddConstraint(
            model_name="leavebalance",
            constraint=models.CheckConstraint(condition=models.Q(entitled_days__gte=models.F("used_days") + models.F("reserved_days")), name="leave_balance_within_entitlement"),
        ),
        migrations.AddIndex(
            model_name="leavebalance",
            index=models.Index(fields=["employee", "year"], name="leave_bal_emp_year_idx"),
        ),
        migrations.AddConstraint(
            model_name="leaverequest",
            constraint=models.CheckConstraint(condition=models.Q(("end_date__gte", models.F("start_date"))), name="leave_request_end_on_or_after_start"),
        ),
        migrations.AddConstraint(
            model_name="leaverequest",
            constraint=models.CheckConstraint(condition=models.Q(("days_count__gt", 0)), name="leave_request_days_positive"),
        ),
        migrations.AddIndex(
            model_name="leaverequest",
            index=models.Index(fields=["employee", "status", "start_date"], name="leave_emp_status_start_idx"),
        ),
        migrations.AddIndex(
            model_name="leaverequest",
            index=models.Index(fields=["status", "submitted_at"], name="leave_status_submitted_idx"),
        ),
        migrations.AddConstraint(
            model_name="leaverequestallocation",
            constraint=models.UniqueConstraint(fields=("leave_request", "balance"), name="uniq_leave_request_balance_allocation"),
        ),
        migrations.AddConstraint(
            model_name="leaverequestallocation",
            constraint=models.CheckConstraint(condition=models.Q(("days_count__gt", 0)), name="leave_allocation_days_positive"),
        ),
        migrations.AddConstraint(
            model_name="asset",
            constraint=models.UniqueConstraint(condition=models.Q(("serial_number", ""), _negated=True), fields=("serial_number",), name="uniq_nonempty_asset_serial"),
        ),
        migrations.AddIndex(
            model_name="asset",
            index=models.Index(fields=["status", "category"], name="asset_status_category_idx"),
        ),
        migrations.AddConstraint(
            model_name="assetassignment",
            constraint=models.UniqueConstraint(condition=models.Q(("returned_at__isnull", True)), fields=("asset",), name="uniq_active_assignment_per_asset"),
        ),
        migrations.AddConstraint(
            model_name="assetassignment",
            constraint=models.CheckConstraint(condition=models.Q(("returned_at__isnull", True), ("returned_at__gte", models.F("assigned_at")), _connector="OR"), name="asset_return_after_assignment"),
        ),
        migrations.AddIndex(
            model_name="assetassignment",
            index=models.Index(fields=["employee", "assigned_at"], name="asset_assign_emp_date_idx"),
        ),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["recipient", "read_at", "created_at"], name="notif_recipient_read_idx"),
        ),
    ]
