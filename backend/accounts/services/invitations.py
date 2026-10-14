
import hashlib
import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from accounts.models import AccountInvitation, User , AuditEvent
from accounts.tasks import send_account_invitation_email
from accounts.services.audit import record_audit_event

@transaction.atomic
def create_or_resend_invitation(*, user, created_by):
    """
    Create a fresh invitation for an account that has not
    completed activation. Revoke earlier unused invitations.
    """
    had_previous_invitation = AccountInvitation.objects.filter(
        user=user,
    ).exists()

    # Serialize concurrent resend requests for this account.
    user = User.objects.select_for_update().get(pk=user.pk)

    if user.is_active:
        raise ValueError("This account is already active.")

    if AccountInvitation.objects.filter(
        user=user,
        accepted_at__isnull=False,
    ).exists():
        raise ValueError(
            "This account was already activated. "
            "Use the account-recovery process instead."
        )

    now = timezone.now()

    # Expire all previous, unaccepted invitations before issuing
    # a new one. This also handles previously expired invitations.
    AccountInvitation.objects.filter(
        user=user,
        accepted_at__isnull=True,
        revoked_at__isnull=True,
    ).update(
        revoked_at=now,
        updated_at=now,
    )

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(
        raw_token.encode("utf-8")
    ).hexdigest()

    invitation = AccountInvitation.objects.create(
        user=user,
        email_snapshot=user.email,
        token_hash=token_hash,
        expires_at=now + timedelta(hours=48),
        created_by=created_by,
        delivery_status=AccountInvitation.DeliveryStatus.PENDING,
    )
    record_audit_event(
        action=(
            AuditEvent.Action.INVITATION_RESENT
            if had_previous_invitation
            else AuditEvent.Action.INVITATION_CREATED
        ),
        actor=created_by,
        subject_user=user,
        subject_email=user.email,
        object_type="AccountInvitation",
        object_id=invitation.pk,
    )

    # Queue the email only after the database transaction commits.
    # Redact the bearer token from task representations in logs.
    def queue_email():
        send_account_invitation_email.apply_async(
            args=(invitation.pk, raw_token),
            argsrepr=f"({invitation.pk}, '<redacted>')",
        ) # type: ignore

    transaction.on_commit(queue_email, robust=True)

    return invitation
