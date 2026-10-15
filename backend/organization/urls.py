from django.urls import path

from organization.views import (
    DepartmentLookupView,
    DesignationLookupView,
    WorkLocationLookupView,
)


urlpatterns = [
    path("departments/", DepartmentLookupView.as_view(), name="department-lookup-list"),
    path("designations/", DesignationLookupView.as_view(), name="designation-lookup-list"),
    path("work-locations/", WorkLocationLookupView.as_view(), name="work-location-lookup-list"),
]
