
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

    class Meta:
        model = Employee
        fields = [
            "id",
            "employee_code",
            "official_email",
            "first_name",
            "last_name",
            "department",
            "designation",
            "manager",
            "work_location",
            "employment_type",
            "employment_status",
            "date_of_joining",
            "date_of_exit",
            "phone_number",
            "user",
            "account_activation_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "employment_status",
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

        matches = Employee.objects.filter(
            employee_code__iexact=value
        )

        if self.instance is not None:
            matches = matches.exclude(pk=self.instance.pk)

        if matches.exists():
            raise serializers.ValidationError(
                "This employee code already exists."
            )

        return value

    def validate_official_email(self, value):
        value = value.strip().lower()

        if Employee.objects.filter(
            official_email__iexact=value
        ).exists():
            raise serializers.ValidationError(
                "An employee with this email already exists."
            )

        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )

        return value

    def validate(self, attrs):
        manager = attrs.get(
            "manager",
            getattr(self.instance, "manager", None),
        )

        if self.instance is not None and manager == self.instance:
            raise serializers.ValidationError({
                "manager": "An employee cannot manage themselves."
            })

        joining_date = attrs.get(
            "date_of_joining",
            getattr(self.instance, "date_of_joining", None),
        )
        exit_date = attrs.get(
            "date_of_exit",
            getattr(self.instance, "date_of_exit", None),
        )

        if joining_date and exit_date and exit_date < joining_date:
            raise serializers.ValidationError({
                "date_of_exit": "Exit date cannot precede joining date."
            })

        return attrs

    def create(self, validated_data):
        request = self.context["request"]

        try:
            employee, invitation = create_employee_with_invitation(
                employee_data=validated_data,
                created_by=request.user,
            )
        except DjangoValidationError as exc:
            detail = getattr(
                exc,
                "message_dict",
                {"detail": exc.messages},
            )
            raise serializers.ValidationError(detail) from exc

        return employee

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

        if (
            latest.delivery_status
            == AccountInvitation.DeliveryStatus.FAILED
        ):
            return "DELIVERY_FAILED"

        if (
            latest.delivery_status
            == AccountInvitation.DeliveryStatus.SENT
        ):
            return "ACTIVATION_PENDING"

        return "EMAIL_PENDING"
