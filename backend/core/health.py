from django.db import connections
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def liveness_check(request):
    return JsonResponse({"status": "ok"})


@require_GET
def readiness_check(request):
    try:
        connections["default"].ensure_connection()
    except Exception:
        return JsonResponse(
            {
                "status": "not_ready",
                "database": "unavailable",
            },
            status=503,
        )

    return JsonResponse(
        {
            "status": "ready",
            "database": "ok",
        }
    )