from django.db import migrations


def seed(apps, schema_editor):
    ScoringRule = apps.get_model("recognition", "ScoringRule")
    AchievementDefinition = apps.get_model("recognition", "AchievementDefinition")
    rules = [
        ("ON_TIME_CHECK_IN", 10, True, {"basis": "server_recorded_check_in", "grace_from_schedule": True}),
        ("COMPLETE_ATTENDANCE", 5, True, {"requires_check_in_and_check_out": True}),
        ("LEARNING_COMPLETED", 10, False, {"source_required": "learning_completion"}),
        ("TEAM_CHALLENGE", 15, False, {"source_required": "team_challenge_completion"}),
    ]
    for activity, points, active, eligibility in rules:
        ScoringRule.objects.update_or_create(activity=activity, defaults={"points": points, "active": active, "eligibility": eligibility})
    achievements = [
        ("on-time-streak-5", "On-Time Streak", "Five consecutive eligible scheduled workdays with an on-time check-in.", 0, {"eligible_workdays": 5}),
        ("consistency-10", "10-Day Consistency", "Ten eligible attendance days. Approved leave does not break the streak.", 0, {"eligible_workdays": 10, "optional": True}),
        ("punctuality-pro", "Punctuality Pro", "At least 95% on-time check-ins in an eligible calendar month.", 0, {"monthly_rate": 0.95}),
        ("attendance-star", "Attendance Star", "Complete attendance records for the configured eligible period.", 0, {"period_days": 20}),
        ("learning-champion", "Learning Champion", "Verified completion of assigned learning activities.", 0, {"source_required": "learning_completion"}),
        ("team-player", "Team Player", "Verified team challenge participation or positive recognition.", 0, {"source_required": "team_challenge_completion"}),
        ("most-improved", "Most Improved", "Meaningful improvement against the participant's historical baseline.", 0, {"comparison_required": True}),
    ]
    for key, name, description, bonus_points, configuration in achievements:
        AchievementDefinition.objects.update_or_create(key=key, defaults={"name": name, "description": description, "bonus_points": bonus_points, "configuration": configuration, "active": True})


def unseed(apps, schema_editor):
    # Preserve earned history; reversing this data migration intentionally leaves definitions and rules intact.
    pass


class Migration(migrations.Migration):
    dependencies = [("recognition", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
