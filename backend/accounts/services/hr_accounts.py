
from django.db import IntegrityError, transaction

from accounts.models import AuditEvent, User
from accounts.services.audit import record_audit_event
from accounts.services.invitations import create_or_resend_invitation
from employees.models import Employee


class HRAccountEmailAlreadyExists(ValueError):
    """Raised when an email is already used by an account or employee."""


@transaction.atomic
def create_hr_account_with_invitation(
    *,
    email,
    first_name,
    last_name,
    created_by,
):
    """
    Create an inactive HR account and queue its activation invitation.

    The service deliberately does not create an Employee profile.
    """
    email = email.strip().lower()
    first_name = first_name.strip()
    last_name = last_name.strip()

    if User.objects.filter(email__iexact=email).exists():
        raise HRAccountEmailAlreadyExists(
            "This email is already linked to an account."
        )

    if Employee.objects.filter(official_email__iexact=email).exists():
        raise HRAccountEmailAlreadyExists(
            "This email is already used by an employee record."
        )

    try:
        # Use an inner transaction so a database uniqueness failure does
        # not leave the surrounding transaction in a broken state.
        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                password=None,
                first_name=first_name,
                last_name=last_name,
                role=User.Role.HR,
                is_active=False,
                is_staff=False,
                is_superuser=False,
            )
    except IntegrityError as exc:
        if User.objects.filter(email__iexact=email).exists():
            raise HRAccountEmailAlreadyExists(
                "This email is already linked to an account."
            ) from exc
        raise

    # Reuse the existing secure invitation flow.
    # It stores a hash of the token and queues the email after commit.
    invitation = create_or_resend_invitation(
        user=user,
        created_by=created_by,
    )

    record_audit_event(
        action=AuditEvent.Action.HR_CREATED,
        actor=created_by,
        subject_user=user,
        subject_email=user.email,
        object_type="User",
        object_id=user.pk,
        metadata={
            "role": User.Role.HR,
            "invitation_id": invitation.pk,
        },
    )

    return user, invitation
