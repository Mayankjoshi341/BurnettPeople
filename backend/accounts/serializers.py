
from rest_framework import serializers

from .models import User
from django.core.exceptions import ValidationError as DjangoValidationError

from accounts.services.activation import (
    InvalidInvitationError,
    activate_account,
)


class CurrentUserSerializer(serializers.ModelSerializer):
    """Expose safe profile information for the authenticated user."""

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
        )
        read_only_fields = fields


class AccountActivationSerializer(serializers.Serializer):
    token = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        max_length=256,
    )

    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        max_length=128,
        style={"input_type": "password"},
    )

    password_confirm = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        max_length=128,
        style={"input_type": "password"},
    )

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({
                "password_confirm": "The passwords do not match."
            })

        return attrs

    def create(self, validated_data):
        raw_token = validated_data["token"]
        password = validated_data["password"]

        try:
            return activate_account(
                raw_token=raw_token,
                password=password,
            )
        except InvalidInvitationError:
            raise serializers.ValidationError({
                "token": (
                    "This activation link is invalid, expired, "
                    "or has already been used."
                )
            })
        except DjangoValidationError as exc:
            raise serializers.ValidationError({
                "password": exc.messages
            })




class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(
        regex=r"^\d{6}$",
        error_messages={
            "invalid": "Enter the six-digit reset code."
        },
    )
    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        max_length=128,
    )
    password_confirm = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        max_length=128,
    )

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({
                "password_confirm": "The passwords do not match."
            })

        attrs.pop("password_confirm")
        return attrs
