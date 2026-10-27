from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import AuditEvent, User
from employees.models import Employee
from organization.models import Department, Designation


class EmployeeRoleChangeApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="role-admin@example.test", password="StrongTestPass!2026", role=User.Role.ADMIN
        )
        self.hr = User.objects.create_user(
            email="role-hr@example.test", password="StrongTestPass!2026", role=User.Role.HR
        )
        self.manager = User.objects.create_user(
            email="role-manager@example.test", password="StrongTestPass!2026", role=User.Role.MANAGER
        )
        self.department = Department.objects.create(name="Role Change", code="ROLE")
        self.designation = Designation.objects.create(title="Role Change Employee")
        self.employee_user = User.objects.create_user(
            email="role-employee@example.test", password="StrongTestPass!2026", role=User.Role.EMPLOYEE
        )
        self.employee = self._profile(self.employee_user, "ROLE001")

    def _profile(self, user, code, *, status=Employee.EmploymentStatus.ACTIVE):
        return Employee.objects.create(
            user=user,
            employee_code=code,
            official_email=user.email,
            first_name="Role",
            last_name=code,
            department=self.department,
            designation=self.designation,
            employment_status=status,
            date_of_joining=timezone.localdate() - timedelta(days=30),
        )

    def _url(self, employee=None):
        return f"/api/employees/{(employee or self.employee).pk}/change-role/"

    def test_admin_can_promote_active_employee_and_audit_change(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self._url(), {"role": "MANAGER"}, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.employee_user.refresh_from_db()
        self.assertEqual(self.employee_user.role, User.Role.MANAGER)
        self.assertEqual(response.data["employee"]["portal_role"], User.Role.MANAGER)
        event = AuditEvent.objects.get(action=AuditEvent.Action.EMPLOYEE_ROLE_CHANGED)
        self.assertEqual(event.actor_id, self.admin.pk)
        self.assertEqual(event.subject_user_id, self.employee_user.pk)
        self.assertEqual(event.metadata["previous_role"], User.Role.EMPLOYEE)
        self.assertEqual(event.metadata["new_role"], User.Role.MANAGER)

    def test_repeating_manager_promotion_is_idempotent(self):
        self.employee_user.role = User.Role.MANAGER
        self.employee_user.save(update_fields=["role"])
        self.client.force_authenticate(self.admin)

        response = self.client.post(self._url(), {"role": "MANAGER"}, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(AuditEvent.objects.filter(action=AuditEvent.Action.EMPLOYEE_ROLE_CHANGED).count(), 0)

    def test_hr_and_manager_cannot_change_roles(self):
        for user in (self.hr, self.manager, self.employee_user):
            with self.subTest(role=user.role):
                self.client.force_authenticate(user)
                response = self.client.post(self._url(), {"role": "MANAGER"}, format="json")
                self.assertEqual(response.status_code, 403)

    def test_endpoint_rejects_roles_other_than_manager(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self._url(), {"role": "ADMIN"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.employee_user.refresh_from_db()
        self.assertEqual(self.employee_user.role, User.Role.EMPLOYEE)

    def test_employee_without_portal_account_cannot_be_promoted(self):
        employee = Employee.objects.create(
            user=None,
            employee_code="ROLE-NO-USER",
            official_email="role-no-user@example.test",
            first_name="No",
            last_name="User",
            department=self.department,
            designation=self.designation,
            employment_status=Employee.EmploymentStatus.ACTIVE,
            date_of_joining=timezone.localdate() - timedelta(days=30),
        )
        self.client.force_authenticate(self.admin)
        response = self.client.post(self._url(employee), {"role": "MANAGER"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_inactive_employee_or_inactive_account_cannot_be_promoted(self):
        self.client.force_authenticate(self.admin)
        self.employee.employment_status = Employee.EmploymentStatus.PREBOARDING
        self.employee.save(update_fields=["employment_status"])
        inactive_employee = self.client.post(self._url(), {"role": "MANAGER"}, format="json")
        self.assertEqual(inactive_employee.status_code, 400)

        self.employee.employment_status = Employee.EmploymentStatus.ACTIVE
        self.employee.save(update_fields=["employment_status"])
        self.employee_user.is_active = False
        self.employee_user.save(update_fields=["is_active"])
        inactive_account = self.client.post(self._url(), {"role": "MANAGER"}, format="json")
        self.assertEqual(inactive_account.status_code, 400)

    def test_admin_cannot_change_own_role(self):
        own_profile = self._profile(self.admin, "ROLEADMIN")
        self.client.force_authenticate(self.admin)
        response = self.client.post(self._url(own_profile), {"role": "MANAGER"}, format="json")
        self.assertEqual(response.status_code, 403)
