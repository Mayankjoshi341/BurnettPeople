from django.urls import path

from .views import (
    MissingStatusUpdatesView,
    StatusUpdateDetailView,
    StatusUpdateListCreateView,
    StatusUpdateUserHistoryView,
)

urlpatterns = [
    path("", StatusUpdateListCreateView.as_view(), name="status-update-list-create"),
    path("missing/", MissingStatusUpdatesView.as_view(), name="status-update-missing"),
    path("users/<int:user_id>/history/", StatusUpdateUserHistoryView.as_view(), name="status-update-user-history"),
    path("<int:pk>/", StatusUpdateDetailView.as_view(), name="status-update-detail"),
]
