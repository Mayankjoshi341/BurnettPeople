from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

from accounts.models import AccountInvitation, AuditEvent, User
from accounts.permissions import IsHROrAdmin
from accounts.services.audit import record_audit_event
from accounts.services.invitations import create_or_resend_invitation
from employees.models import Employee
from hr_operations.models import LeaveRequest, RemoteWorkRequest


class EmployeeDirectoryView(APIView):
    """Company directory with a deliberately limited, non-sensitive projection."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows = Employee.objects.filter(employment_status=Employee.EmploymentStatus.ACTIVE).select_related(
            "department", "designation", "manager"
        ).order_by("first_name", "last_name", "id")
        return Response([{
            "id": row.pk,
            "employee_code": row.employee_code,
            "first_name": row.first_name,
            "last_name": row.last_name,
            "department_name": row.department.name,
            "designation_title": row.designation.title,
            "manager_name": (f"{row.manager.first_name} {row.manager.last_name}".strip() if row.manager_id else ""),
              "date_of_joining": row.date_of_joining,
            "employment_status": row.employment_status,
        } for row in rows])


class EmployeeDirectoryOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        active = Employee.objects.filter(employment_status=Employee.EmploymentStatus.ACTIVE)
        total = active.count()
        on_leave = LeaveRequest.objects.filter(
            employee__employment_status=Employee.EmploymentStatus.ACTIVE,
            status=LeaveRequest.Status.APPROVED,
            start_date__lte=today, end_date__gte=today,
        ).values("employee_id").distinct().count()
        joiners = active.filter(date_of_joining__gte=today.replace(day=1), date_of_joining__lte=today).count()
        remote_work = RemoteWorkRequest.objects.filter(
            employee__employment_status=Employee.EmploymentStatus.ACTIVE,
            work_date=today, status=RemoteWorkRequest.Status.APPROVED,
        ).count()
        return Response({
            "total_employees": total,
            "departments": active.values("department_id").distinct().count(),
            "new_joiners_this_month": joiners,
            "on_leave_today": on_leave,
            "work_from_home_today": remote_work,
            "work_from_home_available": True,
        })
from employees.serializers import (
    EmployeeRoleChangeSerializer,
    EmployeeSerializer,
    EmploymentStatusTransitionSerializer,
)


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

        activation_filter = self.request.query_params.get("activation_status")
        if activation_filter == "pending":
            queryset = queryset.filter(user__isnull=False, user__is_active=False)
        elif activation_filter == "activated":
            queryset = queryset.filter(user__is_active=True)

        # Used by the employee form to populate valid manager FK choices.
        # Accept only known enum values; unknown filters do not broaden access
        # beyond the endpoint's existing HR/Admin permission boundary.
        employment_filter = self.request.query_params.get("employment_status")
        valid_statuses = {choice.value for choice in Employee.EmploymentStatus}
        if employment_filter in valid_statuses:
            queryset = queryset.filter(employment_status=employment_filter)

        return queryset

    @action(detail=False, methods=["get"], url_path="pending-activations")
    def pending_activations(self, request):
        employees = self.filter_queryset(
            self.get_queryset().filter(user__isnull=False, user__is_active=False)
        )
        page = self.paginate_queryset(employees)
        if page is not None:
            data = self.get_serializer(page, many=True).data
            return self.get_paginated_response(data)
        return Response(self.get_serializer(employees, many=True).data)

    @action(detail=True, methods=["post"], url_path="change-role")
    @transaction.atomic
    def change_role(self, request, pk=None):
        """Allow Admin to promote an active employee account to Manager."""
        if request.user.role != User.Role.ADMIN and not request.user.is_superuser:
            raise PermissionDenied("Only Admin can change employee roles.")

        selected = self.get_object()
        employee = Employee.objects.select_for_update().get(pk=selected.pk)

        if employee.user_id is None:
            raise ValidationError("This employee has no linked portal account.")
        if employee.user_id == request.user.pk:
            raise PermissionDenied("You cannot change your own role through this endpoint.")

        target_user = User.objects.select_for_update().get(pk=employee.user_id)
        serializer = EmployeeRoleChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_role = serializer.validated_data["role"]

        if employee.employment_status != Employee.EmploymentStatus.ACTIVE:
            raise ValidationError("Only active employees can be promoted to Manager.")
        if not target_user.is_active:
            raise ValidationError("The portal account must be activated before promotion.")

        # Retries are harmless: do not generate duplicate audit rows.
        if target_user.role == target_role:
            employee.refresh_from_db()
            return Response({
                "detail": "This employee is already a Manager.",
                "employee": self.get_serializer(employee).data,
            })

        if target_user.role != User.Role.EMPLOYEE:
            raise ValidationError("Only users with the Employee role can be promoted to Manager.")

        previous_role = target_user.role
        target_user.role = target_role
        target_user.save(update_fields=["role"])

        record_audit_event(
            action=AuditEvent.Action.EMPLOYEE_ROLE_CHANGED,
            actor=request.user,
            subject_user=target_user,
            subject_email=target_user.email,
            object_type="Employee",
            object_id=employee.pk,
            metadata={
                "employee_code": employee.employee_code,
                "previous_role": previous_role,
                "new_role": target_role,
            },
        )

        employee.refresh_from_db()
        return Response({
            "detail": "Employee promoted to Manager.",
            "employee": self.get_serializer(employee).data,
        })

    @action(detail=True, methods=["post"], url_path="resend-invitation")
    def resend_invitation(self, request, pk=None):
        employee = self.get_object()
        if employee.user_id is None:
            raise ValidationError("This employee has no linked portal account.")

        try:
            invitation = create_or_resend_invitation(user=employee.user, created_by=request.user)
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

    @action(detail=True, methods=["patch"], url_path="employment-status")
    @transaction.atomic
    def update_employment_status(self, request, pk=None):
        """Change an employee's lifecycle status through a validated HR API."""
        employee = self.get_object()
        serializer = EmploymentStatusTransitionSerializer(
            data=request.data,
            context={"employee": employee},
        )
        serializer.is_valid(raise_exception=True)

        previous_status = employee.employment_status
        target_status = serializer.validated_data["employment_status"]

        # Repeating the current status is idempotent and does not create a
        # duplicate audit event or re-run the exit side effects.
        if target_status == previous_status:
            return Response(self.get_serializer(employee).data)

        if target_status == Employee.EmploymentStatus.EXITED:
            exit_date = (
                serializer.validated_data.get("date_of_exit")
                or employee.date_of_exit
                or timezone.localdate()
            )
            if exit_date < employee.date_of_joining:
                raise ValidationError({
                    "date_of_exit": "Exit date cannot precede the joining date."
                })
            employee.date_of_exit = exit_date
            employee.save(update_fields=["date_of_exit", "updated_at"])

            # Reuse the established soft-exit path so access is disabled,
            # invitations are revoked, outstanding JWTs are blacklisted,
            # and the deactivation audit event is recorded.
            self.perform_destroy(employee)
        else:
            employee.employment_status = target_status
            employee.date_of_exit = None
            employee.save(update_fields=["employment_status", "date_of_exit", "updated_at"])
            record_audit_event(
                action=AuditEvent.Action.EMPLOYMENT_STATUS_CHANGED,
                actor=request.user,
                subject_user=employee.user,
                subject_email=employee.user.email if employee.user_id else employee.official_email,
                object_type="Employee",
                object_id=employee.pk,
                metadata={
                    "previous_status": previous_status,
                    "employment_status": target_status,
                },
            )

        employee.refresh_from_db()
        # The employee viewset selects the related User; refresh that cached
        # object too so activation-status fields reflect the just-completed exit.
        if employee.user_id is not None:
            employee.user.refresh_from_db()
        return Response(self.get_serializer(employee).data)

    @transaction.atomic
    def perform_destroy(self, employee):
        # Preserve HR history instead of physically deleting the record.
        # DELETE must enforce the same exit-date invariant as the explicit
        # employment-status endpoint, including future-dated new hires.
        exit_date = employee.date_of_exit or timezone.localdate()
        if exit_date < employee.date_of_joining:
            raise ValidationError({
                "date_of_exit": "Exit date cannot precede the joining date."
            })

        previous_status = employee.employment_status
        employee.employment_status = Employee.EmploymentStatus.EXITED
        employee.date_of_exit = exit_date
        employee.save(update_fields=["employment_status", "date_of_exit", "updated_at"])

        user = employee.user if employee.user_id is not None else None
        if user is not None:
            user.is_active = False
            user.save(update_fields=["is_active"])

            now = timezone.now()
            AccountInvitation.objects.filter(
                user=user,
                accepted_at__isnull=True,
                revoked_at__isnull=True,
            ).update(revoked_at=now, updated_at=now)

            for token in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=token)

        record_audit_event(
            action=AuditEvent.Action.EMPLOYEE_DEACTIVATED,
            actor=self.request.user,
            subject_user=user,
            subject_email=user.email if user is not None else "",
            object_type="Employee",
            object_id=employee.pk,
            metadata={
                "previous_status": previous_status,
                "employment_status": employee.employment_status,
            },
        )
