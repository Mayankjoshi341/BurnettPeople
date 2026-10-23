from django.conf import settings
from django.db import models


class ScoringRule(models.Model):
    class Activity(models.TextChoices):
        ON_TIME_CHECK_IN = "ON_TIME_CHECK_IN", "On-time check-in"
        COMPLETE_ATTENDANCE = "COMPLETE_ATTENDANCE", "Complete attendance record"
        LEARNING_COMPLETED = "LEARNING_COMPLETED", "Learning activity completed"
        TEAM_CHALLENGE = "TEAM_CHALLENGE", "Team challenge completed"

    activity = models.CharField(max_length=32, choices=Activity.choices, unique=True)
    points = models.PositiveSmallIntegerField(default=0)
    active = models.BooleanField(default=True)
    eligibility = models.JSONField(default=dict, blank=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["activity"]


class ScoreLedger(models.Model):
    participant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="recognition_scores")
    employee = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.SET_NULL, related_name="recognition_scores")
    activity = models.CharField(max_length=32, choices=ScoringRule.Activity.choices)
    points = models.PositiveSmallIntegerField()
    source_event = models.CharField(max_length=160, unique=True)
    event_date = models.DateField(db_index=True)
    description = models.CharField(max_length=180)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-event_date", "-id"]
        indexes = [models.Index(fields=["participant", "event_date"], name="recognition_user_date_idx")]


class AchievementDefinition(models.Model):
    key = models.SlugField(max_length=48, unique=True)
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=240)
    active = models.BooleanField(default=True)
    bonus_points = models.PositiveSmallIntegerField(default=0)
    configuration = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["name"]


class EmployeeAchievement(models.Model):
    participant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="recognition_achievements")
    employee = models.ForeignKey("employees.Employee", null=True, blank=True, on_delete=models.SET_NULL, related_name="recognition_achievements")
    definition = models.ForeignKey(AchievementDefinition, on_delete=models.PROTECT, related_name="earned")
    earned_at = models.DateTimeField()
    period_key = models.CharField(max_length=16, default="lifetime")
    status = models.CharField(max_length=16, default="EARNED")
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-earned_at", "id"]
        constraints = [models.UniqueConstraint(fields=["participant", "definition", "period_key"], name="uniq_recognition_achievement")]


class LearningActivity(models.Model):
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="learning_activities_created")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title", "id"]


class LearningCompletion(models.Model):
    class Status(models.TextChoices):
        ASSIGNED = "ASSIGNED", "Assigned"
        REVIEW = "REVIEW", "Pending review"
        COMPLETED = "COMPLETED", "Verified"
        REJECTED = "REJECTED", "Needs more information"

    activity = models.ForeignKey(LearningActivity, on_delete=models.PROTECT, related_name="completions")
    participant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="learning_completions")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ASSIGNED)
    submission_note = models.CharField(max_length=500, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="learning_completions_verified")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status", "activity__title", "participant_id"]
        constraints = [models.UniqueConstraint(fields=["activity", "participant"], name="uniq_learning_participant_activity")]
        indexes = [models.Index(fields=["participant", "status"], name="learning_user_status_idx")]


class TeamChallenge(models.Model):
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    starts_on = models.DateField()
    ends_on = models.DateField()
    active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="team_challenges_created")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-starts_on", "title", "id"]
        constraints = [models.CheckConstraint(condition=models.Q(ends_on__gte=models.F("starts_on")), name="challenge_end_on_or_after_start")]


class ChallengeParticipation(models.Model):
    class Status(models.TextChoices):
        JOINED = "JOINED", "Joined"
        REVIEW = "REVIEW", "Pending review"
        COMPLETED = "COMPLETED", "Verified"
        REJECTED = "REJECTED", "Needs more information"

    challenge = models.ForeignKey(TeamChallenge, on_delete=models.PROTECT, related_name="participations")
    participant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="challenge_participations")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.JOINED)
    submission_note = models.CharField(max_length=500, blank=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="challenge_participations_verified")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["status", "challenge__title", "participant_id"]
        constraints = [models.UniqueConstraint(fields=["challenge", "participant"], name="uniq_challenge_participant")]
        indexes = [models.Index(fields=["participant", "status"], name="challenge_user_status_idx")]
