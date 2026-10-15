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

## Endpoints not currently implemented

There are currently no registered operational REST endpoints for attendance, leave requests, work-schedule management, breaks, or tea/expenses. The existing attendance and expenses modules primarily contain models/placeholders. Do not label dashboard metrics for those features as live or invent routes until business rules, authorization, serializers, views, URLs and tests are defined.

## Migration note

This patch adds serializers/views/URLs and CORS configuration only. It introduces no database model fields or tables and requires no new Django migration. Keep existing migrations and PostgreSQL data unchanged.