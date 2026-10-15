from django.contrib import admin

from attendance.models import AttendanceException, AttendanceRecord, BreakPolicy, BreakPolicyRule, BreakSession


class BreakPolicyRuleInline(admin.TabularInline):
    model = BreakPolicyRule
    extra = 0


@admin.register(BreakPolicy)
class BreakPolicyAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "version", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    inlines = (BreakPolicyRuleInline,)


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display = ("employee", "work_date", "check_in", "check_out", "status", "schedule")
    list_filter = ("status", "work_date")
    search_fields = ("employee__employee_code", "employee__official_email")
    readonly_fields = ("created_at", "updated_at")


@admin.register(BreakSession)
class BreakSessionAdmin(admin.ModelAdmin):
    list_display = ("attendance", "rule", "started_at", "ended_at")
    list_filter = ("rule__break_type",)


@admin.register(AttendanceException)
class AttendanceExceptionAdmin(admin.ModelAdmin):
    list_display = ("employee", "exception_type", "review_status", "submitted_at", "reviewed_by")
    list_filter = ("exception_type", "review_status")
    search_fields = ("employee__employee_code", "reason")
    readonly_fields = ("submitted_at", "reviewed_at")
