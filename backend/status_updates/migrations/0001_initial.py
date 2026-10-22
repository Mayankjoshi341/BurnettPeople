# Generated for BurnettPeople work status updates.
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("employees", "0001_initial"),
    ]
    operations = [
        migrations.CreateModel(
            name="StatusUpdate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("update_date", models.DateField(db_index=True, default=django.utils.timezone.localdate)),
                ("work_status", models.CharField(choices=[("IN_PROGRESS", "In progress"), ("COMPLETED", "Completed"), ("BLOCKED", "Blocked")], default="IN_PROGRESS", max_length=20)),
                ("completed_work", models.TextField()),
                ("currently_working", models.TextField()),
                ("testing", models.TextField(blank=True, default="")),
                ("tech_stack", models.TextField(blank=True, default="")),
                ("remaining_work", models.TextField(blank=True, null=True)),
                ("blocker", models.TextField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("author", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="work_status_updates", to=settings.AUTH_USER_MODEL)),
                ("employee", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="work_status_updates", to="employees.employee")),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.AddConstraint(
            model_name="statusupdate",
            constraint=models.UniqueConstraint(fields=("author", "update_date"), name="uniq_status_update_author_date"),
        ),
        migrations.AddIndex(
            model_name="statusupdate",
            index=models.Index(fields=["update_date", "work_status"], name="status_date_work_idx"),
        ),
        migrations.AddIndex(
            model_name="statusupdate",
            index=models.Index(fields=["author", "update_date"], name="status_author_date_idx"),
        ),
    ]
