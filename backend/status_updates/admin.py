from django.contrib import admin
from .models import StatusUpdate


@admin.register(StatusUpdate)
class StatusUpdateAdmin(admin.ModelAdmin):
    list_display = ("author", "update_date", "work_status", "created_at", "updated_at")
    list_filter = ("work_status", "update_date", "author__role")
    search_fields = ("author__email", "author__first_name", "author__last_name", "completed_work", "currently_working")
    readonly_fields = ("created_at", "updated_at")
