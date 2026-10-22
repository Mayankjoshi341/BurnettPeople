from django.contrib import admin
from django.urls import include, path

from core.views import health_check
from core.health import liveness_check, readiness_check
from accounts.views import AdminCreateHRView


urlpatterns = [
    path("admin/", admin.site.urls),

    # Health checks
    path("api/health/", health_check, name="health"),
    path("api/health/live/", liveness_check, name="health-live"),
    path("api/health/ready/", readiness_check, name="health-ready"),

    # Authentication and employee management
    path("api/auth/", include("accounts.urls")),
    path("api/employees/", include("employees.urls")),
    path("api/attendance/", include("attendance.urls")),
    path("api/organization/", include("organization.urls")),

    # Admin
    path(
        "api/admin/hr/",
        AdminCreateHRView.as_view(),
        name="admin-create-hr",
    ),

    # HR operations
    path("api/", include("hr_operations.urls")),

    # Work status updates
    path("api/status-updates/", include("status_updates.urls")),
]