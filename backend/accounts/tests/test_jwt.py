
from datetime import timedelta

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken


User = get_user_model()


class JWTAuthenticationTests(APITestCase):
    def setUp(self):
        self.email = "jwt.test@example.com"
        self.password = "Test-JWT-Password-8274!"

        self.user = User.objects.create_user(
            email=self.email,
            password=self.password,
            first_name="JWT",
            last_name="Test",
            role=User.Role.EMPLOYEE,
            is_active=True,
        )

    def obtain_tokens(self):
        response = self.client.post(
            "/api/auth/token/",
            {"email": self.email, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def test_configured_token_lifetimes_and_rotation(self):
        self.assertEqual(
            api_settings.ACCESS_TOKEN_LIFETIME,
            timedelta(hours=6),
        )
        self.assertEqual(
            api_settings.REFRESH_TOKEN_LIFETIME,
            timedelta(days=7),
        )
        self.assertTrue(api_settings.ROTATE_REFRESH_TOKENS)
        self.assertTrue(api_settings.BLACKLIST_AFTER_ROTATION)

    def test_login_returns_six_hour_access_token(self):
        tokens = self.obtain_tokens()

        access = AccessToken(tokens["access"])
        issued_at = int(access["iat"])
        expires_at = int(access["exp"])

        self.assertEqual(expires_at - issued_at, 6 * 60 * 60)
        self.assertIn("refresh", tokens)

    def test_access_token_authenticates_current_user(self):
        tokens = self.obtain_tokens()

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {tokens['access']}"
        )
        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.email)
        self.assertEqual(response.data["role"], User.Role.EMPLOYEE)

    def test_refresh_rotation_rejects_old_refresh_token(self):
        original_tokens = self.obtain_tokens()
        old_refresh = original_tokens["refresh"]

        rotated = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": old_refresh},
            format="json",
        )

        self.assertEqual(rotated.status_code, status.HTTP_200_OK)
        self.assertIn("access", rotated.data)
        self.assertIn("refresh", rotated.data)
        self.assertNotEqual(rotated.data["refresh"], old_refresh)

        # The original refresh token must no longer be reusable.
        old_token_again = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": old_refresh},
            format="json",
        )

        self.assertEqual(
            old_token_again.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

        # The newly rotated refresh token must still work.
        new_refresh_works = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": rotated.data["refresh"]},
            format="json",
        )

        self.assertEqual(
            new_refresh_works.status_code,
            status.HTTP_200_OK,
        )

    def test_logout_revokes_refresh_token(self):
        tokens = self.obtain_tokens()

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {tokens['access']}"
        )
        logout_response = self.client.post(
            "/api/auth/logout/",
            {"refresh": tokens["refresh"]},
            format="json",
        )

        self.assertEqual(
            logout_response.status_code,
            status.HTTP_205_RESET_CONTENT,
        )

        # The revoked refresh token must not issue new access tokens.
        refresh_response = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": tokens["refresh"]},
            format="json",
        )

        self.assertEqual(
            refresh_response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_inactive_user_cannot_log_in(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        response = self.client.post(
            "/api/auth/token/",
            {"email": self.email, "password": self.password},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
