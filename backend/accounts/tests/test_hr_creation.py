
import hashlib
from datetime import date
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import AccountInvitation, AuditEvent
from employees.models import Employee
from organization.models import Department, Designation


User = get_user_model()


class AdminHRAccountCreationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("admin-create-hr")

        self.admin = User.objects.create_user(
            email="admin.test@example.com",
            password="Existing-Admin-Password-927!",
            first_name="Test",
            last_name="Admin",
            role=User.Role.ADMIN,
            is_active=True,
        )

        self.payload = {
            "email": "hr.new@example.com",
            "first_name": "Priya",
            "last_name": "Sharma",
        }

    def authenticate_as(self, user):
        self.client.force_authenticate(user=user)

    def test_unauthenticated_request_is_rejected(self):
        response = self.client.post(
            self.url,
            self.payload,
            format="json",
        )

        self.assertEqual(response.status_code, 401)
        self.assertFalse(
            User.objects.filter(email=self.payload["email"]).exists()
        )

    def test_only_admin_can_create_hr(self):
        for role in (
            User.Role.HR,
            User.Role.MANAGER,
            User.Role.EMPLOYEE,
        ):
            with self.subTest(role=role):
                user = User.objects.create_user(
                    email=f"{role.lower()}.test@example.com",
                    password="Existing-Test-Password-927!",
                    first_name="Test",
                    last_name=role.title(),
                    role=role,
                    is_active=True,
                )

                self.authenticate_as(user)
                response = self.client.post(
                    self.url,
                    self.payload,
                    format="json",
                )

                self.assertEqual(response.status_code, 403)

        self.assertFalse(
            User.objects.filter(email=self.payload["email"]).exists()
        )

    def test_admin_creates_hr_and_hr_can_activate_account(self):
        raw_token = "known-hr-invitation-token"

        self.authenticate_as(self.admin)

        with (
            patch(
                "accounts.services.invitations.secrets.token_urlsafe",
                return_value=raw_token,
            ),
            patch(
                "accounts.services.invitations."
                "send_account_invitation_email.apply_async"
            ) as queue_email,
        ):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    self.url,
                    self.payload,
                    format="json",
                )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["role"], User.Role.HR)
        self.assertFalse(response.data["is_active"])
        self.assertEqual(response.data["email"], self.payload["email"])
        self.assertEqual(
            response.data["invitation"]["delivery_status"],
            AccountInvitation.DeliveryStatus.PENDING,
        )
        queue_email.assert_called_once()

        hr_user = User.objects.get(email=self.payload["email"])
        invitation = AccountInvitation.objects.get(user=hr_user)

        self.assertEqual(hr_user.role, User.Role.HR)
        self.assertFalse(hr_user.is_active)
        self.assertFalse(hr_user.has_usable_password())
        self.assertEqual(
            invitation.token_hash,
            hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
        )
        self.assertEqual(len(invitation.token_hash), 64)
        self.assertEqual(invitation.created_by_id, self.admin.pk)
        self.assertFalse(
            Employee.objects.filter(
                official_email=self.payload["email"]
            ).exists()
        )
        self.assertTrue(
            AuditEvent.objects.filter(
                action=AuditEvent.Action.HR_CREATED,
                actor=self.admin,
                subject_user=hr_user,
            ).exists()
        )

        # Use the existing shared activation endpoint, not a separate
        # HR-specific password-setting implementation.
        activation_client = APIClient()
        activation_password = "HR-Activation-Password-927!"

        activation_response = activation_client.post(
            "/api/auth/activate/",
            {
                "token": raw_token,
                "password": activation_password,
                "password_confirm": activation_password,
            },
            format="json",
        )

        self.assertEqual(activation_response.status_code, 200)

        hr_user.refresh_from_db()
        invitation.refresh_from_db()

        self.assertTrue(hr_user.is_active)
        self.assertEqual(hr_user.role, User.Role.HR)
        self.assertTrue(hr_user.check_password(activation_password))
        self.assertIsNotNone(invitation.accepted_at)

    def test_duplicate_account_email_is_rejected(self):
        User.objects.create_user(
            email=self.payload["email"],
            password="Existing-HR-Password-927!",
            first_name="Existing",
            last_name="User",
            role=User.Role.HR,
            is_active=True,
        )

        self.authenticate_as(self.admin)
        response = self.client.post(
            self.url,
            self.payload,
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)
        self.assertEqual(
            User.objects.filter(email__iexact=self.payload["email"]).count(),
            1,
        )
        self.assertFalse(
            AccountInvitation.objects.filter(
                email_snapshot__iexact=self.payload["email"]
            ).exists()
        )

    def test_email_used_by_existing_employee_is_rejected(self):
        department = Department.objects.create(
            name="Engineering",
            code="ENG",
        )
        designation = Designation.objects.create(
            title="Engineer",
        )

        Employee.objects.create(
            employee_code="TEST-001",
            official_email=self.payload["email"],
            first_name="Existing",
            last_name="Employee",
            department=department,
            designation=designation,
            date_of_joining=date.today(),
        )

        self.authenticate_as(self.admin)
        response = self.client.post(
            self.url,
            self.payload,
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)
        self.assertFalse(
            User.objects.filter(email__iexact=self.payload["email"]).exists()
        )

    def test_required_fields_are_validated(self):
        self.authenticate_as(self.admin)

        response = self.client.post(
            self.url,
            {"email": "not-an-email"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)
        self.assertIn("first_name", response.data)
        self.assertIn("last_name", response.data)
