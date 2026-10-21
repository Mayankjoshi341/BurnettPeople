import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail

from hr_operations.models import Notification

logger = logging.getLogger(__name__)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_jitter=True, max_retries=3)
def send_notification_email(self, notification_id):
    """Send one persisted in-app notification email; retries are handled by Celery."""
    try:
        item = Notification.objects.select_related("recipient").get(pk=notification_id)
    except Notification.DoesNotExist:
        logger.warning("Notification %s no longer exists; email skipped", notification_id)
        return "missing"
    recipient = item.recipient
    if not recipient.is_active or not recipient.email:
        return "skipped"
    send_mail(
        subject=f"BurnettPeople: {item.title}",
        message=f"{item.message}\n\nOpen BurnettPeople to review the latest status.",
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[recipient.email],
        fail_silently=False,
    )
    return "sent"
