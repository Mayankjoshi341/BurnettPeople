from rest_framework import serializers

from attendance.models import AttendanceException, AttendanceRecord, BreakSession


class BreakSessionSerializer(serializers.ModelSerializer):
    break_type = serializers.CharField(source="rule.break_type", read_only=True)
    duration_seconds = serializers.IntegerField(read_only=True)

    class Meta:
        model = BreakSession
        fields = ["id", "break_type", "started_at", "ended_at", "duration_seconds"]


class AttendanceRecordSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    schedule_name = serializers.CharField(source="schedule.name", read_only=True)
    breaks = BreakSessionSerializer(source="break_sessions", many=True, read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            "id", "employee", "employee_code", "work_date", "schedule", "schedule_name",
            "check_in", "check_out", "status", "breaks", "created_at", "updated_at",
        ]
        read_only_fields = fields


class AttendanceExceptionSerializer(serializers.ModelSerializer):
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    exception_label = serializers.CharField(source="get_exception_type_display", read_only=True)
    status_label = serializers.CharField(source="get_review_status_display", read_only=True)
    reviewed_by_email = serializers.EmailField(source="reviewed_by.email", read_only=True, allow_null=True)

    class Meta:
        model = AttendanceException
        fields = [
            "id", "employee", "employee_code", "attendance", "break_session", "exception_type",
            "exception_label", "reason", "review_status", "status_label", "review_comment",
            "reviewed_by", "reviewed_by_email", "reviewed_at", "submitted_at",
        ]
        read_only_fields = fields


class AttendanceExceptionCreateSerializer(serializers.Serializer):
    exception_type = serializers.ChoiceField(
        choices=AttendanceException.ExceptionType.choices,
        required=True,
    )
    reason = serializers.CharField(
        max_length=4000,
        trim_whitespace=True,
        required=True,
    )
    attendance_id = serializers.IntegerField(
        required=False,
        min_value=1,
    )

    def validate_reason(self, value):
        value = value.strip()

        if len(value) < 10:
            raise serializers.ValidationError(
                "Please enter at least 10 characters in the description."
            )

        return value

class AttendanceExceptionReviewSerializer(serializers.Serializer):
    review_status = serializers.ChoiceField(choices=["APPROVED", "REJECTED"])
    review_comment = serializers.CharField(required=False, allow_blank=True, max_length=4000)
