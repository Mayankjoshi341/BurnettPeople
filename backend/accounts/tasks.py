
from html import escape
from urllib.parse import quote

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils import timezone

from .models import AccountInvitation , PasswordResetCode
from accounts.models import AuditEvent
from accounts.services.audit import record_audit_event

import logging

logger = logging.getLogger(__name__)
@shared_task(
    bind=True,
    max_retries=3,
    argsrepr="(<reset_id>, '<redacted>')",
)
def send_password_reset_code(self, reset_id, raw_code):
    reset = PasswordResetCode.objects.filter(
        pk=reset_id,
        used_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).first()

    # Do not email codes that have expired or already been used.
    if reset is None:
        return "Password reset code is no longer active."

    subject = "BurnettPeople password reset"
    body = (
        f"Your BurnettPeople password reset code is: {raw_code}\n\n"
        "This code expires in 10 minutes and can only be used once.\n"
        "If you did not request this, you can ignore this email."
    )

    try:
        message = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[reset.email_snapshot],
        )
        message.send(fail_silently=False)
        return "Password reset email accepted by the configured email backend."

    except Exception as exc:
        logger.exception(
            "Password reset email task failed for reset record %s",
            reset_id,
        )
        raise self.retry(
            exc=exc,
            countdown=min(30 * (2 ** self.request.retries), 300),
        )

@shared_task(
    bind=True,
    max_retries=3,
    name="accounts.send_account_invitation_email",
)
def send_account_invitation_email(self, invitation_id, raw_token):
    """Send an activation email and track delivery status."""

    try:
        invitation = AccountInvitation.objects.select_related(
            "user"
        ).get(pk=invitation_id)
    except AccountInvitation.DoesNotExist:
        return {"status": "skipped", "reason": "invitation_not_found"}

    # Do not send links which have already been revoked or used.
    if (
        invitation.revoked_at is not None
        or invitation.accepted_at is not None
        or invitation.expires_at <= timezone.now()
        or invitation.user.is_active
    ):
        return {"status": "skipped", "reason": "invitation_not_usable"}

    name = escape(
        invitation.user.get_full_name()
        or invitation.email_snapshot
    )

    activation_url = (
        f"{settings.FRONTEND_BASE_URL}/activate-account"
        f"?token={quote(raw_token, safe='')}"
    )

    subject = "Set up your BurnettPeople account"

    text_content = (
        f"Hello {invitation.user.get_full_name() or 'there'},\n\n"
        "Your BurnettPeople account has been created.\n"
        "Use this link within 48 hours to set your password:\n\n"
        f"{activation_url}\n\n"
        "If you were not expecting this email, please contact HR."
    )

    html_content = f"""
    <html>
      <body>
        <h2>Welcome to BurnettPeople, {name}!</h2>
        <p>Your account has been created.</p>
        <p>Use the link below within 48 hours to set your password.</p>
        <p>
          <a href="{escape(activation_url, quote=True)}">
            Set your password
          </a>
        </p>
        <p>If you were not expecting this email, contact HR.</p>
      </body>
    </html>
    """

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[invitation.email_snapshot],
    )
    message.attach_alternative(html_content, "text/html")

    try:
        sent_count = message.send(fail_silently=False)

        if sent_count != 1:
            raise RuntimeError("The email backend did not confirm delivery.")

    except Exception as exc:
        invitation.delivery_error = (
            f"{type(exc).__name__}: {exc}"
        )[:500]

        if self.request.retries < self.max_retries:
            invitation.delivery_status = (
                AccountInvitation.DeliveryStatus.PENDING
            )
            invitation.save(
                update_fields=[
                    "delivery_status",
                    "delivery_error",
                    "updated_at",
                ]
            )

            raise self.retry(
                exc=exc,
                countdown=min(
                    300,
                    30 * (2 ** self.request.retries),
                ),
            )

        invitation.delivery_status = (
            AccountInvitation.DeliveryStatus.FAILED
        )
        record_audit_event(
            action=AuditEvent.Action.INVITATION_EMAIL_FAILED,
            subject_user=invitation.user,
            subject_email=invitation.email_snapshot,
            object_type="AccountInvitation",
            object_id=invitation.pk,
            metadata={
                "error_type": type(exc).__name__,
            },
        )
        invitation.save(
            update_fields=[
                "delivery_status",
                "delivery_error",
                "updated_at",
            ]
        )
        raise

    invitation.delivery_status = (
        AccountInvitation.DeliveryStatus.SENT
    )
    record_audit_event(
        action=AuditEvent.Action.INVITATION_EMAIL_SENT,
        subject_user=invitation.user,
        subject_email=invitation.email_snapshot,
        object_type="AccountInvitation",
        object_id=invitation.pk,
    )
    invitation.sent_at = timezone.now()
    invitation.delivery_error = ""
    invitation.save(
        update_fields=[
            "delivery_status",
            "sent_at",
            "delivery_error",
            "updated_at",
        ]
    )

    return {"status": "sent", "invitation_id": invitation.pk}
