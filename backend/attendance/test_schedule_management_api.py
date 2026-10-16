from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from attendance.models import BreakPolicy, BreakPolicyRule
from employees.models import Employee, EmployeeScheduleAssignment, WorkSchedule
from organization.models import Department, Designation


class ScheduleManagementApiTests(APITestCase):
    def setUp(self):
        self.hr = User.objects.create_user(
            email="schedule-hr@example.test",
            password="StrongTestPass!2026",
            first_name="Schedule",
            last_name="HR",
            role=User.Role.HR,
        )
        self.employee_user = User.objects.create_user(
            email="schedule-employee@example.test",
            password="StrongTestPass!2026",
            first_name="Schedule",
            last_name="Employee",
            role=User.Role.EMPLOYEE,
        )
        self.department = Department.objects.create(name="Schedule Engineering", code="SCH")
        self.designation = Designation.objects.create(title="Schedule Engineer")
        self.policy = BreakPolicy.objects.create(code="SCH", name="Schedule test policy")
        BreakPolicyRule.objects.create(
            policy=self.policy,
            break_type=BreakPolicyRule.BreakType.LUNCH,
            allowed_start_time="12:00",
            allowed_end_time="14:00",
            duration_minutes=30,
            duration_mode=BreakPolicyRule.DurationMode.FIXED,
        )
        self.schedule = WorkSchedule.objects.create(
            name="Schedule management test",
            start_time="09:00",
            end_time="18:00",
            workdays=["MON", "TUE", "WED", "THU", "FRI"],
            timezone="Asia/Kolkata",
            break_policy=self.policy,
            late_grace_minutes=5,
        )
        self.employee = Employee.objects.create(
            user=self.employee_user,
            employee_code="SCH0001",
            official_email=self.employee_user.email,
            first_name="Schedule",
            last_name="Employee",
            department=self.department,
            designation=self.designation,
            date_of_joining=timezone.localdate() - timedelta(days=60),
            employment_status=Employee.EmploymentStatus.ACTIVE,
        )
        self.today = timezone.localdate()
        self.assignment = EmployeeScheduleAssignment.objects.create(
            employee=self.employee,
            work_schedule=self.schedule,
            effective_from=self.today - timedelta(days=30),
        )
        self.client.force_authenticate(self.hr)

    def test_hr_can_list_active_schedules(self):
        response = self.client.get("/api/attendance/schedules/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(any(item["id"] == self.schedule.pk for item in response.data))

    def test_employee_cannot_list_schedules_or_assignments(self):
        self.client.force_authenticate(self.employee_user)
        self.assertEqual(self.client.get("/api/attendance/schedules/").status_code, 403)
        self.assertEqual(self.client.get("/api/attendance/assignments/").status_code, 403)

    def test_create_assignment_after_closing_previous_range(self):
        self.assignment.effective_until = self.today - timedelta(days=1)
        self.assignment.save(update_fields=["effective_until"])
        response = self.client.post(
            "/api/attendance/assignments/",
            {
                "employee_id": self.employee.pk,
                "work_schedule_id": self.schedule.pk,
                "effective_from": self.today.isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["employee_id"], self.employee.pk)
        self.assertEqual(response.data["effective_from"], self.today.isoformat())
        self.assertIsNone(response.data["effective_until"])

    def test_overlapping_assignment_is_rejected(self):
        response = self.client.post(
            "/api/attendance/assignments/",
            {
                "employee_id": self.employee.pk,
                "work_schedule_id": self.schedule.pk,
                "effective_from": self.today.isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("effective_from", response.data)

    def test_inactive_schedule_cannot_be_assigned(self):
        inactive = WorkSchedule.objects.create(
            name="Inactive schedule management test",
            start_time="09:00",
            end_time="18:00",
            workdays=["MON", "TUE", "WED", "THU", "FRI"],
            timezone="Asia/Kolkata",
            break_policy=self.policy,
            late_grace_minutes=5,
            is_active=False,
        )
        self.assignment.effective_until = self.today - timedelta(days=1)
        self.assignment.save(update_fields=["effective_until"])
        response = self.client.post(
            "/api/attendance/assignments/",
            {
                "employee_id": self.employee.pk,
                "work_schedule_id": inactive.pk,
                "effective_from": self.today.isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("work_schedule_id", response.data)

    def test_exited_employee_cannot_receive_new_assignment(self):
        self.employee.employment_status = Employee.EmploymentStatus.EXITED
        self.employee.date_of_exit = self.today - timedelta(days=1)
        self.employee.save(update_fields=["employment_status", "date_of_exit"])
        self.assignment.effective_until = self.today - timedelta(days=1)
        self.assignment.save(update_fields=["effective_until"])
        response = self.client.post(
            "/api/attendance/assignments/",
            {
                "employee_id": self.employee.pk,
                "work_schedule_id": self.schedule.pk,
                "effective_from": self.today.isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_assignment_list_filters_by_employee_and_effective_date(self):
        response = self.client.get(
            "/api/attendance/assignments/",
            {"employee_id": self.employee.pk, "effective_on": self.today.isoformat()},
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.assignment.pk)

    def test_hr_can_end_assignment_without_deleting_history(self):
        end_date = self.today
        response = self.client.patch(
            f"/api/attendance/assignments/{self.assignment.pk}/",
            {"effective_until": end_date.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.effective_until, end_date)

    def test_end_date_cannot_overlap_a_later_assignment(self):
        next_day = self.today + timedelta(days=1)
        self.assignment.effective_until = self.today
        self.assignment.save(update_fields=["effective_until"])
        later = EmployeeScheduleAssignment.objects.create(
            employee=self.employee,
            work_schedule=self.schedule,
            effective_from=next_day,
        )
        response = self.client.patch(
            f"/api/attendance/assignments/{self.assignment.pk}/",
            {"effective_until": next_day.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, 400, response.data)
        later.refresh_from_db()
        self.assertIsNone(later.effective_until)

    def test_invalid_effective_date_filter_is_rejected(self):
        response = self.client.get("/api/attendance/assignments/?effective_on=not-a-date")
        self.assertEqual(response.status_code, 400)
