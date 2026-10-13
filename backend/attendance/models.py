
from django.db import models
from django.db.models import F, Q
from django.core.exceptions import ValidationError


class BreakPolicy(models.Model):
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=100)
    version = models.PositiveSmallIntegerField(default=1)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code", "version"]
        constraints = [
            models.UniqueConstraint(
                fields=["code", "version"],
                name="uniq_break_policy_version",
            ),
            models.CheckConstraint(
                condition=Q(version__gte=1),
                name="break_policy_version_positive",
            ),
        ]

    def __str__(self):
        return f"{self.name} (v{self.version})"


class BreakPolicyRule(models.Model):
    class BreakType(models.TextChoices):
        LUNCH = "LUNCH", "Lunch break"
        SHORT_BREAK = "SHORT_BREAK", "Short break"
        OTHER = "OTHER", "Other break"

    class DurationMode(models.TextChoices):
        FIXED = "FIXED", "Fixed duration"
        MINIMUM = "MINIMUM", "Minimum duration"
        MAXIMUM = "MAXIMUM", "Maximum duration"

    policy = models.ForeignKey(
        BreakPolicy,
        on_delete=models.PROTECT,
        related_name="rules",
    )
    break_type = models.CharField(
        max_length=20,
        choices=BreakType.choices,
    )
    allowed_start_time = models.TimeField()
    allowed_end_time = models.TimeField()
    duration_minutes = models.PositiveSmallIntegerField()
    duration_mode = models.CharField(
        max_length=10,
        choices=DurationMode.choices,
        default=DurationMode.FIXED,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["allowed_start_time", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["policy", "break_type"],
                name="uniq_break_type_per_policy",
            ),
            models.CheckConstraint(
                condition=Q(duration_minutes__gt=0),
                name="break_duration_positive",
            ),
            models.CheckConstraint(
                condition=Q(
                    allowed_start_time__lt=F("allowed_end_time")
                ),
                name="break_window_start_before_end",
            ),
        ]

    def clean(self):
        super().clean()

        if (
            self.allowed_start_time is not None
            and self.allowed_end_time is not None
            and self.allowed_start_time >= self.allowed_end_time
        ):
            raise ValidationError(
                "The permitted break window must end after it starts."
            )

    def __str__(self):
        return f"{self.policy.name} - {self.get_break_type_display()}"
