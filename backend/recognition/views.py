from datetime import date, timedelta

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsHROrAdmin
from employees.models import Employee
from organization.models import Department
from recognition.models import (
    AchievementDefinition, ChallengeParticipation, EmployeeAchievement,
    LearningActivity, LearningCompletion, ScoreLedger, ScoringRule, TeamChallenge,
)
from recognition.services import award_activity_milestone, award_verified_activity, current_streak


def _visible_participant(user):
    return user.role in {User.Role.EMPLOYEE, User.Role.MANAGER, User.Role.HR, User.Role.ADMIN}


class LeaderboardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class LeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _visible_participant(request.user):
            return Response({"detail": "Your role cannot access the company leaderboard."}, status=403)
        period = request.query_params.get("period", "all")
        if period not in {"all", "week", "month"}:
            raise ValidationError({"period": "Choose all, week, or month."})
        today = timezone.localdate()
        queryset = ScoreLedger.objects.select_related("participant", "employee", "employee__department").filter(
            Q(participant__is_active=True),
        ).filter(Q(employee__isnull=True) | Q(employee__employment_status=Employee.EmploymentStatus.ACTIVE))
        if period == "week":
            queryset = queryset.filter(event_date__gte=today-timedelta(days=today.weekday()))
        elif period == "month":
            queryset = queryset.filter(event_date__year=today.year, event_date__month=today.month)
        department = request.query_params.get("department")
        if department:
            try:
                queryset = queryset.filter(employee__department_id=int(department))
            except ValueError as exc:
                raise ValidationError({"department": "Choose a valid department id."}) from exc
        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(participant__first_name__icontains=search) | Q(participant__last_name__icontains=search))
        rankings = list(queryset.values("participant_id", "participant__first_name", "participant__last_name",
            "employee__department_id", "employee__department__name").annotate(points=Sum("points")))
        rankings.sort(key=lambda row: (-row["points"], (row["participant__last_name"] or "").casefold(), row["participant_id"]))
        participant_ids = [row["participant_id"] for row in rankings]
        badges_by_participant = {}
        for achievement in EmployeeAchievement.objects.filter(participant_id__in=participant_ids, status="EARNED").select_related("definition"):
            badges_by_participant.setdefault(achievement.participant_id, []).append({
                "name": achievement.definition.name,
                "description": achievement.definition.description,
                "earned_at": achievement.earned_at,
            })
        # Competition ranking: ties share a rank and the next rank skips.
        result = []
        last_points = None
        current_rank = 0
        for index, row in enumerate(rankings, 1):
            if row["points"] != last_points:
                current_rank = index
                last_points = row["points"]
            result.append({"rank": current_rank, "participant_id": row["participant_id"],
                "name": f"{row['participant__first_name']} {row['participant__last_name']}".strip(),
                "department_id": row["employee__department_id"], "department": row["employee__department__name"],
                "points": row["points"], "is_me": row["participant_id"] == request.user.pk,
                "badge_details": badges_by_participant.get(row["participant_id"], []),
                "badges": [badge["name"] for badge in badges_by_participant.get(row["participant_id"], [])]})
        paginator = LeaderboardPagination()
        page = paginator.paginate_queryset(result, request, view=self)
        return paginator.get_paginated_response({"results": page,
            "current_user": next((entry for entry in result if entry["is_me"]), None),
            "scoring": list(ScoringRule.objects.filter(active=True).values("activity", "points"))})


class LeaderboardDepartmentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _visible_participant(request.user):
            raise PermissionDenied("Your role cannot access the company leaderboard.")
        return Response(list(Department.objects.filter(is_active=True).order_by("name").values("id", "name")))


class MyRecognitionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _visible_participant(request.user):
            return Response({"detail": "Your role cannot access recognition data."}, status=403)
        ledger = ScoreLedger.objects.filter(participant=request.user)
        streak = current_streak(request.user)
        achievements = EmployeeAchievement.objects.filter(participant=request.user, status="EARNED").select_related("definition")
        return Response({"points": ledger.aggregate(total=Sum("points"))["total"] or 0,
            "on_time_streak": streak,
            "achievements": [{"key": item.definition.key, "name": item.definition.name,
                "description": item.definition.description, "earned_at": item.earned_at,
                "metadata": item.metadata} for item in achievements],
            "history": list(ledger.values("activity", "points", "description", "event_date").order_by("-event_date", "-id")[:100])})


class RecognitionRulesView(APIView):
    permission_classes = [IsAuthenticated, IsHROrAdmin]

    def get(self, request):
        return Response(list(ScoringRule.objects.all().values("id", "activity", "points", "active", "eligibility", "updated_at")))

    @transaction.atomic
    def patch(self, request):
        updates = request.data.get("rules")
        if not isinstance(updates, list):
            raise ValidationError({"rules": "Provide a list of scoring rule updates."})
        ids = []
        for item in updates:
            if not isinstance(item, dict) or isinstance(item.get("id"), bool) or not isinstance(item.get("id"), int):
                raise ValidationError({"rules": "Each update needs a numeric rule id."})
            ids.append(item["id"])
        if len(set(ids)) != len(ids):
            raise ValidationError({"rules": "Each scoring rule may be updated only once per request."})
        for item in updates:
            rule = ScoringRule.objects.filter(pk=item["id"]).first()
            if rule is None:
                raise ValidationError({"rules": f"Unknown scoring rule id {item['id']}."})
            if "points" in item:
                if isinstance(item["points"], bool) or not isinstance(item["points"], int) or not 0 <= item["points"] <= 100:
                    raise ValidationError({"points": "Points must be between 0 and 100."})
                rule.points = item["points"]
            if "active" in item:
                if not isinstance(item["active"], bool):
                    raise ValidationError({"active": "Active must be true or false."})
                rule.active = item["active"]
            if "eligibility" in item:
                if not isinstance(item["eligibility"], dict):
                    raise ValidationError({"eligibility": "Eligibility must be an object."})
                rule.eligibility = item["eligibility"]
            rule.updated_by = request.user
            rule.save()
        return self.get(request)


class AchievementCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _visible_participant(request.user):
            return Response({"detail": "Your role cannot access recognition data."}, status=403)
        earned = set(EmployeeAchievement.objects.filter(participant=request.user, status="EARNED").values_list("definition_id", flat=True))
        return Response([{
            "key": item.key, "name": item.name, "description": item.description,
            "active": item.active, "earned": item.pk in earned,
        } for item in AchievementDefinition.objects.all()])


def _review_allowed(reviewer, participant):
    # A participant must never verify their own submission.
    # Check this before granting elevated-role permissions.
    if reviewer.pk == participant.pk:
        return False

    if reviewer.is_superuser or reviewer.role in {
        User.Role.ADMIN,
        User.Role.HR,
    }:
        return True

    if reviewer.role != User.Role.MANAGER:
        return False

    try:
        reviewer_employee = reviewer.employee_profile
        participant_employee = participant.employee_profile
    except Employee.DoesNotExist:
        return False

    return participant_employee.manager_id == reviewer_employee.id

def _learning_data(activity, participant):
    completion = LearningCompletion.objects.filter(activity=activity, participant=participant).first()
    return {"id": activity.id, "title": activity.title, "description": activity.description,
        "status": completion.status if completion else None, "completion_id": completion.id if completion else None,
        "submission_note": completion.submission_note if completion else ""}


class LearningActivitiesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _visible_participant(request.user):
            raise PermissionDenied("Your role cannot access recognition activities.")
        return Response([_learning_data(activity, request.user) for activity in LearningActivity.objects.filter(active=True)])

    def post(self, request):
        if request.user.role not in {User.Role.ADMIN, User.Role.HR}:
            raise PermissionDenied("Only HR or administrators can create learning activities.")
        title = str(request.data.get("title", "")).strip()
        description = str(request.data.get("description", "")).strip()
        if not title or len(title) > 120 or len(description) > 5000:
            raise ValidationError({"title": "Provide a title up to 120 characters and a description up to 5000 characters."})
        activity = LearningActivity.objects.create(title=title, description=description, created_by=request.user)
        return Response({"id": activity.pk, "title": activity.title, "description": activity.description, "active": activity.active}, status=201)


class LearningEnrollView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        activity = LearningActivity.objects.filter(pk=pk, active=True).first()
        if activity is None:
            raise NotFound("This learning activity is not available.")
        completion, _created = LearningCompletion.objects.get_or_create(activity=activity, participant=request.user)
        if completion.status == LearningCompletion.Status.REJECTED:
            completion.status = LearningCompletion.Status.ASSIGNED
            completion.submission_note = ""
            completion.submitted_at = None
            completion.save(update_fields=["status", "submission_note", "submitted_at", "updated_at"])
        return Response({"id": completion.pk, "activity_id": activity.pk, "status": completion.status})


class LearningSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        completion = LearningCompletion.objects.filter(pk=pk).first()
        if completion is None:
            raise NotFound("Learning activity enrollment was not found.")
        if completion.participant_id != request.user.pk:
            raise PermissionDenied("You can submit only your own learning activity.")
        if completion.status not in {LearningCompletion.Status.ASSIGNED, LearningCompletion.Status.REJECTED}:
            raise ValidationError({"status": "This learning activity is not ready for submission."})
        note = str(request.data.get("submission_note", "")).strip()
        if not note or len(note) > 500:
            raise ValidationError({"submission_note": "Describe what you completed in 1 to 500 characters."})
        completion.status = LearningCompletion.Status.REVIEW
        completion.submission_note = note
        completion.submitted_at = timezone.now()
        completion.save(update_fields=["status", "submission_note", "submitted_at", "updated_at"])
        return Response({"id": completion.pk, "status": completion.status})


class LearningVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        completion = LearningCompletion.objects.select_for_update().select_related("participant", "activity").filter(pk=pk).first()
        if completion is None:
            raise NotFound("Learning completion was not found.")
        if not _review_allowed(request.user, completion.participant):
            raise PermissionDenied("Only HR, administrators, or the participant's manager can verify this completion.")
        if completion.status != LearningCompletion.Status.REVIEW:
            raise ValidationError({"status": "Only pending submissions can be reviewed."})
        decision = request.data.get("decision")
        if decision not in {"COMPLETED", "REJECTED"}:
            raise ValidationError({"decision": "Choose COMPLETED or REJECTED."})
        completion.status = decision
        completion.verified_by = request.user
        completion.completed_at = timezone.now() if decision == LearningCompletion.Status.COMPLETED else None
        completion.save(update_fields=["status", "verified_by", "completed_at", "updated_at"])
        if decision == LearningCompletion.Status.COMPLETED:
            award_verified_activity(participant=completion.participant,
                activity=ScoringRule.Activity.LEARNING_COMPLETED,
                source_event=f"learning-completion:{completion.pk}", event_date=timezone.localdate(),
                description=f"Verified learning: {completion.activity.title[:120]}")
            definition = AchievementDefinition.objects.filter(key="learning-champion", active=True).first()
            threshold = int(definition.configuration.get("verified_activities", 3)) if definition else 3
            count = LearningCompletion.objects.filter(participant=completion.participant, status=LearningCompletion.Status.COMPLETED).count()
            award_activity_milestone(participant=completion.participant, key="learning-champion", threshold=threshold, count=count)
        return Response({"id": completion.pk, "status": completion.status})


def _challenge_data(challenge, participant):
    participation = ChallengeParticipation.objects.filter(challenge=challenge, participant=participant).first()
    return {"id": challenge.id, "title": challenge.title, "description": challenge.description,
        "starts_on": challenge.starts_on, "ends_on": challenge.ends_on,
        "status": participation.status if participation else None,
        "participation_id": participation.id if participation else None,
        "submission_note": participation.submission_note if participation else ""}


class TeamChallengesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _visible_participant(request.user):
            raise PermissionDenied("Your role cannot access team challenges.")
        today = timezone.localdate()
        return Response([_challenge_data(challenge, request.user) for challenge in TeamChallenge.objects.filter(active=True, ends_on__gte=today)])

    def post(self, request):
        if request.user.role not in {User.Role.ADMIN, User.Role.HR}:
            raise PermissionDenied("Only HR or administrators can create team challenges.")
        title = str(request.data.get("title", "")).strip()
        description = str(request.data.get("description", "")).strip()
        try:
            starts_on = date.fromisoformat(str(request.data.get("starts_on", "")))
            ends_on = date.fromisoformat(str(request.data.get("ends_on", "")))
        except ValueError as exc:
            raise ValidationError({"date": "Provide valid ISO start and end dates."}) from exc
        if not title or len(title) > 120 or len(description) > 5000 or ends_on < starts_on:
            raise ValidationError({"title": "Provide a title up to 120 characters, a description up to 5000 characters, and a valid date range."})
        challenge = TeamChallenge.objects.create(title=title, description=description, starts_on=starts_on, ends_on=ends_on, created_by=request.user)
        return Response({"id": challenge.pk, "title": challenge.title, "description": challenge.description,
            "starts_on": challenge.starts_on, "ends_on": challenge.ends_on}, status=201)


class ChallengeJoinView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        challenge = TeamChallenge.objects.filter(pk=pk, active=True).first()
        today = timezone.localdate()
        if challenge is None or not challenge.starts_on <= today <= challenge.ends_on:
            raise NotFound("This team challenge is not open for participation.")
        participation, _created = ChallengeParticipation.objects.get_or_create(challenge=challenge, participant=request.user)
        if participation.status == ChallengeParticipation.Status.REJECTED:
            participation.status = ChallengeParticipation.Status.JOINED
            participation.submission_note = ""
            participation.submitted_at = None
            participation.save(update_fields=["status", "submission_note", "submitted_at", "updated_at"])
        return Response({"id": participation.pk, "challenge_id": challenge.pk, "status": participation.status})


class ChallengeSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        participation = ChallengeParticipation.objects.select_related("challenge").filter(pk=pk).first()
        if participation is None:
            raise NotFound("Challenge participation was not found.")
        if participation.participant_id != request.user.pk:
            raise PermissionDenied("You can submit only your own challenge participation.")
        if participation.status not in {ChallengeParticipation.Status.JOINED, ChallengeParticipation.Status.REJECTED}:
            raise ValidationError({"status": "This challenge is not ready for submission."})
        note = str(request.data.get("submission_note", "")).strip()
        if not note or len(note) > 500:
            raise ValidationError({"submission_note": "Describe your challenge contribution in 1 to 500 characters."})
        participation.status = ChallengeParticipation.Status.REVIEW
        participation.submission_note = note
        participation.submitted_at = timezone.now()
        participation.save(update_fields=["status", "submission_note", "submitted_at", "updated_at"])
        return Response({"id": participation.pk, "status": participation.status})


class ChallengeVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        participation = ChallengeParticipation.objects.select_for_update().select_related("participant", "challenge").filter(pk=pk).first()
        if participation is None:
            raise NotFound("Challenge participation was not found.")
        if not _review_allowed(request.user, participation.participant):
            raise PermissionDenied("Only HR, administrators, or the participant's manager can verify this completion.")
        if participation.status != ChallengeParticipation.Status.REVIEW:
            raise ValidationError({"status": "Only pending submissions can be reviewed."})
        decision = request.data.get("decision")
        if decision not in {"COMPLETED", "REJECTED"}:
            raise ValidationError({"decision": "Choose COMPLETED or REJECTED."})
        participation.status = decision
        participation.verified_by = request.user
        participation.completed_at = timezone.now() if decision == ChallengeParticipation.Status.COMPLETED else None
        participation.save(update_fields=["status", "verified_by", "completed_at", "updated_at"])
        if decision == ChallengeParticipation.Status.COMPLETED:
            award_verified_activity(participant=participation.participant,
                activity=ScoringRule.Activity.TEAM_CHALLENGE,
                source_event=f"team-challenge:{participation.pk}", event_date=timezone.localdate(),
                description=f"Verified team challenge: {participation.challenge.title[:120]}")
            definition = AchievementDefinition.objects.filter(key="team-player", active=True).first()
            threshold = int(definition.configuration.get("verified_activities", 3)) if definition else 3
            count = ChallengeParticipation.objects.filter(participant=participation.participant, status=ChallengeParticipation.Status.COMPLETED).count()
            award_activity_milestone(participant=participation.participant, key="team-player", threshold=threshold, count=count)
        return Response({"id": participation.pk, "status": participation.status})


class RecognitionReviewQueueView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role in {User.Role.ADMIN, User.Role.HR}:
            learning = LearningCompletion.objects.filter(status=LearningCompletion.Status.REVIEW)
            challenges = ChallengeParticipation.objects.filter(status=ChallengeParticipation.Status.REVIEW)
        elif request.user.role == User.Role.MANAGER:
            try:
                manager = request.user.employee_profile
            except Employee.DoesNotExist:
                return Response({"learning": [], "challenges": []})
            learning = LearningCompletion.objects.filter(status=LearningCompletion.Status.REVIEW, participant__employee_profile__manager=manager)
            challenges = ChallengeParticipation.objects.filter(status=ChallengeParticipation.Status.REVIEW, participant__employee_profile__manager=manager)
        else:
            raise PermissionDenied("Only managers, HR, or administrators can review recognition submissions.")
        return Response({
            "learning": [{"id": item.pk, "title": item.activity.title, "participant_id": item.participant_id,
                "participant": f"{item.participant.first_name} {item.participant.last_name}".strip(), "submission_note": item.submission_note}
                for item in learning.select_related("activity", "participant")],
            "challenges": [{"id": item.pk, "title": item.challenge.title, "participant_id": item.participant_id,
                "participant": f"{item.participant.first_name} {item.participant.last_name}".strip(), "submission_note": item.submission_note}
                for item in challenges.select_related("challenge", "participant")],
        })
