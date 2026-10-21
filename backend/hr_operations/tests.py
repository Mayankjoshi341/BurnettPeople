from datetime import timedelta
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from employees.models import Employee
from hr_operations.models import (
    Asset,
    AssetAssignment,
    CompanyHoliday,
    LeaveBalance,
    LeaveRequest,
    LeaveRequestAllocation,
    LeaveType,
    Notification,
)
from organization.models import Department, Designation


class Day4WorkflowAPITests(APITestCase):
    def setUp(self):
        self.hr = User.objects.create_user(
            email="hr-day4@example.test", password="Strong-HR-Password-2026!", role=User.Role.HR
        )
        self.manager_user = User.objects.create_user(
            email="manager-day4@example.test", password="Strong-Manager-Password-2026!", role=User.Role.MANAGER
        )
        self.employee_user = User.objects.create_user(
            email="employee-day4@example.test", password="Strong-Employee-Password-2026!", role=User.Role.EMPLOYEE
        )
        self.department = Department.objects.create(name="Day 4 Engineering", code="D4ENG")
        self.designation = Designation.objects.create(title="Day 4 Engineer")
        today = timezone.localdate()
        self.manager = Employee.objects.create(
            user=self.manager_user,
            employee_code="D4MGR001",
            official_email=self.manager_user.email,
            first_name="Mira",
            last_name="Manager",
            department=self.department,
            designation=self.designation,
            date_of_joining=today - timedelta(days=90),
            employment_status=Employee.EmploymentStatus.ACTIVE,
        )
        self.employee = Employee.objects.create(
            user=self.employee_user,
            employee_code="D4EMP001",
            official_email=self.employee_user.email,
            first_name="Evan",
            last_name="Employee",
            department=self.department,
            designation=self.designation,
            manager=self.manager,
            date_of_joining=today - timedelta(days=90),
            employment_status=Employee.EmploymentStatus.ACTIVE,
        )
        self.leave_type = LeaveType.objects.create(code="ANNUAL", name="Annual Leave", is_paid=True)
        self.start = today + timedelta(days=(7 - today.weekday()) % 7 or 7)
        self.end = self.start + timedelta(days=1)
        self.balance = LeaveBalance.objects.create(
            employee=self.employee,
            leave_type=self.leave_type,
            year=self.start.year,
            entitled_days=10,
        )
        self.client.force_authenticate(self.employee_user)

    def submit(self, start=None, end=None, reason="Family plans"):
        return self.client.post(
            "/api/leave/requests/",
            {
                "leave_type_id": self.leave_type.pk,
                "start_date": (start or self.start).isoformat(),
                "end_date": (end or self.end).isoformat(),
                "reason": reason,
            },
            format="json",
        )

    def test_submit_reserves_balance_and_stores_year_allocation(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        self.balance.refresh_from_db()
        self.assertEqual(response.data["status"], LeaveRequest.Status.PENDING)
        self.assertEqual(response.data["days_count"], 2)
        self.assertEqual(self.balance.reserved_days, 2)
        self.assertEqual(self.balance.used_days, 0)
        self.assertEqual(LeaveRequestAllocation.objects.count(), 1)

    def test_holiday_is_excluded_from_working_day_count(self):
        CompanyHoliday.objects.create(date=self.start, name="Company shutdown")
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["days_count"], 1)
        self.balance.refresh_from_db()
        self.assertEqual(self.balance.reserved_days, 1)

    def test_overlapping_pending_request_is_rejected(self):
        first = self.submit()
        self.assertEqual(first.status_code, 201, first.data)
        second = self.submit(start=self.start + timedelta(days=1), end=self.end + timedelta(days=1))
        self.assertEqual(second.status_code, 400)
        self.assertIn("dates", second.data)
        self.assertEqual(LeaveRequest.objects.count(), 1)

    def test_insufficient_balance_is_rejected_without_creating_request(self):
        self.balance.entitled_days = 1
        self.balance.save(update_fields=["entitled_days", "updated_at"])
        response = self.submit()
        self.assertEqual(response.status_code, 400)
        self.assertIn("balance", response.data)
        self.assertEqual(LeaveRequest.objects.count(), 0)
        self.balance.refresh_from_db()
        self.assertEqual(self.balance.reserved_days, 0)

    def test_manager_approval_moves_reserved_days_to_used_days(self):
        created = self.submit()
        self.assertEqual(created.status_code, 201, created.data)
        request_id = created.data["id"]
        self.client.force_authenticate(self.manager_user)
        response = self.client.post(f"/api/leave/requests/{request_id}/approve/", {"comment": "Approved"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["status"], LeaveRequest.Status.APPROVED)
        self.balance.refresh_from_db()
        self.assertEqual(self.balance.reserved_days, 0)
        self.assertEqual(self.balance.used_days, 2)
        self.assertTrue(Notification.objects.filter(recipient=self.employee_user, kind=Notification.Kind.LEAVE_APPROVED).exists())

    def test_unrelated_manager_cannot_decide_an_employee_request(self):
        created = self.submit()
        outsider_user = User.objects.create_user(
            email="outsider-manager@example.test", password="Strong-Other-Password-2026!", role=User.Role.MANAGER
        )
        self.client.force_authenticate(outsider_user)
        response = self.client.post(f"/api/leave/requests/{created.data['id']}/approve/", {}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(LeaveRequest.objects.get(pk=created.data["id"]).status, LeaveRequest.Status.PENDING)

    def test_employee_can_cancel_pending_request_and_release_reservation(self):
        created = self.submit()
        response = self.client.post(f"/api/leave/requests/{created.data['id']}/cancel/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.balance.refresh_from_db()
        self.assertEqual(response.data["status"], LeaveRequest.Status.CANCELLED)
        self.assertEqual(self.balance.reserved_days, 0)
        self.assertEqual(self.balance.used_days, 0)

    def test_asset_duplicate_assignment_is_prevented_and_return_keeps_history(self):
        self.client.force_authenticate(self.hr)
        created_asset = self.client.post(
            "/api/assets/",
            {"asset_tag": "LAP-D4-001", "name": "ThinkPad Test", "category": "LAPTOP", "serial_number": "SN-D4-001"},
            format="json",
        )
        self.assertEqual(created_asset.status_code, 201, created_asset.data)
        asset_id = created_asset.data["id"]
        assignment = self.client.post(
            "/api/assets/assignments/",
            {"asset_id": asset_id, "employee_id": self.employee.pk, "condition_on_assignment": "Good"},
            format="json",
        )
        self.assertEqual(assignment.status_code, 201, assignment.data)
        duplicate = self.client.post(
            "/api/assets/assignments/",
            {"asset_id": asset_id, "employee_id": self.employee.pk},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)
        returned = self.client.post(
            f"/api/assets/assignments/{assignment.data['id']}/return/",
            {"condition_on_return": "Good"},
            format="json",
        )
        self.assertEqual(returned.status_code, 200, returned.data)
        self.assertIsNotNone(AssetAssignment.objects.get(pk=assignment.data["id"]).returned_at)
        self.assertEqual(Asset.objects.get(pk=asset_id).status, Asset.Status.AVAILABLE)
        self.assertEqual(AssetAssignment.objects.filter(asset_id=asset_id).count(), 1)

    def test_employee_cannot_register_assets(self):
        response = self.client.post(
            "/api/assets/", {"asset_tag": "NO-ACCESS", "name": "Blocked laptop"}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    @override_settings(AI_PROVIDER="mock", AI_API_KEY="")
    def test_ai_endpoint_returns_editable_fallback_without_submitting_leave(self):
        response = self.client.post(
            "/api/ai/leave-draft/",
            {"leave_type": "Annual Leave", "start_date": self.start.isoformat(), "end_date": self.end.isoformat(), "reason": "Family visit"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["fallback"])
        self.assertFalse(response.data["submitted"])
        self.assertIn("Annual Leave", response.data["draft"])
        self.assertEqual(LeaveRequest.objects.count(), 0)

    def test_notification_read_endpoints_are_recipient_scoped(self):
        item = Notification.objects.create(
            recipient=self.employee_user,
            kind=Notification.Kind.LEAVE_SUBMITTED,
            title="Test notification",
            message="This is a test.",
        )
        self.client.force_authenticate(self.manager_user)
        forbidden = self.client.post(f"/api/notifications/{item.pk}/read/", {}, format="json")
        self.assertEqual(forbidden.status_code, 404)
        self.client.force_authenticate(self.employee_user)
        read = self.client.post(f"/api/notifications/{item.pk}/read/", {}, format="json")
        self.assertEqual(read.status_code, 200, read.data)
        item.refresh_from_db()
        self.assertIsNotNone(item.read_at)
