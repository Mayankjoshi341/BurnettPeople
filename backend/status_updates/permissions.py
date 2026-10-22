from accounts.models import User


def elevated_role(user):
    """Whether the user may inspect organization-wide work status updates."""
    return bool(
        user.is_superuser
        or user.role in {User.Role.ADMIN, User.Role.HR}
    )


def manager_team_user_ids(user):
    """IDs of user accounts attached to employees reporting to this manager."""
    from employees.models import Employee

    return Employee.objects.filter(manager__user=user).exclude(user__isnull=True).values_list("user_id", flat=True)
