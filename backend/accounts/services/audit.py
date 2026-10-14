
from accounts.models import AuditEvent


def record_audit_event(
    *,
    action,
    actor=None,
    subject_user=None,
    subject_email="",
    object_type="",
    object_id="",
    metadata=None,
):
    """Record a security-relevant event without sensitive credentials."""

    return AuditEvent.objects.create(
        action=action,
        actor=actor,
        subject_user=subject_user,
        subject_email=subject_email,
        object_type=object_type,
        object_id=str(object_id) if object_id else "",
        metadata=metadata or {},
    )
