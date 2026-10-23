from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.generics import ListCreateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsHROrAdmin
from organization.models import Department, Designation, WorkLocation
from organization.serializers import (
    DepartmentLookupSerializer,
    DesignationLookupSerializer,
    WorkLocationLookupSerializer,
)


class OrganizationListCreateView(ListCreateAPIView):
    """Expose active lookup records and authorized HR/Admin maintenance."""

    permission_classes = [IsHROrAdmin]

    def get_queryset(self):
        queryset = self.model.objects.all()
        include_inactive = self.request.query_params.get("include_inactive", "false").lower()
        if include_inactive not in {"true", "1"}:
            queryset = queryset.filter(is_active=True)
        return queryset.order_by(*self.ordering)


class DepartmentLookupView(OrganizationListCreateView):
    model = Department
    serializer_class = DepartmentLookupSerializer
    ordering = ("name", "id")


class DesignationLookupView(OrganizationListCreateView):
    model = Designation
    serializer_class = DesignationLookupSerializer
    ordering = ("title", "id")


class WorkLocationLookupView(OrganizationListCreateView):
    model = WorkLocation
    ordering = ("name", "id")
    serializer_class = WorkLocationLookupSerializer


class OrganizationDetailView(APIView):
    permission_classes = [IsHROrAdmin]
    model = None
    serializer_class = None

    def get_object(self, pk):
        return get_object_or_404(self.model, pk=pk)

    def patch(self, request, pk):
        item = self.get_object(pk)
        serializer = self.serializer_class(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        item = self.get_object(pk)
        if item.is_active:
            item.is_active = False
            item.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class DepartmentDetailView(OrganizationDetailView):
    model = Department
    serializer_class = DepartmentLookupSerializer


class DesignationDetailView(OrganizationDetailView):
    model = Designation
    serializer_class = DesignationLookupSerializer


class WorkLocationDetailView(OrganizationDetailView):
    model = WorkLocation
    serializer_class = WorkLocationLookupSerializer
