from django.db import models


class Department(models.Model):
    name = models.CharField(max_length=100)

    code = models.CharField(
        max_length=20,
        unique=True,
    )

    description = models.TextField(
        blank=True,
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Designation(models.Model):
    title = models.CharField(max_length=100)

    grade = models.CharField(
        max_length=50,
        blank=True,
        null=True,
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title", "id"]

    def __str__(self):
        if self.grade:
            return f"{self.title} - {self.grade}"
        return self.title

class WorkLocation(models.Model):
    name = models.CharField(max_length=100, unique=True)
    address = models.TextField(blank=True)
    timezone = models.CharField(
        max_length=50,
        default="Asia/Kolkata",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name