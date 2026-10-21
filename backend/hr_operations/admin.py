from django.contrib import admin

from hr_operations.models import (
    Asset,
    AssetAssignment,
    CompanyHoliday,
    LeaveBalance,
    LeaveRequest,
    LeaveRequestAllocation,
    LeaveType,
    Notification,
)


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_paid", "is_active", "max_consecutive_days")
    list_filter = ("is_paid", "is_active")
    search_fields = ("code", "name")


@admin.register(CompanyHoliday)
class CompanyHolidayAdmin(admin.ModelAdmin):
    list_display = ("date", "name", "is_active", "created_by")
    list_filter = ("is_active",)
    search_fields = ("name", "description")
    date_hierarchy = "date"


@admin.register(LeaveBalance)
class LeaveBalanceAdmin(admin.ModelAdmin):
    list_display = ("employee", "leave_type", "year", "entitled_days", "used_days", "reserved_days")
    list_filter = ("year", "leave_type")
    search_fields = ("employee__employee_code", "employee__first_name", "employee__last_name")


class LeaveRequestAllocationInline(admin.TabularInline):
    model = LeaveRequestAllocation
    extra = 0
    readonly_fields = ("balance", "days_count")


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ("employee", "leave_type", "start_date", "end_date", "days_count", "status", "submitted_at")
    list_filter = ("status", "leave_type")
    search_fields = ("employee__employee_code", "employee__first_name", "employee__last_name", "reason")
    readonly_fields = ("submitted_at", "created_at", "updated_at", "decided_at")
    inlines = (LeaveRequestAllocationInline,)


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("asset_tag", "name", "category", "status", "serial_number")
    list_filter = ("category", "status")
    search_fields = ("asset_tag", "name", "serial_number", "manufacturer", "model")


@admin.register(AssetAssignment)
class AssetAssignmentAdmin(admin.ModelAdmin):
    list_display = ("asset", "employee", "assigned_at", "returned_at", "assigned_by", "returned_by")
    list_filter = ("returned_at",)
    search_fields = ("asset__asset_tag", "employee__employee_code", "employee__first_name", "employee__last_name")
    readonly_fields = ("asset", "employee", "assigned_by", "assigned_at", "returned_at", "returned_by")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("recipient", "kind", "title", "read_at", "created_at")
    list_filter = ("kind", "read_at")
    search_fields = ("recipient__email", "title", "message")
