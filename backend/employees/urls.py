
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from employees.views import EmployeeDirectoryOverviewView, EmployeeDirectoryView, EmployeeViewSet


router = DefaultRouter()
router.register("", EmployeeViewSet, basename="employee")

urlpatterns = [
    path("directory/overview/", EmployeeDirectoryOverviewView.as_view(), name="employee-directory-overview"),
    path("directory/", EmployeeDirectoryView.as_view(), name="employee-directory"),
    path("", include(router.urls)),
]
