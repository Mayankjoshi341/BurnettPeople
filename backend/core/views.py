
from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from redis import Redis


@require_GET
def health_check(request):
    checks = {}

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "unavailable"

    client = None
    try:
        client = Redis.from_url(
            settings.CELERY_BROKER_URL,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        client.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "unavailable"
    finally:
        if client is not None:
            client.close()

    healthy = all(value == "ok" for value in checks.values())

    return JsonResponse(
        {
            "status": "ok" if healthy else "degraded",
            "checks": checks,
        },
        status=200 if healthy else 503,
    )
