
from rest_framework.permissions import BasePermission

from accounts.models import User


class IsHROrAdmin(BasePermission):
    """Allow only HR and Admin users to manage employee records."""

    message = "Only HR or Admin users can perform this action."

    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.role in {
                    User.Role.ADMIN,
                    User.Role.HR,
                }
            )
        )

class IsAdmin(BasePermission):
    """Allow only authenticated users whose application role is ADMIN."""

    message = "Only an Admin can create HR accounts."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role == User.Role.ADMIN
        )
