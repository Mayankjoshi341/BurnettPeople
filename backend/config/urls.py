
from django.contrib import admin
from django.urls import include, path

from accounts.audit_views import AuditEventListView
from accounts.views import AdminCreateHRView
from attendance.reporting_views import AdminDashboardMetricsView
from core.views import health_check, liveness_check, readiness_check
from recognition.views import (
    AchievementCatalogView,
    ChallengeJoinView,
    ChallengeSubmitView,
    ChallengeVerifyView,
    LeaderboardDepartmentsView,
    LeaderboardView,
    LearningActivitiesView,
    LearningEnrollView,
    LearningSubmitView,
    LearningVerifyView,
    MyRecognitionView,
    RecognitionReviewQueueView,
    RecognitionRulesView,
    TeamChallengesView,
)

urlpatterns = [
    # Django administration
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

    # Admin endpoints
    path(
        "api/admin/hr/",
        AdminCreateHRView.as_view(),
        name="admin-create-hr",
    ),
    path(
        "api/admin/metrics/",
        AdminDashboardMetricsView.as_view(),
        name="admin-metrics",
    ),

    # Recognition and leaderboard
    path(
        "api/recognition/leaderboard/",
        LeaderboardView.as_view(),
        name="recognition-leaderboard",
    ),
    path(
        "api/recognition/departments/",
        LeaderboardDepartmentsView.as_view(),
        name="recognition-departments",
    ),
    path(
        "api/recognition/me/",
        MyRecognitionView.as_view(),
        name="recognition-me",
    ),
    path(
        "api/recognition/rules/",
        RecognitionRulesView.as_view(),
        name="recognition-rules",
    ),
    path(
        "api/recognition/achievements/",
        AchievementCatalogView.as_view(),
        name="recognition-achievements",
    ),
    path(
        "api/recognition/learning/",
        LearningActivitiesView.as_view(),
        name="recognition-learning",
    ),
    path(
        "api/recognition/learning/<int:pk>/enroll/",
        LearningEnrollView.as_view(),
        name="recognition-learning-enroll",
    ),
    path(
        "api/recognition/learning/completions/<int:pk>/submit/",
        LearningSubmitView.as_view(),
        name="recognition-learning-submit",
    ),
    path(
        "api/recognition/learning/completions/<int:pk>/verify/",
        LearningVerifyView.as_view(),
        name="recognition-learning-verify",
    ),
    path(
        "api/recognition/challenges/",
        TeamChallengesView.as_view(),
        name="recognition-challenges",
    ),
    path(
        "api/recognition/challenges/<int:pk>/join/",
        ChallengeJoinView.as_view(),
        name="recognition-challenge-join",
    ),
    path(
        "api/recognition/challenges/participations/<int:pk>/submit/",
        ChallengeSubmitView.as_view(),
        name="recognition-challenge-submit",
    ),
    path(
        "api/recognition/challenges/participations/<int:pk>/verify/",
        ChallengeVerifyView.as_view(),
        name="recognition-challenge-verify",
    ),
    path(
        "api/recognition/review-queue/",
        RecognitionReviewQueueView.as_view(),
        name="recognition-review-queue",
    ),

    # Audit logs
    path(
        "api/audit/logs/",
        AuditEventListView.as_view(),
        name="audit-log-list",
    ),

    # HR operations: leave, assets, notifications and remote work
    path("api/", include("hr_operations.urls")),

    # Work status updates
    path(
        "api/status-updates/",
        include("status_updates.urls"),
    ),
]
