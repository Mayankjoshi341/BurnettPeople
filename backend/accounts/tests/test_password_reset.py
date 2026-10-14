
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import PasswordResetCode


class PasswordResetFlowTests(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.email = "reset.employee@example.com"
        self.user = User.objects.create_user(
            email=self.email,
            password="OriginalSecurePass123!",
        )

    def request_code(self):
        with patch(
            "accounts.services.password_reset.send_password_reset_code.delay"
        ) as mocked_delay:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    "/api/auth/password-reset/request/",
                    {"email": self.email},
                    format="json",
                )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(mocked_delay.call_count, 1)

        reset_id, code = mocked_delay.call_args.args
        reset = PasswordResetCode.objects.get(pk=reset_id)

        # The raw code should not be stored in the database.
        self.assertNotEqual(reset.code_hash, code)
        self.assertEqual(len(code), 6)

        return reset, code

    def test_request_queues_code_and_unknown_email_is_generic(self):
        reset, _ = self.request_code()
        self.assertEqual(reset.user_id, self.user.pk)

        response = self.client.post(
            "/api/auth/password-reset/request/",
            {"email": "unknown.employee@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["detail"],
            "If an active account exists with that email, "
            "a password reset code will be sent.",
        )
        self.assertEqual(
            PasswordResetCode.objects.filter(
                email_snapshot="unknown.employee@example.com"
            ).count(),
            0,
        )

    def test_valid_code_resets_password_and_is_single_use(self):
        reset, code = self.request_code()
        new_password = "NewSecurePassword937!"

        response = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "email": self.email,
                "code": code,
                "password": new_password,
                "password_confirm": new_password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        reset.refresh_from_db()

        self.assertTrue(self.user.check_password(new_password))
        self.assertIsNotNone(reset.used_at)

        response_again = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "email": self.email,
                "code": code,
                "password": new_password,
                "password_confirm": new_password,
            },
            format="json",
        )
        self.assertEqual(response_again.status_code, 400)

    def test_wrong_code_is_limited_to_five_attempts(self):
        reset, code = self.request_code()
        wrong_code = "000000" if code != "000000" else "000001"

        for attempt in range(5):
            response = self.client.post(
                "/api/auth/password-reset/confirm/",
                {
                    "email": self.email,
                    "code": wrong_code,
                    "password": "NewSecurePassword937!",
                    "password_confirm": "NewSecurePassword937!",
                },
                format="json",
            )
            self.assertEqual(response.status_code, 400)

        reset.refresh_from_db()
        self.assertEqual(reset.attempts, 5)
        self.assertIsNotNone(reset.used_at)

    def test_expired_code_is_rejected(self):
        reset, code = self.request_code()
        reset.expires_at = timezone.now() - timedelta(seconds=1)
        reset.save(update_fields=["expires_at"])

        response = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "email": self.email,
                "code": code,
                "password": "NewSecurePassword937!",
                "password_confirm": "NewSecurePassword937!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

