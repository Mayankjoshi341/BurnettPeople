from django.db import transaction
from rest_framework import serializers

from attendance.models import BreakPolicy, BreakPolicyRule


class BreakPolicyRuleInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = BreakPolicyRule
        fields = ("break_type", "allowed_start_time", "allowed_end_time", "duration_minutes", "duration_mode", "is_active")

    def validate(self, attrs):
        start = attrs.get("allowed_start_time", getattr(self.instance, "allowed_start_time", None))
        end = attrs.get("allowed_end_time", getattr(self.instance, "allowed_end_time", None))
        if start is not None and end is not None and start >= end:
            raise serializers.ValidationError({"allowed_end_time": "Break window must end after it starts."})
        return attrs


class BreakPolicyWriteSerializer(serializers.ModelSerializer):
    rules = BreakPolicyRuleInputSerializer(many=True, required=False)

    class Meta:
        model = BreakPolicy
        fields = ("id", "code", "name", "version", "description", "is_active", "rules")
        read_only_fields = ("id",)

    def validate_code(self, value):
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("Policy code cannot be empty.")
        return value

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Policy name cannot be empty.")
        return value

    def validate(self, attrs):
        rules = attrs.get("rules")
        if rules is not None:
            types = [rule["break_type"] for rule in rules]
            if len(types) != len(set(types)):
                raise serializers.ValidationError({"rules": "A policy can have only one rule per break type."})
        if self.instance and rules is not None:
            raise serializers.ValidationError({"rules": "Break rules are versioned. Create a new policy version to change them."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        rules = validated_data.pop("rules", [])
        policy = BreakPolicy.objects.create(**validated_data)
        for rule in rules:
            BreakPolicyRule.objects.create(policy=policy, **rule)
        return policy
