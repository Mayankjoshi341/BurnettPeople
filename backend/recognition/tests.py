from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from attendance.models import AttendanceRecord, BreakPolicy
from employees.models import Employee, EmployeeScheduleAssignment, WorkSchedule
from organization.models import Department, Designation
from recognition.models import AchievementDefinition, EmployeeAchievement, ScoreLedger, ScoringRule
from recognition.services import award_event, current_streak, award_streak_achievement, evaluate_periodic_achievements


class RecognitionApiTests(APITestCase):
    def setUp(self):
        self.hr = User.objects.create_user(email="recognition-hr@example.test", password="StrongPass!2026", first_name="HR", last_name="One", role=User.Role.HR)
        self.employee_user = User.objects.create_user(email="recognition-employee@example.test", password="StrongPass!2026", first_name="Employee", last_name="One", role=User.Role.EMPLOYEE)
        dept = Department.objects.create(name="Recognition", code="RECOG")
        self.department = dept
        self.employee = Employee.objects.create(user=self.employee_user, employee_code="REC001", official_email=self.employee_user.email, first_name="Employee", last_name="One", department=dept, designation=Designation.objects.create(title="Recognition Specialist"), employment_status=Employee.EmploymentStatus.ACTIVE, date_of_joining=date.today()-timedelta(days=100))
        self.rule, _ = ScoringRule.objects.update_or_create(activity=ScoringRule.Activity.ON_TIME_CHECK_IN, defaults={"points": 10, "active": True})

    def _record(self, day=None):
        schedule = WorkSchedule.objects.create(name=f"Recognition schedule {AttendanceRecord.objects.count()}", start_time="09:00", end_time="18:00", workdays=["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], break_policy=BreakPolicy.objects.create(code=f"REC{AttendanceRecord.objects.count()}", name="Recognition policy"))
        now = timezone.now()
        return AttendanceRecord.objects.create(employee=self.employee, schedule=schedule, work_date=day or timezone.localdate(), check_in=now, check_out=now+timedelta(hours=8), status=AttendanceRecord.Status.CLOSED)

    def test_attendance_award_is_idempotent_by_source_event(self):
        record = self._record()
        first = award_event(record=record, activity=self.rule.activity, source_suffix="test", description="Verified test event")
        second = award_event(record=record, activity=self.rule.activity, source_suffix="test", description="Verified test event")
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(ScoreLedger.objects.count(), 1)

    def test_leaderboard_is_visible_to_employee_and_orders_actual_scores(self):
        record = self._record()
        award_event(record=record, activity=self.rule.activity, source_suffix="first", description="Verified attendance")
        self.client.force_authenticate(self.employee_user)
        response = self.client.get("/api/recognition/leaderboard/?period=all")
        self.assertEqual(response.status_code, 200)
        result = response.data["results"]["results"]
        self.assertEqual(result[0]["participant_id"], self.employee_user.pk)
        self.assertEqual(result[0]["points"], 10)
        self.assertTrue(result[0]["is_me"])

    def test_scoring_rules_are_administered_only_by_hr_or_admin(self):
        self.client.force_authenticate(self.employee_user)
        denied = self.client.get("/api/recognition/rules/")
        self.assertEqual(denied.status_code, 403)
        self.client.force_authenticate(self.hr)
        allowed = self.client.get("/api/recognition/rules/")
        self.assertEqual(allowed.status_code, 200)
        changed = self.client.patch("/api/recognition/rules/", {"rules": [{"id": self.rule.pk, "points": 12, "active": True}]}, format="json")
        self.assertEqual(changed.status_code, 200, changed.data)
        self.rule.refresh_from_db()
        self.assertEqual(self.rule.points, 12)
        atomic_failure = self.client.patch("/api/recognition/rules/", {"rules": [
            {"id": self.rule.pk, "points": 18}, {"id": 99999, "points": 20},
        ]}, format="json")
        self.assertEqual(atomic_failure.status_code, 400)
        self.rule.refresh_from_db()
        self.assertEqual(self.rule.points, 12)

    def test_leaderboard_search_keeps_period_and_department_filters(self):
        row = self._record()
        award_event(record=row, activity=self.rule.activity, source_suffix="search", description="Verified attendance")
        self.client.force_authenticate(self.hr)
        response = self.client.get(f"/api/recognition/leaderboard/?period=all&department={self.department.pk}&search=Employee")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["results"]["results"]), 1)
        invalid = self.client.get("/api/recognition/leaderboard/?period=quarter")
        self.assertEqual(invalid.status_code, 400)

    def test_company_leaderboard_and_department_filter_are_available_to_all_roles(self):
        manager = User.objects.create_user(email="recognition-manager@example.test", password="StrongPass!2026", first_name="Manager", last_name="One", role=User.Role.MANAGER)
        admin = User.objects.create_user(email="recognition-admin@example.test", password="StrongPass!2026", first_name="Admin", last_name="One", role=User.Role.ADMIN)
        for user in (self.employee_user, manager, self.hr, admin):
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get("/api/recognition/leaderboard/").status_code, 200)
            self.assertEqual(self.client.get("/api/recognition/departments/").status_code, 200)

    def test_streak_counts_scheduled_closed_on_time_days_and_respects_approved_leave(self):
        today = timezone.localdate()
        policy = BreakPolicy.objects.create(code="STREAK", name="Streak policy")
        schedule = WorkSchedule.objects.create(name="Streak schedule", start_time="09:00", end_time="18:00", workdays=["MON", "TUE", "WED", "THU", "FRI"], break_policy=policy)
        start = today - timedelta(days=14)
        EmployeeScheduleAssignment.objects.create(employee=self.employee, work_schedule=schedule, effective_from=start)
        workdays = []
        day = today
        while len(workdays) < 5:
            if day.weekday() < 5:
                workdays.append(day)
            day -= timedelta(days=1)
        workdays.reverse()
        for workday in workdays:
            if workday == workdays[-2]:
                continue
            local = ZoneInfo("Asia/Kolkata")
            AttendanceRecord.objects.create(employee=self.employee, schedule=schedule, work_date=workday,
                check_in=datetime.combine(workday, datetime.min.time().replace(hour=9), tzinfo=local),
                check_out=datetime.combine(workday, datetime.min.time().replace(hour=18), tzinfo=local),
                status=AttendanceRecord.Status.CLOSED)
        from hr_operations.models import LeaveRequest, LeaveType
        leave_type = LeaveType.objects.create(code="STREAK", name="Streak leave")
        LeaveRequest.objects.create(employee=self.employee, leave_type=leave_type, start_date=workdays[-2], end_date=workdays[-2], days_count=1, status=LeaveRequest.Status.APPROVED)
        self.assertEqual(current_streak(self.employee_user), 4)

    def test_streak_achievement_is_persisted_once(self):
        definition = AchievementDefinition.objects.get(key="on-time-streak-5")
        first = award_streak_achievement(self.employee_user, 5)
        second = award_streak_achievement(self.employee_user, 5)
        self.assertEqual(len(first), 1)
        self.assertEqual(second, [])
        self.assertEqual(EmployeeAchievement.objects.filter(participant=self.employee_user, definition=definition).count(), 1)

    def test_punctuality_month_ignores_approved_leave_days(self):
        from calendar import monthrange
        from hr_operations.models import LeaveRequest, LeaveType
        today = timezone.localdate().replace(day=1)
        last_end = today - timedelta(days=1)
        last_start = last_end.replace(day=1)
        policy = BreakPolicy.objects.create(code="MONTHLY", name="Monthly policy")
        schedule = WorkSchedule.objects.create(name="Monthly schedule", start_time="09:00", end_time="18:00", workdays=["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"], break_policy=policy)
        EmployeeScheduleAssignment.objects.create(employee=self.employee, work_schedule=schedule, effective_from=last_start)
        LeaveRequest.objects.create(employee=self.employee, leave_type=LeaveType.objects.create(code="MONTHLY", name="Monthly leave"), start_date=last_start, end_date=last_start, days_count=1, status=LeaveRequest.Status.APPROVED)
        zone = ZoneInfo("Asia/Kolkata")
        for offset in range(1, monthrange(last_start.year, last_start.month)[1]+1):
            day = last_start.replace(day=offset)
            if day == last_start:
                continue
            AttendanceRecord.objects.create(employee=self.employee, schedule=schedule, work_date=day,
                check_in=datetime.combine(day, datetime.min.time().replace(hour=9), tzinfo=zone),
                check_out=None if offset == 2 else datetime.combine(day, datetime.min.time().replace(hour=18), tzinfo=zone),
                status=AttendanceRecord.Status.OPEN if offset == 2 else AttendanceRecord.Status.CLOSED)
        evaluate_periodic_achievements(self.employee, today=today)
        earned = EmployeeAchievement.objects.filter(participant=self.employee_user, definition__key="punctuality-pro", period_key=last_start.strftime("%Y-%m"))
        self.assertEqual(earned.count(), 1)

    def test_most_improved_requires_meaningful_completed_month_comparison(self):
        today = timezone.localdate().replace(day=1)
        last_end = today - timedelta(days=1)
        last_start = last_end.replace(day=1)
        prior_end = last_start - timedelta(days=1)
        prior_start = prior_end.replace(day=1)
        ScoreLedger.objects.create(participant=self.employee_user, employee=self.employee, activity=self.rule.activity, points=10, source_event="history:baseline", event_date=prior_start, description="Historical baseline")
        ScoreLedger.objects.create(participant=self.employee_user, employee=self.employee, activity=self.rule.activity, points=20, source_event="history:improved", event_date=last_start, description="Improved period")
        evaluate_periodic_achievements(self.employee, today=today)
        earned = EmployeeAchievement.objects.filter(participant=self.employee_user, definition__key="most-improved", period_key=last_start.strftime("%Y-%m"))
        self.assertEqual(earned.count(), 1)

    def test_learning_points_require_reviewed_completion_and_award_once(self):
        ScoringRule.objects.filter(activity=ScoringRule.Activity.LEARNING_COMPLETED).update(active=True, points=10)
        self.client.force_authenticate(self.hr)
        activity = self.client.post("/api/recognition/learning/", {"title": "Security basics", "description": "Complete the company security course."}, format="json")
        self.assertEqual(activity.status_code, 201, activity.data)
        self.client.force_authenticate(self.employee_user)
        enrollment = self.client.post(f"/api/recognition/learning/{activity.data['id']}/enroll/")
        self.assertEqual(enrollment.status_code, 200)
        completion_id = enrollment.data["id"]
        submitted = self.client.post(f"/api/recognition/learning/completions/{completion_id}/submit/", {"submission_note": "Completed the course and passed its knowledge check."}, format="json")
        self.assertEqual(submitted.data["status"], "REVIEW")
        self.assertFalse(ScoreLedger.objects.filter(participant=self.employee_user, activity=ScoringRule.Activity.LEARNING_COMPLETED).exists())
        self.client.force_authenticate(self.hr)
        reviewed = self.client.post(f"/api/recognition/learning/completions/{completion_id}/verify/", {"decision": "COMPLETED"}, format="json")
        self.assertEqual(reviewed.data["status"], "COMPLETED")
        self.assertEqual(ScoreLedger.objects.filter(participant=self.employee_user, activity=ScoringRule.Activity.LEARNING_COMPLETED).count(), 1)
        duplicate = self.client.post(f"/api/recognition/learning/completions/{completion_id}/verify/", {"decision": "COMPLETED"}, format="json")
        self.assertEqual(duplicate.status_code, 400)

    def test_manager_review_queue_is_limited_to_direct_reports(self):
        manager_user = User.objects.create_user(email="team-manager@example.test", password="StrongPass!2026", first_name="Team", last_name="Manager", role=User.Role.MANAGER)
        manager_employee = Employee.objects.create(user=manager_user, employee_code="MGR001", official_email=manager_user.email,
            first_name="Team", last_name="Manager", department=self.department, designation=self.employee.designation,
            employment_status=Employee.EmploymentStatus.ACTIVE, date_of_joining=date.today()-timedelta(days=365))
        self.employee.manager = manager_employee
        self.employee.save(update_fields=["manager"])
        self.client.force_authenticate(self.hr)
        activity = self.client.post("/api/recognition/learning/", {"title": "Required course"}, format="json")
        self.client.force_authenticate(self.employee_user)
        enrollment = self.client.post(f"/api/recognition/learning/{activity.data['id']}/enroll/")
        self.client.post(f"/api/recognition/learning/completions/{enrollment.data['id']}/submit/", {"submission_note": "Completed the required course."}, format="json")
        self.client.force_authenticate(manager_user)
        queue = self.client.get("/api/recognition/review-queue/")
        self.assertEqual(len(queue.data["learning"]), 1)
        self.assertEqual(queue.data["learning"][0]["participant_id"], self.employee_user.pk)
        self.assertEqual(self.client.post(f"/api/recognition/learning/completions/{enrollment.data['id']}/verify/", {"decision": "COMPLETED"}, format="json").status_code, 200)

    def test_team_challenge_awards_only_after_authorized_verification(self):
        ScoringRule.objects.filter(activity=ScoringRule.Activity.TEAM_CHALLENGE).update(active=True, points=15)
        today = timezone.localdate()
        self.client.force_authenticate(self.hr)
        challenge = self.client.post("/api/recognition/challenges/", {
            "title": "Mentor a new teammate", "description": "Support a new colleague.",
            "starts_on": today.isoformat(), "ends_on": today.isoformat(),
        }, format="json")
        self.assertEqual(challenge.status_code, 201, challenge.data)
        self.client.force_authenticate(self.employee_user)
        joined = self.client.post(f"/api/recognition/challenges/{challenge.data['id']}/join/")
        participation_id = joined.data["id"]
        submitted = self.client.post(f"/api/recognition/challenges/participations/{participation_id}/submit/", {
            "submission_note": "Paired with a new colleague through their first deployment."}, format="json")
        self.assertEqual(submitted.data["status"], "REVIEW")
        self.client.force_authenticate(self.employee_user)
        denied = self.client.post(f"/api/recognition/challenges/participations/{participation_id}/verify/", {"decision": "COMPLETED"}, format="json")
        self.assertEqual(denied.status_code, 403)
        self.client.force_authenticate(self.hr)
        verified = self.client.post(f"/api/recognition/challenges/participations/{participation_id}/verify/", {"decision": "COMPLETED"}, format="json")
        self.assertEqual(verified.data["status"], "COMPLETED")
        ledger = ScoreLedger.objects.filter(participant=self.employee_user, activity=ScoringRule.Activity.TEAM_CHALLENGE)
        self.assertEqual(ledger.count(), 1)
        self.assertEqual(ledger.first().points, 15)

    def test_employee_directory_contains_only_safe_work_profile_fields(self):
        self.client.force_authenticate(self.employee_user)
        response = self.client.get("/api/employees/directory/")
        self.assertEqual(response.status_code, 200)
        row = next(item for item in response.data if item["id"] == self.employee.pk)
        self.assertEqual(row["employee_code"], self.employee.employee_code)
        self.assertIn("date_of_joining", row)
        self.assertNotIn("official_email", row)
        self.assertNotIn("phone_number", row)

    def test_streak_resets_on_a_missed_scheduled_day(self):
        today = timezone.localdate()
        policy = BreakPolicy.objects.create(code="RESET", name="Reset policy")
        schedule = WorkSchedule.objects.create(name="Reset schedule", start_time="09:00", end_time="18:00", workdays=["MON", "TUE", "WED", "THU", "FRI"], break_policy=policy)
        EmployeeScheduleAssignment.objects.create(employee=self.employee, work_schedule=schedule, effective_from=today-timedelta(days=21))
        expected = []
        day = today
        while len(expected) < 3:
            if day.weekday() < 5:
                expected.append(day)
            day -= timedelta(days=1)
        latest, _missed, older = expected
        zone = ZoneInfo("Asia/Kolkata")
        for workday in (latest, older):
            AttendanceRecord.objects.create(employee=self.employee, schedule=schedule, work_date=workday,
                check_in=datetime.combine(workday, datetime.min.time().replace(hour=9), tzinfo=zone),
                check_out=datetime.combine(workday, datetime.min.time().replace(hour=18), tzinfo=zone),
                status=AttendanceRecord.Status.CLOSED)
        self.assertEqual(current_streak(self.employee_user), 1)
