from rest_framework import serializers
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from organization.models import Department, Designation, WorkLocation


class DepartmentLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "name", "code", "description", "is_active")
        read_only_fields = ("id",)

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name cannot be empty.")
        return value

    def validate_code(self, value):
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("Code cannot be empty.")
        return value


class DesignationLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Designation
        fields = ("id", "title", "grade", "is_active")
        read_only_fields = ("id",)

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Title cannot be empty.")
        return value


class WorkLocationLookupSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkLocation
        fields = ("id", "name", "address", "timezone", "is_active")
        read_only_fields = ("id",)

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name cannot be empty.")
        return value

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise serializers.ValidationError("Enter a valid IANA time zone.") from exc
        return value
