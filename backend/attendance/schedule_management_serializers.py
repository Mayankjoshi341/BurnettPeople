"""Input and output serializers for HR-managed work schedule assignments."""

from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Q
from rest_framework import serializers

from attendance.models import BreakPolicy
from attendance.reporting_serializers import WorkScheduleReadSerializer
from employees.models import Employee, EmployeeScheduleAssignment, WorkSchedule


class ScheduleAssignmentReadSerializer(serializers.ModelSerializer):
    employee_id = serializers.IntegerField(read_only=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True)
    employee_first_name = serializers.CharField(source="employee.first_name", read_only=True)
    employee_last_name = serializers.CharField(source="employee.last_name", read_only=True)
    work_schedule_id = serializers.IntegerField(read_only=True)
    work_schedule = WorkScheduleReadSerializer(read_only=True)

    class Meta:
        model = EmployeeScheduleAssignment
        fields = [
            "id",
            "employee_id",
            "employee_code",
            "employee_first_name",
            "employee_last_name",
            "work_schedule_id",
            "work_schedule",
            "effective_from",
            "effective_until",
            "created_at",
        ]
        read_only_fields = fields


class ScheduleAssignmentCreateSerializer(serializers.Serializer):
    """Create a dated schedule assignment without allowing overlapping ranges."""

    employee_id = serializers.PrimaryKeyRelatedField(
        source="employee",
        queryset=Employee.objects.all(),
    )
    work_schedule_id = serializers.PrimaryKeyRelatedField(
        source="work_schedule",
        queryset=WorkSchedule.objects.select_related("break_policy").all(),
    )
    effective_from = serializers.DateField()
    effective_until = serializers.DateField(required=False, allow_null=True, default=None)

    def validate(self, attrs):
        employee = attrs["employee"]
        schedule = attrs["work_schedule"]
        start_date = attrs["effective_from"]
        end_date = attrs.get("effective_until")

        if end_date is not None and end_date < start_date:
            raise serializers.ValidationError({
                "effective_until": "End date cannot precede start date."
            })

        if start_date < employee.date_of_joining:
            raise serializers.ValidationError({
                "effective_from": "A schedule assignment cannot start before the employee's joining date."
            })

        if employee.employment_status == Employee.EmploymentStatus.EXITED:
            raise serializers.ValidationError({
                "employee_id": "A schedule cannot be assigned to an exited employee."
            })
        if employee.date_of_exit:
            if start_date > employee.date_of_exit:
                raise serializers.ValidationError({
                    "effective_from": "The assignment cannot start after the employee's exit date."
                })
            if end_date is None or end_date > employee.date_of_exit:
                raise serializers.ValidationError({
                    "effective_until": "The assignment cannot extend beyond the employee's exit date."
                })
        if not schedule.is_active:
            raise serializers.ValidationError({
                "work_schedule_id": "Choose an active work schedule."
            })
        if not schedule.break_policy.is_active:
            raise serializers.ValidationError({
                "work_schedule_id": "The schedule's break policy is inactive."
            })

        self._validate_no_overlap(employee, start_date, end_date)
        return attrs

    @staticmethod
    def _validate_no_overlap(employee, start_date, end_date):
        effective_end = end_date or date.max
        overlapping = EmployeeScheduleAssignment.objects.filter(
            employee=employee,
            effective_from__lte=effective_end,
        ).filter(
            Q(effective_until__isnull=True) | Q(effective_until__gte=start_date)
        )
        if overlapping.exists():
            raise serializers.ValidationError({
                "effective_from": (
                    "This date range overlaps an existing schedule assignment. "
                    "Set the previous assignment's end date before adding another."
                )
            })

    def create(self, validated_data):
        return EmployeeScheduleAssignment.objects.create(**validated_data)


class ScheduleAssignmentEndSerializer(serializers.Serializer):
    """Set an assignment's inclusive end date; other history is immutable."""

    effective_until = serializers.DateField()

    def validate_effective_until(self, end_date):
        assignment = self.context["assignment"]
        if end_date < assignment.effective_from:
            raise serializers.ValidationError("End date cannot precede start date.")

        employee_exit_date = assignment.employee.date_of_exit
        if employee_exit_date and end_date > employee_exit_date:
            raise serializers.ValidationError(
                "The assignment cannot extend beyond the employee's exit date."
            )

        overlapping = EmployeeScheduleAssignment.objects.filter(
            employee_id=assignment.employee_id,
            effective_from__lte=end_date,
        ).filter(
            Q(effective_until__isnull=True) | Q(effective_until__gte=assignment.effective_from)
        ).exclude(pk=assignment.pk)
        if overlapping.exists():
            raise serializers.ValidationError(
                "This end date would overlap another schedule assignment."
            )
        return end_date

    def update(self, instance, validated_data):
        instance.effective_until = validated_data["effective_until"]
        instance.save(update_fields=["effective_until"])
        return instance


class WorkScheduleWriteSerializer(serializers.ModelSerializer):
    break_policy_id = serializers.PrimaryKeyRelatedField(
        source="break_policy", queryset=BreakPolicy.objects.filter(is_active=True)
    )

    class Meta:
        model = WorkSchedule
        fields = [
            "id", "name", "start_time", "end_time", "workdays", "timezone",
            "late_grace_minutes", "break_policy_id", "is_active",
        ]
        read_only_fields = ["id"]

    def validate_timezone(self, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise serializers.ValidationError("Enter a valid IANA time zone.") from exc
        return value

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start is not None and start == end:
            raise serializers.ValidationError({"end_time": "Start and end times cannot be equal."})

        if self.instance and (
            self.instance.employee_assignments.exists()
            or self.instance.attendance_records.exists()
        ):
            historical_fields = ("name", "start_time", "end_time", "workdays", "timezone",
                                 "late_grace_minutes", "break_policy")
            changed = [field for field in historical_fields
                       if field in attrs and getattr(self.instance, f"{field}_id" if field == "break_policy" else field)
                       != (attrs[field].pk if field == "break_policy" else attrs[field])]
            if changed:
                raise serializers.ValidationError(
                    "This schedule has assignments or attendance history. Create a new schedule to preserve historical records."
                )
        return attrs
