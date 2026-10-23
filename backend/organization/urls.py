from django.urls import path

from organization.views import (
    DepartmentLookupView,
    DepartmentDetailView,
    DesignationLookupView,
    DesignationDetailView,
    WorkLocationLookupView,
    WorkLocationDetailView,
)


urlpatterns = [
    path("departments/", DepartmentLookupView.as_view(), name="department-lookup-list"),
    path("departments/<int:pk>/", DepartmentDetailView.as_view(), name="department-detail"),
    path("designations/", DesignationLookupView.as_view(), name="designation-lookup-list"),
    path("designations/<int:pk>/", DesignationDetailView.as_view(), name="designation-detail"),
    path("work-locations/", WorkLocationLookupView.as_view(), name="work-location-lookup-list"),
    path("work-locations/<int:pk>/", WorkLocationDetailView.as_view(), name="work-location-detail"),
]
