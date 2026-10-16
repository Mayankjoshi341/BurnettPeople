"""Read-only attendance and schedule endpoints used by the HRMS dashboards."""

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsHROrAdmin
from attendance.models import AttendanceException, AttendanceRecord
from attendance.serializers import AttendanceRecordSerializer
from attendance.views import _employee_for_user, _record_query, _zone
from employees.models import EmployeeScheduleAssignment
from attendance.reporting_serializers import EmployeeScheduleAssignmentReadSerializer


class AttendanceRecordPagination(PageNumberPagination):
    """Bound report response sizes while allowing callers to move through pages."""

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


def _query_date(request, name, default=None):
    raw_value = request.query_params.get(name)
    if raw_value in (None, ""):
        return default

    parsed = parse_date(raw_value)
    if parsed is None:
        raise ValidationError({name: "Use a valid date in YYYY-MM-DD format."})
    return parsed


class MyWorkScheduleView(APIView):
    """Return only the authenticated employee's schedule effective today."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _employee_for_user(request.user)
        now = timezone.now()
        assignments = (
            EmployeeScheduleAssignment.objects.filter(employee=employee)
            .select_related("work_schedule", "work_schedule__break_policy")
            .prefetch_related("work_schedule__break_policy__rules")
            .order_by("-effective_from", "-id")
        )

        for assignment in assignments:
            schedule_local_date = now.astimezone(_zone(assignment.work_schedule)).date()
            is_effective = assignment.effective_from <= schedule_local_date and (
                assignment.effective_until is None
                or assignment.effective_until >= schedule_local_date
            )
            if is_effective:
                return Response(
                    {
                        "work_date": schedule_local_date.isoformat(),
                        "assignment": EmployeeScheduleAssignmentReadSerializer(assignment).data,
                    }
                )

        return Response(
            {
                "work_date": timezone.localdate().isoformat(),
                "assignment": None,
                "detail": "No work schedule is assigned for the current date.",
            }
        )


class AttendanceRecordListView(APIView):
    """List company attendance records for HR/Admin, with validated filters."""

    permission_classes = [IsAuthenticated, IsHROrAdmin]
    pagination_class = AttendanceRecordPagination

    def get(self, request):
        start_date = _query_date(request, "start_date")
        end_date = _query_date(request, "end_date")
        if start_date and end_date and start_date > end_date:
            raise ValidationError({"end_date": "End date must be on or after start date."})

        queryset = _record_query()
        if start_date:
            queryset = queryset.filter(work_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(work_date__lte=end_date)

        employee_id = request.query_params.get("employee_id")
        if employee_id not in (None, ""):
            try:
                employee_id = int(employee_id)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"employee_id": "Provide a valid employee ID."}) from exc
            if employee_id < 1:
                raise ValidationError({"employee_id": "Employee ID must be a positive integer."})
            queryset = queryset.filter(employee_id=employee_id)

        record_status = request.query_params.get("status")
        valid_statuses = {choice.value for choice in AttendanceRecord.Status}
        if record_status not in (None, ""):
            if record_status not in valid_statuses:
                raise ValidationError({"status": f"Choose one of: {', '.join(sorted(valid_statuses))}."})
            queryset = queryset.filter(status=record_status)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serialized = AttendanceRecordSerializer(page, many=True)
        return paginator.get_paginated_response(serialized.data)


class AttendanceSummaryView(APIView):
    """Return a factual attendance summary; it does not infer absences."""

    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def get(self, request):
        work_date = _query_date(request, "date", default=timezone.localdate())
        records = AttendanceRecord.objects.filter(work_date=work_date)
        pending_exceptions = AttendanceException.objects.filter(
            review_status=AttendanceException.ReviewStatus.PENDING
        ).count()

        return Response(
            {
                "date": work_date.isoformat(),
                "total_attendance_records": records.count(),
                "open_sessions": records.filter(status=AttendanceRecord.Status.OPEN).count(),
                "closed_sessions": records.filter(status=AttendanceRecord.Status.CLOSED).count(),
                "pending_exceptions_total": pending_exceptions,
            }
        )
