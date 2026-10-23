"""HR/Admin endpoints for listing work schedules and managing assignments."""

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsHROrAdmin
from attendance.reporting_serializers import WorkScheduleReadSerializer
from attendance.reporting_serializers import BreakPolicyReadSerializer
from attendance.models import BreakPolicy
from attendance.break_policy_serializers import BreakPolicyWriteSerializer
from attendance.schedule_management_serializers import (
    ScheduleAssignmentCreateSerializer,
    ScheduleAssignmentEndSerializer,
    ScheduleAssignmentReadSerializer,
    WorkScheduleWriteSerializer,
)
from employees.models import Employee, EmployeeScheduleAssignment, WorkSchedule


class ScheduleManagementPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


def _positive_id(raw_value, field_name):
    try:
        value = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({field_name: "Provide a valid positive integer."}) from exc
    if value < 1:
        raise ValidationError({field_name: "Provide a valid positive integer."})
    return value


def _effective_on(request):
    raw_value = request.query_params.get("effective_on")
    if not raw_value:
        return None
    value = parse_date(raw_value)
    if value is None:
        raise ValidationError({"effective_on": "Use YYYY-MM-DD format."})
    return value


class WorkScheduleListView(APIView):
    """List work schedules available for HR/Admin assignment actions."""

    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def get(self, request):
        include_inactive = request.query_params.get("include_inactive", "false").lower()
        if include_inactive not in {"true", "false", "1", "0"}:
            raise ValidationError({"include_inactive": "Use true or false."})

        schedules = WorkSchedule.objects.select_related("break_policy").prefetch_related(
            "break_policy__rules"
        )
        if include_inactive not in {"true", "1"}:
            schedules = schedules.filter(is_active=True, break_policy__is_active=True)

        return Response(WorkScheduleReadSerializer(schedules, many=True).data)

    def post(self, request):
        serializer = WorkScheduleWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            schedule = serializer.save()
        except IntegrityError as exc:
            raise ValidationError("A schedule with this name already exists.") from exc
        schedule = WorkSchedule.objects.select_related("break_policy").prefetch_related("break_policy__rules").get(pk=schedule.pk)
        return Response(WorkScheduleReadSerializer(schedule).data, status=status.HTTP_201_CREATED)


class WorkScheduleDetailView(APIView):
    """Edit unused schedule definitions; retain history once assignments begin."""
    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def patch(self, request, pk):
        try:
            schedule = WorkSchedule.objects.select_related("break_policy").get(pk=pk)
        except WorkSchedule.DoesNotExist as exc:
            raise NotFound("Work schedule not found.") from exc
        serializer = WorkScheduleWriteSerializer(schedule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            schedule = serializer.save()
        except IntegrityError as exc:
            raise ValidationError("A schedule with this name already exists.") from exc
        schedule = WorkSchedule.objects.select_related("break_policy").prefetch_related("break_policy__rules").get(pk=schedule.pk)
        return Response(WorkScheduleReadSerializer(schedule).data)

    def delete(self, request, pk):
        try:
            schedule = WorkSchedule.objects.get(pk=pk)
        except WorkSchedule.DoesNotExist as exc:
            raise NotFound("Work schedule not found.") from exc
        if schedule.is_active:
            schedule.is_active = False
            schedule.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class BreakPolicyListView(APIView):
    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def get(self, request):
        include_inactive = request.query_params.get("include_inactive", "false").lower() in {"true", "1"}
        policies = BreakPolicy.objects.all() if include_inactive else BreakPolicy.objects.filter(is_active=True)
        policies = policies.prefetch_related("rules")
        return Response(BreakPolicyReadSerializer(policies, many=True).data)

    def post(self, request):
        serializer = BreakPolicyWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            policy = serializer.save()
        except IntegrityError as exc:
            raise ValidationError({"code": "That policy code and version already exists, or a rule conflicts with this version."}) from exc
        return Response(BreakPolicyReadSerializer(policy).data, status=status.HTTP_201_CREATED)


class BreakPolicyDetailView(APIView):
    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def get_object(self, pk):
        return get_object_or_404(BreakPolicy.objects.prefetch_related("rules"), pk=pk)

    def patch(self, request, pk):
        policy = self.get_object(pk)
        serializer = BreakPolicyWriteSerializer(policy, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            policy = serializer.save()
        except IntegrityError as exc:
            raise ValidationError({"code": "That policy code and version already exists."}) from exc
        return Response(BreakPolicyReadSerializer(policy).data)

    def delete(self, request, pk):
        policy = self.get_object(pk)
        if policy.is_active:
            policy.is_active = False
            policy.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ScheduleAssignmentListCreateView(APIView):
    """List assignments or create a non-overlapping assignment for an employee."""

    permission_classes = [IsAuthenticated, IsHROrAdmin]
    pagination_class = ScheduleManagementPagination

    def get(self, request):
        assignments = EmployeeScheduleAssignment.objects.select_related(
            "employee", "work_schedule", "work_schedule__break_policy"
        ).prefetch_related("work_schedule__break_policy__rules")

        employee_id = request.query_params.get("employee_id")
        if employee_id not in (None, ""):
            employee_id = _positive_id(employee_id, "employee_id")
            assignments = assignments.filter(employee_id=employee_id)

        effective_on = _effective_on(request)
        if effective_on is not None:
            assignments = assignments.filter(effective_from__lte=effective_on).filter(
                Q(effective_until__isnull=True) | Q(effective_until__gte=effective_on)
            )

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(assignments, request, view=self)
        return paginator.get_paginated_response(
            ScheduleAssignmentReadSerializer(page, many=True).data
        )

    def post(self, request):
        employee_id = _positive_id(request.data.get("employee_id"), "employee_id")
        try:
            with transaction.atomic():
                # Serialize concurrent assignment changes for this employee.
                locked_employee = Employee.objects.select_for_update().filter(pk=employee_id).first()
                if locked_employee is None:
                    raise ValidationError({"employee_id": "Employee not found."})

                serializer = ScheduleAssignmentCreateSerializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                assignment = serializer.save()
        except IntegrityError as exc:
            raise ValidationError(
                "The assignment conflicts with an existing schedule assignment. Refresh and try again."
            ) from exc

        assignment = EmployeeScheduleAssignment.objects.select_related(
            "employee", "work_schedule", "work_schedule__break_policy"
        ).prefetch_related("work_schedule__break_policy__rules").get(pk=assignment.pk)
        return Response(
            ScheduleAssignmentReadSerializer(assignment).data,
            status=status.HTTP_201_CREATED,
        )


class ScheduleAssignmentDetailView(APIView):
    """Allow HR/Admin to set the inclusive end date without deleting history."""

    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def patch(self, request, pk):
        try:
            with transaction.atomic():
                assignment = (
                    EmployeeScheduleAssignment.objects.select_for_update()
                    .select_related("employee", "work_schedule", "work_schedule__break_policy")
                    .get(pk=pk)
                )
                Employee.objects.select_for_update().get(pk=assignment.employee_id)
                serializer = ScheduleAssignmentEndSerializer(
                    data=request.data,
                    context={"assignment": assignment},
                )
                serializer.is_valid(raise_exception=True)
                assignment = serializer.update(assignment, serializer.validated_data)
        except EmployeeScheduleAssignment.DoesNotExist as exc:
            raise NotFound("Schedule assignment not found.") from exc
        except IntegrityError as exc:
            raise ValidationError(
                "The updated end date conflicts with another schedule assignment."
            ) from exc

        assignment = EmployeeScheduleAssignment.objects.select_related(
            "employee", "work_schedule", "work_schedule__break_policy"
        ).prefetch_related("work_schedule__break_policy__rules").get(pk=assignment.pk)
        return Response(ScheduleAssignmentReadSerializer(assignment).data)
