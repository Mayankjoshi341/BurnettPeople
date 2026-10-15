from rest_framework import serializers

from organization.models import Department, Designation, WorkLocation


class DepartmentLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "name", "code", "description", "is_active")
        read_only_fields = fields


class DesignationLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Designation
        fields = ("id", "title", "grade", "is_active")
        read_only_fields = fields


class WorkLocationLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkLocation
        fields = ("id", "name", "address", "timezone", "is_active")
        read_only_fields = fields
