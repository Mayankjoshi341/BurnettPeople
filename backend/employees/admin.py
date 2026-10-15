from django.contrib import admin
from .models import Employee, WorkSchedule, EmployeeScheduleAssignment

admin.site.register([
    Employee,
    WorkSchedule,
    EmployeeScheduleAssignment,
])