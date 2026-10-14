import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.models import AuditEvent, PasswordResetCode
from accounts.services.audit import record_audit_event
from accounts.tasks import send_password_reset_code


MAX_CODE_ATTEMPTS = 5
CODE_LIFETIME_MINUTES = 10
REQUEST_COOLDOWN_SECONDS = 60


def _hash_code(reset_id, code):
    message = f"burnettpeople-password-reset:{reset_id}:{code}".encode()
    key = settings.SECRET_KEY.encode()
    return hmac.new(key, message, hashlib.sha256).hexdigest()


@transaction.atomic
def request_password_reset(email):
    User = get_user_model()
    email = email.strip().lower()
    now = timezone.now()

    user = (
        User.objects.select_for_update()
        .filter(email__iexact=email, is_active=True)
        .first()
    )

    # Return the same API response for unknown and known email addresses.
    if user is None:
        return

    recent_request_exists = PasswordResetCode.objects.filter(
        user=user,
        used_at__isnull=True,
        expires_at__gt=now,
        created_at__gte=now - timedelta(seconds=REQUEST_COOLDOWN_SECONDS),
    ).exists()

    if recent_request_exists:
        return

    # Invalidate prior unused codes before creating a new code.
    PasswordResetCode.objects.filter(
        user=user,
        used_at__isnull=True,
    ).update(used_at=now)

    code = f"{secrets.randbelow(1_000_000):06d}"
    reset = PasswordResetCode.objects.create(
        user=user,
        email_snapshot=user.email,
        code_hash="0" * 64,
        expires_at=now + timedelta(minutes=CODE_LIFETIME_MINUTES),
    )
    reset.code_hash = _hash_code(reset.pk, code)
    reset.save(update_fields=["code_hash"])

    record_audit_event(
        action=AuditEvent.Action.PASSWORD_RESET_REQUESTED,
        subject_user=user,
        subject_email=user.email,
        object_type="PasswordResetCode",
        object_id=reset.pk,
    )

    reset_id = reset.pk
    transaction.on_commit(
        lambda: send_password_reset_code.delay(reset_id, code),
        robust=True,
    )


def confirm_password_reset(email, code, new_password):
    User = get_user_model()
    email = email.strip().lower()
    now = timezone.now()
    error = None

    # Do not raise inside the transaction for invalid codes: the failed
    # attempt counter must be committed instead of rolled back.
    with transaction.atomic():
        reset = (
            PasswordResetCode.objects.select_for_update()
            .filter(
                email_snapshot__iexact=email,
                used_at__isnull=True,
            )
            .order_by("-created_at")
            .first()
        )

        if reset is None:
            error = ValidationError({"code": "Invalid or expired reset code."})

        elif reset.expires_at <= now:
            reset.used_at = now
            reset.save(update_fields=["used_at"])
            error = ValidationError({"code": "Invalid or expired reset code."})

        elif reset.attempts >= MAX_CODE_ATTEMPTS:
            reset.used_at = now
            reset.save(update_fields=["used_at"])
            error = ValidationError({"code": "Invalid or expired reset code."})

        elif not hmac.compare_digest(
            _hash_code(reset.pk, code),
            reset.code_hash,
        ):
            reset.attempts += 1
            update_fields = ["attempts"]
            if reset.attempts >= MAX_CODE_ATTEMPTS:
                reset.used_at = now
                update_fields.append("used_at")
            reset.save(update_fields=update_fields)
            error = ValidationError({"code": "Invalid or expired reset code."})

        else:
            user = (
                User.objects.select_for_update()
                .filter(
                    pk=reset.user_id,
                    is_active=True,
                    email__iexact=reset.email_snapshot,
                )
                .first()
            )

            if user is None:
                reset.used_at = now
                reset.save(update_fields=["used_at"])
                error = ValidationError({"code": "Invalid or expired reset code."})
            else:
                try:
                    validate_password(new_password, user=user)
                except DjangoValidationError as exc:
                    error = ValidationError({"password": exc.messages})

                if error is None:
                    user.set_password(new_password)
                    user.save(update_fields=["password"])

                    reset.used_at = now
                    reset.save(update_fields=["used_at"])

                    PasswordResetCode.objects.filter(
                        user=user,
                        used_at__isnull=True,
                    ).exclude(pk=reset.pk).update(used_at=now)

                    # Require sign-in again by blacklisting outstanding refresh tokens.
                    from rest_framework_simplejwt.token_blacklist.models import (
                        BlacklistedToken,
                        OutstandingToken,
                    )

                    for token in OutstandingToken.objects.filter(user=user):
                        BlacklistedToken.objects.get_or_create(token=token)

                    record_audit_event(
                        action=AuditEvent.Action.PASSWORD_RESET_COMPLETED,
                        actor=user,
                        subject_user=user,
                        subject_email=user.email,
                        object_type="PasswordResetCode",
                        object_id=reset.pk,
                    )

    if error is not None:
        raise error
