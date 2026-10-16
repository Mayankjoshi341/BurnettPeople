from datetime import date, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AuditEvent, User
from employees.models import Employee
from organization.models import Department, Designation


class EmployeeEmploymentStatusTransitionTests(APITestCase):
    def setUp(self):
        self.hr_user = User.objects.create_user(
            email="hr.status@example.test",
            password="Safe-HR-Password-8274!",
            role=User.Role.HR,
            is_active=True,
        )
        self.manager_user = User.objects.create_user(
            email="manager.status@example.test",
            password="Safe-Manager-Password-8274!",
            role=User.Role.MANAGER,
            is_active=True,
        )
        self.employee_user = User.objects.create_user(
            email="employee.status@example.test",
            password="Safe-Employee-Password-8274!",
            role=User.Role.EMPLOYEE,
            is_active=True,
        )
        self.department = Department.objects.create(name="Engineering", code="ENG-STATUS")
        self.designation = Designation.objects.create(title="Engineer", grade="L1")
        self.employee = Employee.objects.create(
            user=self.employee_user,
            employee_code="BP-STATUS-001",
            official_email=self.employee_user.email,
            first_name="Status",
            last_name="Employee",
            department=self.department,
            designation=self.designation,
            employment_status=Employee.EmploymentStatus.ACTIVE,
            date_of_joining=date(2026, 1, 1),
        )
        self.client.force_authenticate(user=self.hr_user)

    def url(self):
        return f"/api/employees/{self.employee.pk}/employment-status/"

    def test_hr_can_move_active_employee_to_notice_period_and_audit_it(self):
        response = self.client.patch(
            self.url(),
            {"employment_status": "NOTICE_PERIOD"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.employment_status, Employee.EmploymentStatus.NOTICE_PERIOD)
        self.assertIsNone(self.employee.date_of_exit)
        event = AuditEvent.objects.get(action=AuditEvent.Action.EMPLOYMENT_STATUS_CHANGED)
        self.assertEqual(event.metadata["previous_status"], "ACTIVE")
        self.assertEqual(event.metadata["employment_status"], "NOTICE_PERIOD")

    def test_hr_can_exit_employee_and_disable_portal_access(self):
        exit_date = timezone.localdate()
        response = self.client.patch(
            self.url(),
            {"employment_status": "EXITED", "date_of_exit": exit_date.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.employee.refresh_from_db()
        self.employee_user.refresh_from_db()
        self.assertEqual(self.employee.employment_status, Employee.EmploymentStatus.EXITED)
        self.assertEqual(self.employee.date_of_exit, exit_date)
        self.assertFalse(self.employee_user.is_active)
        self.assertEqual(response.data["account_activation_status"], "NOT_INVITED")
        self.assertTrue(AuditEvent.objects.filter(
            action=AuditEvent.Action.EMPLOYEE_DEACTIVATED,
            object_id=str(self.employee.pk),
        ).exists())

    def test_exit_date_defaults_to_today(self):
        response = self.client.patch(
            self.url(), {"employment_status": "EXITED"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.date_of_exit, timezone.localdate())

    def test_rejects_exit_date_before_joining(self):
        response = self.client.patch(
            self.url(),
            {"employment_status": "EXITED", "date_of_exit": "2025-12-31"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.employment_status, Employee.EmploymentStatus.ACTIVE)
        self.assertIsNone(self.employee.date_of_exit)

    def test_rejects_invalid_lifecycle_transition(self):
        response = self.client.patch(
            self.url(), {"employment_status": "PREBOARDING"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.employment_status, Employee.EmploymentStatus.ACTIVE)

    def test_exited_employee_cannot_be_reactivated_through_this_endpoint(self):
        self.employee.employment_status = Employee.EmploymentStatus.EXITED
        self.employee.date_of_exit = timezone.localdate()
        self.employee.save(update_fields=["employment_status", "date_of_exit", "updated_at"])
        self.employee_user.is_active = False
        self.employee_user.save(update_fields=["is_active"])

        response = self.client.patch(
            self.url(), {"employment_status": "ACTIVE"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.employment_status, Employee.EmploymentStatus.EXITED)

    def test_manager_cannot_change_employment_status(self):
        self.client.force_authenticate(user=self.manager_user)
        response = self.client.patch(
            self.url(), {"employment_status": "NOTICE_PERIOD"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_same_status_is_idempotent(self):
        response = self.client.patch(
            self.url(), {"employment_status": "ACTIVE"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(AuditEvent.objects.filter(
            action=AuditEvent.Action.EMPLOYMENT_STATUS_CHANGED
        ).exists())
