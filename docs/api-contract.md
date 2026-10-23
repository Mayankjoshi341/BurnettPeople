# BurnettPeople API Contract

Status: verified against the current Django URL configuration, serializers, views, and tests, with the organization lookup endpoints in this patch noted separately below.

## General conventions

- API base URL: `http://localhost:8000/api` in local development; set `VITE_API_BASE_URL` in `frontend/.env` for other environments.
- Request/response format: JSON unless an endpoint returns an empty response.
- Field names: `snake_case`.
- Protected endpoints use `Authorization: Bearer <access-token>`.
- Tokens are held in frontend module memory only; a full browser reload requires signing in again. The refresh token is not saved to localStorage or sessionStorage.
- PostgreSQL is the source of truth for HR records. The frontend must not substitute local demo records when the API is unavailable.
- Dates use `YYYY-MM-DD`. Timestamps are ISO 8601 values with timezone information.
- The current DRF settings do not configure pagination; employee and lookup list endpoints currently return JSON arrays. The UI tolerates a `results` response envelope for forward compatibility.

## Authentication

### `POST /api/auth/token/`

Authentication: Public.

Request:

```json
{"email":"employee@example.com","password":"<password>"}
```

Success: HTTP `200`.

```json
{"access":"<access-jwt>","refresh":"<refresh-jwt>"}
```

Invalid/inactive credentials: normally HTTP `401`. The Simple JWT serializer does not provide field-level login errors. Do not log the credentials or returned tokens.

### `POST /api/auth/token/refresh/`

Authentication: Public; the request carries a refresh token.

Request:

```json
{"refresh":"<refresh-jwt>"}
```

Success: HTTP `200`, returns a new access token and, with the repository's configuration, a rotated refresh token.

Configured policy in `backend/config/settings.py`: access lifetime 6 hours; refresh lifetime 7 days; refresh rotation enabled; old refresh tokens blacklisted after rotation. A reused/invalid refresh token is rejected with an authentication error. The frontend coordinates concurrent refresh attempts and only automatically retries safe read requests, except logout's narrowly-scoped retry with the newly rotated refresh token.

### `GET /api/auth/me/`

Authentication: Any active authenticated role (`ADMIN`, `HR`, `MANAGER`, `EMPLOYEE`).

Success: HTTP `200`.

```json
{
  "id": 12,
  "email": "employee@example.com",
  "first_name": "Aarav",
  "last_name": "Sharma",
  "role": "EMPLOYEE",
  "is_active": true
}
```

Unauthenticated/invalid token: HTTP `401`.

### `POST /api/auth/activate/`

Authentication: Public; invitation token authorizes activation.

Request:

```json
{"token":"<invitation-token>","password":"<new-password>","password_confirm":"<new-password>"}
```

Success: HTTP `200`, `{"detail":"Your account has been activated successfully. You can now log in."}`.

Validation error: HTTP `400`; DRF returns field-level validation messages for password mismatch/password policy or a `token` error for invalid, expired, revoked, already-used, or otherwise unusable invitations. Activation is atomic, the raw token is not stored, and password hashing uses Django's `set_password`.

### `POST /api/auth/logout/`

Authentication: Active JWT access token required.

Request:

```json
{"refresh":"<refresh-jwt-for-current-user>"}
```

Success: HTTP `205` with an empty response. HTTP `400` if the refresh token is absent or invalid; HTTP `403` if it belongs to a different user. The matching refresh token is blacklisted.

### `POST /api/auth/password-reset/request/`

Authentication: Public.

Request: `{"email":"employee@example.com"}`.

Success: HTTP `200` with a generic detail message regardless of whether an active account exists. For eligible accounts, the reset code is queued via Celery. The code is single-use, expires after 10 minutes, has a 60-second request cooldown, and permits at most five failed attempts.

Invalid email: HTTP `400` with DRF validation detail.

### `POST /api/auth/password-reset/confirm/`

Authentication: Public.

Request:

```json
{
  "email":"employee@example.com",
  "code":"123456",
  "password":"<new-password>",
  "password_confirm":"<new-password>"
}
```

Success: HTTP `200` with a detail message. Validation failures (mismatched passwords, wrong/expired/used code, or password policy) return HTTP `400` with DRF detail/field errors. Successful reset blacklists outstanding refresh tokens.

## Employee management

All `/api/employees/` endpoints require authentication and the backend `IsHROrAdmin` permission: `ADMIN` and `HR` (or Django superuser). `MANAGER` and `EMPLOYEE` are not allowed. The frontend's route guards only improve navigation; backend permissions remain authoritative.

The router basename is `employee`. Current router-generated names include `employee-list`, `employee-detail`, `employee-pending-activations`, and `employee-resend-invitation`.

### `GET /api/employees/`

Returns an array of persisted employee objects. No pagination class is configured in the current project.

Optional query parameters:

- `activation_status=pending`: linked portal account exists and `user.is_active=false`. This means not activated; it does not guarantee that an invitation email is queued or delivered.
- `activation_status=activated`: linked portal account has `user.is_active=true`.
- `employment_status=PREBOARDING|ACTIVE|NOTICE_PERIOD|EXITED`: filters employment lifecycle status. Unsupported values currently do not add a filter.

### `POST /api/employees/`

Request schema (foreign keys are database IDs, not names):

```json
{
  "employee_code":"BP005",
  "official_email":"employee@example.com",
  "first_name":"Aarav",
  "last_name":"Sharma",
  "department":1,
  "designation":1,
  "manager":null,
  "work_location":null,
  "employment_type":"FULL_TIME",
  "date_of_joining":"2026-10-15",
  "phone_number":""
}
```

Required: `employee_code`, `official_email`, `first_name`, `last_name`, `department`, `designation`, `date_of_joining`. `manager`, `work_location`, `employment_type`, and `phone_number` are optional/nullable as allowed by the serializer/model. Employment types: `FULL_TIME`, `PART_TIME`, `INTERN`, `CONTRACT`.

Success: HTTP `201` with the created `EmployeeSerializer` object, including database `id`, relationship IDs and display labels, employment status, portal role, and `account_activation_status`.

The serializer delegates to `create_employee_with_invitation`. This transaction creates a `PREBOARDING` employee and inactive `EMPLOYEE` portal account, stores a hashed invitation token, records audit events, and queues email after commit. Creating the employee does not mean the portal account is activated or that the email was delivered. Duplicate employee codes/email, invalid foreign keys, and invalid data return HTTP `400` DRF validation errors, commonly as field-keyed arrays.

### `GET /api/employees/pending-activations/`

Authentication/roles: HR/Admin. Returns employees with a linked inactive account. Response is an array under current default settings; the action also honors DRF pagination if pagination is configured later.

### `GET /api/employees/{id}/`

Authentication/roles: HR/Admin. `{id}` is the database primary key, not the human-readable employee code. Returns one employee serializer object; unknown IDs return HTTP `404`.

### `PUT /api/employees/{id}/` and `PATCH /api/employees/{id}/`

Authentication/roles: HR/Admin. Update fields supported by `EmployeeSerializer`. `employee_code`, `official_email`, linked `user`, employment status, activation status and audit timestamps are read-only through ordinary update requests. Validation failure returns HTTP `400`.

### `DELETE /api/employees/{id}/`

Authentication/roles: HR/Admin. This is historical deactivation, not physical deletion. Success: HTTP `204`. The backend marks employment `EXITED`, sets the exit date if missing, disables the linked user, revokes unused invitations, blacklists outstanding refresh tokens, and records an audit event. No migration is required.

### `POST /api/employees/{id}/resend-invitation/`

Authentication/roles: HR/Admin. Empty JSON object may be posted as the request body.

Success: HTTP `202`:

```json
{
  "detail":"A new activation invitation has been queued.",
  "invitation_id":42,
  "delivery_status":"PENDING",
  "expires_at":"2026-10-17T12:00:00Z"
}
```

A missing linked portal account or already-active account returns a validation error. The endpoint only confirms that an invitation was queued. Celery later updates delivery state to `SENT` or `FAILED`; do not claim email delivery at HTTP `202` time.

## Organization lookup endpoints added in this integration patch

These read-only endpoints are added because the employee form must submit valid FK IDs instead of hard-coded names/IDs. They require authentication and the same HR/Admin permission boundary as employee management. All return arrays and only active records; there are no database schema changes.

### `GET /api/organization/departments/`

Response item: `id`, `name`, `code`, `description`, `is_active`.

### `GET /api/organization/designations/`

Response item: `id`, `title`, `grade`, `is_active`.

### `GET /api/organization/work-locations/`

Response item: `id`, `name`, `address`, `timezone`, `is_active`.

Unauthenticated requests return HTTP `401`; a non-HR/Admin role returns HTTP `403`.

## Error and status conventions

- `400`: invalid serializer input; detail may be a string, list, or object with field-name keys and arrays/messages.
- `401`: missing, invalid, or expired authentication/credentials.
- `403`: authenticated user is not permitted to perform the action.
- `404`: unknown route/record.
- `409`: conflict response if a future endpoint explicitly uses this status; current duplicate employee validation normally uses `400`.
- `429`: rate-limit response if configured by deployment/middleware; no project-wide DRF throttle is currently configured.
- `500`: unexpected server error; client should show a generic message without echoing credentials or personal data.


## Admin HR account management

### `POST /api/admin/hr/`

Authentication: Active JWT access token required. Only users with the
`ADMIN` application role may create HR accounts.

Request:

```json
{
  "email": "hr@company.com",
  "first_name": "Priya",
  "last_name": "Sharma"
}
```

Success: HTTP `201`.

```json
{
  "detail": "HR account created. The activation invitation has been queued for email delivery.",
  "id": 42,
  "email": "hr@company.com",
  "first_name": "Priya",
  "last_name": "Sharma",
  "role": "HR",
  "is_active": false,
  "invitation": {
    "id": 18,
    "delivery_status": "PENDING",
    "expires_at": "2026-10-17T12:00:00Z"
  }
}
```

The server assigns the HR role. The request cannot create Admin users,
set the initial password, or create an Employee profile. The account
remains inactive until the user activates it through
`POST /api/auth/activate/`.

The invitation token is single-use, expires after 48 hours, and is stored
as a hash in the database. The existing email task processes delivery
asynchronously; HTTP `201` means the account was created and an invitation
was recorded, not that the email has reached the recipient.

Validation errors return HTTP `400`. An unauthenticated request returns
HTTP `401`. A signed-in non-Admin user returns HTTP `403`.


## Operational endpoint groups

The repository registers operational APIs in addition to employee onboarding:

- Attendance: `/api/attendance/me/`, `schedule/me/`, `check-in/`, `check-out/`, `breaks/start/`, `breaks/end/`, `history/`, `records/`, `summary/`, `schedules/`, `assignments/`, and `exceptions/` (see `backend/attendance/urls.py`).
- Leave: `/api/leave/types/`, `holidays/`, `balances/me/`, `balances/`, `requests/`, `requests/pending-approvals/`, and request `approve/`, `reject/`, `cancel/` actions.
- Assets: `/api/assets/me/`, `/api/assets/`, `/api/assets/assignments/` and assignment `return/` actions.
- Notifications: `/api/notifications/`, `read-all/`, and notification `read/` actions.
- AI leave drafts: `/api/ai/leave-draft/`. This returns a draft only; it does not submit a leave request.

See [integration-audit.md](integration-audit.md) for unavailable aggregate dashboards, settings mutations, and audit browsing routes. Do not show fabricated metrics when these endpoints are unavailable.

## Migration note

The integration patch contains additive migrations for audit events, organization lookups, score/achievement history, and remote-work requests. It does not reset or drop existing tables. Apply migrations with the configured deployment database only after the normal release review.


## Admin overview metrics

`GET /api/admin/metrics/?working_days=5|15|20` (HR/Admin only) returns persisted employee counts, active-today attendance count, latest weekday attendance series and dates, and actionable invitation, exception, schedule-gap, and active asset-assignment counts. `working_days` defaults to 5 and rejects values outside 5, 15, or 20. Attendance series counts recorded attendance records; it does not infer absences.

## Recognition

- `GET /api/recognition/leaderboard/?period=all|week|month&department=<id>&search=<text>&page=<n>&page_size=<n>`: authenticated company rankings with competition ties, points, department and earned badge names.
- `GET /api/recognition/departments/`: active department names for the leaderboard filter; available to eligible leaderboard roles.
- `GET /api/recognition/me/`: own points, eligible on-time streak, earned achievements and recent points history.
- `GET /api/recognition/achievements/`: achievement catalog and the signed-in user's earned state.
- `GET /api/recognition/rules/`: HR/Admin scoring-rule configuration.
- `PATCH /api/recognition/rules/` with `{ "rules": [{ "id": 1, "points": 10, "active": true, "eligibility": {} }] }`: HR/Admin only; points are bounded 0–100.
- `GET|POST /api/recognition/learning/`: active activities for participants; HR/Admin may create an activity.
- `POST /api/recognition/learning/<id>/enroll/`, `POST /api/recognition/learning/completions/<id>/submit/`, and `POST /api/recognition/learning/completions/<id>/verify/`: participant enrollment/submission and HR/Admin/direct-manager verification. Only verified completions award configured points.
- `GET|POST /api/recognition/challenges/`: open challenges; HR/Admin may create a challenge with a valid date range.
- `POST /api/recognition/challenges/<id>/join/`, `POST /api/recognition/challenges/participations/<id>/submit/`, and `POST /api/recognition/challenges/participations/<id>/verify/`: participant enrollment/submission and HR/Admin/direct-manager verification. Only verified completions award configured points.
- `GET /api/recognition/review-queue/`: pending learning and challenge submissions scoped to HR/Admin or a manager's direct reports.

Scoring includes server-verified on-time check-in and complete attendance, plus reviewed learning and team-challenge completion. The score ledger uses unique source-event keys. Seeded achievement definitions include five- and ten-day streaks, monthly punctuality, complete attendance, learning, team contribution, and meaningful month-over-month improvement. Approved leave is excluded from attendance eligibility.

## Remote work

- `GET /api/remote-work/requests/`: HR/Admin see all; managers see direct reports; employees see their own requests.
- `POST /api/remote-work/requests/` with `{ "work_date": "YYYY-MM-DD", "reason": "optional" }`: creates one request per employee/date.
- `POST /api/remote-work/requests/<id>/decision/` with `{ "status": "APPROVED|REJECTED", "comment": "optional" }`: direct manager, HR, or Admin only.
- Only approved requests count in `GET /api/employees/directory/overview/` for the current company-local date.
- `GET /api/employees/directory/` returns a limited active directory projection for authenticated roles.
