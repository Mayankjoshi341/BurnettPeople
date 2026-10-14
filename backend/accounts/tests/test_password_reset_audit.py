from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from accounts.models import AuditEvent, PasswordResetCode


class PasswordResetAuditTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.email = "reset.audit@example.com"
        self.password = "OriginalSecurePass123!"
        self.user = User.objects.create_user(
            email=self.email,
            password=self.password,
            first_name="Audit",
            last_name="Test",
        )

    def request_reset_code(self):
        with patch(
            "accounts.services.password_reset.send_password_reset_code.delay"
        ) as mocked_send:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    "/api/auth/password-reset/request/",
                    {"email": self.email},
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(mocked_send.call_count, 1)
        reset_id, raw_code = mocked_send.call_args.args
        reset = PasswordResetCode.objects.get(pk=reset_id)
        return reset, raw_code

    def test_request_is_audited_without_storing_raw_code(self):
        reset, raw_code = self.request_reset_code()

        event = AuditEvent.objects.get(
            action=AuditEvent.Action.PASSWORD_RESET_REQUESTED,
            object_id=str(reset.pk),
        )
        self.assertEqual(event.subject_user, self.user)
        self.assertEqual(event.subject_email, self.email)
        self.assertEqual(event.object_type, "PasswordResetCode")
        self.assertNotIn(raw_code, str(event.metadata))
        self.assertNotEqual(reset.code_hash, raw_code)

    def test_successful_reset_is_audited_and_invalidates_code(self):
        reset, raw_code = self.request_reset_code()
        new_password = "UpdatedSecurePassword937!"

        response = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "email": self.email,
                "code": raw_code,
                "password": new_password,
                "password_confirm": new_password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        reset.refresh_from_db()

        self.assertTrue(self.user.check_password(new_password))
        self.assertIsNotNone(reset.used_at)

        event = AuditEvent.objects.get(
            action=AuditEvent.Action.PASSWORD_RESET_COMPLETED,
            object_id=str(reset.pk),
        )
        self.assertEqual(event.actor, self.user)
        self.assertEqual(event.subject_user, self.user)
        self.assertEqual(event.subject_email, self.email)
        self.assertNotIn(raw_code, str(event.metadata))
        self.assertNotIn(new_password, str(event.metadata))

        retry = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "email": self.email,
                "code": raw_code,
                "password": new_password,
                "password_confirm": new_password,
            },
            format="json",
        )
        self.assertEqual(retry.status_code, 400)
        self.assertEqual(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.PASSWORD_RESET_COMPLETED,
                subject_user=self.user,
            ).count(),
            1,
        )
