
from django.db import transaction
from django.utils import timezone
from django.utils import dateparse

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from accounts.models import AccountInvitation, AuditEvent
from accounts.services.audit import record_audit_event

from accounts.models import AccountInvitation
from accounts.permissions import IsHROrAdmin
from accounts.services.invitations import create_or_resend_invitation
from employees.models import Employee
from employees.serializers import EmployeeSerializer


class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    permission_classes = [IsHROrAdmin]

    def get_queryset(self):
        queryset = (
            Employee.objects
            .select_related(
                "department",
                "designation",
                "manager",
                "work_location",
                "user",
            )
            .prefetch_related("user__account_invitations")
        )

        activation_filter = self.request.query_params.get(
            "activation_status"
        )

        if activation_filter == "pending":
            queryset = queryset.filter(
                user__isnull=False,
                user__is_active=False,
            )
        elif activation_filter == "activated":
            queryset = queryset.filter(user__is_active=True)

        return queryset

    @action(
        detail=False,
        methods=["get"],
        url_path="pending-activations",
    )
    def pending_activations(self, request):
        employees = self.filter_queryset(
            self.get_queryset().filter(
                user__isnull=False,
                user__is_active=False,
            )
        )

        page = self.paginate_queryset(employees)

        if page is not None:
            data = self.get_serializer(page, many=True).data
            return self.get_paginated_response(data)

        return Response(self.get_serializer(employees, many=True).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="resend-invitation",
    )
    def resend_invitation(self, request, pk=None):
        employee = self.get_object()

        if employee.user_id is None:
            raise ValidationError(
                "This employee has no linked portal account."
            )

        try:
            invitation = create_or_resend_invitation(
                user=employee.user,
                created_by=request.user,
            )
        except ValueError as exc:
            raise ValidationError(str(exc)) from exc

        return Response(
            {
                "detail": "A new activation invitation has been queued.",
                "invitation_id": invitation.pk,
                "delivery_status": invitation.delivery_status,
                "expires_at": invitation.expires_at,
            },
            status=status.HTTP_202_ACCEPTED,
        )

 
    @transaction.atomic
    def perform_destroy(self, employee):
        # Preserve HR history instead of physically deleting the record.
        employee.employment_status = Employee.EmploymentStatus.EXITED
        employee.date_of_exit = (
            employee.date_of_exit or timezone.localdate()
        )
        employee.save(
            update_fields=[
                "employment_status",
                "date_of_exit",
                "updated_at",
            ]
        )

        user = employee.user if employee.user_id is not None else None

        if user is not None:
            # Deactivate the linked account.
            user.is_active = False
            user.save(update_fields=["is_active"])

            # Revoke unused invitations.
            now = timezone.now()
            AccountInvitation.objects.filter(
                user=user,
                accepted_at__isnull=True,
                revoked_at__isnull=True,
            ).update(revoked_at=now, updated_at=now)

            # Revoke outstanding refresh tokens.
            for token in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=token)

        # Record the event even if the employee has no linked user.
        record_audit_event(
            action=AuditEvent.Action.EMPLOYEE_DEACTIVATED,
            actor=self.request.user,
            subject_user=user,
            subject_email=user.email if user is not None else "",
            object_type="Employee",
            object_id=employee.pk,
            metadata={
                "employment_status": employee.employment_status,
            },
        )
