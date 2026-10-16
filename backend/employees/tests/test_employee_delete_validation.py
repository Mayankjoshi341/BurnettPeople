from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from employees.models import Employee
from organization.models import Department, Designation


class EmployeeDeleteDateValidationTests(APITestCase):
    def setUp(self):
        self.hr = User.objects.create_user(
            email="future-hire-delete-hr@example.test",
            password="StrongTestPass!2026",
            role=User.Role.HR,
        )
        self.employee_user = User.objects.create_user(
            email="future-hire-delete-employee@example.test",
            password="StrongTestPass!2026",
            role=User.Role.EMPLOYEE,
            is_active=True,
        )
        department = Department.objects.create(
            name="Future Hire Delete Validation", code="FUTDEL"
        )
        designation = Designation.objects.create(title="Future Hire Delete Engineer")
        self.employee = Employee.objects.create(
            user=self.employee_user,
            employee_code="FUTDEL001",
            official_email=self.employee_user.email,
            first_name="Future",
            last_name="Hire",
            department=department,
            designation=designation,
            date_of_joining=timezone.localdate() + timedelta(days=7),
            employment_status=Employee.EmploymentStatus.PREBOARDING,
        )
        self.client.force_authenticate(self.hr)

    def test_delete_rejects_exit_date_before_future_joining_date(self):
        response = self.client.delete(f"/api/employees/{self.employee.pk}/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.data)
        self.employee.refresh_from_db()
        self.employee_user.refresh_from_db()
        self.assertEqual(
            self.employee.employment_status,
            Employee.EmploymentStatus.PREBOARDING,
        )
        self.assertIsNone(self.employee.date_of_exit)
        self.assertTrue(self.employee_user.is_active)

