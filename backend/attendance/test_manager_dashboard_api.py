from datetime import date, timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from attendance.models import AttendanceRecord, BreakPolicy
from employees.models import Employee, WorkSchedule
from organization.models import Department, Designation


class ManagerDashboardApiTests(APITestCase):
    def setUp(self):
        self.manager_user = User.objects.create_user(
            email="manager-api@example.test", password="StrongTestPass!2026",
            first_name="Team", last_name="Manager", role=User.Role.MANAGER,
        )
        self.other_manager_user = User.objects.create_user(
            email="other-manager-api@example.test", password="StrongTestPass!2026",
            first_name="Other", last_name="Manager", role=User.Role.MANAGER,
        )
        self.hr_user = User.objects.create_user(
            email="manager-api-hr@example.test", password="StrongTestPass!2026",
            first_name="HR", last_name="User", role=User.Role.HR,
        )
        self.department = Department.objects.create(name="Manager API", code="MGRAPI")
        self.designation = Designation.objects.create(title="Manager API Engineer")
        self.manager = self._employee(self.manager_user, "MGR001", "Manager", "One")
        other_manager = self._employee(self.other_manager_user, "MGR002", "Other", "Manager")
        self.report = self._employee(User.objects.create_user(
            email="direct-api@example.test", password="StrongTestPass!2026",
            first_name="Direct", last_name="Report", role=User.Role.EMPLOYEE,
        ), "MGR003", "Direct", "Report", manager=self.manager)
        self._employee(User.objects.create_user(
            email="outside-api@example.test", password="StrongTestPass!2026",
            first_name="Outside", last_name="Report", role=User.Role.EMPLOYEE,
        ), "MGR004", "Outside", "Report", manager=other_manager)
        self.schedule = WorkSchedule.objects.create(
            name="Manager API schedule", start_time="09:00", end_time="18:00",
            workdays=["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            break_policy=BreakPolicy.objects.create(code="MGRAPI", name="Manager API policy"),
        )
        now = timezone.now()
        AttendanceRecord.objects.create(
            employee=self.report, schedule=self.schedule, work_date=timezone.localdate(),
            check_in=now - timedelta(minutes=30), status=AttendanceRecord.Status.OPEN,
        )

    def _employee(self, user, code, first, last, manager=None):
        return Employee.objects.create(
            user=user, employee_code=code, official_email=user.email,
            first_name=first, last_name=last, department=self.department,
            designation=self.designation, manager=manager,
            employment_status=Employee.EmploymentStatus.ACTIVE,
            date_of_joining=timezone.localdate() - timedelta(days=30),
        )

    def test_manager_dashboard_contains_only_direct_reports_and_real_attendance(self):
        self.client.force_authenticate(self.manager_user)
        response = self.client.get("/api/attendance/manager-dashboard/")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row["id"] for row in response.data["team"]], [self.report.pk])
        self.assertEqual(response.data["team"][0]["status"], "Present")
        self.assertEqual(response.data["week"][-1]["present"], 1)
        self.assertNotIn("Outside Report", str(response.data))

    def test_non_manager_cannot_access_manager_dashboard(self):
        self.client.force_authenticate(self.hr_user)
        response = self.client.get("/api/attendance/manager-dashboard/")
        self.assertEqual(response.status_code, 403)

    def test_hr_can_read_admin_metrics_from_persisted_records(self):
        self.client.force_authenticate(self.hr_user)
        response = self.client.get("/api/admin/metrics/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["totals"]["employees"], 4)
        self.assertEqual(response.data["totals"]["activeToday"], 1)
        self.assertEqual(len(response.data["attendance"]), 5)
        self.assertIn("attentionItems", response.data)

    def test_admin_workflow_ranges_accept_only_supported_workday_windows(self):
        self.client.force_authenticate(self.hr_user)
        for days in ("5", "15", "20"):
            response = self.client.get(f"/api/admin/metrics/?working_days={days}")
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(len(response.data["attendanceDates"]), int(days))
            self.assertTrue(all(date.fromisoformat(value).weekday() < 5 for value in response.data["attendanceDates"]))
        self.assertEqual(self.client.get("/api/admin/metrics/?working_days=7").status_code, 400)
