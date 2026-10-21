from django.contrib import admin
from django.urls import include, path

from core.views import health_check
from performance_management.health import liveness_check, readiness_check
from accounts.views import AdminCreateHRView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health"),
    path("api/auth/", include("accounts.urls")),
    path("api/employees/", include("employees.urls")),
    path("api/attendance/", include("attendance.urls")),
    path("api/organization/", include("organization.urls")),
    path("api/admin/hr/", AdminCreateHRView.as_view(), name="admin-create-hr"),
    path("api/", include("hr_operations.urls")),
    path(
    "api/performance/",
    include("performance_management.urls"),),
    path("api/performance/", include("performance_management.urls")),
    path("api/health/live/", liveness_check, name="health-live"),
    path("api/health/ready/", readiness_check, name="health-ready"),

]
