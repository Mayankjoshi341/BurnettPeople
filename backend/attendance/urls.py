from django.urls import path

from attendance.views import (
    AttendanceExceptionListCreateView, AttendanceExceptionReviewView,
    BreakEndView, BreakStartView, CheckInView, CheckOutView,
    MyAttendanceHistoryView, MyAttendanceView,
)

app_name = "attendance"
urlpatterns = [
    path("me/", MyAttendanceView.as_view(), name="my-attendance"),
    path("check-in/", CheckInView.as_view(), name="check-in"),
    path("check-out/", CheckOutView.as_view(), name="check-out"),
    path("breaks/start/", BreakStartView.as_view(), name="break-start"),
    path("breaks/end/", BreakEndView.as_view(), name="break-end"),
    path("history/", MyAttendanceHistoryView.as_view(), name="history"),
    path("exceptions/", AttendanceExceptionListCreateView.as_view(), name="exceptions"),
    path("exceptions/<int:pk>/review/", AttendanceExceptionReviewView.as_view(), name="exception-review"),
]
