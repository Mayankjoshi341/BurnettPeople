from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from attendance.models import AttendanceRecord, BreakPolicy, BreakPolicyRule, BreakSession
from employees.models import Employee, EmployeeScheduleAssignment, WorkSchedule
from hr_operations.models import LeaveRequest, LeaveType, RemoteWorkRequest
from organization.models import Department, Designation


class AttendanceOverviewApiTests(APITestCase):
    def setUp(self):
        self.hr = User.objects.create_user(
            email="overview-hr@example.test",
            password="StrongTestPass!2026",
            role=User.Role.HR,
        )
        self.employee_user = User.objects.create_user(
            email="overview-employee@example.test",
            password="StrongTestPass!2026",
            role=User.Role.EMPLOYEE,
        )
        self.department = Department.objects.create(name="Overview Engineering", code="OVW")
        self.designation = Designation.objects.create(title="Overview Engineer")
        self.policy = BreakPolicy.objects.create(code="OVW", name="Overview policy")
        self.lunch_rule = BreakPolicyRule.objects.create(
            policy=self.policy,
            break_type=BreakPolicyRule.BreakType.LUNCH,
            allowed_start_time="00:00",
            allowed_end_time="23:59",
            duration_minutes=30,
            duration_mode=BreakPolicyRule.DurationMode.FIXED,
        )
        BreakPolicyRule.objects.create(
            policy=self.policy,
            break_type=BreakPolicyRule.BreakType.SHORT_BREAK,
            allowed_start_time="00:00",
            allowed_end_time="23:59",
            duration_minutes=20,
            duration_mode=BreakPolicyRule.DurationMode.MAXIMUM,
        )
        self.schedule = WorkSchedule.objects.create(
            name="Overview all-days schedule",
            start_time="00:00",
            end_time="23:59",
            workdays=["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            timezone="Asia/Kolkata",
            break_policy=self.policy,
            late_grace_minutes=5,
        )
        self.today = timezone.localdate()
        self.start_date = self.today - timedelta(days=6)
        self.present = self._employee("Present", "OVW001", self.employee_user)
        self.absent = self._employee("Absent", "OVW002")
        self.on_leave = self._employee("Leave", "OVW003")
        self.wfh = self._employee("Remote", "OVW004")

        self.leave_type = LeaveType.objects.create(code="OVERVIEW-VAC", name="Overview Vacation")
        LeaveRequest.objects.create(
            employee=self.on_leave,
            leave_type=self.leave_type,
            start_date=self.today,
            end_date=self.today,
            days_count=1,
            status=LeaveRequest.Status.APPROVED,
        )
        RemoteWorkRequest.objects.create(
            employee=self.wfh,
            work_date=self.today,
            reason="Overview test",
            status=RemoteWorkRequest.Status.APPROVED,
        )

        now = timezone.now()
        record = AttendanceRecord.objects.create(
            employee=self.present,
            work_date=self.today,
            schedule=self.schedule,
            check_in=now - timedelta(hours=2),
            check_out=now - timedelta(minutes=20),
            status=AttendanceRecord.Status.CLOSED,
        )
        BreakSession.objects.create(
            attendance=record,
            rule=self.lunch_rule,
            started_at=now - timedelta(minutes=90),
            ended_at=now - timedelta(minutes=60),
        )

    def _employee(self, label, code, user=None):
        employee = Employee.objects.create(
            user=user,
            employee_code=code,
            official_email=user.email if user else f"{code.lower()}@example.test",
            first_name=label,
            last_name="Overview",
            department=self.department,
            designation=self.designation,
            employment_status=Employee.EmploymentStatus.ACTIVE,
            date_of_joining=self.today - timedelta(days=30),
        )
        EmployeeScheduleAssignment.objects.create(
            employee=employee,
            work_schedule=self.schedule,
            effective_from=self.today - timedelta(days=30),
        )
        return employee

    def test_hr_receives_real_weekly_summary_and_employee_rows(self):
        self.client.force_authenticate(self.hr)
        response = self.client.get("/api/attendance/overview/")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data["week"]), 7)
        self.assertEqual(response.data["dates"][0], self.start_date.isoformat())
        self.assertEqual(response.data["dates"][-1], self.today.isoformat())
        self.assertEqual(response.data["summary"]["total"], 4)
        self.assertEqual(response.data["summary"]["present"], 1)
        self.assertEqual(response.data["summary"]["absent"], 1)
        self.assertEqual(response.data["summary"]["on_leave"], 1)
        self.assertEqual(response.data["summary"]["wfh"], 1)
        self.assertEqual(len(response.data["employees"]), 4)

        rows = {row["code"]: row for row in response.data["employees"]}
        self.assertEqual(rows["OVW001"]["days"][self.today.isoformat()], "P")
        self.assertEqual(rows["OVW002"]["days"][self.today.isoformat()], "A")
        self.assertEqual(rows["OVW003"]["days"][self.today.isoformat()], "L")
        self.assertEqual(rows["OVW004"]["days"][self.today.isoformat()], "W")
        self.assertIn("h", rows["OVW001"]["work_hours"])

        day_summary = response.data["week"][-1]
        self.assertEqual(day_summary["total"], 4)
        self.assertEqual(day_summary["present"], 1)
        self.assertEqual(day_summary["absent"], 1)
        self.assertEqual(day_summary["on_leave"], 1)
        self.assertEqual(day_summary["wfh"], 1)

        lunch = next(item for item in response.data["breaks"] if item["name"] == "Lunch Break")
        self.assertEqual(lunch["total"], 3)  # approved leave is not break-eligible
        self.assertEqual(lunch["taken"], 1)
        self.assertEqual(lunch["not_taken"], 2)
        self.assertIsNone(lunch["missed"])

    def test_employee_cannot_access_company_overview(self):
        self.client.force_authenticate(self.employee_user)
        response = self.client.get("/api/attendance/overview/")
        self.assertEqual(response.status_code, 403)

    def test_overview_rejects_invalid_and_oversized_ranges(self):
        self.client.force_authenticate(self.hr)
        invalid = self.client.get("/api/attendance/overview/?start_date=not-a-date")
        reversed_range = self.client.get(
            "/api/attendance/overview/",
            {"start_date": self.today.isoformat(), "end_date": self.start_date.isoformat()},
        )
        oversized = self.client.get(
            "/api/attendance/overview/",
            {"start_date": (self.today - timedelta(days=7)).isoformat(), "end_date": self.today.isoformat()},
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(reversed_range.status_code, 400)
        self.assertEqual(oversized.status_code, 400)
