from django.urls import path

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from accounts.views import (
    CurrentUserView,
    ActivateAccountView,
    LogoutView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)


urlpatterns = [
    path(
        "token/",
        TokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path(
        "token/refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path(
        "me/",
        CurrentUserView.as_view(),
        name="current_user",
    ),
    path(
    "activate/",
    ActivateAccountView.as_view(),
    name="activate_account",
    ),
    path("logout/", LogoutView.as_view(), name="logout"),


    path(
        "password-reset/request/",
        PasswordResetRequestView.as_view(),
        name="password-reset-request",
    ),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),

]
