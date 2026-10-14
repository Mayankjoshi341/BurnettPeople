
import hashlib

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone

from accounts.models import AccountInvitation, User
from accounts.models import AuditEvent
from accounts.services.audit import record_audit_event

class InvalidInvitationError(Exception):
    """Raised when an invitation cannot be used for activation."""


@transaction.atomic
def activate_account(*, raw_token: str, password: str) -> User:
    """
    Validate a single-use invitation and activate the account atomically.

    The database stores only a SHA-256 hash of the invitation token.
    """

    token_hash = hashlib.sha256(
        raw_token.encode("utf-8")
    ).hexdigest()

    # Find the account associated with this token.
    user_id = (
        AccountInvitation.objects
        .filter(token_hash=token_hash)
        .values_list("user_id", flat=True)
        .first()
    )

    if user_id is None:
        raise InvalidInvitationError

    # Always lock the user before the invitation. The invitation
    # creation/resend service locks records in the same order.
    user = User.objects.select_for_update().filter(pk=user_id).first()

    if user is None:
        raise InvalidInvitationError

    invitation = (
        AccountInvitation.objects
        .select_for_update()
        .filter(token_hash=token_hash, user_id=user.pk)
        .first()
    )

    now = timezone.now()

    if (
        invitation is None
        or invitation.accepted_at is not None
        or invitation.revoked_at is not None
        or invitation.expires_at <= now
        or user.is_active
        or invitation.email_snapshot.strip().casefold()
        != user.email.strip().casefold()
    ):
        raise InvalidInvitationError

    # Apply Django's configured password-strength validators.
    validate_password(password, user=user)

    # Set the password using Django's secure password hashing.
    user.set_password(password)
    user.is_active = True
    user.save(update_fields=["password", "is_active"])

    invitation.accepted_at = now
    invitation.save(update_fields=["accepted_at", "updated_at"])
    record_audit_event(
        action=AuditEvent.Action.ACCOUNT_ACTIVATED,
        actor=user,
        subject_user=user,
        subject_email=user.email,
        object_type="AccountInvitation",
        object_id=invitation.pk,
    )

    return user
