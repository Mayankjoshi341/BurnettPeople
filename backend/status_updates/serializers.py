from rest_framework import serializers

from .models import StatusUpdate


class StatusUpdateSerializer(serializers.ModelSerializer):
    author_id = serializers.IntegerField(source="author.id", read_only=True)
    author_name = serializers.SerializerMethodField()
    author_email = serializers.EmailField(source="author.email", read_only=True)
    author_role = serializers.CharField(source="author.role", read_only=True)
    employee_id = serializers.IntegerField(source="employee.id", read_only=True, allow_null=True)
    employee_code = serializers.CharField(source="employee.employee_code", read_only=True, allow_null=True)
    department = serializers.CharField(source="employee.department.name", read_only=True, allow_null=True)
    designation = serializers.CharField(source="employee.designation.title", read_only=True, allow_null=True)

    class Meta:
        model = StatusUpdate
        fields = [
            "id", "author_id", "author_name", "author_email", "author_role",
            "employee_id", "employee_code", "department", "designation",
            "update_date", "work_status", "completed_work", "currently_working",
            "testing", "tech_stack", "remaining_work", "blocker", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "author_id", "author_name", "author_email", "author_role",
            "employee_id", "employee_code", "department", "designation", "update_date", "created_at", "updated_at",
        ]

    def get_author_name(self, obj):
        name = f"{obj.author.first_name} {obj.author.last_name}".strip()
        if name:
            return name
        if obj.employee_id:
            return f"{obj.employee.first_name} {obj.employee.last_name}".strip()
        return obj.author.email

    def validate_completed_work(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Describe at least one item of completed work.")
        return value

    def validate_currently_working(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Describe what you are currently working on.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        if request and self.instance and self.instance.author_id != request.user.id:
            raise serializers.ValidationError("You can only edit your own work status update.")
        return attrs
