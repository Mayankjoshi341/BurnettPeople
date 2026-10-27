from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from ..models import StatusUpdate

User = get_user_model()


class StatusUpdateApiTests(APITestCase):
    def setUp(self):
        self.employee = User.objects.create_user(
            email="employee@example.com", password="test-password-123", role="EMPLOYEE",
            first_name="Test", last_name="Employee",
        )
        self.hr = User.objects.create_user(
            email="hr@example.com", password="test-password-123", role="HR",
            first_name="Test", last_name="HR",
        )
        self.admin = User.objects.create_user(
            email="admin@example.com", password="test-password-123", role="ADMIN",
            first_name="Test", last_name="Admin",
        )

    def payload(self, **overrides):
        data = {
            "work_status": "IN_PROGRESS",
            "completed_work": "Finished the employee list API.",
            "currently_working": "Integrating status updates.",
            "testing": "Ran API tests.",
            "tech_stack": "Django, React, PostgreSQL",
            "remaining_work": None,
            "blocker": None,
        }
        data.update(overrides)
        return data

    def test_employee_can_submit_and_read_own_update(self):
        self.client.force_authenticate(self.employee)
        response = self.client.post("/api/status-updates/", self.payload(), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["author_id"], self.employee.id)
        self.assertEqual(response.data["update_date"], timezone.localdate().isoformat())
        listing = self.client.get("/api/status-updates/?days=7")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.data), 1)

    def test_only_one_update_per_user_per_day(self):
        self.client.force_authenticate(self.employee)
        first = self.client.post("/api/status-updates/", self.payload(), format="json")
        second = self.client.post("/api/status-updates/", self.payload(completed_work="Another update"), format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)

    def test_employee_cannot_view_other_users_history(self):
        update = StatusUpdate.objects.create(
            author=self.hr, completed_work="HR work", currently_working="HR tasks"
        )
        self.client.force_authenticate(self.employee)
        response = self.client.get(f"/api/status-updates/users/{self.hr.id}/history/")
        self.assertEqual(response.status_code, 403)

    def test_hr_can_view_updates_across_roles(self):
        StatusUpdate.objects.create(author=self.employee, completed_work="Employee work", currently_working="Employee tasks")
        self.client.force_authenticate(self.hr)
        response = self.client.get("/api/status-updates/?days=7")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_missing_updates_excludes_admin_accounts(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(f"/api/status-updates/missing/?date={timezone.localdate().isoformat()}")
        self.assertEqual(response.status_code, 200)
        missing_ids = {item["id"] for item in response.data["results"]}
        self.assertIn(self.employee.id, missing_ids)
        self.assertIn(self.hr.id, missing_ids)
        self.assertNotIn(self.admin.id, missing_ids)

    def test_old_updates_are_read_only(self):
        old = StatusUpdate.objects.create(
            author=self.employee,
            update_date=timezone.localdate() - timedelta(days=1),
            completed_work="Yesterday work",
            currently_working="Yesterday current",
        )
        self.client.force_authenticate(self.employee)
        response = self.client.patch(f"/api/status-updates/{old.id}/", {"completed_work": "Changed"}, format="json")
        self.assertEqual(response.status_code, 403)
