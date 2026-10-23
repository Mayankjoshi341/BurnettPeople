from rest_framework.test import APITestCase

from accounts.models import AuditEvent, User


class AuditLogApiTests(APITestCase):
    def setUp(self):
        self.hr = User.objects.create_user(
            email="audit-hr@example.test", password="StrongTestPass!2026",
            first_name="Audit", last_name="HR", role=User.Role.HR,
        )
        self.employee = User.objects.create_user(
            email="audit-employee@example.test", password="StrongTestPass!2026",
            first_name="Audit", last_name="Employee", role=User.Role.EMPLOYEE,
        )
        self.event = AuditEvent.objects.create(
            actor=self.hr, action=AuditEvent.Action.EMPLOYEE_CREATED,
            object_type="employee", object_id="BP-123",
            metadata={"password": "never-return-this", "api_token": "secret"},
        )

    def test_hr_can_filter_and_read_paginated_events_without_secrets(self):
        self.client.force_authenticate(self.hr)
        response = self.client.get("/api/audit/logs/?object_type=employee")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        row = response.data["results"][0]
        self.assertEqual(row["id"], self.event.pk)
        self.assertEqual(row["user_email"], self.hr.email)
        self.assertIn("BP-123", row["details"])
        self.assertNotIn("metadata", row)
        self.assertNotIn("never-return-this", str(response.data))
        self.assertNotIn("secret", str(response.data))

    def test_non_hr_role_cannot_browse_audit_history(self):
        self.client.force_authenticate(self.employee)
        response = self.client.get("/api/audit/logs/")
        self.assertEqual(response.status_code, 403)

    def test_invalid_date_filter_is_rejected(self):
        self.client.force_authenticate(self.hr)
        response = self.client.get("/api/audit/logs/?from=not-a-date")
        self.assertEqual(response.status_code, 400)
