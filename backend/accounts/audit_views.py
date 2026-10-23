from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import AuditEvent
from accounts.permissions import IsHROrAdmin


class AuditEventPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class AuditEventListView(APIView):
    """Browse non-sensitive audit metadata; HR and Admin only."""

    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def get(self, request):
        queryset = AuditEvent.objects.select_related("actor").all()
        for key, field in (("action", "action"), ("object_type", "object_type"),
                           ("object_id", "object_id"), ("actor_id", "actor_id")):
            value = request.query_params.get(key)
            if value:
                queryset = queryset.filter(**{field: value})

        for key, field, op in (("from", "created_at__date__gte", "from"),
                               ("to", "created_at__date__lte", "to")):
            raw = request.query_params.get(key)
            if raw:
                parsed = parse_date(raw)
                if parsed is None:
                    raise ValidationError({op: "Use a valid date in YYYY-MM-DD format."})
                queryset = queryset.filter(**{field: parsed})

        paginator = AuditEventPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        rows = [{
            "id": event.pk,
            "created_at": event.created_at,
            "user_name": (event.actor.get_full_name().strip() if event.actor else "System") or "System",
            "user_email": event.actor.email if event.actor else "",
            "action": event.get_action_display(),
            "module": event.object_type or "Account",
            "details": " ".join(part for part in (
                event.get_action_display(),
                f"{event.object_type} #{event.object_id}" if event.object_type and event.object_id else "",
            ) if part),
            "status": "Success",
        } for event in page]
        return paginator.get_paginated_response(rows)
