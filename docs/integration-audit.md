# Burnett People integration audit

Audit date: 2026-10-23. This audit reflects the repository's registered Django routes, serializers, React API clients, and current demo configuration. It is a code-level audit; it does not claim that email, database, or browser workflows were exercised.

## Requirements traceability

| Requirement area | Current implementation | Status / remaining work |
| --- | --- | --- |
| Authentication and role routes | JWT login, current-user lookup, logout/refresh, password reset, protected React routes, server permissions | Implemented in code; verify against running services and role accounts |
| Employee onboarding | HR employee creation, hashed single-use activation invitations, activation and resend, account deactivation | Implemented in code; email delivery depends on configured Celery/email provider |
| Employee profiles | HR/Admin CRUD-like list/detail/update and soft deactivation, active organization lookup APIs | Mostly implemented; profile data is HR/Admin-only under current backend permissions |
| Schedules | Structured schedule and effective-dated employee assignments, employee schedule endpoint | Backend implemented; Admin settings UI still expects some unsupported generic CRUD endpoints |
| Attendance and breaks | Check-in/out, schedule-based timestamps, break sessions, exception submission/review, history and summary | Backend implemented; HR aggregate overview and manager dashboard endpoints do not exist |
| Leave | Types, holidays, balances, create/cancel/approve/reject, working-day calculation, notifications and AI draft endpoint | Backend implemented; frontend endpoint/field contract corrected in this change; manager dashboard aggregation remains unavailable |
| Assets | Inventory, assignment/return history, employee own-assets endpoint, server-side role checks | Backend implemented; frontend endpoint and payload contract corrected; purchase date/location are not represented by the current model |
| Dashboards and reports | Employee attendance/leave/assets can use operational endpoints; HR/Admin reports contain disconnected metrics placeholders | Partially implemented; do not treat unavailable metrics as live |
| Notifications and audit | Leave/asset notifications and audit service/model exist | Notification API exists; audit log browsing API and a broad audit endpoint are not registered |
| Performance management | URL/settings references existed without a `performance_management` package in this checkout | Unavailable; removed dead imports so they no longer prevent Django from starting |
| Organization settings | Department/designation/location read endpoints and schedule listing exist | Partial; profile/settings mutations and some UI list endpoints have no matching backend routes |
| Responsive layout | Existing layouts include responsive CSS and mobile dashboard navigation | Requires device/browser verification; no viewport automation was available in this code audit |
| Light/dark theme | Shared persisted theme toggle and page-level dark styles exist | Implemented in code; visual coverage still requires browser verification |

## Changes made

- Disabled production-facing demo fallbacks centrally so dashboards and management pages no longer present fabricated metrics and people when APIs are missing.
- Aligned leave API paths with Django's `/leave/...` routes, used `leave_type_id`, and mapped the actual balance and request serializer fields.
- Aligned asset assignment and return paths and payloads with `/assets/assignments/`; asset assignment now includes both `asset_id` and `employee_id`.
- Used the employee-specific `/assets/me/` endpoint for employee asset history.
- Reused the existing connected HR asset workflow from the Admin asset section.
- Corrected Admin HR invitation creation to `/admin/hr/` with separate first and last name fields, and clarified that invitations are queued.
- Connected the employee dashboard to `/attendance/schedule/me/` so the assigned shift, weekdays, timezone, and configured break rules can render before the first check-in.
- Removed the duplicate registration of performance URLs.

## Known gaps and policy dependencies

- No manager dashboard aggregation endpoint exists. Manager team attendance, reports, and notifications cannot be considered integrated until server-side scoped endpoints are implemented.
- Admin/HR attendance overview and reporting UI requests shapes that are not provided by current endpoints. The available summary endpoint intentionally reports recorded sessions and pending exceptions; it does not infer absences.
- Admin/HR company settings screens still reference generic department, designation, location, schedule, and company-profile routes that are not all available for writes. Existing read-only organization lookup routes should not be presented as editable settings.
- Audit records are written for selected operations, but no registered audit-list API was found.
- The asset model has no purchase-date or location fields; those values cannot be persisted with the current schema.
- The proposed post-shift cutoff and specific break windows/durations remain company-policy decisions. No automatic logout/cutoff behavior was introduced.
- Email, Celery, database-backed migrations, browser/mobile layouts, and role-specific end-to-end flows require a running configured environment to verify.

## Verification performed

- Django `manage.py check`: passed.
- Django `manage.py test` against an in-memory SQLite test database: 88 tests passed. The configured remote PostgreSQL hostname was not reachable, so the suite did not use the configured Neon database.
- Frontend `npm test`: 15 tests passed, including leave and asset serializer-contract checks.
- Frontend `npm run lint`: passed.
- Frontend `npm run build`: passed. Vite reports the existing single JavaScript bundle exceeds 500 kB after minification.
- `git diff --check`: passed.
- No migrations or persistent database changes were made. Desktop and mobile visual browser checks were not run.


## Corrective-pass status (2026-10-23)

| Requirement | Status | Evidence / remaining work |
| --- | --- | --- |
| Admin metrics endpoint | Implemented and targeted-tested | `/api/admin/metrics/` uses persisted records; `attendance.test_manager_dashboard_api` validates permissions and 5/15/20 weekday windows. |
| Admin attention list | Implemented | Rows derive from API `attentionItems`, with an empty state when counts are zero. |
| Employee manager assignment | Frontend corrected | Sends employee FK ID or null. Needs broader backend relationship boundary tests. |
| Duplicate employee action | Corrected | Retains one Manage action per row. |
| Leaderboard / score ledger / achievements | Implemented; targeted-tested | Persistent ledger and definitions, idempotent attendance awards, streak/monthly rules, configurable scoring, ranking and personal-history APIs; learning and challenge completions require manager/HR review before awards. |
| My People overview cards | Implemented in code; targeted-tested | Actual directory and summary endpoints provide active headcount, departments, new joiners, approved remote work and leave; directory/profile preview and leaderboard preview have independent error states. |
| Company Settings changes | Implemented in code | Summary cards moved to the top; Roles, Organization Profile, and Schedule Assignment card entries removed while separate role/schedule routes and CRUD APIs remain. |
| Screenshot references | Used as design references | Screenshots are not embedded as static page images; interactive page implementations still need visual matching and browser review. |
| Responsive and theme verification | Not browser-verified | Existing CSS/build checks do not substitute for viewports and role-specific rendered checks. |

## End-to-end corrective implementation status (2026-10-23)

| Requirement | Status | Implementation / evidence |
| --- | --- | --- |
| Persistent recognition schema | Implemented | Configurable scoring rules, unique score sources, achievement definitions/history, learning activity/completion, and team challenge/participation; migrations `recognition.0001`–`0005` are additive. |
| Attendance scoring and habits | Implemented; targeted-tested | Schedule timezone and grace drive on-time awards; check-out awards completed attendance. Scheduled-day streak resets on missed/late work; approved leave/holidays pause eligibility. Monthly punctuality, Attendance Star, and month-over-month Most Improved use recorded data. |
| Verified learning and challenge activity | Implemented; targeted-tested | Participants enroll/join and submit notes; HR/Admin or the direct manager verifies. Scoped review queue. Configured 10/15 point values are awarded once after verification; Learning Champion and Team Player use three verified activities by default. |
| Leaderboard and personal APIs | Implemented; targeted-tested | Ranking, department facets, personal stats/history, achievement catalog, scoring rules, learning/challenge actions and scoped review queue. Competition ties are deterministic; badge details include descriptions and dates. |
| Role navigation | Implemented in code | Leaderboard navigation exists for Admin, HR, Manager and Employee; My Profile loads personal points, streak, achievement progress/catalog and recent history. Browser route workflows remain unverified. |
| My People directory and cards | Implemented in code; targeted-tested | Safe active directory overview; date joined and manager included, private email/phone excluded. Counts use active employees, current-month joiners, approved remote work and approved leave. New Joiners filters the directory. |
| Remote-work source | Implemented; targeted-tested | Employee request, direct-manager/HR/Admin decision, role-scoped list, unique employee/day constraint and approved-only overview count. |
| Company Settings placement | Implemented in code | Summary cards moved from footer to top; the three specified entries removed from card tabs; HR & Roles, separate schedule assignments and organization CRUD remain available. |
| Screenshot integration | Interactive implementation; visual match unverified | Existing interactive pages use screenshots as layout/color references; no static screenshot background. Browser comparison remains blocked because the available browser cannot reach the local Vite server. |
| Responsive/theme/role verification | Not browser-verified | Automated lint, tests, and build are not a substitute for the requested viewport and theme checks. |

The `recognition` and remote-work migrations have been generated and validated in the test database. They have not been applied to a persistent production database.
