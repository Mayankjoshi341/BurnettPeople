from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from organization.models import Department, Designation, WorkLocation


class OrganizationLookupAPITests(APITestCase):
    def setUp(self):
        self.hr_user = User.objects.create_user(
            email="hr.lookup@example.com",
            password="Safe-HR-Password-8941!",
            role=User.Role.HR,
            is_active=True,
        )
        self.employee_user = User.objects.create_user(
            email="employee.lookup@example.com",
            password="Safe-Employee-Password-8941!",
            role=User.Role.EMPLOYEE,
            is_active=True,
        )
        Department.objects.create(name="Engineering", code="ENG", is_active=True)
        Department.objects.create(name="Archived", code="ARC", is_active=False)
        Designation.objects.create(title="Software Engineer", grade="L1", is_active=True)
        Designation.objects.create(title="Retired Role", grade="", is_active=False)
        WorkLocation.objects.create(name="Indore", is_active=True)
        WorkLocation.objects.create(name="Closed Office", is_active=False)

    def test_lookup_endpoints_require_authentication(self):
        for url in (
            "/api/organization/departments/",
            "/api/organization/designations/",
            "/api/organization/work-locations/",
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_employee_role_cannot_read_hr_lookup_endpoints(self):
        self.client.force_authenticate(user=self.employee_user)
        for url in (
            "/api/organization/departments/",
            "/api/organization/designations/",
            "/api/organization/work-locations/",
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_hr_sees_only_active_departments(self):
        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get("/api/organization/departments/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["name"] for item in response.data], ["Engineering"])

    def test_hr_sees_only_active_designations(self):
        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get("/api/organization/designations/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["title"] for item in response.data], ["Software Engineer"])

    def test_hr_sees_only_active_work_locations(self):
        self.client.force_authenticate(user=self.hr_user)
        response = self.client.get("/api/organization/work-locations/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["name"] for item in response.data], ["Indore"])
