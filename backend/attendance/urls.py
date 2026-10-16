from django.urls import path

from .views import MyAttendanceView

app_name = "attendance"

urlpatterns = [
    path("me/", MyAttendanceView.as_view(), name="my-attendance"),
]