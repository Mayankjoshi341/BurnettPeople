from django.contrib import admin
from django.urls import include, path

from core.views import health_check
from accounts.views import AdminCreateHRView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health"),
    path("api/auth/", include("accounts.urls")),
    path("api/employees/", include("employees.urls")),
    path("api/organization/", include("organization.urls")),
    path(
    "api/admin/hr/",
    AdminCreateHRView.as_view(),
    name="admin-create-hr",
),
]