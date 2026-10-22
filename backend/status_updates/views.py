from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from employees.models import Employee
from .models import StatusUpdate
from .permissions import elevated_role, manager_team_user_ids
from .serializers import StatusUpdateSerializer

UserModel = get_user_model()


def _is_manager(user):
    return user.role == User.Role.MANAGER and not elevated_role(user)


def _visible_user_ids(user):
    if elevated_role(user):
        return None  # unrestricted
    if _is_manager(user):
        return set(manager_team_user_ids(user)) | {user.id}
    return {user.id}


def _scoped_updates(user):
    qs = StatusUpdate.objects.select_related(
        "author", "employee", "employee__department", "employee__designation"
    )
    ids = _visible_user_ids(user)
    return qs if ids is None else qs.filter(author_id__in=ids)


class StatusUpdateListCreateView(APIView):
    def get(self, request):
        qs = _scoped_updates(request.user)
        today = timezone.localdate()
        date_value = request.query_params.get("date")
        days_value = request.query_params.get("days")
        user_id = request.query_params.get("user_id")
        department = request.query_params.get("department")
        work_status = request.query_params.get("work_status")
        from_date = request.query_params.get("from")
        to_date = request.query_params.get("to")

        if date_value:
            qs = qs.filter(update_date=date_value)
        elif days_value:
            try:
                days = max(1, min(int(days_value), 90))
            except (TypeError, ValueError):
                raise ValidationError({"days": "Enter a number between 1 and 90."})
            qs = qs.filter(update_date__gte=today - timedelta(days=days - 1), update_date__lte=today)
        elif not any([from_date, to_date, user_id, department, work_status]):
            # Default: user's recent week; elevated users and managers see recent team activity.
            qs = qs.filter(update_date__gte=today - timedelta(days=6), update_date__lte=today)

        if from_date:
            qs = qs.filter(update_date__gte=from_date)
        if to_date:
            qs = qs.filter(update_date__lte=to_date)
        if user_id:
            try:
                qs = qs.filter(author_id=int(user_id))
            except ValueError:
                raise ValidationError({"user_id": "Must be a valid user ID."})
        if department:
            qs = qs.filter(employee__department__name__icontains=department)
        if work_status:
            qs = qs.filter(work_status=work_status)

        return Response(StatusUpdateSerializer(qs[:500], many=True).data)

    def post(self, request):
        serializer = StatusUpdateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        today = timezone.localdate()
        if StatusUpdate.objects.filter(author=request.user, update_date=today).exists():
            raise ValidationError({"detail": "You already submitted an update today. Open your today's update to edit it."})
        try:
            item = serializer.save(author=request.user, update_date=today)
        except IntegrityError:
            raise ValidationError({"detail": "You already submitted an update today. Refresh and edit it instead."})
        return Response(StatusUpdateSerializer(item).data, status=status.HTTP_201_CREATED)


class StatusUpdateDetailView(APIView):
    def get_object(self, request, pk):
        try:
            item = _scoped_updates(request.user).get(pk=pk)
        except StatusUpdate.DoesNotExist:
            raise NotFound("Work status update was not found or you do not have access to it.")
        return item

    def patch(self, request, pk):
        item = self.get_object(request, pk)
        if item.author_id != request.user.id:
            raise PermissionDenied("You can only edit your own work status update.")
        if item.update_date != timezone.localdate():
            raise PermissionDenied("Past daily updates are read-only. You can edit today's update only.")
        serializer = StatusUpdateSerializer(item, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(StatusUpdateSerializer(item).data)

    def delete(self, request, pk):
        item = self.get_object(request, pk)
        if item.author_id != request.user.id:
            raise PermissionDenied("You can only delete your own work status update.")
        if item.update_date != timezone.localdate():
            raise PermissionDenied("Past daily updates are read-only and cannot be deleted.")
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StatusUpdateUserHistoryView(APIView):
    def get(self, request, user_id):
        visible_ids = _visible_user_ids(request.user)
        if visible_ids is not None and user_id not in visible_ids:
            raise PermissionDenied("You do not have permission to view this person's updates.")
        try:
            target = UserModel.objects.get(pk=user_id, is_active=True)
        except UserModel.DoesNotExist:
            raise NotFound("User not found.")
        today = timezone.localdate()
        qs = _scoped_updates(request.user).filter(
            author=target,
            update_date__gte=today - timedelta(days=6),
            update_date__lte=today,
        )
        return Response({
            "user": {
                "id": target.id,
                "name": (f"{target.first_name} {target.last_name}".strip() or target.email),
                "email": target.email,
                "role": target.role,
            },
            "updates": StatusUpdateSerializer(qs, many=True).data,
        })


class MissingStatusUpdatesView(APIView):
    """Return active non-admin users who have not submitted for a given date."""

    def get(self, request):
        user = request.user
        date_value = request.query_params.get("date") or timezone.localdate().isoformat()
        try:
            from datetime import date
            target_date = date.fromisoformat(date_value)
        except ValueError:
            raise ValidationError({"date": "Use YYYY-MM-DD."})
        if target_date > timezone.localdate():
            raise ValidationError({"date": "Future dates cannot be used for missing-submission reports."})

        if elevated_role(user):
            eligible = UserModel.objects.filter(is_active=True).exclude(role=User.Role.ADMIN)
        elif _is_manager(user):
            team_ids = set(manager_team_user_ids(user))
            eligible = UserModel.objects.filter(id__in=team_ids, is_active=True)
        else:
            raise PermissionDenied("Only HR, Admin or Managers can view missing submissions.")

        submitted_ids = StatusUpdate.objects.filter(update_date=target_date).values_list("author_id", flat=True)
        missing = eligible.exclude(id__in=submitted_ids).order_by("first_name", "last_name", "email")
        employees_by_user = {
            e.user_id: e for e in Employee.objects.filter(user_id__in=missing.values_list("id", flat=True)).select_related("department", "designation")
        }
        results = []
        for person in missing:
            employee = employees_by_user.get(person.id)
            results.append({
                "id": person.id,
                "name": (f"{person.first_name} {person.last_name}".strip() or person.email),
                "email": person.email,
                "role": person.role,
                "employee_id": employee.id if employee else None,
                "employee_code": employee.employee_code if employee else None,
                "department": employee.department.name if employee else None,
                "designation": employee.designation.title if employee else None,
            })
        return Response({"date": target_date.isoformat(), "count": len(results), "results": results})
