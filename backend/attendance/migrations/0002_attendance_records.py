# Day 3 attendance and exception workflow tables.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("attendance", "0001_initial"),
        ("employees", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AttendanceRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("work_date", models.DateField(db_index=True)),
                ("check_in", models.DateTimeField()),
                ("check_out", models.DateTimeField(blank=True, null=True)),
                ("status", models.CharField(choices=[("OPEN", "Open"), ("CLOSED", "Closed")], default="OPEN", max_length=10)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="attendance_records", to="employees.employee")),
                ("schedule", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="attendance_records", to="employees.workschedule")),
            ],
            options={"ordering": ["-work_date", "-check_in"], "indexes": [models.Index(fields=["employee", "work_date"], name="att_emp_date_idx")],
                     "constraints": [models.UniqueConstraint(fields=("employee", "work_date"), name="uniq_attendance_employee_day"),
                                     models.CheckConstraint(condition=models.Q(("check_out__isnull", True), ("check_out__gte", models.F("check_in")), _connector="OR"), name="attendance_checkout_after_checkin")]},
        ),
        migrations.CreateModel(
            name="BreakSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("started_at", models.DateTimeField()),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("attendance", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="break_sessions", to="attendance.attendancerecord")),
                ("rule", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="sessions", to="attendance.breakpolicyrule")),
            ],
            options={"ordering": ["started_at"], "indexes": [models.Index(fields=["attendance", "started_at"], name="break_att_start_idx")],
                     "constraints": [models.CheckConstraint(condition=models.Q(("ended_at__isnull", True), ("ended_at__gte", models.F("started_at")), _connector="OR"), name="break_end_after_start")]},
        ),
        migrations.CreateModel(
            name="AttendanceException",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("exception_type", models.CharField(choices=[("MISSED_CHECK_IN", "Missed check-in"), ("MISSED_CHECK_OUT", "Missed check-out"), ("LATE_ARRIVAL", "Late arrival"), ("BREAK_OUTSIDE_WINDOW", "Break outside allowed window"), ("BREAK_DURATION", "Break duration violation"), ("OTHER", "Other")], max_length=30)),
                ("reason", models.TextField()),
                ("review_status", models.CharField(choices=[("PENDING", "Pending review"), ("APPROVED", "Approved"), ("REJECTED", "Rejected")], db_index=True, default="PENDING", max_length=10)),
                ("review_comment", models.TextField(blank=True)),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("submitted_at", models.DateTimeField(auto_now_add=True)),
                ("attendance", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="exceptions", to="attendance.attendancerecord")),
                ("break_session", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="exceptions", to="attendance.breaksession")),
                ("employee", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="attendance_exceptions", to="employees.employee")),
                ("reviewed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reviewed_attendance_exceptions", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-submitted_at"], "indexes": [models.Index(fields=["employee", "review_status"], name="att_exc_emp_status_idx"),
                                                                     models.Index(fields=["exception_type", "submitted_at"], name="att_exc_type_date_idx")]},
        ),
    ]
