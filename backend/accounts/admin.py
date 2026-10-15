from django.contrib import admin

from .models import User, AccountInvitation, AuditEvent, PasswordResetCode


@admin.register(User)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = (
        "email",
        "first_name",
        "last_name",
        "role",
        "is_active",
        "is_staff",
    )

    search_fields = ("email", "first_name", "last_name")
    list_filter = ("role", "is_active", "is_staff")

    # Avoid changing the stored password hash directly.
    readonly_fields = ("password", "last_login", "date_joined")

    # Create users through the project's intended account-creation flow.
    def has_add_permission(self, request):
        return False


admin.site.register([
    AccountInvitation,
    AuditEvent,
    PasswordResetCode,
])