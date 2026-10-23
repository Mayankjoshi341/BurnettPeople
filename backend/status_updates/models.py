from django.conf import settings
from django.db import models
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone


class StatusUpdate(models.Model):
    class WorkStatus(models.TextChoices):
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        BLOCKED = "BLOCKED", "Blocked"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="work_status_updates",
    )
    # Employee profile is optional because HR/admin/manager accounts may not all
    # have an Employee row, but every authenticated user can submit an update.
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="work_status_updates",
    )
    update_date = models.DateField(default=timezone.localdate, db_index=True)
    work_status = models.CharField(
        max_length=20,
        choices=WorkStatus.choices,
        default=WorkStatus.IN_PROGRESS,
    )
    completed_work = models.TextField()
    currently_working = models.TextField()
    testing = models.TextField(blank=True, default="")
    tech_stack = models.TextField(blank=True, default="")
    remaining_work = models.TextField(blank=True, null=True)
    blocker = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["author", "update_date"],
                name="uniq_status_update_author_date",
            )
        ]
        indexes = [
            models.Index(fields=["update_date", "work_status"], name="status_date_work_idx"),
            models.Index(fields=["author", "update_date"], name="status_author_date_idx"),
        ]

    def save(self, *args, **kwargs):
        if self.author_id and self.employee_id is None:
            try:
                self.employee = self.author.employee_profile
            except ObjectDoesNotExist:
                self.employee = None
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.author.email} — {self.update_date}"
