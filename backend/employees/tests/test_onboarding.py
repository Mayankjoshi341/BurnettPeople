
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from accounts.models import User, AccountInvitation
from employees.models import Employee
from employees.services import create_employee_with_invitation
from organization.models import Department, Designation


class EmployeeOnboardingServiceTests(TestCase):
    def setUp(self):
        self.hr_user = User.objects.create_user(
            email="hr.test@example.com",
            password="Test-HR-Password-8392!",
            role=User.Role.HR,
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

        self.employee_data = {
            "employee_code": "emp-1001",
            "official_email": "New.Employee@example.com",
            "first_name": "New",
            "last_name": "Employee",
            "department": self.department,
            "designation": self.designation,
            "date_of_joining": timezone.localdate(),
        }

    @patch(
        "accounts.services.invitations."
        "send_account_invitation_email.apply_async"
    )
    def test_create_employee_keeps_account_inactive(
        self,
        queue_email,
    ):
        with self.captureOnCommitCallbacks(execute=True):
            employee, invitation = create_employee_with_invitation(
                employee_data=self.employee_data,
                created_by=self.hr_user,
            )

        employee.user.refresh_from_db()

        self.assertEqual(employee.employee_code, "EMP-1001")
        self.assertEqual(
            employee.official_email,
            "new.employee@example.com",
        )
        self.assertEqual(
            employee.employment_status,
            Employee.EmploymentStatus.PREBOARDING,
        )
        self.assertFalse(employee.user.is_active)
        self.assertTrue(employee.user.has_usable_password() is False)
        self.assertEqual(
            invitation.delivery_status,
            AccountInvitation.DeliveryStatus.PENDING,
        )

        # The raw token is not stored in the invitation record.
        self.assertEqual(len(invitation.token_hash), 64)
        queue_email.assert_called_once()

    def test_duplicate_email_is_rejected(self):
        with self.captureOnCommitCallbacks(execute=True):
            create_employee_with_invitation(
                employee_data=self.employee_data,
                created_by=self.hr_user,
            )

        duplicate_data = {
            **self.employee_data,
            "employee_code": "EMP-1002",
            "official_email": "NEW.EMPLOYEE@example.com",
        }

        with self.assertRaises(ValidationError):
            create_employee_with_invitation(
                employee_data=duplicate_data,
                created_by=self.hr_user,
            )

        self.assertEqual(Employee.objects.count(), 1)

    def test_duplicate_employee_code_is_rejected(self):
        with self.captureOnCommitCallbacks(execute=True):
            create_employee_with_invitation(
                employee_data=self.employee_data,
                created_by=self.hr_user,
            )

        duplicate_data = {
            **self.employee_data,
            "employee_code": "emp-1001",
            "official_email": "another.employee@example.com",
        }

        with self.assertRaises(ValidationError):
            create_employee_with_invitation(
                employee_data=duplicate_data,
                created_by=self.hr_user,
            )

        self.assertEqual(Employee.objects.count(), 1)