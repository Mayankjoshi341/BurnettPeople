from rest_framework.generics import ListAPIView

from accounts.permissions import IsHROrAdmin
from organization.models import Department, Designation, WorkLocation
from organization.serializers import (
    DepartmentLookupSerializer,
    DesignationLookupSerializer,
    WorkLocationLookupSerializer,
)


class DepartmentLookupView(ListAPIView):
    """Active departments available when HR creates an employee."""

    serializer_class = DepartmentLookupSerializer
    permission_classes = [IsHROrAdmin]

    def get_queryset(self):
        return Department.objects.filter(is_active=True).order_by("name", "id")


class DesignationLookupView(ListAPIView):
    """Active designations available when HR creates an employee."""

    serializer_class = DesignationLookupSerializer
    permission_classes = [IsHROrAdmin]

    def get_queryset(self):
        return Designation.objects.filter(is_active=True).order_by("title", "id")


class WorkLocationLookupView(ListAPIView):
    """Active work locations available when HR creates an employee."""

    serializer_class = WorkLocationLookupSerializer
    permission_classes = [IsHROrAdmin]

    def get_queryset(self):
        return WorkLocation.objects.filter(is_active=True).order_by("name", "id")
