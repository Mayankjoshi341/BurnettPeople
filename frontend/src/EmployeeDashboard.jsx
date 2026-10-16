import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { roleLabel, userDisplayName, userInitials } from "./auth/userDisplay";
import "./EmployeeDashboard.css";

const EXCEPTION_TYPES = [
  ["MISSED_CHECK_IN", "Missed check-in"],
  ["MISSED_CHECK_OUT", "Missed check-out"],
  ["LATE_ARRIVAL", "Late arrival"],
  ["BREAK_OUTSIDE_WINDOW", "Break outside allowed window"],
  ["BREAK_DURATION", "Break duration issue"],
  ["OTHER", "Other attendance issue"],
];

function getErrorMessage(error) {
  const fieldMessages = Object.values(error?.fieldErrors || {}).flat();
  return fieldMessages.join(" ") || error?.message || "The request failed. Please try again.";
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getRows(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  return [];
}

function weekdayInTimezone(timeZone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: timeZone || "Asia/Kolkata",
    }).format(new Date()).toUpperCase().slice(0, 3);
  } catch {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" })
      .format(new Date()).toUpperCase().slice(0, 3);
  }
}

function EmployeeDashboard({ user, onLogout }) {
  const name = userDisplayName(user);
  const firstName = name.split(/\s+/)[0];

  const [dashboardData, setDashboardData] = useState({ attendance: null, schedule: null });
  const [history, setHistory] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [exceptionsError, setExceptionsError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [breakType, setBreakType] = useState("");
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [exceptionType, setExceptionType] = useState("OTHER");
  const [exceptionReason, setExceptionReason] = useState("");

  const loadDashboard = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    setError("");
    setHistoryError("");
    setExceptionsError("");

    const [currentResult, historyResult, exceptionResult] = await Promise.allSettled([
      apiClient.get("/attendance/me/"),
      apiClient.get("/attendance/history/"),
      apiClient.get("/attendance/exceptions/"),
    ]);

    if (currentResult.status === "fulfilled") {
      setDashboardData(currentResult.value || { attendance: null, schedule: null });
    } else {
      setDashboardData({ attendance: null, schedule: null });
      setError(getErrorMessage(currentResult.reason));
    }

    if (historyResult.status === "fulfilled") {
      setHistory(getRows(historyResult.value));
    } else {
      setHistory([]);
      setHistoryError(getErrorMessage(historyResult.reason));
    }

    if (exceptionResult.status === "fulfilled") {
      setExceptions(getRows(exceptionResult.value));
    } else {
      setExceptions([]);
      setExceptionsError(getErrorMessage(exceptionResult.reason));
    }

    if (!quiet) setIsLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const attendance = dashboardData?.attendance || null;
  const schedule = dashboardData?.schedule || null;
  const breakRules = schedule?.break_policy?.rules || [];
  const activeBreak = attendance?.breaks?.find((item) => !item.ended_at) || null;
  const workdayToday = schedule
    ? (schedule.workdays || []).includes(weekdayInTimezone(schedule.timezone))
    : false;
  const scheduleEnabled = Boolean(
    schedule && schedule.is_active !== false && schedule.break_policy?.is_active !== false
  );
  const canCheckIn = Boolean(scheduleEnabled && workdayToday && !attendance);
  const isCheckedIn = Boolean(attendance && attendance.status === "OPEN" && !attendance.check_out);
  const canCheckOut = isCheckedIn && !activeBreak;
  const statusText = !attendance
    ? "Not checked in"
    : isCheckedIn
      ? activeBreak ? "On break" : "Checked in"
      : "Workday completed";

  const sortedExceptions = useMemo(
    () => [...exceptions].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)),
    [exceptions],
  );

  async function runAttendanceAction(actionKey, endpoint, body, successMessage) {
    setBusyAction(actionKey);
    setError("");
    setNotice("");
    try {
      await apiClient.post(endpoint, body);
      setNotice(successMessage);
      await loadDashboard(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction("");
    }
  }

  async function handleExceptionSubmit(event) {
    event.preventDefault();
    const reason = exceptionReason.trim();
    if (!exceptionType) {
      setError("Choose an attendance issue type.");
      return;
    }
    if (reason.length < 10) {
      setError("Please explain the issue in at least 10 characters.");
      return;
    }

    setBusyAction("exception");
    setError("");
    setNotice("");
    try {
      const payload = { exception_type: exceptionType, reason };
      if (attendance?.id) payload.attendance_id = attendance.id;
      await apiClient.post("/attendance/exceptions/", payload);
      setExceptionReason("");
      setExceptionType("OTHER");
      setShowExceptionForm(false);
      setNotice("Your attendance issue has been submitted for HR review.");
      await loadDashboard(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className="employee-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>
        <nav aria-label="Employee navigation">
          <a href="#dashboard" className="active">Dashboard</a>
          <a href="#attendance">My Attendance</a>
          <a href="#schedule">My Schedule</a>
          <a href="#history">Attendance History</a>
          <a href="#exceptions">Report an Issue</a>
          <a href="#profile">My Profile</a>
        </nav>
      </aside>

      <main className="employee-main" id="dashboard">
        <header className="employee-header">
          <div><p>EMPLOYEE PORTAL</p><h1>My Dashboard</h1></div>
          <div className="employee-profile" id="profile">
            <span>{userInitials(user)}</span>
            <div><strong>{name}</strong><p>{roleLabel(user?.role)}</p></div>
            <button type="button" className="employee-logout" onClick={onLogout}>Log out</button>
          </div>
        </header>

        <section className="employee-welcome">
          <p>YOUR WORKSPACE</p>
          <h2>Welcome, {firstName}!</h2>
          <p>View your assigned schedule, record attendance, manage breaks, and submit attendance issues for HR review.</p>
        </section>

        {error && <div className="employee-form-message" role="alert">{error}</div>}
        {notice && <div className="employee-notice" role="status">{notice}</div>}
        {isLoading && <div className="employee-notice" role="status">Loading your attendance and schedule…</div>}

        <section className="employee-summary" id="attendance">
          <article className="employee-card">
            <p>Today's Attendance</p><h3>{isLoading ? "Loading…" : statusText}</h3>
            <span>{attendance?.work_date || (schedule ? "No record created for today" : "No schedule assigned")}</span>
          </article>
          <article className="employee-card">
            <p>Check-in Time</p><h3>{formatTime(attendance?.check_in)}</h3>
            <span>{attendance ? formatDateTime(attendance.check_in) : "Server timestamp is recorded when you check in"}</span>
          </article>
          <article className="employee-card">
            <p>Check-out Time</p><h3>{formatTime(attendance?.check_out)}</h3>
            <span>{attendance?.check_out ? formatDateTime(attendance.check_out) : "Recorded when you finish the workday"}</span>
          </article>
        </section>

        <section className="employee-content">
          <article className="employee-card employee-attendance-actions">
            <div className="employee-section-heading">
              <div><h2>Attendance Actions</h2><p>All timestamps are recorded by the server.</p></div>
              <span className="employee-status-badge">{statusText}</span>
            </div>
            {!schedule && !isLoading && <div className="employee-notice">No work schedule is assigned to your account. Contact HR before checking in.</div>}
            {schedule && scheduleEnabled && !workdayToday && !attendance && <div className="employee-notice">Today is not a configured workday for your assigned schedule.</div>}
            {schedule && !scheduleEnabled && <div className="employee-notice">Your schedule or break policy is inactive. Contact HR before checking in.</div>}
            <div className="employee-action-buttons">
              <button type="button" className="employee-primary-button" disabled={!canCheckIn || Boolean(busyAction) || isLoading}
                onClick={() => runAttendanceAction("check-in", "/attendance/check-in/", {}, "You are checked in. The server recorded your timestamp.")}>
                {busyAction === "check-in" ? "Checking in…" : "Check in"}
              </button>
              <button type="button" className="employee-primary-button" disabled={!canCheckOut || Boolean(busyAction) || isLoading}
                onClick={() => runAttendanceAction("check-out", "/attendance/check-out/", {}, "You are checked out. Your workday is complete.")}>
                {busyAction === "check-out" ? "Checking out…" : "Check out"}
              </button>
            </div>
            <p className="employee-help-text">Duplicate check-ins and invalid check-outs are rejected by the backend.</p>

            <div className="employee-break-section">
              <h3>Break Management</h3>
              {activeBreak && <p className="employee-notice">Active break: {activeBreak.break_type}. End this break before checking out or starting another.</p>}
              {!breakRules.length && <p className="employee-help-text">No active break types are configured for this schedule.</p>}
              <div className="employee-form-field">
                <label htmlFor="break-type">Break type</label>
                <select id="break-type" value={breakType} onChange={(event) => setBreakType(event.target.value)} disabled={!isCheckedIn || Boolean(activeBreak) || Boolean(busyAction) || breakRules.length === 0}>
                  <option value="">Choose a break type</option>
                  {breakRules.map((rule) => <option key={rule.id} value={rule.break_type}>{rule.label || rule.break_type}</option>)}
                </select>
              </div>
              <div className="employee-action-buttons">
                <button type="button" className="employee-secondary-button" disabled={!isCheckedIn || Boolean(activeBreak) || !breakType || Boolean(busyAction)}
                  onClick={() => runAttendanceAction("break-start", "/attendance/breaks/start/", { break_type: breakType }, "Break started. Policy checks will be recorded by the backend.")}>
                  {busyAction === "break-start" ? "Starting break…" : "Start break"}
                </button>
                <button type="button" className="employee-secondary-button" disabled={!isCheckedIn || !activeBreak || Boolean(busyAction)}
                  onClick={() => runAttendanceAction("break-end", "/attendance/breaks/end/", {}, "Break ended. The backend checked the configured duration policy.")}>
                  {busyAction === "break-end" ? "Ending break…" : "End break"}
                </button>
              </div>
            </div>
          </article>

          <article className="employee-card" id="schedule">
            <div className="employee-section-heading"><div><h2>My Schedule</h2><p>Your assigned working hours and break rules.</p></div></div>
            {schedule ? (
              <>
                <h3>{schedule.name}</h3>
                <p><strong>Working hours:</strong> {schedule.start_time}–{schedule.end_time}</p>
                <p><strong>Workdays:</strong> {(schedule.workdays || []).join(", ") || "—"}</p>
                <p><strong>Timezone:</strong> {schedule.timezone || "Asia/Kolkata"}</p>
                <p><strong>Late grace period:</strong> {schedule.late_grace_minutes} minutes</p>
                <p><strong>Break policy:</strong> {schedule.break_policy?.name || "No policy name"}</p>
                {breakRules.length > 0 ? <ul>{breakRules.map((rule) => <li key={rule.id}>{rule.label || rule.break_type}: {rule.allowed_start_time}–{rule.allowed_end_time} ({rule.duration_mode.toLowerCase()} {rule.duration_minutes} minutes)</li>)}</ul> : <p>No active break rules configured.</p>}
              </>
            ) : (
              <div className="employee-empty-state"><span className="employee-empty-icon">◷</span><h3>No schedule available</h3><p>HR must assign an active work schedule and break policy to enable attendance actions.</p></div>
            )}
          </article>
        </section>

        <section className="employee-card employee-history-section" id="history">
          <div className="employee-section-heading"><div><h2>Attendance History</h2><p>Your latest recorded workdays.</p></div><button className="employee-secondary-button" type="button" onClick={() => loadDashboard(true)} disabled={Boolean(busyAction)}>Refresh</button></div>
          {historyError && <div className="employee-form-message" role="alert">{historyError}</div>}
          {!historyError && history.length === 0 ? (
            <div className="employee-empty-state"><span className="employee-empty-icon">▤</span><h3>No attendance records yet</h3><p>Your records will appear after you check in.</p></div>
          ) : !historyError && (
            <div className="employee-table-wrapper"><table className="employee-history-table">
              <thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Status</th><th>Breaks</th></tr></thead>
              <tbody>{history.map((record) => <tr key={record.id}>
                <td>{record.work_date || "—"}</td><td>{formatDateTime(record.check_in)}</td><td>{formatDateTime(record.check_out)}</td>
                <td>{record.status || (record.check_out ? "CLOSED" : "OPEN")}</td><td>{(record.breaks || []).length}</td>
              </tr>)}</tbody>
            </table></div>
          )}
        </section>

        <section className="employee-card employee-report-section" id="exceptions">
          <div className="employee-section-heading"><div><h2>Report an Attendance Issue</h2><p>Submit a reason for missed check-in/out, late arrival, or a break issue.</p></div></div>
          <button type="button" className="employee-primary-button" onClick={() => { setShowExceptionForm(true); setError(""); }} disabled={Boolean(busyAction)}>Report an issue</button>
          {exceptionsError && <div className="employee-form-message" role="alert">{exceptionsError}</div>}
          <h3>My submitted issues</h3>
          {sortedExceptions.length === 0 ? <p className="employee-help-text">No attendance issues have been submitted.</p> : (
            <div className="employee-table-wrapper"><table className="employee-history-table">
              <thead><tr><th>Submitted</th><th>Issue</th><th>Reason</th><th>Review status</th><th>HR comment</th></tr></thead>
              <tbody>{sortedExceptions.map((item) => <tr key={item.id}>
                <td>{formatDateTime(item.submitted_at)}</td><td>{item.exception_label || item.exception_type}</td><td>{item.reason}</td>
                <td>{item.status_label || item.review_status}</td><td>{item.review_comment || "—"}</td>
              </tr>)}</tbody>
            </table></div>
          )}
        </section>

        {showExceptionForm && (
          <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && busyAction !== "exception") setShowExceptionForm(false); }}>
            <section className="employee-modal" role="dialog" aria-modal="true" aria-labelledby="exception-modal-title">
              <div className="employee-modal-heading"><div><p>ATTENDANCE SUPPORT</p><h2 id="exception-modal-title">Report an attendance issue</h2></div>
                <button type="button" className="employee-modal-close" onClick={() => setShowExceptionForm(false)} aria-label="Close form" disabled={busyAction === "exception"}>×</button>
              </div>
              <form onSubmit={handleExceptionSubmit}>
                <div className="employee-form-field"><label htmlFor="exception-type">Issue type *</label>
                  <select id="exception-type" value={exceptionType} onChange={(event) => setExceptionType(event.target.value)} required>
                    {EXCEPTION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="employee-form-field"><label htmlFor="exception-reason">Explanation *</label>
                  <textarea id="exception-reason" value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} placeholder="Explain what happened and include relevant details…" rows={5} maxLength={4000} minLength={10} required />
                  <span className="employee-character-count">{exceptionReason.length}/4000 characters</span>
                </div>
                <div className="employee-modal-actions">
                  <button type="button" className="employee-secondary-button" onClick={() => setShowExceptionForm(false)} disabled={busyAction === "exception"}>Cancel</button>
                  <button type="submit" className="employee-primary-button" disabled={busyAction === "exception"}>{busyAction === "exception" ? "Submitting…" : "Submit for review"}</button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default EmployeeDashboard;
