from datetime import date, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import AuditEvent, User
from accounts.services.audit import record_audit_event
from employees.models import Employee
from hr_operations.ai_providers import AIProviderError, generate_leave_draft
from hr_operations.models import (
    Asset,
    AssetAssignment,
    CompanyHoliday,
    LeaveBalance,
    LeaveRequest,
    LeaveRequestAllocation,
    LeaveType,
    Notification,
    RemoteWorkRequest,
)
from hr_operations.permissions import is_hr_or_admin, require_hr_or_admin
from hr_operations.serializers import (
    AssetAssignmentCreateSerializer,
    AssetAssignmentReadSerializer,
    AssetAssignmentReturnSerializer,
    AssetSerializer,
    AssetStatusSerializer,
    CompanyHolidaySerializer,
    LeaveBalanceAllocationSerializer,
    LeaveBalanceSerializer,
    LeaveDecisionSerializer,
    LeaveDraftSerializer,
    LeaveRequestCreateSerializer,
    LeaveRequestReadSerializer,
    LeaveTypeSerializer,
    NotificationSerializer,
)
from hr_operations.services import (
    calculate_leave_days_by_year,
    notify_hr_or_admin,
    notify_leave_decision,
    notify_leave_submitted,
    notify_user,
)


HISTORY_STATUSES = [LeaveRequest.Status.PENDING, LeaveRequest.Status.APPROVED]


def _linked_employee(user):
    try:
        return Employee.objects.select_related("manager", "manager__user", "user").get(user=user)
    except Employee.DoesNotExist as exc:
        raise PermissionDenied("Your account is not linked to an employee profile.") from exc


class RemoteWorkRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if is_hr_or_admin(request.user):
            rows = RemoteWorkRequest.objects.select_related("employee", "employee__department", "employee__manager")
        else:
            employee = _linked_employee(request.user)
            if request.user.role == User.Role.MANAGER:
                rows = RemoteWorkRequest.objects.filter(employee__manager=employee)
            else:
                rows = RemoteWorkRequest.objects.filter(employee=employee)
            rows = rows.select_related("employee", "employee__department", "employee__manager")
        return Response([{
            "id": row.pk, "employee_id": row.employee_id,
            "employee_name": f"{row.employee.first_name} {row.employee.last_name}".strip(),
            "department": row.employee.department.name, "work_date": row.work_date,
            "status": row.status, "reason": row.reason if row.employee.user_id == request.user.id or is_hr_or_admin(request.user) else "",
            "decided_at": row.decided_at, "decision_comment": row.decision_comment,
        } for row in rows.order_by("-work_date", "-id")[:500]])

    def post(self, request):
        employee = _linked_employee(request.user)
        try:
            work_date = date.fromisoformat(str(request.data.get("work_date", "")))
        except ValueError as exc:
            raise ValidationError({"work_date": "Enter a valid YYYY-MM-DD date."}) from exc
        if work_date < timezone.localdate():
            raise ValidationError({"work_date": "Remote-work requests must be for today or a future date."})
        reason = str(request.data.get("reason", "")).strip()
        if len(reason) > 240:
            raise ValidationError({"reason": "Use 240 characters or fewer."})
        row, created = RemoteWorkRequest.objects.get_or_create(
            employee=employee, work_date=work_date, defaults={"reason": reason}
        )
        if not created:
            raise ValidationError({"work_date": "A remote-work request already exists for this date."})
        return Response({"id": row.pk, "work_date": row.work_date, "status": row.status}, status=status.HTTP_201_CREATED)


class RemoteWorkDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        row = get_object_or_404(RemoteWorkRequest.objects.select_for_update().select_related("employee", "employee__manager"), pk=pk)
        if is_hr_or_admin(request.user):
            pass
        else:
            approver = _linked_employee(request.user)
            if request.user.role != User.Role.MANAGER or row.employee.manager_id != approver.pk:
                raise PermissionDenied("Only the employee's manager, HR, or Admin may decide this request.")
        decision = request.data.get("status")
        if row.status != RemoteWorkRequest.Status.PENDING or decision not in {"APPROVED", "REJECTED"}:
            raise ValidationError({"status": "Only pending requests may be approved or rejected."})
        row.status = decision
        row.decided_by = request.user
        row.decided_at = timezone.now()
        row.decision_comment = str(request.data.get("comment", ""))[:240]
        row.save(update_fields=["status", "decided_by", "decided_at", "decision_comment"])
        return Response({"id": row.pk, "status": row.status, "decided_at": row.decided_at})


def _release_reservations(leave_request, *, consume=False):
    allocation_rows = list(
        LeaveRequestAllocation.objects.filter(leave_request=leave_request).order_by("balance__year", "id")
    )
    balance_ids = [row.balance_id for row in allocation_rows]
    balances = list(LeaveBalance.objects.select_for_update().filter(pk__in=balance_ids).order_by("year", "id"))
    by_id = {balance.pk: balance for balance in balances}
    for allocation in allocation_rows:
        balance = by_id.get(allocation.balance_id)
        if balance is None or balance.reserved_days < allocation.days_count:
            raise ValidationError("The leave reservation is inconsistent. Contact HR; no balance was changed.")
        balance.reserved_days -= allocation.days_count
        if consume:
            balance.used_days += allocation.days_count
        balance.save(update_fields=["reserved_days", "used_days", "updated_at"])


def _can_review(user, leave_request):
    # A requester must never approve or reject their own application, even if
    # that requester also has an HR/Admin role.
    if leave_request.employee.user_id == user.pk:
        return False
    if is_hr_or_admin(user):
        return True
    if getattr(user, "role", None) != User.Role.MANAGER:
        return False
    try:
        manager_employee = Employee.objects.get(user=user)
    except Employee.DoesNotExist:
        return False
    return leave_request.employee.manager_id == manager_employee.pk and leave_request.employee_id != manager_employee.pk


class LeaveTypeListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = LeaveType.objects.all().order_by("name", "id")
        include_inactive = request.query_params.get("include_inactive", "false").lower() in {"true", "1"}
        if not include_inactive or not is_hr_or_admin(request.user):
            queryset = queryset.filter(is_active=True)
        return Response(LeaveTypeSerializer(queryset, many=True).data)

    def post(self, request):
        require_hr_or_admin(request.user)
        serializer = LeaveTypeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            item = serializer.save()
        except IntegrityError as exc:
            raise ValidationError({"code": "A leave type with this code already exists."}) from exc
        return Response(LeaveTypeSerializer(item).data, status=status.HTTP_201_CREATED)


class LeaveTypeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        require_hr_or_admin(request.user)
        item = get_object_or_404(LeaveType, pk=pk)
        serializer = LeaveTypeSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(LeaveTypeSerializer(item).data)

    def delete(self, request, pk):
        require_hr_or_admin(request.user)
        item = get_object_or_404(LeaveType, pk=pk)
        item.is_active = False
        item.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class CompanyHolidayListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = CompanyHoliday.objects.all()
        include_inactive = request.query_params.get("include_inactive", "false").lower() in {"true", "1"}
        if not include_inactive or not is_hr_or_admin(request.user):
            queryset = queryset.filter(is_active=True)
        return Response(CompanyHolidaySerializer(queryset, many=True).data)

    def post(self, request):
        require_hr_or_admin(request.user)
        serializer = CompanyHolidaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save(created_by=request.user)
        return Response(CompanyHolidaySerializer(item).data, status=status.HTTP_201_CREATED)


class CompanyHolidayDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        require_hr_or_admin(request.user)
        item = get_object_or_404(CompanyHoliday, pk=pk)
        serializer = CompanyHolidaySerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(CompanyHolidaySerializer(item).data)

    def delete(self, request, pk):
        require_hr_or_admin(request.user)
        item = get_object_or_404(CompanyHoliday, pk=pk)
        item.is_active = False
        item.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyLeaveBalancesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _linked_employee(request.user)
        year_raw = request.query_params.get("year", str(timezone.localdate().year))
        try:
            year = int(year_raw)
        except (TypeError, ValueError) as exc:
            raise ValidationError({"year": "Use a calendar year such as 2026."}) from exc
        queryset = LeaveBalance.objects.filter(employee=employee, year=year).select_related("employee", "leave_type")
        return Response(LeaveBalanceSerializer(queryset, many=True).data)


class LeaveBalanceListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        require_hr_or_admin(request.user)
        queryset = LeaveBalance.objects.select_related("employee", "leave_type")
        employee_id = request.query_params.get("employee_id")
        year = request.query_params.get("year")
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        if year:
            try:
                queryset = queryset.filter(year=int(year))
            except ValueError as exc:
                raise ValidationError({"year": "Use a calendar year such as 2026."}) from exc
        return Response(LeaveBalanceSerializer(queryset, many=True).data)

    def post(self, request):
        require_hr_or_admin(request.user)
        serializer = LeaveBalanceAllocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        employee = values["employee"]
        leave_type = values["leave_type"]
        if leave_type.is_active is False:
            raise ValidationError({"leave_type_id": "Cannot allocate balance for an inactive leave type."})
        if employee.employment_status == Employee.EmploymentStatus.EXITED:
            raise ValidationError({"employee_id": "Cannot allocate leave balance to an exited employee."})

        with transaction.atomic():
            balance = LeaveBalance.objects.select_for_update().filter(
                employee=employee, leave_type=leave_type, year=values["year"]
            ).first()
            created = balance is None
            if balance is None:
                try:
                    balance = LeaveBalance.objects.create(
                        employee=employee, leave_type=leave_type, year=values["year"],
                        entitled_days=values["entitled_days"],
                    )
                except IntegrityError as exc:
                    raise ValidationError("A balance was created concurrently. Refresh and retry.") from exc
            else:
                minimum = balance.used_days + balance.reserved_days
                if values["entitled_days"] < minimum:
                    raise ValidationError({"entitled_days": f"Entitlement cannot be below {minimum} used or reserved day(s)."})
                balance.entitled_days = values["entitled_days"]
                balance.save(update_fields=["entitled_days", "updated_at"])
        return Response(LeaveBalanceSerializer(balance).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class LeaveRequestListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = LeaveRequest.objects.select_related(
            "employee", "leave_type", "decided_by"
        )
        if is_hr_or_admin(request.user):
            employee_id = request.query_params.get("employee_id")
            if employee_id:
                queryset = queryset.filter(employee_id=employee_id)
        elif getattr(request.user, "role", None) == User.Role.MANAGER:
            manager_employee = _linked_employee(request.user)
            if request.query_params.get("team_only", "false").lower() in {"true", "1"}:
                queryset = queryset.filter(employee__manager=manager_employee)
            else:
                queryset = queryset.filter(Q(employee=manager_employee) | Q(employee__manager=manager_employee))
        else:
            employee = _linked_employee(request.user)
            queryset = queryset.filter(employee=employee)
        state = request.query_params.get("status")
        if state:
            valid_states = {choice.value for choice in LeaveRequest.Status}
            if state not in valid_states:
                raise ValidationError({"status": f"Choose one of: {', '.join(sorted(valid_states))}."})
            queryset = queryset.filter(status=state)
        return Response(LeaveRequestReadSerializer(queryset, many=True).data)

    def post(self, request):
        employee = _linked_employee(request.user)
        if employee.employment_status != Employee.EmploymentStatus.ACTIVE:
            raise ValidationError("Only active employees can request leave. Contact HR if your status is incorrect.")
        serializer = LeaveRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        start_date, end_date = values["start_date"], values["end_date"]
        if (end_date - start_date).days > 366:
            raise ValidationError({"end_date": "A single leave request cannot span more than 367 calendar dates."})
        leave_type = values["leave_type"]

        with transaction.atomic():
            locked_employee = (
    Employee.objects
    .select_for_update(of=("self",))
    .select_related("manager", "manager__user", "user")
    .get(pk=employee.pk)
)
            overlap = LeaveRequest.objects.filter(
                employee=locked_employee,
                status__in=HISTORY_STATUSES,
                start_date__lte=end_date,
                end_date__gte=start_date,
            ).exists()
            if overlap:
                raise ValidationError({"dates": "This request overlaps an existing pending or approved leave request."})

            days_by_year = calculate_leave_days_by_year(locked_employee, start_date, end_date)
            days_count = sum(days_by_year.values())
            if days_count == 0:
                raise ValidationError({"dates": "The selected dates contain no scheduled working days after holidays are excluded."})
            if leave_type.max_consecutive_days and days_count > leave_type.max_consecutive_days:
                raise ValidationError({"end_date": f"This leave type permits at most {leave_type.max_consecutive_days} working day(s) per request."})

            balances = list(
                LeaveBalance.objects.select_for_update().filter(
                    employee=locked_employee, leave_type=leave_type, year__in=days_by_year.keys()
                ).order_by("year", "id")
            )
            by_year = {balance.year: balance for balance in balances}
            missing_years = sorted(set(days_by_year) - set(by_year))
            if missing_years:
                raise ValidationError({"balance": f"No {leave_type.name} balance is configured for year(s) {', '.join(map(str, missing_years))}. Contact HR."})
            for year, days in days_by_year.items():
                balance = by_year[year]
                if balance.available_days < days:
                    raise ValidationError({"balance": f"Insufficient {leave_type.name} balance for {year}: {balance.available_days} day(s) available, {days} required."})

            leave_request = LeaveRequest.objects.create(
                employee=locked_employee,
                leave_type=leave_type,
                start_date=start_date,
                end_date=end_date,
                days_count=days_count,
                reason=values.get("reason", "").strip(),
            )
            for year, days in days_by_year.items():
                balance = by_year[year]
                balance.reserved_days += days
                balance.save(update_fields=["reserved_days", "updated_at"])
                LeaveRequestAllocation.objects.create(
                    leave_request=leave_request, balance=balance, days_count=days
                )
            notify_leave_submitted(leave_request)
            record_audit_event(
                action=AuditEvent.Action.LEAVE_SUBMITTED, actor=request.user,
                subject_user=locked_employee.user, subject_email=locked_employee.user.email,
                object_type="leave_request", object_id=leave_request.pk,
                metadata={"leave_type": leave_type.code, "start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
            )

        leave_request = LeaveRequest.objects.select_related("employee", "leave_type", "decided_by").get(pk=leave_request.pk)
        return Response(LeaveRequestReadSerializer(leave_request).data, status=status.HTTP_201_CREATED)


class LeaveApprovalQueueView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = LeaveRequest.objects.filter(status=LeaveRequest.Status.PENDING).select_related(
            "employee", "leave_type", "decided_by"
        )
        if is_hr_or_admin(request.user):
            pass
        elif getattr(request.user, "role", None) == User.Role.MANAGER:
            manager_employee = _linked_employee(request.user)
            queryset = queryset.filter(employee__manager=manager_employee)
        else:
            raise PermissionDenied("Only the employee's manager, HR or Admin can view the approval queue.")
        return Response(LeaveRequestReadSerializer(queryset, many=True).data)


class LeaveDecisionView(APIView):
    permission_classes = [IsAuthenticated]
    decision_status = None

    def post(self, request, pk):
        serializer = LeaveDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            leave_request = get_object_or_404(
                LeaveRequest.objects.select_for_update(
    of=("self",)
).select_related(
    "employee",
    "employee__manager",
    "leave_type",
),
                pk=pk,
            )
            if not _can_review(request.user, leave_request):
                raise PermissionDenied("Only this employee's manager, HR or Admin can decide the request.")
            if leave_request.status != LeaveRequest.Status.PENDING:
                raise ValidationError("Only pending leave requests can be approved or rejected.")
            _release_reservations(leave_request, consume=self.decision_status == LeaveRequest.Status.APPROVED)
            leave_request.status = self.decision_status
            leave_request.decided_by = request.user
            leave_request.decided_at = timezone.now()
            leave_request.decision_comment = serializer.validated_data.get("comment", "").strip()
            leave_request.save(update_fields=["status", "decided_by", "decided_at", "decision_comment", "updated_at"])
            notify_leave_decision(leave_request)
            action = (AuditEvent.Action.LEAVE_APPROVED if self.decision_status == LeaveRequest.Status.APPROVED
                      else AuditEvent.Action.LEAVE_REJECTED)
            record_audit_event(
                action=action, actor=request.user, subject_user=leave_request.employee.user,
                subject_email=leave_request.employee.user.email, object_type="leave_request",
                object_id=leave_request.pk, metadata={"leave_type": leave_request.leave_type.code},
            )
        leave_request = LeaveRequest.objects.select_related("employee", "leave_type", "decided_by").get(pk=leave_request.pk)
        return Response(LeaveRequestReadSerializer(leave_request).data)


class LeaveApproveView(LeaveDecisionView):
    decision_status = LeaveRequest.Status.APPROVED


class LeaveRejectView(LeaveDecisionView):
    decision_status = LeaveRequest.Status.REJECTED


class LeaveCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        serializer = LeaveDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            try:
                leave_request = LeaveRequest.objects.select_for_update().select_related("employee", "leave_type").get(
                    pk=pk, employee__user=request.user
                )
            except LeaveRequest.DoesNotExist as exc:
                raise PermissionDenied("You can only cancel your own leave request.") from exc
            if leave_request.status != LeaveRequest.Status.PENDING:
                raise ValidationError("Only pending leave requests can be cancelled.")
            _release_reservations(leave_request, consume=False)
            leave_request.status = LeaveRequest.Status.CANCELLED
            leave_request.decided_by = request.user
            leave_request.decided_at = timezone.now()
            leave_request.decision_comment = serializer.validated_data.get("comment", "").strip()
            leave_request.save(update_fields=["status", "decided_by", "decided_at", "decision_comment", "updated_at"])
            notify_leave_decision(leave_request)
            record_audit_event(
                action=AuditEvent.Action.LEAVE_CANCELLED, actor=request.user,
                subject_user=leave_request.employee.user, subject_email=leave_request.employee.user.email,
                object_type="leave_request", object_id=leave_request.pk,
            )
        return Response(LeaveRequestReadSerializer(leave_request).data)


class LeaveDraftView(APIView):
    """Generate draft text only; it cannot create or decide a leave request."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LeaveDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = generate_leave_draft(serializer.validated_data)
        except AIProviderError as exc:
            return Response({"detail": str(exc), "draft": None, "can_retry": True}, status=exc.status_code)
        return Response({**result, "submitted": False, "detail": "Draft only. Review and edit it, then submit leave separately."})


class AssetListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        require_hr_or_admin(request.user)
        queryset = Asset.objects.all()
        asset_status = request.query_params.get("status")
        if asset_status:
            valid_statuses = {choice.value for choice in Asset.Status}
            if asset_status not in valid_statuses:
                raise ValidationError({"status": f"Choose one of: {', '.join(sorted(valid_statuses))}."})
            queryset = queryset.filter(status=asset_status)
        return Response(AssetSerializer(queryset, many=True).data)

    def post(self, request):
        require_hr_or_admin(request.user)
        serializer = AssetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            item = serializer.save(created_by=request.user)
        except IntegrityError as exc:
            raise ValidationError("The asset tag or serial number already exists.") from exc
        record_audit_event(action=AuditEvent.Action.ASSET_REGISTERED, actor=request.user,
                           object_type="asset", object_id=item.pk,
                           metadata={"asset_tag": item.asset_tag, "category": item.category})
        return Response(AssetSerializer(item).data, status=status.HTTP_201_CREATED)


class AssetDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        require_hr_or_admin(request.user)
        item = get_object_or_404(Asset, pk=pk)
        serializer = AssetSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            item = serializer.save()
        except IntegrityError as exc:
            raise ValidationError("The asset tag or serial number already exists.") from exc
        record_audit_event(action=AuditEvent.Action.ASSET_UPDATED, actor=request.user,
                           object_type="asset", object_id=item.pk,
                           metadata={"asset_tag": item.asset_tag})
        return Response(AssetSerializer(item).data)


class AssetStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        require_hr_or_admin(request.user)
        serializer = AssetStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]
        with transaction.atomic():
            asset = get_object_or_404(Asset.objects.select_for_update(), pk=pk)
            has_active_assignment = AssetAssignment.objects.filter(asset=asset, returned_at__isnull=True).exists()
            if has_active_assignment or asset.status == Asset.Status.ASSIGNED:
                raise ValidationError("Return the asset before changing its status.")
            if asset.status == Asset.Status.RETIRED and new_status != Asset.Status.RETIRED:
                raise ValidationError("Retired assets cannot be reactivated through this endpoint.")
            asset.status = new_status
            asset.save(update_fields=["status", "updated_at"])
            record_audit_event(action=AuditEvent.Action.ASSET_STATUS_CHANGED, actor=request.user,
                               object_type="asset", object_id=asset.pk,
                               metadata={"status": new_status})
        return Response(AssetSerializer(asset).data)


class AssetAssignmentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        require_hr_or_admin(request.user)
        queryset = AssetAssignment.objects.select_related("asset", "employee", "assigned_by", "returned_by")
        employee_id = request.query_params.get("employee_id")
        asset_id = request.query_params.get("asset_id")
        active = request.query_params.get("active")
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        if asset_id:
            queryset = queryset.filter(asset_id=asset_id)
        if active is not None:
            active_value = active.lower()
            if active_value not in {"true", "false", "1", "0"}:
                raise ValidationError({"active": "Use true or false."})
            if active_value in {"true", "1"}:
                queryset = queryset.filter(returned_at__isnull=True)
            else:
                queryset = queryset.filter(returned_at__isnull=False)
        return Response(AssetAssignmentReadSerializer(queryset, many=True).data)

    def post(self, request):
        require_hr_or_admin(request.user)
        serializer = AssetAssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        try:
            with transaction.atomic():
                asset = Asset.objects.select_for_update().get(pk=values["asset"].pk)
                employee = Employee.objects.select_for_update(of=("self",)).select_related("user").get(pk=values["employee"].pk)
                if asset.status != Asset.Status.AVAILABLE:
                    raise ValidationError({"asset_id": f"This asset is not available (current status: {asset.status})."})
                if employee.employment_status != Employee.EmploymentStatus.ACTIVE:
                    raise ValidationError({"employee_id": "Assets can only be assigned to active employees."})
                if AssetAssignment.objects.filter(asset=asset, returned_at__isnull=True).exists():
                    raise ValidationError({"asset_id": "This asset already has an active assignment."})
                assignment = AssetAssignment.objects.create(
                    asset=asset,
                    employee=employee,
                    assigned_by=request.user,
                    condition_on_assignment=values.get("condition_on_assignment", "").strip(),
                    notes=values.get("notes", "").strip(),
                )
                asset.status = Asset.Status.ASSIGNED
                asset.save(update_fields=["status", "updated_at"])
                notify_user(
                    employee.user,
                    kind=Notification.Kind.ASSET_ASSIGNED,
                    title="Company asset assigned",
                    message=f"{asset.name} ({asset.asset_tag}) has been assigned to you.",
                    target_type="asset_assignment",
                    target_id=assignment.pk,
                )
                record_audit_event(
                    action=AuditEvent.Action.ASSET_ASSIGNED, actor=request.user,
                    subject_user=employee.user, subject_email=employee.user.email,
                    object_type="asset_assignment", object_id=assignment.pk,
                    metadata={"asset_tag": asset.asset_tag, "employee_code": employee.employee_code},
                )
        except Asset.DoesNotExist as exc:
            raise ValidationError({"asset_id": "Asset not found."}) from exc
        except Employee.DoesNotExist as exc:
            raise ValidationError({"employee_id": "Employee not found."}) from exc
        except IntegrityError as exc:
            raise ValidationError("A concurrent assignment was detected. Refresh and try again.") from exc
        assignment = AssetAssignment.objects.select_related("asset", "employee", "assigned_by", "returned_by").get(pk=assignment.pk)
        return Response(AssetAssignmentReadSerializer(assignment).data, status=status.HTTP_201_CREATED)


class AssetReturnView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        require_hr_or_admin(request.user)
        serializer = AssetAssignmentReturnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        with transaction.atomic():
            assignment = get_object_or_404(
                AssetAssignment.objects.select_for_update().select_related("employee"), pk=pk
            )
            if assignment.returned_at is not None:
                raise ValidationError("This assignment has already been returned.")
            asset = Asset.objects.select_for_update().get(pk=assignment.asset_id)
            assignment.returned_at = timezone.now()
            assignment.returned_by = request.user
            assignment.condition_on_return = values.get("condition_on_return", "").strip()
            if values.get("notes"):
                assignment.notes = (assignment.notes + "\n" + values["notes"].strip()).strip()
            assignment.save(update_fields=["returned_at", "returned_by", "condition_on_return", "notes"])
            asset.status = Asset.Status.AVAILABLE
            asset.save(update_fields=["status", "updated_at"])
            notify_user(
                assignment.employee.user,
                kind=Notification.Kind.ASSET_RETURNED,
                title="Company asset returned",
                message=f"{asset.name} ({asset.asset_tag}) was marked as returned.",
                target_type="asset_assignment",
                target_id=assignment.pk,
            )
            record_audit_event(
                action=AuditEvent.Action.ASSET_RETURNED, actor=request.user,
                subject_user=assignment.employee.user, subject_email=assignment.employee.user.email,
                object_type="asset_assignment", object_id=assignment.pk,
                metadata={"asset_tag": asset.asset_tag, "employee_code": assignment.employee.employee_code},
            )
        assignment = AssetAssignment.objects.select_related("asset", "employee", "assigned_by", "returned_by").get(pk=assignment.pk)
        return Response(AssetAssignmentReadSerializer(assignment).data)


class MyAssetsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = _linked_employee(request.user)
        queryset = AssetAssignment.objects.filter(employee=employee).select_related(
            "asset", "employee", "assigned_by", "returned_by"
        )
        return Response(AssetAssignmentReadSerializer(queryset, many=True).data)


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Notification.objects.filter(recipient=request.user)
        unread = request.query_params.get("unread")
        if unread is not None:
            value = unread.lower()
            if value not in {"true", "false", "1", "0"}:
                raise ValidationError({"unread": "Use true or false."})
            queryset = queryset.filter(read_at__isnull=value in {"true", "1"})
        return Response(NotificationSerializer(queryset, many=True).data)


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        item = get_object_or_404(Notification, pk=pk, recipient=request.user)
        if item.read_at is None:
            item.read_at = timezone.now()
            item.save(update_fields=["read_at"])
        return Response(NotificationSerializer(item).data)


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(recipient=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response({"marked_read": updated})
