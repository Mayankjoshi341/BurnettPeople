from django.urls import path

from hr_operations.views import (
    AssetAssignmentListCreateView,
    AssetDetailView,
    AssetListCreateView,
    AssetReturnView,
    AssetStatusView,
    CompanyHolidayDetailView,
    CompanyHolidayListCreateView,
    LeaveApprovalQueueView,
    LeaveApproveView,
    LeaveBalanceListCreateView,
    LeaveCancelView,
    LeaveDraftView,
    LeaveRejectView,
    LeaveRequestListCreateView,
    LeaveTypeDetailView,
    LeaveTypeListCreateView,
    MyAssetsView,
    MyLeaveBalancesView,
    NotificationListView,
    NotificationReadAllView,
    NotificationReadView,
)

app_name = "hr_operations"
urlpatterns = [
    # Leave policy and calendar
    path("leave/types/", LeaveTypeListCreateView.as_view(), name="leave-type-list-create"),
    path("leave/types/<int:pk>/", LeaveTypeDetailView.as_view(), name="leave-type-detail"),
    path("leave/holidays/", CompanyHolidayListCreateView.as_view(), name="company-holiday-list-create"),
    path("leave/holidays/<int:pk>/", CompanyHolidayDetailView.as_view(), name="company-holiday-detail"),
    path("leave/balances/me/", MyLeaveBalancesView.as_view(), name="my-leave-balances"),
    path("leave/balances/", LeaveBalanceListCreateView.as_view(), name="leave-balance-list-create"),
    path("leave/requests/", LeaveRequestListCreateView.as_view(), name="leave-request-list-create"),
    path("leave/requests/pending-approvals/", LeaveApprovalQueueView.as_view(), name="leave-approval-queue"),
    path("leave/requests/<int:pk>/approve/", LeaveApproveView.as_view(), name="leave-request-approve"),
    path("leave/requests/<int:pk>/reject/", LeaveRejectView.as_view(), name="leave-request-reject"),
    path("leave/requests/<int:pk>/cancel/", LeaveCancelView.as_view(), name="leave-request-cancel"),
    # Asset inventory and auditable assignment history
    path("assets/me/", MyAssetsView.as_view(), name="my-assets"),
    path("assets/", AssetListCreateView.as_view(), name="asset-list-create"),
    path("assets/<int:pk>/", AssetDetailView.as_view(), name="asset-detail"),
    path("assets/<int:pk>/status/", AssetStatusView.as_view(), name="asset-status"),
    path("assets/assignments/", AssetAssignmentListCreateView.as_view(), name="asset-assignment-list-create"),
    path("assets/assignments/<int:pk>/return/", AssetReturnView.as_view(), name="asset-assignment-return"),
    # Notifications and AI draft only
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/read-all/", NotificationReadAllView.as_view(), name="notification-read-all"),
    path("notifications/<int:pk>/read/", NotificationReadView.as_view(), name="notification-read"),
    path("ai/leave-draft/", LeaveDraftView.as_view(), name="ai-leave-draft"),
]
