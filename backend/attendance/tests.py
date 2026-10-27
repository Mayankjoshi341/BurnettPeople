from datetime import date, timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import AuditEvent, User
from attendance.models import AttendanceException, AttendanceRecord, BreakPolicy, BreakPolicyRule
from employees.models import Employee, EmployeeScheduleAssignment, WorkSchedule
from organization.models import Department, Designation


class AttendanceApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="employee-day3@example.test", password="StrongTestPass!2026",
            first_name="Test", last_name="Employee", role=User.Role.EMPLOYEE,
        )
        self.department = Department.objects.create(name="Engineering", code="ENG")
        self.designation = Designation.objects.create(title="Developer")
        self.policy = BreakPolicy.objects.create(code="DAY3", name="Day 3 test policy")
        self.lunch = BreakPolicyRule.objects.create(
            policy=self.policy, break_type=BreakPolicyRule.BreakType.LUNCH,
            allowed_start_time="00:00", allowed_end_time="23:59",
            duration_minutes=30, duration_mode=BreakPolicyRule.DurationMode.FIXED,
        )
        self.short = BreakPolicyRule.objects.create(
            policy=self.policy, break_type=BreakPolicyRule.BreakType.SHORT_BREAK,
            allowed_start_time="00:00", allowed_end_time="23:59",
            duration_minutes=20, duration_mode=BreakPolicyRule.DurationMode.MAXIMUM,
        )
        self.schedule = WorkSchedule.objects.create(
            name="Day 3 test schedule", start_time="00:00", end_time="23:59",
            workdays=["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
            timezone="Asia/Kolkata", break_policy=self.policy, late_grace_minutes=5,
        )
        self.employee = Employee.objects.create(
            user=self.user, employee_code="D3TEST01", official_email=self.user.email,
            first_name="Test", last_name="Employee", department=self.department,
            designation=self.designation, date_of_joining=date.today() - timedelta(days=30),
            employment_status=Employee.EmploymentStatus.ACTIVE,
        )
        # Keep the current assignment active in local business date.
        today = timezone.localdate()
        EmployeeScheduleAssignment.objects.create(
            employee=self.employee, work_schedule=self.schedule, effective_from=today - timedelta(days=30)
        )
        self.client.force_authenticate(self.user)

    def test_check_in_creates_record_and_duplicate_is_rejected(self):
        first = self.client.post("/api/attendance/check-in/", {}, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(AttendanceRecord.objects.filter(employee=self.employee).count(), 1)
        self.assertTrue(AuditEvent.objects.filter(
            action=AuditEvent.Action.ATTENDANCE_CHECKED_IN, object_id=str(first.data["attendance"]["id"]),
        ).exists())
        second = self.client.post("/api/attendance/check-in/", {}, format="json")
        self.assertEqual(second.status_code, 400)

    def test_checkout_requires_open_session(self):
        response = self.client.post("/api/attendance/check-out/", {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.client.post("/api/attendance/check-in/", {}, format="json")
        response = self.client.post("/api/attendance/check-out/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        record = AttendanceRecord.objects.get(employee=self.employee)
        self.assertEqual(record.status, AttendanceRecord.Status.CLOSED)
        self.assertIsNotNone(record.check_out)
        self.assertTrue(AuditEvent.objects.filter(
            action=AuditEvent.Action.ATTENDANCE_CHECKED_OUT, object_id=str(record.pk),
        ).exists())

    def test_break_must_be_ended_before_checkout(self):
        self.client.post("/api/attendance/check-in/", {}, format="json")
        started = self.client.post("/api/attendance/breaks/start/", {"break_type": "LUNCH"}, format="json")
        self.assertEqual(started.status_code, 201, started.data)
        checkout = self.client.post("/api/attendance/check-out/", {}, format="json")
        self.assertEqual(checkout.status_code, 400)
        ended = self.client.post("/api/attendance/breaks/end/", {}, format="json")
        self.assertEqual(ended.status_code, 200, ended.data)
        checkout = self.client.post("/api/attendance/check-out/", {}, format="json")
        self.assertEqual(checkout.status_code, 200, checkout.data)

    def test_employee_can_submit_exception_and_hr_can_review(self):
        submitted = self.client.post("/api/attendance/exceptions/", {
            "exception_type": "OTHER", "reason": "I forgot to check out yesterday."
        }, format="json")
        self.assertEqual(submitted.status_code, 201, submitted.data)
        exception_id = submitted.data["id"]
        self.assertEqual(submitted.data["review_status"], "PENDING")
        hr = User.objects.create_user(
            email="hr-day3@example.test", password="StrongTestPass!2026",
            first_name="Test", last_name="HR", role=User.Role.HR,
        )
        self.client.force_authenticate(hr)
        reviewed = self.client.patch(
            f"/api/attendance/exceptions/{exception_id}/review/",
            {"review_status": "APPROVED", "review_comment": "Verified by HR."}, format="json",
        )
        self.assertEqual(reviewed.status_code, 200, reviewed.data)
        exception = AttendanceException.objects.get(pk=exception_id)
        self.assertEqual(exception.review_status, AttendanceException.ReviewStatus.APPROVED)
        self.assertEqual(exception.reviewed_by, hr)
        self.assertTrue(AuditEvent.objects.filter(
            action=AuditEvent.Action.ATTENDANCE_EXCEPTION_SUBMITTED, object_id=str(exception_id),
        ).exists())
        self.assertTrue(AuditEvent.objects.filter(
            action=AuditEvent.Action.ATTENDANCE_EXCEPTION_REVIEWED, object_id=str(exception_id),
        ).exists())

    def test_non_hr_cannot_review_exception(self):
        exception = AttendanceException.objects.create(
            employee=self.employee, exception_type="OTHER", reason="Test review permission."
        )
        response = self.client.patch(
            f"/api/attendance/exceptions/{exception.pk}/review/",
            {"review_status": "APPROVED"}, format="json",
        )
        self.assertEqual(response.status_code, 403)
    def test_hr_cannot_review_own_attendance_exception(self):
        hr = User.objects.create_user(
            email="hr-self-review@example.test",
            password="StrongTestPass!2026",
            first_name="Test",
            last_name="HR",
            role=User.Role.HR,
        )
    
        hr_employee = Employee.objects.create(
            user=hr,
            employee_code="HRSELF001",
            official_email=hr.email,
            first_name="Test",
            last_name="HR",
            department=self.department,
            designation=self.designation,
            date_of_joining=date.today() - timedelta(days=30),
            employment_status=Employee.EmploymentStatus.ACTIVE,
        )
    
        self.client.force_authenticate(hr)
    
        submitted = self.client.post(
            "/api/attendance/exceptions/",
            {
                "exception_type": "OTHER",
                "reason": "I need to correct my own attendance record.",
            },
            format="json",
        )
    
        self.assertEqual(submitted.status_code, 201, submitted.data)
    
        denied = self.client.patch(
            f"/api/attendance/exceptions/{submitted.data['id']}/review/",
            {
                "review_status": "APPROVED",
                "review_comment": "Self-approved",
            },
            format="json",
        )
    
        self.assertEqual(denied.status_code, 403, denied.data)
    
        exception = AttendanceException.objects.get(
            pk=submitted.data["id"]
        )
    
        self.assertEqual(
            exception.review_status,
            AttendanceException.ReviewStatus.PENDING,
        )
        self.assertIsNone(exception.reviewed_by_id)