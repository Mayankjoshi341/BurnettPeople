"""Seed repeatable reference data for local BurnettPeople development.

Safe to run more than once. Does not delete data and does not change existing
passwords. Demo login accounts are created only when --with-demo-accounts is
passed, DEBUG is enabled, and DEV_DEMO_PASSWORD is provided in the environment.
"""

import os
from datetime import time

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from attendance.models import BreakPolicy, BreakPolicyRule
from employees.models import Employee, EmployeeScheduleAssignment, WorkSchedule
from organization.models import Department, Designation, WorkLocation


DEPARTMENTS = [
    ("DEV-ENG", "Engineering", "Development seed data: engineering team."),
    ("DEV-HR", "Human Resources", "Development seed data: people operations."),
    ("DEV-PROD", "Product & Design", "Development seed data: product and UX."),
    ("DEV-OPS", "Operations", "Development seed data: operations team."),
    ("DEV-SALES", "Sales & Marketing", "Development seed data: sales and marketing."),
    ("DEV-SUPPORT", "Customer Support", "Development seed data: customer support."),
]

DESIGNATIONS = [
    ("Software Engineer", "DEV-1"),
    ("Senior Software Engineer", "DEV-2"),
    ("QA Engineer", "DEV-1"),
    ("Product Designer", "DEV-1"),
    ("HR Executive", "DEV-1"),
    ("HR Manager", "DEV-2"),
    ("Operations Executive", "DEV-1"),
    ("Sales Executive", "DEV-1"),
    ("Support Specialist", "DEV-1"),
    ("Engineering Manager", "DEV-3"),
]


class Command(BaseCommand):
    help = "Create repeatable development reference data; optionally seed demo employee and HR accounts."

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-demo-accounts",
            action="store_true",
            help="Also create a linked demo employee, assigned schedule, employee login, and HR login.",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to seed development data because DJANGO_DEBUG is not enabled. "
                "Set DJANGO_DEBUG=True for your local development command only."
            )

        demo_password = None
        if options["with_demo_accounts"]:
            demo_password = os.environ.get("DEV_DEMO_PASSWORD", "").strip()
            if not demo_password:
                raise CommandError(
                    "Set DEV_DEMO_PASSWORD in the environment before using --with-demo-accounts."
                )
            try:
                validate_password(demo_password)
            except Exception as exc:
                raise CommandError(f"DEV_DEMO_PASSWORD does not pass Django password validation: {exc}") from exc

        with transaction.atomic():
            departments = {}
            for code, name, description in DEPARTMENTS:
                department, created = Department.objects.update_or_create(
                    code=code,
                    defaults={"name": name, "description": description, "is_active": True},
                )
                departments[code] = department
                self._report("Department", code, created)

            designations = {}
            for title, grade in DESIGNATIONS:
                designation, created = Designation.objects.update_or_create(
                    title=title,
                    grade=grade,
                    defaults={"is_active": True},
                )
                designations[title] = designation
                self._report("Designation", title, created)

            location, created = WorkLocation.objects.update_or_create(
                name="Indore Development Office",
                defaults={
                    "address": "Development-only sample location; replace with the actual office address.",
                    "timezone": "Asia/Kolkata",
                    "is_active": True,
                },
            )
            self._report("Work location", location.name, created)

            policy, created = BreakPolicy.objects.update_or_create(
                code="DEV-GENERAL",
                version=1,
                defaults={
                    "name": "Development Test Break Policy",
                    "description": "Synthetic break rules for local development testing only.",
                    "is_active": True,
                },
            )
            self._report("Break policy", f"{policy.code} v{policy.version}", created)

            break_rules = [
                {
                    "break_type": BreakPolicyRule.BreakType.LUNCH,
                    "allowed_start_time": time(12, 0),
                    "allowed_end_time": time(15, 0),
                    "duration_minutes": 30,
                    "duration_mode": BreakPolicyRule.DurationMode.FIXED,
                },
                {
                    "break_type": BreakPolicyRule.BreakType.SHORT_BREAK,
                    "allowed_start_time": time(10, 0),
                    "allowed_end_time": time(12, 0),
                    "duration_minutes": 15,
                    "duration_mode": BreakPolicyRule.DurationMode.MAXIMUM,
                },
                {
                    "break_type": BreakPolicyRule.BreakType.OTHER,
                    "allowed_start_time": time(15, 0),
                    "allowed_end_time": time(17, 0),
                    "duration_minutes": 10,
                    "duration_mode": BreakPolicyRule.DurationMode.MAXIMUM,
                },
            ]
            for values in break_rules:
                rule, created = BreakPolicyRule.objects.update_or_create(
                    policy=policy,
                    break_type=values["break_type"],
                    defaults={**values, "is_active": True},
                )
                self._report("Break rule", rule.get_break_type_display(), created)

            schedule, created = WorkSchedule.objects.update_or_create(
                name="DEV - All Days Test Schedule",
                defaults={
                    "start_time": time(9, 0),
                    "end_time": time(18, 0),
                    # All days keeps attendance testing possible regardless of
                    # which day the developer runs the command.
                    "workdays": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
                    "timezone": "Asia/Kolkata",
                    "break_policy": policy,
                    "late_grace_minutes": 5,
                    "is_active": True,
                },
            )
            self._report("Work schedule", schedule.name, created)

            if options["with_demo_accounts"]:
                employee_user = self._get_or_create_demo_user(
                    email="demo.employee@burnettpeople.local",
                    first_name="Dev",
                    last_name="Employee",
                    role=User.Role.EMPLOYEE,
                    password=demo_password,
                )
                hr_user = self._get_or_create_demo_user(
                    email="demo.hr@burnettpeople.local",
                    first_name="Dev",
                    last_name="HR",
                    role=User.Role.HR,
                    password=demo_password,
                )

                linked_employee = Employee.objects.filter(user=employee_user).first()
                employee_by_code = Employee.objects.filter(employee_code="DEV-EMP-001").first()
                email_owner = Employee.objects.filter(official_email=employee_user.email).first()
                if linked_employee and linked_employee.employee_code != "DEV-EMP-001":
                    raise CommandError(
                        f"{employee_user.email} is already linked to employee {linked_employee.employee_code}; "
                        "not changing an existing employee link."
                    )
                if email_owner and email_owner.employee_code != "DEV-EMP-001":
                    raise CommandError(
                        f"{employee_user.email} is already used by employee {email_owner.employee_code}."
                    )
                if employee_by_code and employee_by_code.user_id not in (None, employee_user.id):
                    raise CommandError("DEV-EMP-001 already exists and is linked to a different login.")

                employee, employee_created = Employee.objects.update_or_create(
                    employee_code="DEV-EMP-001",
                    defaults={
                        "user": employee_user,
                        "official_email": employee_user.email,
                        "first_name": "Dev",
                        "last_name": "Employee",
                        "department": departments["DEV-ENG"],
                        "designation": designations["Software Engineer"],
                        "work_location": location,
                        "employment_type": Employee.EmploymentType.FULL_TIME,
                        "employment_status": Employee.EmploymentStatus.ACTIVE,
                        "date_of_joining": timezone.localdate(),
                        "date_of_exit": None,
                        "phone_number": "",
                        "created_by": None,
                    },
                )
                self._report("Demo employee", employee.employee_code, employee_created)

                active_assignment = EmployeeScheduleAssignment.objects.filter(
                    employee=employee,
                    effective_until__isnull=True,
                ).first()
                if active_assignment:
                    if active_assignment.work_schedule_id != schedule.id:
                        active_assignment.work_schedule = schedule
                        active_assignment.save(update_fields=["work_schedule"])
                    self.stdout.write("  ~ Schedule assignment already exists; ensured it uses the DEV schedule.")
                else:
                    today_assignment = EmployeeScheduleAssignment.objects.filter(
                        employee=employee,
                        effective_from=timezone.localdate(),
                    ).first()
                    if today_assignment:
                        today_assignment.work_schedule = schedule
                        today_assignment.effective_until = None
                        today_assignment.save(update_fields=["work_schedule", "effective_until"])
                        self.stdout.write("  ~ Reused today's schedule assignment for the demo employee.")
                    else:
                        EmployeeScheduleAssignment.objects.create(
                            employee=employee,
                            work_schedule=schedule,
                            effective_from=timezone.localdate(),
                        )
                        self.stdout.write("  + Created schedule assignment for the demo employee.")

                self.stdout.write("\nDemo login emails:")
                self.stdout.write("  Employee: demo.employee@burnettpeople.local")
                self.stdout.write("  HR:       demo.hr@burnettpeople.local")
                self.stdout.write("  Password: the value you supplied in DEV_DEMO_PASSWORD (not printed).")

        self.stdout.write(self.style.SUCCESS("\nDevelopment seed completed. No records were deleted."))

    def _get_or_create_demo_user(self, *, email, first_name, last_name, role, password):
        existing = User.objects.filter(email=email).first()
        if existing:
            if existing.role != role:
                raise CommandError(
                    f"{email} already exists with role {existing.role}, expected {role}; leaving it unchanged."
                )
            if not existing.is_active:
                raise CommandError(
                    f"{email} exists but is inactive; activate it explicitly before testing."
                )
            self.stdout.write(f"  = Demo user already exists: {email}; password left unchanged.")
            return existing

        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=role,
            is_active=True,
        )
        self.stdout.write(self.style.SUCCESS(f"  + Created demo user: {email}"))
        return user

    def _report(self, model, key, created):
        symbol = "+" if created else "="
        verb = "created" if created else "exists/updated"
        self.stdout.write(f"  {symbol} {model}: {key} ({verb})")
