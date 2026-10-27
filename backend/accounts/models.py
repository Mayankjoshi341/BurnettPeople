from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models

from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError


class UserManager(BaseUserManager):
    """Create users using email instead of username."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")

        email = self.normalize_email(email)

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", User.Role.ADMIN)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("A superuser must have is_staff=True.")

        if extra_fields.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        HR = "HR", "HR"
        MANAGER = "MANAGER", "Manager"
        EMPLOYEE = "EMPLOYEE", "Employee"

    # Email replaces Django's default username.
    username = None

    email = models.EmailField(
        unique=True,
        db_index=True,
    )

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EMPLOYEE,
        db_index=True,
    )

    objects = UserManager()  # type: ignore

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.email


class AccountInvitation(models.Model):
    class DeliveryStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="account_invitations",
    )

    email_snapshot = models.EmailField()

    # Store the hash of the invitation token, never the raw token.
    token_hash = models.CharField(max_length=64, unique=True)

    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_invitations",
    )

    delivery_status = models.CharField(
        max_length=10,
        choices=DeliveryStatus.choices,
        default=DeliveryStatus.PENDING,
    )

    sent_at = models.DateTimeField(null=True, blank=True)
    delivery_error = models.CharField(max_length=500, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["user", "created_at"],
                name="inv_user_created_idx",
            ),
            models.Index(
                fields=["delivery_status", "expires_at"],
                name="inv_delivery_expiry_idx",
            ),
        ]

    def clean(self):
        super().clean()

        if (
            self.expires_at
            and self.created_at
            and self.expires_at <= self.created_at
        ):
            raise ValidationError(
                {"expires_at": "Expiry must be after creation."}
            )

    @property
    def is_usable(self):
        return (
            self.accepted_at is None
            and self.revoked_at is None
            and self.expires_at > timezone.now()
            and not self.user.is_active
        )

    def __str__(self):
        return f"Invitation for {self.email_snapshot}"


class AuditEvent(models.Model):
    class Action(models.TextChoices):
        EMPLOYEE_CREATED = "EMPLOYEE_CREATED", "Employee created"
        INVITATION_CREATED = "INVITATION_CREATED", "Invitation created"
        INVITATION_RESENT = "INVITATION_RESENT", "Invitation resent"
        INVITATION_EMAIL_SENT = "INVITATION_EMAIL_SENT", "Invitation email sent"
        INVITATION_EMAIL_FAILED = "INVITATION_EMAIL_FAILED", "Invitation email failed"
        ACCOUNT_ACTIVATED = "ACCOUNT_ACTIVATED", "Account activated"
        EMPLOYEE_DEACTIVATED = "EMPLOYEE_DEACTIVATED", "Employee deactivated"
        EMPLOYMENT_STATUS_CHANGED = "EMPLOYMENT_STATUS_CHANGED", "Employment status changed"
        EMPLOYEE_ROLE_CHANGED = "EMPLOYEE_ROLE_CHANGED", "Employee role changed"
        HR_CREATED = "HR_CREATED", "HR account created"
        PASSWORD_RESET_REQUESTED = (
            "PASSWORD_RESET_REQUESTED",
            "Password reset requested",
        )
        PASSWORD_RESET_COMPLETED = (
            "PASSWORD_RESET_COMPLETED",
            "Password reset completed",
        )
        LEAVE_SUBMITTED = "LEAVE_SUBMITTED", "Leave submitted"
        LEAVE_APPROVED = "LEAVE_APPROVED", "Leave approved"
        LEAVE_REJECTED = "LEAVE_REJECTED", "Leave rejected"
        LEAVE_CANCELLED = "LEAVE_CANCELLED", "Leave cancelled"
        ATTENDANCE_CHECKED_IN = "ATTENDANCE_CHECKED_IN", "Attendance checked in"
        ATTENDANCE_CHECKED_OUT = "ATTENDANCE_CHECKED_OUT", "Attendance checked out"
        ATTENDANCE_EXCEPTION_SUBMITTED = "ATTENDANCE_EXCEPTION_SUBMITTED", "Attendance exception submitted"
        ATTENDANCE_EXCEPTION_REVIEWED = "ATTENDANCE_EXCEPTION_REVIEWED", "Attendance exception reviewed"
        ASSET_REGISTERED = "ASSET_REGISTERED", "Asset registered"
        ASSET_UPDATED = "ASSET_UPDATED", "Asset updated"
        ASSET_ASSIGNED = "ASSET_ASSIGNED", "Asset assigned"
        ASSET_RETURNED = "ASSET_RETURNED", "Asset returned"
        ASSET_STATUS_CHANGED = "ASSET_STATUS_CHANGED", "Asset status changed"

    # Who performed the action. Null means a system-generated event
    # or an actor who has since been deleted.
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_events_created",
    )

    # The user affected by this event, when applicable.
    subject_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_events_received",
    )

    # Snapshots remain available even if the related user is deleted.
    subject_email = models.EmailField(blank=True)

    action = models.CharField(
        max_length=32,
        choices=Action.choices,
    )

    # A loose reference avoids coupling the audit table to one
    # particular HR record type.
    object_type = models.CharField(max_length=50, blank=True)
    object_id = models.CharField(max_length=64, blank=True)

    # Store non-sensitive contextual details only.
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["action", "created_at"],
                name="audit_action_created_idx",
            ),
            models.Index(
                fields=["subject_email", "created_at"],
                name="audit_subject_created_idx",
            ),
        ]

    def __str__(self):
        return f"{self.action} at {self.created_at}"


class PasswordResetCode(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="password_reset_codes",
    )
    email_snapshot = models.EmailField()
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["user", "created_at"],
                name="pwd_reset_user_created_idx",
            ),
            models.Index(
                fields=["expires_at"],
                name="pwd_reset_expiry_idx",
            ),
        ]

    def __str__(self):
        return f"Password reset for {self.email_snapshot}"
