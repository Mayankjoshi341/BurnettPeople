
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import AccountInvitation
from employees.models import Employee
from organization.models import Department, Designation


User = get_user_model()


class OnboardingEndToEndTests(TestCase):
    def setUp(self):
        self.hr = User.objects.create_user(
            email="hr.e2e@example.com",
            password="Test-HR-Password-8274!",
            role=User.Role.HR,
            is_active=True,
        )

        self.department = Department.objects.create(
            name="E2E Engineering",
            code="E2E",
        )
        self.designation = Designation.objects.create(
            title="E2E Engineer",
            grade="L1",
        )

        self.hr_client = APIClient()
        self.hr_client.force_authenticate(user=self.hr)
        self.public_client = APIClient()

        self.email = "employee.e2e@example.com"
        self.password = "Test-Employee-Password-8274!"

        self.employee_payload = {
            "employee_code": "E2E-1001",
            "official_email": self.email,
            "first_name": "End",
            "last_name": "ToEnd",
            "department": self.department.pk,
            "designation": self.designation.pk,
            "employment_type": "FULL_TIME",
            "date_of_joining": timezone.localdate().isoformat(),
        }

    @patch(
        "accounts.services.invitations."
        "send_account_invitation_email.apply_async"
    )
    def test_hr_creates_employee_activation_and_login(
        self,
        queue_email,
    ):
        with self.captureOnCommitCallbacks(execute=True):
            created = self.hr_client.post(
                "/api/employees/",
                self.employee_payload,
                format="json",
            )

        self.assertEqual(created.status_code, 201)
        queue_email.assert_called_once()

        # The raw token is passed to the worker, while only its
        # hash should be stored in PostgreSQL.
        queued_args = queue_email.call_args.kwargs["args"]
        invitation_id, raw_token = queued_args

        invitation = AccountInvitation.objects.get(
            pk=invitation_id
        )
        employee = Employee.objects.get(
            employee_code="E2E-1001"
        )

        self.assertNotEqual(invitation.token_hash, raw_token)
        self.assertFalse(employee.user.is_active)

        activation = self.public_client.post(
            "/api/auth/activate/",
            {
                "token": raw_token,
                "password": self.password,
                "password_confirm": self.password,
            },
            format="json",
        )
        self.assertEqual(activation.status_code, 200)

        employee.user.refresh_from_db()
        invitation.refresh_from_db()

        self.assertTrue(employee.user.is_active)
        self.assertTrue(employee.user.check_password(self.password))
        self.assertIsNotNone(invitation.accepted_at)

        login_response = self.public_client.post(
            "/api/auth/token/",
            {
                "email": self.email,
                "password": self.password,
            },
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertIn("access", login_response.data)
        self.assertIn("refresh", login_response.data)

        employee_client = APIClient()
        employee_client.credentials(
            HTTP_AUTHORIZATION=(
                f"Bearer {login_response.data['access']}"
            )
        )
        profile_response = employee_client.get("/api/auth/me/")

        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(
            profile_response.data["email"],
            self.email,
        )
        self.assertEqual(
            profile_response.data["role"],
            User.Role.EMPLOYEE,
        )

        # Password activation must not silently change employment status.
        employee.refresh_from_db()
        self.assertEqual(
            employee.employment_status,
            Employee.EmploymentStatus.PREBOARDING,
        )
