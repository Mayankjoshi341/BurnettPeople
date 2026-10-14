
import hashlib
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import AccountInvitation
from accounts.tasks import send_account_invitation_email


User = get_user_model()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    FRONTEND_BASE_URL="http://localhost:5173",
)
class InvitationEmailTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="mail.test@example.com",
            password=None,
            first_name="Mail",
            last_name="Test",
            is_active=False,
        )
        self.raw_token = "test-email-worker-token"

        self.invitation = AccountInvitation.objects.create(
            user=self.user,
            email_snapshot=self.user.email,
            token_hash=hashlib.sha256(
                self.raw_token.encode("utf-8")
            ).hexdigest(),
            expires_at=timezone.now() + timedelta(hours=48),
            delivery_status=AccountInvitation.DeliveryStatus.PENDING,
        )

    def test_successful_send_updates_delivery_status(self):
        result = send_account_invitation_email.run(
            self.invitation.pk,
            self.raw_token,
        )

        self.invitation.refresh_from_db()

        self.assertEqual(result["status"], "sent")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(
            mail.outbox[0].to,
            [self.user.email],
        )
        self.assertIn(
            self.raw_token,
            mail.outbox[0].body,
        )
        self.assertEqual(
            self.invitation.delivery_status,
            AccountInvitation.DeliveryStatus.SENT,
        )
        self.assertIsNotNone(self.invitation.sent_at)
        self.assertEqual(self.invitation.delivery_error, "")

    def test_revoked_invitation_is_not_sent(self):
        self.invitation.revoked_at = timezone.now()
        self.invitation.save(update_fields=["revoked_at"])

        result = send_account_invitation_email.run(
            self.invitation.pk,
            self.raw_token,
        )

        self.assertEqual(result["status"], "skipped")
        self.assertEqual(len(mail.outbox), 0)

    @patch(
        "accounts.tasks.EmailMultiAlternatives.send",
        side_effect=OSError("SMTP temporarily unavailable"),
    )
    @patch("accounts.tasks.send_account_invitation_email.retry")
    def test_transient_failure_records_error_and_retries(
        self,
        retry_mock,
        send_mock,
    ):
        retry_mock.side_effect = RuntimeError(
            "Simulated retry scheduling"
        )

        with self.assertRaisesRegex(
            RuntimeError,
            "Simulated retry scheduling",
        ):
            send_account_invitation_email.run(
                self.invitation.pk,
                self.raw_token,
            )

        self.invitation.refresh_from_db()

        self.assertEqual(
            self.invitation.delivery_status,
            AccountInvitation.DeliveryStatus.PENDING,
        )
        self.assertIn(
            "SMTP temporarily unavailable",
            self.invitation.delivery_error,
        )
        retry_mock.assert_called_once()

    @patch(
        "accounts.tasks.EmailMultiAlternatives.send",
        side_effect=OSError("SMTP permanently unavailable"),
    )
    def test_final_failure_is_recorded(self, send_mock):
        send_account_invitation_email.push_request(retries=3)

        try:
            with self.assertRaisesRegex(
                OSError,
                "SMTP permanently unavailable",
            ):
                send_account_invitation_email.run(
                    self.invitation.pk,
                    self.raw_token,
                )
        finally:
            send_account_invitation_email.pop_request()

        self.invitation.refresh_from_db()

        self.assertEqual(
            self.invitation.delivery_status,
            AccountInvitation.DeliveryStatus.FAILED,
        )
        self.assertIn(
            "SMTP permanently unavailable",
            self.invitation.delivery_error,
        )
