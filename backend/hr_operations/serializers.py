from django.utils import timezone
from rest_framework import serializers

from employees.models import Employee
from hr_operations.models import (
    Asset,
    AssetAssignment,
    CompanyHoliday,
    LeaveBalance,
    LeaveRequest,
    LeaveType,
    Notification,
)


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = [
            "id", "code", "name", "description", "is_paid", "max_consecutive_days",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_code(self, value):
        return value.strip().upper()

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name cannot be empty.")
        return value


class CompanyHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyHoliday
        fields = ["id", "date", "name", "description", "is_active", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def validate_date(self, value):
        # HR may still register a past holiday for records; employee leave-day
        # calculations only exclude holidays within the requested date range.
        return value

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Holiday name cannot be empty.")
        return value


class LeaveBalanceSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.SerializerMethodField()
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    leave_type_code = serializers.CharField(source="leave_type.code", read_only=True)
    available_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = LeaveBalance
        fields = [
            "id", "employee", "employee_code", "employee_name", "leave_type", "leave_type_name",
            "leave_type_code", "year", "entitled_days", "used_days", "reserved_days", "available_days",
        ]
        read_only_fields = fields

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name}".strip()


class LeaveBalanceAllocationSerializer(serializers.Serializer):
    employee_id = serializers.PrimaryKeyRelatedField(source="employee", queryset=Employee.objects.all())
    leave_type_id = serializers.PrimaryKeyRelatedField(source="leave_type", queryset=LeaveType.objects.all())
    year = serializers.IntegerField(min_value=2000, max_value=9999)
    entitled_days = serializers.IntegerField(min_value=0, max_value=366)


class LeaveRequestCreateSerializer(serializers.Serializer):
    leave_type_id = serializers.PrimaryKeyRelatedField(
        source="leave_type", queryset=LeaveType.objects.filter(is_active=True)
    )
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    reason = serializers.CharField(required=False, allow_blank=True, max_length=5000)

    def validate(self, attrs):
        if attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError({"end_date": "End date must be on or after start date."})
        if attrs["start_date"] < timezone.localdate():
            raise serializers.ValidationError({"start_date": "Leave requests cannot start in the past."})
        return attrs


class LeaveRequestReadSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.SerializerMethodField()
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    leave_type_code = serializers.CharField(source="leave_type.code", read_only=True)
    decided_by_email = serializers.EmailField(source="decided_by.email", read_only=True, allow_null=True)

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "employee", "employee_code", "employee_name", "leave_type", "leave_type_name",
            "leave_type_code", "start_date", "end_date", "days_count", "reason", "status",
            "submitted_at", "decided_by", "decided_by_email", "decided_at", "decision_comment",
        ]
        read_only_fields = fields

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name}".strip()


class LeaveDecisionSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = [
            "id", "asset_tag", "name", "category", "manufacturer", "model", "serial_number",
            "purchase_date", "location", "status", "notes", "created_by", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "status", "created_by", "created_at", "updated_at"]

    def validate_asset_tag(self, value):
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("Asset tag cannot be empty.")
        return value


class AssetStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        (Asset.Status.AVAILABLE, Asset.Status.AVAILABLE.label),
        (Asset.Status.REPAIR, Asset.Status.REPAIR.label),
        (Asset.Status.RETIRED, Asset.Status.RETIRED.label),
    ])


class AssetAssignmentCreateSerializer(serializers.Serializer):
    asset_id = serializers.PrimaryKeyRelatedField(source="asset", queryset=Asset.objects.all())
    employee_id = serializers.PrimaryKeyRelatedField(source="employee", queryset=Employee.objects.all())
    condition_on_assignment = serializers.CharField(required=False, allow_blank=True, max_length=250)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=5000)


class AssetAssignmentReturnSerializer(serializers.Serializer):
    condition_on_return = serializers.CharField(required=False, allow_blank=True, max_length=250)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=5000)


class AssetAssignmentReadSerializer(serializers.ModelSerializer):
    asset_tag = serializers.CharField(source="asset.asset_tag", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    asset_category = serializers.CharField(source="asset.category", read_only=True)
    asset_status = serializers.CharField(source="asset.status", read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_name = serializers.SerializerMethodField()
    assigned_by_email = serializers.EmailField(source="assigned_by.email", read_only=True)
    returned_by_email = serializers.EmailField(source="returned_by.email", read_only=True, allow_null=True)

    class Meta:
        model = AssetAssignment
        fields = [
            "id", "asset", "asset_tag", "asset_name", "asset_category", "asset_status", "employee",
            "employee_code", "employee_name", "assigned_by", "assigned_by_email", "assigned_at",
            "condition_on_assignment", "returned_at", "returned_by", "returned_by_email",
            "condition_on_return", "notes",
        ]
        read_only_fields = fields

    def get_employee_name(self, obj):
        return f"{obj.employee.first_name} {obj.employee.last_name}".strip()


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "message", "target_type", "target_id", "read_at", "is_read", "created_at"]
        read_only_fields = fields

    def get_is_read(self, obj):
        return obj.read_at is not None


class LeaveDraftSerializer(serializers.Serializer):
    leave_type = serializers.CharField(max_length=100, required=False, allow_blank=True, default="leave")
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    reason = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")
    manager_name = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError({"end_date": "End date must be on or after start date."})
        if attrs["start_date"] < timezone.localdate():
            raise serializers.ValidationError({"start_date": "Draft dates cannot start in the past."})
        return attrs
