
from django.conf import settings
from django.db import models
from django.db.models import Q


class TeaRate(models.Model):
    effective_from = models.DateField(unique=True)
    price_per_cup = models.DecimalField(
        max_digits=8,
        decimal_places=2,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_tea_rates",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-effective_from"]
        constraints = [
            models.CheckConstraint(
                condition=Q(price_per_cup__gte=0),
                name="tea_rate_nonnegative",
            ),
        ]

    def __str__(self):
        return f"₹{self.price_per_cup} per cup from {self.effective_from}"


class TeaConsumption(models.Model):
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.PROTECT,
        related_name="tea_consumptions",
    )

    consumption_date = models.DateField()

    cups = models.PositiveSmallIntegerField()

    rate = models.ForeignKey(
        TeaRate,
        on_delete=models.PROTECT,
        related_name="consumption_records",
    )

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_tea_consumption",
    )

    notes = models.CharField(max_length=250, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-consumption_date", "employee_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "consumption_date"],
                name="uniq_tea_employee_day",
            ),
            models.CheckConstraint(
                condition=Q(cups__gt=0),
                name="tea_cups_positive",
            ),
        ]
        indexes = [
            models.Index(
                fields=["consumption_date"],
                name="tea_consumption_date_idx",
            ),
        ]

    @property
    def total_cost(self):
        return self.cups * self.rate.price_per_cup

    def __str__(self):
        return (
            f"{self.employee.employee_code}: "
            f"{self.cups} cups on {self.consumption_date}"
        )
