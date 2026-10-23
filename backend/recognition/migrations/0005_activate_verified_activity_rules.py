from django.db import migrations


def activate_verified_rules(apps, schema_editor):
    Rule = apps.get_model("recognition", "ScoringRule")
    Rule.objects.filter(activity="LEARNING_COMPLETED").update(active=True, points=10)
    Rule.objects.filter(activity="TEAM_CHALLENGE").update(active=True, points=15)
    Achievement = apps.get_model("recognition", "AchievementDefinition")
    Achievement.objects.filter(key="learning-champion").update(configuration={"verified_activities": 3})
    Achievement.objects.filter(key="team-player").update(configuration={"verified_activities": 3})


class Migration(migrations.Migration):
    dependencies = [("recognition", "0004_learningactivity_teamchallenge_and_more")]
    operations = [migrations.RunPython(activate_verified_rules, migrations.RunPython.noop)]
