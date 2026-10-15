from datetime import date

from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from employees.models import Employee
from organization.models import Department, Designation


class EmployeeEmploymentStatusFilterTests(APITestCase):
    def setUp(self):
        self.hr_user = User.objects.create_user(
            email="hr.filter@example.com",
            password="Safe-HR-Password-8941!",
            role=User.Role.HR,
            is_active=True,
        )
        department = Department.objects.create(name="Engineering", code="ENG")
        designation = Designation.objects.create(title="Engineer", grade="L1")
        self.active_employee = Employee.objects.create(
            employee_code="BP-FILT-A",
            official_email="active.filter@example.com",
            first_name="Active",
            last_name="Worker",
            department=department,
            designation=designation,
            employment_status=Employee.EmploymentStatus.ACTIVE,
            date_of_joining=date(2026, 1, 1),
        )
        self.exited_employee = Employee.objects.create(
            employee_code="BP-FILT-X",
            official_email="exited.filter@example.com",
            first_name="Exited",
            last_name="Worker",
            department=department,
            designation=designation,
            employment_status=Employee.EmploymentStatus.EXITED,
            date_of_joining=date(2025, 1, 1),
        )
        self.client.force_authenticate(user=self.hr_user)

    def test_employment_status_filter_returns_only_matching_records(self):
        response = self.client.get("/api/employees/?employment_status=ACTIVE")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [self.active_employee.pk])

    def test_unknown_employment_status_filter_does_not_error_or_hide_records(self):
        response = self.client.get("/api/employees/?employment_status=NOT_A_STATUS")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data}
        self.assertEqual(returned_ids, {self.active_employee.pk, self.exited_employee.pk})
