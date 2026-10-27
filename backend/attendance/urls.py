from django.urls import path

from attendance.overview_views import AttendanceOverviewView
from attendance.reporting_views import (
    AttendanceRecordListView,
    AttendanceSummaryView,
    DailyAttendanceReportView,
    ManagerDashboardView,
    MyWorkScheduleView,
)
from attendance.schedule_management_views import (
    BreakPolicyListView,
    BreakPolicyDetailView,
    ScheduleAssignmentDetailView,
    ScheduleAssignmentListCreateView,
    WorkScheduleDetailView,
    WorkScheduleListView,
)
from attendance.views import (
    AttendanceExceptionListCreateView,
    AttendanceExceptionReviewView,
    BreakEndView,
    BreakStartView,
    CheckInView,
    CheckOutView,
    MyAttendanceHistoryView,
    MyAttendanceView,
)

app_name = "attendance"
urlpatterns = [
    path("me/", MyAttendanceView.as_view(), name="my-attendance"),
    path("schedule/me/", MyWorkScheduleView.as_view(), name="my-work-schedule"),
    path("check-in/", CheckInView.as_view(), name="check-in"),
    path("check-out/", CheckOutView.as_view(), name="check-out"),
    path("breaks/start/", BreakStartView.as_view(), name="break-start"),
    path("breaks/end/", BreakEndView.as_view(), name="break-end"),
    path("history/", MyAttendanceHistoryView.as_view(), name="history"),
    path("records/", AttendanceRecordListView.as_view(), name="attendance-record-list"),
    path("summary/", AttendanceSummaryView.as_view(), name="attendance-summary"),
    path("overview/", AttendanceOverviewView.as_view(), name="attendance-overview"),
    path("reports/daily/", DailyAttendanceReportView.as_view(), name="daily-attendance-report"),
    path("manager-dashboard/", ManagerDashboardView.as_view(), name="manager-dashboard"),
    path("schedules/", WorkScheduleListView.as_view(), name="schedule-list"),
    path("schedules/<int:pk>/", WorkScheduleDetailView.as_view(), name="schedule-detail"),
    path("break-policies/", BreakPolicyListView.as_view(), name="break-policy-list"),
    path("break-policies/<int:pk>/", BreakPolicyDetailView.as_view(), name="break-policy-detail"),
    path("assignments/", ScheduleAssignmentListCreateView.as_view(), name="schedule-assignment-list-create"),
    path("assignments/<int:pk>/", ScheduleAssignmentDetailView.as_view(), name="schedule-assignment-detail"),
    path("exceptions/", AttendanceExceptionListCreateView.as_view(), name="exceptions"),
    path(
        "exceptions/<int:pk>/review/",
        AttendanceExceptionReviewView.as_view(),
        name="exception-review",
    ),
]
