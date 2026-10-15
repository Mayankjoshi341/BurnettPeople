from django.contrib import admin
from .models import Department, Designation, WorkLocation

admin.site.register([Department, Designation, WorkLocation])