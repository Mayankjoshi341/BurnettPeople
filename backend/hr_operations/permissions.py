from rest_framework.exceptions import PermissionDenied


HR_ROLES = {"ADMIN", "HR"}


def is_hr_or_admin(user):
    return bool(user and user.is_authenticated and (user.is_superuser or getattr(user, "role", None) in HR_ROLES))


def require_hr_or_admin(user):
    if not is_hr_or_admin(user):
        raise PermissionDenied("Only HR or Admin can perform this action.")
