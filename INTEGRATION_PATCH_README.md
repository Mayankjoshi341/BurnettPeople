# BurnettPeople HRMS integration patch (manual apply)

This ZIP contains complete replacement files plus new files. It does not modify GitHub or create a branch/commit. Copy the included paths into the existing project root and review each diff before running migrations or starting services.

## Files changed / added

### Frontend

- `frontend/src/api/client.js` — central JSON client; bearer auth, DRF errors, GET/POST/PUT/PATCH/DELETE, concurrent JWT refresh coordination, memory-only token storage, safe-method retry policy, special logout retry.
- `frontend/src/api/client.test.js` — built-in Node tests for auth header, field errors, empty response, concurrent refresh, and no automatic POST replay.
- `frontend/src/App.jsx` — real login + `/auth/me/`, in-memory auth state, role-protected routes, logout, password-reset request/confirmation UI; preserves login design and theme preference.
- `frontend/src/EmployeeActivation.jsx` — submits invitation activation to the backend, captures/removes token from URL, shows backend validation/success states.
- `frontend/src/EmployeeForm.jsx` — loads real active organization lookup data and active employee manager choices; submits backend snake_case FK IDs and enum values; reports backend errors and actual returned activation status.
- `frontend/src/EmployeeList.jsx` — loads the backend employee directory, filters by employment/activation state, displays delivery state, uses database IDs for profiles and handles HTTP 202 resend behavior.
- `frontend/src/EmployeeProfile.jsx` — fetches profile by database primary key and renders real server fields/error states.
- `frontend/src/auth/userDisplay.js` — shared user-name/initials/role display helper.
- `frontend/src/AdminDashboard.jsx`, `HRDashboard.jsx`, `ManagerDashboard.jsx`, `EmployeeDashboard.jsx` — show actual authenticated identity/role and logout; do not display fabricated attendance/leave/team metrics.
- `frontend/package.json` — adds `npm test` using Node's built-in test runner; existing runtime/development dependencies unchanged.

### Backend

- `backend/config/settings.py` — CORS middleware + explicit allowed origins; retains PostgreSQL/Redis port defaults, JWT lifetime/rotation/blacklist and environment behavior.
- `backend/requirements.txt` — adds maintained `django-cors-headers` dependency.
- `backend/config/urls.py` — registers the organization lookup URL group.
- `backend/organization/serializers.py`, `views.py`, `urls.py` — new authenticated HR/Admin read-only lookup endpoints for active departments, designations and work locations.
- `backend/organization/tests.py` — tests lookup authentication, role boundary and active-only results.
- `backend/employees/serializers.py` — adds read-only display labels/portal role while preserving existing create service and model schema.
- `backend/employees/views.py` — adds safe `employment_status` filtering while preserving activation filters, invitation action, permissions and soft deactivation.
- `backend/employees/tests/test_employment_status_filter.py` — tests employment lifecycle filtering.
- `.env.example` — adds safe `CORS_ALLOWED_ORIGINS` and `FRONTEND_BASE_URL` examples; does not contain real secrets.
- `docs/api-contract.md` — documents current routes plus the read-only lookup endpoints introduced in this patch, response behaviors, roles, and known unimplemented APIs.

No database migration is needed for these changes. No model or migration files are changed. Do not replace the local `.env`; only merge example variables if needed.

## Configuration

Use the current absolute-URL strategy rather than a Vite proxy:

`frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

Merge these safe settings into the root local `.env` (do not overwrite existing local values):

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
FRONTEND_BASE_URL=http://localhost:5173
```

For other frontend hosts, explicitly add the origin to `CORS_ALLOWED_ORIGINS`. Do not use wildcard origins. Docker service-to-service PostgreSQL/Redis communication should keep using service names/internal ports, while host apps use PostgreSQL `5433` and Redis `6380` as currently configured.

Install the added backend requirement inside your normal backend environment/container:

```powershell
python -m pip install -r backend/requirements.txt
```

Or rebuild the backend image with your existing Compose command. Do not reset or recreate database volumes.

## Validation commands

From `frontend/`:

```powershell
npm test
npm run lint
npm run build
```

From `backend/`:

```powershell
python manage.py check
python manage.py test
```

Also test the running application manually with HR/Admin and Employee accounts: login, failed login, activation, password reset, directory filters, create an employee with existing lookup records, resend invitation and inspect Celery delivery state, open a profile by numeric database ID, try unauthorized routes, and verify historical deactivation in a non-production test database.

The patch authoring environment ran `node --test frontend/src/api/client.test.js`: **5 tests passed**. TypeScript transpilation was used only as a JavaScript/JSX syntax check for 12 frontend files and reported no syntax diagnostics; `python -m compileall` also passed for the included backend Python files. The attempted `npm install` timed out before dependencies were available, so ESLint, the Vite production build, and the Django test suite were not run here. Run the commands above in your local project and fix any environment/version-specific issues before committing.

## Scope / limitations

- Employee records/auth/activation/reset/lookup data are connected to the existing backend contracts.
- Dashboards use real current-user data but operational attendance, leave, team metrics and company-wide metrics remain unavailable because server-authorized APIs do not exist in the current repository.
- Employee endpoints continue to require HR/Admin; role checks in React are not a substitute for backend authorization.
- Invitation HTTP 202 means queued, not delivered.
- Token storage is intentionally memory-only. A full page reload requires login again to reduce exposure of long-lived credentials to browser storage.
