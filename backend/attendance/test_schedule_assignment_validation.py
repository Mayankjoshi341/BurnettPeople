from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from attendance.models import BreakPolicy
from employees.models import Employee, WorkSchedule
from organization.models import Department, Designation


class ScheduleAssignmentDateValidationTests(APITestCase):
    def setUp(self):
        self.hr = User.objects.create_user(
            email="schedule-date-hr@example.test",
            password="StrongTestPass!2026",
            role=User.Role.HR,
        )
        employee_user = User.objects.create_user(
            email="schedule-date-employee@example.test",
            password="StrongTestPass!2026",
            role=User.Role.EMPLOYEE,
        )
        department = Department.objects.create(
            name="Schedule Date Validation", code="SCHDATE"
        )
        designation = Designation.objects.create(title="Schedule Date Engineer")
        self.policy = BreakPolicy.objects.create(
            code="SCHDATE", name="Schedule date validation policy"
        )
        self.schedule = WorkSchedule.objects.create(
            name="Schedule date validation schedule",
            start_time="09:00",
            end_time="18:00",
            workdays=["MON", "TUE", "WED", "THU", "FRI"],
            timezone="Asia/Kolkata",
            break_policy=self.policy,
        )
        today = timezone.localdate()
        self.employee = Employee.objects.create(
            user=employee_user,
            employee_code="SCHDATE001",
            official_email=employee_user.email,
            first_name="Schedule",
            last_name="Date",
            department=department,
            designation=designation,
            date_of_joining=today,
            employment_status=Employee.EmploymentStatus.ACTIVE,
        )
        self.client.force_authenticate(self.hr)

    def test_assignment_cannot_start_before_employee_joining_date(self):
        yesterday = timezone.localdate() - timedelta(days=1)
        response = self.client.post(
            "/api/attendance/assignments/",
            {
                "employee_id": self.employee.pk,
                "work_schedule_id": self.schedule.pk,
                "effective_from": yesterday.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("effective_from", response.data)
        self.assertIn("joining date", str(response.data["effective_from"]).lower())


