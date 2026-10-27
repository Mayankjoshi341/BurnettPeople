from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from accounts.models import AccountInvitation
from employees.models import Employee
from employees.services import create_employee_with_invitation


User = get_user_model()


class EmployeeSerializer(serializers.ModelSerializer):
    account_activation_status = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="department.name", read_only=True)
    designation_title = serializers.CharField(source="designation.title", read_only=True)
    manager_name = serializers.SerializerMethodField()
    work_location_name = serializers.SerializerMethodField()
    portal_role = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_code",
            "official_email",
            "first_name",
            "last_name",
            "department",
            "department_name",
            "designation",
            "designation_title",
            "manager",
            "manager_name",
            "work_location",
            "work_location_name",
            "employment_type",
            "employment_status",
            "date_of_joining",
            "date_of_exit",
            "phone_number",
            "user",
            "portal_role",
            "account_activation_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "employment_status",
            "department_name",
            "designation_title",
            "manager_name",
            "work_location_name",
            "portal_role",
            "account_activation_status",
            "created_at",
            "updated_at",
        ]

    def get_fields(self):
        fields = super().get_fields()

        # Keep identity fields immutable through ordinary update requests.
        # Changing an email later needs a dedicated identity-change flow.
        if self.instance is not None:
            fields["employee_code"].read_only = True
            fields["official_email"].read_only = True

        return fields

    def validate_employee_code(self, value):
        value = value.strip().upper()
        matches = Employee.objects.filter(employee_code__iexact=value)
        if self.instance is not None:
            matches = matches.exclude(pk=self.instance.pk)
        if matches.exists():
            raise serializers.ValidationError("This employee code already exists.")
        return value

    def validate_official_email(self, value):
        value = value.strip().lower()
        if Employee.objects.filter(official_email__iexact=value).exists():
            raise serializers.ValidationError("An employee with this email already exists.")
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        manager = attrs.get("manager", getattr(self.instance, "manager", None))
        if self.instance is not None and manager == self.instance:
            raise serializers.ValidationError({"manager": "An employee cannot manage themselves."})

        joining_date = attrs.get("date_of_joining", getattr(self.instance, "date_of_joining", None))
        exit_date = attrs.get("date_of_exit", getattr(self.instance, "date_of_exit", None))
        if joining_date and exit_date and exit_date < joining_date:
            raise serializers.ValidationError({"date_of_exit": "Exit date cannot precede joining date."})
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        try:
            employee, invitation = create_employee_with_invitation(
                employee_data=validated_data,
                created_by=request.user,
            )
        except DjangoValidationError as exc:
            detail = getattr(exc, "message_dict", {"detail": exc.messages})
            raise serializers.ValidationError(detail) from exc
        return employee

    def get_department_name(self, employee):
        return employee.department.name if employee.department_id else None

    def get_designation_title(self, employee):
        return employee.designation.title if employee.designation_id else None

    def get_manager_name(self, employee):
        if employee.manager_id is None:
            return None
        return f"{employee.manager.first_name} {employee.manager.last_name}".strip()

    def get_work_location_name(self, employee):
        return employee.work_location.name if employee.work_location_id else None

    def get_portal_role(self, employee):
        return employee.user.role if employee.user_id is not None else None

    def get_account_activation_status(self, employee):
        if employee.user_id is None:
            return "NO_PORTAL_ACCOUNT"

        user = employee.user
        if user.is_active:
            return "ACTIVATED"

        # The related invitations are prefetched by the view.
        invitations = list(user.account_invitations.all())
        if not invitations:
            return "NOT_INVITED"

        latest = invitations[0]
        if latest.accepted_at is not None:
            return "ACTIVATED"
        if latest.revoked_at is not None:
            return "INVITATION_REVOKED"
        if latest.expires_at <= timezone.now():
            return "INVITATION_EXPIRED"
        if latest.delivery_status == AccountInvitation.DeliveryStatus.FAILED:
            return "DELIVERY_FAILED"
        if latest.delivery_status == AccountInvitation.DeliveryStatus.SENT:
            return "ACTIVATION_PENDING"
        return "EMAIL_PENDING"

class EmploymentStatusTransitionSerializer(serializers.Serializer):
    """Validate explicit HR-managed employment lifecycle transitions."""

    employment_status = serializers.ChoiceField(
        choices=Employee.EmploymentStatus.choices,
        required=True,
    )
    date_of_exit = serializers.DateField(required=False, allow_null=True)

    ALLOWED_TRANSITIONS = {
        Employee.EmploymentStatus.PREBOARDING: {
            Employee.EmploymentStatus.PREBOARDING,
            Employee.EmploymentStatus.ACTIVE,
            Employee.EmploymentStatus.EXITED,
        },
        Employee.EmploymentStatus.ACTIVE: {
            Employee.EmploymentStatus.ACTIVE,
            Employee.EmploymentStatus.NOTICE_PERIOD,
            Employee.EmploymentStatus.EXITED,
        },
        Employee.EmploymentStatus.NOTICE_PERIOD: {
            Employee.EmploymentStatus.NOTICE_PERIOD,
            Employee.EmploymentStatus.ACTIVE,
            Employee.EmploymentStatus.EXITED,
        },
        # Exited records are terminal; rehire should be a separate workflow.
        Employee.EmploymentStatus.EXITED: {
            Employee.EmploymentStatus.EXITED,
        },
    }

    def validate(self, attrs):
        employee = self.context["employee"]
        target_status = attrs["employment_status"]
        requested_exit_date = attrs.get("date_of_exit")

        if target_status not in self.ALLOWED_TRANSITIONS[employee.employment_status]:
            raise serializers.ValidationError({
                "employment_status": (
                    f"Cannot change employment status from "
                    f"{employee.employment_status} to {target_status}."
                )
            })

        if requested_exit_date is not None:
            if target_status != Employee.EmploymentStatus.EXITED:
                raise serializers.ValidationError({
                    "date_of_exit": "An exit date can only be supplied when status is EXITED."
                })
            if requested_exit_date < employee.date_of_joining:
                raise serializers.ValidationError({
                    "date_of_exit": "Exit date cannot precede the joining date."
                })
            if (
                employee.employment_status == Employee.EmploymentStatus.EXITED
                and requested_exit_date != employee.date_of_exit
            ):
                raise serializers.ValidationError({
                    "date_of_exit": (
                        "Correcting an existing exit date requires a separate HR correction workflow."
                    )
                })

        return attrs


class EmployeeRoleChangeSerializer(serializers.Serializer):
    """Restrict this action to the approved Employee -> Manager transition."""

    role = serializers.ChoiceField(choices=User.Role.choices, required=True)

    def validate_role(self, value):
        if value != User.Role.MANAGER:
            raise serializers.ValidationError(
                "This endpoint only supports promoting an employee to Manager."
            )
        return value
