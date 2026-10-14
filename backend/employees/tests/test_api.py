
import hashlib
import secrets
from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AccountInvitation, User
from employees.models import Employee
from organization.models import Department, Designation


class EmployeeAPITests(APITestCase):
    def setUp(self):
        self.hr_user = User.objects.create_user(
            email="hr.api@example.com",
            password="Test-HR-Password-8274!",
            role=User.Role.HR,
            is_active=True,
        )

        self.manager_user = User.objects.create_user(
            email="manager.api@example.com",
            password="Test-Manager-Password-8274!",
            role=User.Role.MANAGER,
            is_active=True,
        )

        self.employee_user = User.objects.create_user(
            email="employee.api@example.com",
            password="Test-Employee-Password-8274!",
            role=User.Role.EMPLOYEE,
            is_active=True,
        )

        self.department = Department.objects.create(
            name="Engineering",
            code="ENG",
        )

        self.designation = Designation.objects.create(
            title="Software Engineer",
            grade="L1",
        )

        self.employee_payload = {
            "employee_code": "EMP-3001",
            "official_email": "new.hire@example.com",
            "first_name": "New",
            "last_name": "Hire",
            "department": self.department.pk,
            "designation": self.designation.pk,
            "employment_type": "FULL_TIME",
            "date_of_joining": timezone.localdate().isoformat(),
            "phone_number": "9999999999",
        }

    def create_pending_employee(self, code="EMP-4001"):
        email = f"{code.lower()}@example.com"

        user = User.objects.create_user(
            email=email,
            password=None,
            first_name="Pending",
            last_name="Employee",
            role=User.Role.EMPLOYEE,
            is_active=False,
        )

        employee = Employee.objects.create(
            user=user,
            employee_code=code,
            official_email=email,
            first_name="Pending",
            last_name="Employee",
            department=self.department,
            designation=self.designation,
            employment_status=Employee.EmploymentStatus.PREBOARDING,
            date_of_joining=timezone.localdate(),
            created_by=self.hr_user,
        )

        invitation = AccountInvitation.objects.create(
            user=user,
            email_snapshot=email,
            token_hash=hashlib.sha256(
                secrets.token_bytes(32)
            ).hexdigest(),
            expires_at=timezone.now() + timedelta(hours=48),
            created_by=self.hr_user,
            delivery_status=AccountInvitation.DeliveryStatus.PENDING,
        )

        return employee, invitation

    def test_anonymous_user_cannot_list_employees(self):
        response = self.client.get("/api/employees/")

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_manager_cannot_manage_employee_records(self):
        self.client.force_authenticate(user=self.manager_user)

        response = self.client.get("/api/employees/")

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_hr_can_create_employee_and_inactive_account(self):
        self.client.force_authenticate(user=self.hr_user)

        with patch(
            "accounts.services.invitations."
            "send_account_invitation_email.apply_async"
        ) as queue_email:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    "/api/employees/",
                    self.employee_payload,
                    format="json",
                )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        employee = Employee.objects.get(
            employee_code="EMP-3001"
        )
        employee.user.refresh_from_db()

        self.assertEqual(employee.official_email, "new.hire@example.com")
        self.assertEqual(
            employee.employment_status,
            Employee.EmploymentStatus.PREBOARDING,
        )
        self.assertFalse(employee.user.is_active)
        self.assertFalse(employee.user.has_usable_password())

        invitation = AccountInvitation.objects.get(user=employee.user)
        self.assertEqual(
            invitation.delivery_status,
            AccountInvitation.DeliveryStatus.PENDING,
        )
        queue_email.assert_called_once()

    def test_hr_can_view_pending_activations(self):
        self.client.force_authenticate(user=self.hr_user)
        employee, invitation = self.create_pending_employee()

        response = self.client.get(
            "/api/employees/pending-activations/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        results = response.data
        if isinstance(results, dict):
            results = results["results"]

        matching = [
            item for item in results
            if item["id"] == employee.pk
        ]

        self.assertEqual(len(matching), 1)
        self.assertEqual(
            matching[0]["account_activation_status"],
            "EMAIL_PENDING",
        )

    def test_hr_can_resend_invitation(self):
        self.client.force_authenticate(user=self.hr_user)
        employee, old_invitation = self.create_pending_employee()

        with patch(
            "accounts.services.invitations."
            "send_account_invitation_email.apply_async"
        ) as queue_email:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    f"/api/employees/{employee.pk}/resend-invitation/",
                    {},
                    format="json",
                )

        self.assertEqual(
            response.status_code,
            status.HTTP_202_ACCEPTED,
        )

        old_invitation.refresh_from_db()
        self.assertIsNotNone(old_invitation.revoked_at)

        new_invitation = AccountInvitation.objects.filter(
            user=employee.user,
            accepted_at__isnull=True,
        ).exclude(
            pk=old_invitation.pk,
        ).latest("created_at")

        self.assertIsNone(new_invitation.revoked_at)
        self.assertGreater(
            new_invitation.expires_at,
            timezone.now(),
        )
        queue_email.assert_called_once()

    def test_hr_delete_soft_exits_employee_and_disables_login(self):
        self.client.force_authenticate(user=self.hr_user)
        employee, invitation = self.create_pending_employee()

        response = self.client.delete(
            f"/api/employees/{employee.pk}/"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_204_NO_CONTENT,
        )

        employee.refresh_from_db()
        employee.user.refresh_from_db()
        invitation.refresh_from_db()

        self.assertEqual(
            employee.employment_status,
            Employee.EmploymentStatus.EXITED,
        )
        self.assertIsNotNone(employee.date_of_exit)
        self.assertFalse(employee.user.is_active)
        self.assertIsNotNone(invitation.revoked_at)
