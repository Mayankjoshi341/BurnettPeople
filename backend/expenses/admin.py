from django.contrib import admin
from .models import TeaRate, TeaConsumption

admin.site.register([TeaRate, TeaConsumption])