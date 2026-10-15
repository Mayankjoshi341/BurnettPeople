
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_alter_auditevent_action"),
    ]

    operations = [
        migrations.AlterField(
            model_name="auditevent",
            name="action",
            field=models.CharField(
                max_length=32,
                choices=[
                    ("EMPLOYEE_CREATED", "Employee created"),
                    ("HR_CREATED", "HR account created"),
                    ("INVITATION_CREATED", "Invitation created"),
                    ("INVITATION_RESENT", "Invitation resent"),
                    ("INVITATION_EMAIL_SENT", "Invitation email sent"),
                    ("INVITATION_EMAIL_FAILED", "Invitation email failed"),
                    ("ACCOUNT_ACTIVATED", "Account activated"),
                    ("EMPLOYEE_DEACTIVATED", "Employee deactivated"),
                    (
                        "PASSWORD_RESET_REQUESTED",
                        "Password reset requested",
                    ),
                    (
                        "PASSWORD_RESET_COMPLETED",
                        "Password reset completed",
                    ),
                ],
            ),
        ),
    ]
