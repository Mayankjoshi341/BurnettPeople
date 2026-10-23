from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from attendance.models import (
    AttendanceException,
    AttendanceRecord,
    BreakPolicy,
    BreakPolicyRule,
)
from employees.models import Employee, EmployeeScheduleAssignment, WorkSchedule
from organization.models import Department, Designation


class AttendanceReportingApiTests(APITestCase):
    def setUp(self):
        self.employee_user = User.objects.create_user(
            email="report-employee@example.test",
            password="StrongTestPass!2026",
            first_name="Report",
            last_name="Employee",
            role=User.Role.EMPLOYEE,
        )
        self.hr_user = User.objects.create_user(
            email="report-hr@example.test",
            password="StrongTestPass!2026",
            first_name="Report",
            last_name="HR",
            role=User.Role.HR,
        )
        self.department = Department.objects.create(name="Reporting Engineering", code="RPT")
        self.designation = Designation.objects.create(title="Reporting Engineer")
        self.policy = BreakPolicy.objects.create(code="RPT", name="Reporting policy")
        BreakPolicyRule.objects.create(
            policy=self.policy,
            break_type=BreakPolicyRule.BreakType.LUNCH,
            allowed_start_time="12:00",
            allowed_end_time="14:00",
            duration_minutes=30,
            duration_mode=BreakPolicyRule.DurationMode.FIXED,
        )
        self.schedule = WorkSchedule.objects.create(
            name="Reporting day schedule",
            start_time="09:00",
            end_time="18:00",
            workdays=["MON", "TUE", "WED", "THU", "FRI"],
            timezone="Asia/Kolkata",
            break_policy=self.policy,
            late_grace_minutes=5,
        )
        self.employee = Employee.objects.create(
            user=self.employee_user,
            employee_code="RPT0001",
            official_email=self.employee_user.email,
            first_name="Report",
            last_name="Employee",
            department=self.department,
            designation=self.designation,
            date_of_joining=timezone.localdate() - timedelta(days=30),
            employment_status=Employee.EmploymentStatus.ACTIVE,
        )
        today = timezone.localdate()
        EmployeeScheduleAssignment.objects.create(
            employee=self.employee,
            work_schedule=self.schedule,
            effective_from=today - timedelta(days=30),
        )
        self.today = today
        self.now = timezone.now()

    def _record(self, work_date, *, closed=False):
        return AttendanceRecord.objects.create(
            employee=self.employee,
            work_date=work_date,
            schedule=self.schedule,
            check_in=self.now - timedelta(hours=8),
            check_out=(self.now - timedelta(hours=1)) if closed else None,
            status=(AttendanceRecord.Status.CLOSED if closed else AttendanceRecord.Status.OPEN),
        )

    def test_employee_can_view_current_schedule_and_break_rules(self):
        self.client.force_authenticate(self.employee_user)
        response = self.client.get("/api/attendance/schedule/me/")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["assignment"]["work_schedule"]["name"], self.schedule.name)
        self.assertEqual(
            response.data["assignment"]["work_schedule"]["break_policy"]["rules"][0]["break_type"],
            BreakPolicyRule.BreakType.LUNCH,
        )

    def test_schedule_endpoint_does_not_allow_hr_without_employee_profile(self):
        self.client.force_authenticate(self.hr_user)
        response = self.client.get("/api/attendance/schedule/me/")
        self.assertEqual(response.status_code, 403)

    def test_employee_cannot_access_company_attendance_records_or_summary(self):
        self.client.force_authenticate(self.employee_user)
        records = self.client.get("/api/attendance/records/")
        summary = self.client.get("/api/attendance/summary/")
        self.assertEqual(records.status_code, 403)
        self.assertEqual(summary.status_code, 403)

    def test_hr_can_filter_attendance_records_by_date_and_status(self):
        self._record(self.today, closed=False)
        self._record(self.today - timedelta(days=1), closed=True)
        self.client.force_authenticate(self.hr_user)

        response = self.client.get(
            "/api/attendance/records/",
            {
                "start_date": self.today.isoformat(),
                "end_date": self.today.isoformat(),
                "status": AttendanceRecord.Status.OPEN,
            },
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["status"], AttendanceRecord.Status.OPEN)

    def test_hr_can_filter_attendance_by_employee_id(self):
        self._record(self.today)
        self.client.force_authenticate(self.hr_user)
        response = self.client.get(
            "/api/attendance/records/", {"employee_id": str(self.employee.pk)}
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["employee"], self.employee.pk)

    def test_hr_daily_report_uses_real_scheduled_employee_and_attendance_records(self):
        self._record(self.today)
        self.client.force_authenticate(self.hr_user)
        response = self.client.get("/api/attendance/reports/daily/", {"date": self.today.isoformat()})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["summary"]["total"], 1)
        self.assertEqual(response.data["summary"]["present"], 1)
        self.assertIsNone(response.data["summary"]["wfh"])
        self.assertEqual(response.data["employees"][0]["status"], "Present")

    def test_employee_cannot_access_company_daily_report(self):
        self.client.force_authenticate(self.employee_user)
        response = self.client.get("/api/attendance/reports/daily/")
        self.assertEqual(response.status_code, 403)

    def test_invalid_report_filters_return_400(self):
        self.client.force_authenticate(self.hr_user)
        invalid_date = self.client.get("/api/attendance/records/?start_date=not-a-date")
        reversed_dates = self.client.get(
            "/api/attendance/records/",
            {
                "start_date": self.today.isoformat(),
                "end_date": (self.today - timedelta(days=1)).isoformat(),
            },
        )
        invalid_status = self.client.get("/api/attendance/records/?status=UNKNOWN")
        self.assertEqual(invalid_date.status_code, 400)
        self.assertEqual(reversed_dates.status_code, 400)
        self.assertEqual(invalid_status.status_code, 400)

    def test_summary_counts_attendance_records_and_pending_exceptions(self):
        self._record(self.today, closed=False)
        self._record(self.today - timedelta(days=1), closed=True)
        AttendanceException.objects.create(
            employee=self.employee,
            exception_type=AttendanceException.ExceptionType.OTHER,
            reason="Pending report test exception.",
            review_status=AttendanceException.ReviewStatus.PENDING,
        )
        self.client.force_authenticate(self.hr_user)

        response = self.client.get("/api/attendance/summary/", {"date": self.today.isoformat()})

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["total_attendance_records"], 1)
        self.assertEqual(response.data["open_sessions"], 1)
        self.assertEqual(response.data["closed_sessions"], 0)
        self.assertEqual(response.data["pending_exceptions_total"], 1)
