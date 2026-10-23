from datetime import time

from rest_framework.test import APITestCase

from accounts.models import User
from attendance.models import BreakPolicy, BreakPolicyRule


class BreakPolicyManagementApiTests(APITestCase):
    def setUp(self):
        self.hr = User.objects.create_user(email="break-settings-hr@example.test", password="StrongPass!2026", role=User.Role.HR)
        self.employee = User.objects.create_user(email="break-settings-employee@example.test", password="StrongPass!2026", role=User.Role.EMPLOYEE)

    def test_hr_can_create_policy_and_versioned_rules_and_soft_deactivate(self):
        self.client.force_authenticate(self.hr)
        response = self.client.post("/api/attendance/break-policies/", {
            "code": "STANDARD", "name": "Standard shift", "version": 1, "description": "Configured shift breaks.",
            "rules": [{"break_type": "LUNCH", "allowed_start_time": "13:00", "allowed_end_time": "14:00", "duration_minutes": 30, "duration_mode": "FIXED", "is_active": True}],
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        policy_id = response.data["id"]
        self.assertEqual(len(response.data["rules"]), 1)
        changed_rule = self.client.patch(f"/api/attendance/break-policies/{policy_id}/", {"rules": []}, format="json")
        self.assertEqual(changed_rule.status_code, 400)
        self.assertEqual(BreakPolicyRule.objects.filter(policy_id=policy_id).count(), 1)
        self.assertEqual(self.client.delete(f"/api/attendance/break-policies/{policy_id}/").status_code, 204)
        self.assertFalse(BreakPolicy.objects.get(pk=policy_id).is_active)
        self.assertEqual(self.client.get("/api/attendance/break-policies/").data, [])
        self.assertEqual(len(self.client.get("/api/attendance/break-policies/?include_inactive=true").data), 1)

    def test_non_hr_cannot_manage_break_policies(self):
        self.client.force_authenticate(self.employee)
        response = self.client.post("/api/attendance/break-policies/", {"code": "NO", "name": "No", "version": 1}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_new_version_keeps_prior_policy_rules_unchanged(self):
        policy = BreakPolicy.objects.create(code="LUNCH", name="Lunch", version=1)
        BreakPolicyRule.objects.create(policy=policy, break_type="LUNCH", allowed_start_time=time(13), allowed_end_time=time(14), duration_minutes=30)
        self.client.force_authenticate(self.hr)
        response = self.client.post("/api/attendance/break-policies/", {
            "code": "LUNCH", "name": "Lunch", "version": 2, "rules": [
                {"break_type": "LUNCH", "allowed_start_time": "12:30", "allowed_end_time": "14:00", "duration_minutes": 35, "duration_mode": "FIXED"},
            ],
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(BreakPolicyRule.objects.filter(policy=policy).get().allowed_start_time, time(13))
