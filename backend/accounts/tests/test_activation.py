
import hashlib
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import AccountInvitation


User = get_user_model()


class AccountActivationAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.raw_token = "test-invitation-token-for-activation"

        # New portal accounts must remain inactive until activation.
        self.user = User.objects.create_user(
            email="employee.test@example.com",
            password=None,
            first_name="Test",
            last_name="Employee",
            is_active=False,
        )

        self.invitation = AccountInvitation.objects.create(
            user=self.user,
            email_snapshot=self.user.email,
            token_hash=hashlib.sha256(
                self.raw_token.encode("utf-8")
            ).hexdigest(),
            expires_at=timezone.now() + timedelta(hours=48),
        )

        self.activation_url = "/api/auth/activate/"
        self.password = "Safe-Test-Password-9274!"

    def activate(self, token=None, password=None, confirmation=None):
        password = password or self.password

        return self.client.post(
            self.activation_url,
            {
                "token": token or self.raw_token,
                "password": password,
                "password_confirm": (
                    confirmation if confirmation is not None
                    else password
                ),
            },
            format="json",
        )

    def test_valid_invitation_activates_account(self):
        response = self.activate()

        self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()
        self.invitation.refresh_from_db()

        self.assertTrue(self.user.is_active)
        self.assertTrue(self.user.check_password(self.password))
        self.assertIsNotNone(self.invitation.accepted_at)

    def test_invalid_token_is_rejected(self):
        response = self.activate(token="not-a-valid-token")

        self.assertEqual(response.status_code, 400)

        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_expired_invitation_is_rejected(self):
        self.invitation.expires_at = (
            timezone.now() - timedelta(minutes=1)
        )
        self.invitation.save(update_fields=["expires_at"])

        response = self.activate()

        self.assertEqual(response.status_code, 400)

        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

    def test_invitation_cannot_be_used_twice(self):
        first_response = self.activate()
        second_response = self.activate()

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 400)

    def test_mismatched_passwords_are_rejected(self):
        response = self.activate(
            confirmation="Different-Test-Password-9274!"
        )

        self.assertEqual(response.status_code, 400)

        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

        self.invitation.refresh_from_db()
        self.assertIsNone(self.invitation.accepted_at)

    def test_weak_password_is_rejected(self):
        response = self.activate(password="123")

        self.assertEqual(response.status_code, 400)

        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

        self.invitation.refresh_from_db()
        self.assertIsNone(self.invitation.accepted_at)
