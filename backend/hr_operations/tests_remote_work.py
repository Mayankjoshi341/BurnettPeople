from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from employees.models import Employee
from hr_operations.models import RemoteWorkRequest
from organization.models import Department, Designation


class RemoteWorkRequestTests(APITestCase):
    def setUp(self):
        self.manager_user = User.objects.create_user(email="remote-manager@example.test", password="StrongPass!2026", role=User.Role.MANAGER)
        self.employee_user = User.objects.create_user(email="remote-employee@example.test", password="StrongPass!2026", role=User.Role.EMPLOYEE)
        dept = Department.objects.create(name="Remote Work", code="RWORK")
        desig = Designation.objects.create(title="Remote Employee")
        self.manager = Employee.objects.create(user=self.manager_user, employee_code="RWM001", official_email=self.manager_user.email, first_name="Remote", last_name="Manager", department=dept, designation=desig, employment_status=Employee.EmploymentStatus.ACTIVE, date_of_joining=timezone.localdate()-timedelta(days=90))
        self.employee = Employee.objects.create(user=self.employee_user, employee_code="RWE001", official_email=self.employee_user.email, first_name="Remote", last_name="Employee", department=dept, designation=desig, manager=self.manager, employment_status=Employee.EmploymentStatus.ACTIVE, date_of_joining=timezone.localdate()-timedelta(days=30))

    def test_remote_request_requires_manager_approval_and_feeds_directory_count(self):
        self.client.force_authenticate(self.employee_user)
        response = self.client.post("/api/remote-work/requests/", {"work_date": timezone.localdate().isoformat(), "reason": "Home appointment"})
        self.assertEqual(response.status_code, 201, response.data)
        request_id = response.data["id"]
        self.client.force_authenticate(self.manager_user)
        approved = self.client.post(f"/api/remote-work/requests/{request_id}/decision/", {"status": "APPROVED"})
        self.assertEqual(approved.status_code, 200, approved.data)
        overview = self.client.get("/api/employees/directory/overview/")
        self.assertEqual(overview.data["work_from_home_today"], 1)

    def test_unrelated_manager_cannot_approve_and_duplicate_dates_are_rejected(self):
        self.client.force_authenticate(self.employee_user)
        body = {"work_date": (timezone.localdate()+timedelta(days=1)).isoformat()}
        first = self.client.post("/api/remote-work/requests/", body)
        self.assertEqual(first.status_code, 201)
        duplicate = self.client.post("/api/remote-work/requests/", body)
        self.assertEqual(duplicate.status_code, 400)
        outsider = User.objects.create_user(email="remote-outsider@example.test", password="StrongPass!2026", role=User.Role.MANAGER)
        self.client.force_authenticate(outsider)
        decision = self.client.post(f"/api/remote-work/requests/{first.data['id']}/decision/", {"status": "APPROVED"})
        self.assertEqual(decision.status_code, 403)

    def test_employees_see_only_directory_fields_and_active_rows(self):
        self.client.force_authenticate(self.employee_user)
        response = self.client.get("/api/employees/directory/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertNotIn("official_email", response.data[0])
        self.assertNotIn("phone_number", response.data[0])
    def test_hr_cannot_approve_own_remote_work_request(self):
        hr = User.objects.create_user(
            email="remote-hr-self@example.test",
            password="StrongPass!2026",
            role=User.Role.HR,
        )
    
        Employee.objects.create(
            user=hr,
            employee_code="RWH001",
            official_email=hr.email,
            first_name="Remote",
            last_name="HR",
            department=self.employee.department,
            designation=self.employee.designation,
            employment_status=Employee.EmploymentStatus.ACTIVE,
            date_of_joining=timezone.localdate() - timedelta(days=60),
        )
    
        self.client.force_authenticate(hr)
    
        created = self.client.post(
            "/api/remote-work/requests/",
            {
                "work_date": (
                    timezone.localdate() + timedelta(days=1)
                ).isoformat(),
                "reason": "Testing the self-approval restriction.",
            },
            format="json",
        )
    
        self.assertEqual(created.status_code, 201, created.data)
    
        denied = self.client.post(
            f"/api/remote-work/requests/{created.data['id']}/decision/",
            {"status": "APPROVED"},
            format="json",
        )
    
        self.assertEqual(denied.status_code, 403, denied.data)
    
        remote_request = RemoteWorkRequest.objects.get(
            pk=created.data["id"]
        )
    
        self.assertEqual(
            remote_request.status,
            RemoteWorkRequest.Status.PENDING,
        )
        self.assertIsNone(remote_request.decided_by_id)