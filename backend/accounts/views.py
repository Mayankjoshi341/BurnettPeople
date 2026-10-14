
from rest_framework.generics import RetrieveAPIView
from rest_framework.permissions import IsAuthenticated

from .serializers import CurrentUserSerializer
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from .serializers import AccountActivationSerializer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken


from accounts.serializers import (
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from accounts.services.password_reset import (
    request_password_reset,
    confirm_password_reset,
)

class CurrentUserView(RetrieveAPIView):
    """Return the currently authenticated user's profile."""

    serializer_class = CurrentUserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

class ActivateAccountView(APIView):
    # Activation is public because the user does not have a JWT yet.
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AccountActivationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "detail": (
                    "Your account has been activated successfully. "
                    "You can now log in."
                )
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        raw_refresh = request.data.get("refresh")

        if not raw_refresh:
            return Response(
                {"detail": "A refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            refresh = RefreshToken(raw_refresh)

            # Prevent one authenticated user from revoking another
            # user's refresh token.
            if str(refresh.get("user_id")) != str(request.user.pk):
                return Response(
                    {"detail": "This refresh token belongs to another account."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            refresh.blacklist()

        except TokenError:
            return Response(
                {"detail": "The refresh token is invalid, expired, or revoked."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"detail": "Logout successful."},
            status=status.HTTP_205_RESET_CONTENT,
        )

class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        request_password_reset(serializer.validated_data["email"])

        return Response({
            "detail": (
                "If an active account exists with that email, "
                "a password reset code will be sent."
            )
        })


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        confirm_password_reset(
            email=data["email"],
            code=data["code"],
            new_password=data["password"],
        )

        return Response({
            "detail": "Your password has been reset successfully."
        })
