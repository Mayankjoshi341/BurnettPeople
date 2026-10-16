"""Read-only serializers for schedule and policy data exposed to dashboards."""

from rest_framework import serializers

from attendance.models import BreakPolicy, BreakPolicyRule
from employees.models import EmployeeScheduleAssignment, WorkSchedule


class BreakPolicyRuleReadSerializer(serializers.ModelSerializer):
    break_type_label = serializers.CharField(source="get_break_type_display", read_only=True)
    duration_mode_label = serializers.CharField(source="get_duration_mode_display", read_only=True)

    class Meta:
        model = BreakPolicyRule
        fields = [
            "id",
            "break_type",
            "break_type_label",
            "allowed_start_time",
            "allowed_end_time",
            "duration_minutes",
            "duration_mode",
            "duration_mode_label",
            "is_active",
        ]
        read_only_fields = fields


class BreakPolicyReadSerializer(serializers.ModelSerializer):
    rules = BreakPolicyRuleReadSerializer(many=True, read_only=True)

    class Meta:
        model = BreakPolicy
        fields = ["id", "code", "name", "version", "description", "is_active", "rules"]
        read_only_fields = fields


class WorkScheduleReadSerializer(serializers.ModelSerializer):
    break_policy = BreakPolicyReadSerializer(read_only=True)

    class Meta:
        model = WorkSchedule
        fields = [
            "id",
            "name",
            "start_time",
            "end_time",
            "workdays",
            "timezone",
            "late_grace_minutes",
            "is_active",
            "break_policy",
        ]
        read_only_fields = fields


class EmployeeScheduleAssignmentReadSerializer(serializers.ModelSerializer):
    work_schedule = WorkScheduleReadSerializer(read_only=True)

    class Meta:
        model = EmployeeScheduleAssignment
        fields = ["id", "effective_from", "effective_until", "work_schedule"]
        read_only_fields = fields
