import { useCallback, useEffect, useMemo, useState } from "react";
import StatusUpdates from "./StatusUpdates";
import { STATUS_UPDATES_META, STATUS_UPDATES_NAV } from "./statusUpdatesMeta";
import apiClient from "./api/client";
import { userDisplayName, roleLabel } from "./auth/userDisplay";
import DashboardShell from "./DashboardShell";
import { Icon } from "./DashboardIcons";
import { StatCard, MonthCalendar } from "./DashboardParts";
import MyPeople from "./MyPeople";
import Leaderboard from "./Leaderboard";
import EmployeeMyProfile from "./EmployeeMyProfile";
import RemoteWork from "./RemoteWork";
import { useLeaveData, leaveMarks, upcomingLeave, dayLabel } from "./features/leave/leaveApi";
import { LeaveApplyForm, LeaveBalanceCards, LeaveHistoryTable, LeaveStatusBadge } from "./features/leave/LeaveComponents";
import { useMyAssets } from "./features/assets/assetApi";
import { MyAssetsPage, MyAssetsPreview } from "./features/assets/EmployeeAssets";
import {
  SHOW_DEMO_DATA,
  AVATAR_TONES,
  getArrayResponse,
  getErrorMessage,
  formatTime,
  formatDate,
  formatDuration,
  initialsOf,
} from "./dashboardUtils";
import softMint from "./assets/login-soft-mint.png";
import darkTeal from "./assets/login-dark-teal.png";
import "./EmployeeDashboard.css";

/* Set to false if employees should NOT see the "My People" page */
const SHOW_MY_PEOPLE = true;

const NAV = [
  { id: "overview", label: "Dashboard", icon: "home" },
  ...(SHOW_MY_PEOPLE ? [{ id: "people", label: "My People", icon: "people" }] : []),
  { id: "leaderboard", label: "Leaderboard", icon: "flame" },
  { id: "remote-work", label: "Remote Work", icon: "home" },
  { id: "attendance", label: "My Attendance", icon: "clock" },
  { id: "breaks", label: "Breaks", icon: "coffee" },
  { id: "leave", label: "My Leave", icon: "plane" },
  { id: "assets", label: "My Assets", icon: "laptop" },
  { id: "requests", label: "My Requests", icon: "file" },
  { id: "profile", label: "My Profile", icon: "user" },
  { id: "notifications", label: "Notifications", icon: "bell", badge: true },
  STATUS_UPDATES_NAV,
];

const PAGE_META = {
  overview: ["My Workspace", "Your workday, your attendance, your requests and more."],
  people: ["My People", "Explore your organization and connect with colleagues."],
  leaderboard: ["Good Habits & Leaderboard", "Recognize positive, verified work habits across the company."],
  "remote-work": ["Remote Work", "Request a remote work day and track approval."],
  attendance: ["Attendance & Breaks", "Track your work hours, manage your breaks and keep your record."],
  breaks: ["Breaks", "Start, end and review your breaks for today."],
  leave: ["My Leave", "Plan your time off, track your balance and manage requests."],
  assets: ["My Assets", "Devices and equipment assigned to you."],
  requests: ["My Requests", "Report attendance issues and track their review."],
  profile: ["My Profile", "Your personal information and work details."],
  notifications: ["Notifications", "Updates about your requests and attendance."],
  "status-updates": STATUS_UPDATES_META.EMPLOYEE,
};

const BREAK_LABELS = { LUNCH: "Lunch Break", SHORT_BREAK: "Short Break", OTHER: "Other Break" };
/* order in which breaks are shown on the dashboard */
const BREAK_ORDER = ["SHORT_BREAK", "LUNCH", "OTHER"];
const BREAK_TONE = { SHORT_BREAK: "green", LUNCH: "orange", OTHER: "blue" };
const ISSUE_LABELS = {
  MISSED_CHECK_IN: "Missed check-in",
  MISSED_CHECK_OUT: "Missed check-out",
  INCORRECT_HOURS: "Incorrect work hours",
  OTHER: "Other",
};

/* Sample data - only shown when SHOW_DEMO_DATA is true */
const DEMO_SCHEDULE = [
  ["clock", "Work Hours", "9:00 AM – 6:00 PM"],
  ["calendar", "Work Days", "Mon – Fri (Office)"],
  ["clock", "Time Zone", "Asia/Kolkata (IST)"],
  ["coffee", "Break Policy", "3 breaks (15m + 30m + 10m)"],
];
const DEMO_POLICY = [
  ["Short Break", "15 minutes", "10:00 AM – 11:30 AM"],
  ["Lunch Break", "30 minutes", "12:00 PM – 02:00 PM"],
  ["Other Break", "10 minutes", "03:00 PM – 05:00 PM"],
];
const STATUS_CLASS = {
  Approved: "status-completed",
  Pending: "status-pending",
  Rejected: "status-rejected",
  Assigned: "status-completed",
};

function statusClassFor(label = "") {
  const key = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  return STATUS_CLASS[key] || "status-pending";
}

function getExceptionStatus(request) {
  return request.status_label || request.review_status || "PENDING";
}

function greetingFor(date) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function SunIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function EmployeeDashboard({ user, onLogout }) {
  const name = userDisplayName(user);
  const firstName = (name || "").split(" ")[0] || "there";

  const [section, setSection] = useState("overview");
  const [now, setNow] = useState(() => new Date());

  const leave = useLeaveData({ balances: true, types: true });
  const myAssets = useMyAssets();

  const [attendance, setAttendance] = useState(null);
  const [workSchedule, setWorkSchedule] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [myExceptions, setMyExceptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [exceptionsError, setExceptionsError] = useState("");

  const [isWorking, setIsWorking] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [breakType, setBreakType] = useState("SHORT_BREAK");

  const [exceptionType, setExceptionType] = useState("");
  const [exceptionDescription, setExceptionDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [isSubmittingException, setIsSubmittingException] = useState(false);
  const [showExceptionForm, setShowExceptionForm] = useState(false);

  // live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const activeBreak = useMemo(
    () => attendance?.breaks?.find((item) => !item.ended_at) || null,
    [attendance],
  );
  const hasOpenAttendance = Boolean(attendance && !attendance.check_out);
  const attendanceStatus = !attendance ? "Not checked in" : attendance.check_out ? "Completed" : "Checked in";

  const loadDashboard = useCallback(async () => {
    const [currentResult, historyResult, exceptionsResult, scheduleResult] = await Promise.allSettled([
      apiClient.get("/attendance/me/"),
      apiClient.get("/attendance/history/"),
      apiClient.get("/attendance/exceptions/"),
      apiClient.get("/attendance/schedule/me/"),
    ]);

    if (currentResult.status === "fulfilled") {
      setAttendanceError("");
      setAttendance(currentResult.value?.attendance || null);
    } else {
      setAttendanceError(getErrorMessage(currentResult.reason, "Could not load today's attendance."));
    }

    if (historyResult.status === "fulfilled") {
      setHistoryError("");
      setAttendanceHistory(getArrayResponse(historyResult.value));
    } else {
      setAttendanceHistory([]);
      setHistoryError(getErrorMessage(historyResult.reason, "Could not load attendance history."));
    }

    if (exceptionsResult.status === "fulfilled") {
      setExceptionsError("");
      setMyExceptions(getArrayResponse(exceptionsResult.value));
    } else {
      setMyExceptions([]);
      setExceptionsError(getErrorMessage(exceptionsResult.reason, "Could not load your attendance requests."));
    }

    if (scheduleResult.status === "fulfilled") {
      setWorkSchedule(scheduleResult.value?.assignment?.work_schedule || null);
    } else {
      setWorkSchedule(null);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadDashboard());
  }, [loadDashboard]);

  const runAttendanceAction = async (label, endpoint, payload = {}) => {
    setActionError("");
    setActionMessage("");
    setIsWorking(true);

    try {
      const response = await apiClient.post(endpoint, payload);
      setActionMessage(response?.detail || `${label} completed successfully.`);
      await loadDashboard();
    } catch (error) {
      setActionError(getErrorMessage(error, `${label} failed. Please try again.`));
    } finally {
      setIsWorking(false);
    }
  };

  function openExceptionForm() {
    setFormError("");
    setFormMessage("");
    setShowExceptionForm(true);
  }

  function closeExceptionForm() {
    setShowExceptionForm(false);
    setExceptionType("");
    setExceptionDescription("");
    setFormError("");
  }

  async function handleExceptionSubmit(event) {
    event.preventDefault();
    setFormError("");
    setFormMessage("");

    if (!exceptionType) {
      setFormError("Please select an attendance issue.");
      return;
    }
    const reason = exceptionDescription.trim();
    if (reason.length < 10) {
      setFormError("Please enter at least 10 characters in the description.");
      return;
    }

    setIsSubmittingException(true);
    try {
      await apiClient.post("/attendance/exceptions/", { exception_type: exceptionType, reason });
      setFormMessage("Your attendance issue was submitted to HR for review.");
      setShowExceptionForm(false);
      setExceptionType("");
      setExceptionDescription("");
      await loadDashboard();
    } catch (error) {
      setFormError(getErrorMessage(error, "The request could not be submitted."));
    } finally {
      setIsSubmittingException(false);
    }
  }

  /* ---------- derived values ---------- */
  const checkInDate = attendance?.check_in ? new Date(attendance.check_in) : null;
  const checkOutDate = attendance?.check_out ? new Date(attendance.check_out) : null;
  const workMs = checkInDate ? (checkOutDate || now) - checkInDate : null;
  const breaksTaken = attendance?.breaks?.length ?? 0;

  const timeline = useMemo(() => {
    if (!attendance?.check_in) return [];
    const items = [{ key: "in", icon: "check", label: "Checked In", time: formatTime(attendance.check_in), tag: "", done: true }];
    (attendance.breaks || []).forEach((b, i) => {
      const end = b.ended_at ? new Date(b.ended_at) : null;
      items.push({
        key: `b${i}`,
        icon: "coffee",
        label: BREAK_LABELS[b.break_type] || "Break",
        time: `${formatTime(b.started_at)} – ${end ? formatTime(b.ended_at) : "Present"}`,
        tag: formatDuration((end || now) - new Date(b.started_at)),
        done: Boolean(end),
        active: !end,
      });
    });
    if (hasOpenAttendance && !activeBreak) {
      items.push({ key: "office", icon: "clock", label: "In Office", time: "Present", tag: "", done: false, active: true });
    }
    items.push({
      key: "out",
      icon: "logout",
      label: attendance.check_out ? "Checked Out" : "Check Out (Pending)",
      time: attendance.check_out ? formatTime(attendance.check_out) : "—",
      tag: "",
      done: Boolean(attendance.check_out),
    });
    return items;
  }, [attendance, hasOpenAttendance, activeBreak, now]);

  /* Horizontal stepper for the overview: check-in, taken breaks, planned breaks, check-out */
  const steps = useMemo(() => {
    const list = [
      {
        key: "in",
        label: "Check In",
        time: attendance?.check_in ? formatTime(attendance.check_in) : "—",
        state: attendance?.check_in ? "done" : "todo",
      },
    ];
    const taken = attendance?.breaks || [];
    taken.forEach((b, i) => {
      list.push({
        key: `b${i}`,
        label: BREAK_LABELS[b.break_type] || "Break",
        time: formatTime(b.started_at),
        state: b.ended_at ? "done" : "active",
      });
    });
    const takenTypes = new Set(taken.map((b) => b.break_type));
    BREAK_ORDER.filter((t) => !takenTypes.has(t)).forEach((t) => {
      list.push({ key: `p${t}`, label: BREAK_LABELS[t], time: "—", state: "todo" });
    });
    list.push({
      key: "out",
      label: "Check Out",
      time: attendance?.check_out ? formatTime(attendance.check_out) : "—",
      state: attendance?.check_out ? "done" : "todo",
    });
    return list;
  }, [attendance]);
  const doneSteps = steps.filter((s) => s.state === "done" || s.state === "active").length;
  const progressPct = steps.length > 1 ? Math.min(100, ((doneSteps - 1) / (steps.length - 1)) * 100) : 0;

  /* Today's breaks, one row per break type */
  const breakRows = useMemo(
    () =>
      BREAK_ORDER.map((type) => {
        const b = (attendance?.breaks || []).find((x) => x.break_type === type);
        if (!b) return { type, label: BREAK_LABELS[type], range: "—", tag: "Pending", taken: false };
        const end = b.ended_at ? new Date(b.ended_at) : null;
        return {
          type,
          label: BREAK_LABELS[type],
          range: `${formatTime(b.started_at)} - ${end ? formatTime(b.ended_at) : "Present"}`,
          tag: formatDuration((end || now) - new Date(b.started_at)),
          taken: true,
          active: !end,
        };
      }),
    [attendance, now],
  );

  /* Recent activity derived from today's attendance */
  const activity = useMemo(() => {
    if (!attendance?.check_in) return [];
    const rows = [{ at: new Date(attendance.check_in), event: "Checked in", details: "Work day started" }];
    (attendance.breaks || []).forEach((b) => {
      const label = BREAK_LABELS[b.break_type] || "Break";
      rows.push({ at: new Date(b.started_at), event: "Break started", details: label });
      if (b.ended_at) {
        rows.push({
          at: new Date(b.ended_at),
          event: "Break ended",
          details: `${label} (${formatDuration(new Date(b.ended_at) - new Date(b.started_at))})`,
        });
      }
    });
    if (attendance.check_out) {
      rows.push({ at: new Date(attendance.check_out), event: "Checked out", details: "Work day completed" });
    }
    return rows.sort((a, b) => b.at - a.at).slice(0, 5);
  }, [attendance]);

  const calendarMarks = useMemo(() => {
    const marks = {};
    attendanceHistory.forEach((r) => {
      if (r.work_date && r.check_in) marks[r.work_date] = "present";
    });
    if (attendance?.work_date && attendance.check_in) marks[attendance.work_date] = "present";
    return marks;
  }, [attendanceHistory, attendance]);

  const leaveRemaining = leave.balances.length
    ? leave.balances.reduce((sum, b) => sum + (b.remaining ?? 0), 0)
    : null;
  const upcoming = useMemo(() => upcomingLeave(leave.requests).slice(0, 3), [leave.requests]);
  const calendarLeaveMarks = useMemo(() => leaveMarks(leave.requests), [leave.requests]);

  const pendingCount = myExceptions.filter((r) => /pending/i.test(getExceptionStatus(r))).length;
  const unread = SHOW_DEMO_DATA ? Math.max(pendingCount, 3) : pendingCount;

  const checkInDisabled = isLoading || isWorking || Boolean(attendanceError) || hasOpenAttendance || Boolean(attendance?.check_out);
  const checkOutDisabled = isLoading || isWorking || Boolean(attendanceError) || !hasOpenAttendance || Boolean(activeBreak);
  const startBreakDisabled = isLoading || isWorking || Boolean(attendanceError) || !hasOpenAttendance || Boolean(activeBreak);
  const endBreakDisabled = isLoading || isWorking || Boolean(attendanceError) || !hasOpenAttendance || !activeBreak;

  const doCheckIn = () => runAttendanceAction("Check-in", "/attendance/check-in/");
  const doStartBreak = () => runAttendanceAction("Break start", "/attendance/breaks/start/", { break_type: breakType });
  const doEndBreak = () => runAttendanceAction("Break end", "/attendance/breaks/end/");
  const doCheckOut = () => runAttendanceAction("Check-out", "/attendance/check-out/");

  /* ---------- reusable blocks ---------- */
  const notices = (
    <>
      {(attendanceError || actionError) && (
        <div className="admin-form-error" role="alert">{actionError || attendanceError}</div>
      )}
      {actionMessage && <div className="admin-form-success" role="status">{actionMessage}</div>}
    </>
  );

  const statCards = (
    <section className="admin-summary-grid" aria-label="Today at a glance">
      <StatCard
        icon="check" tone="green" label="Today's Status"
        value={isLoading ? "Loading…" : attendanceError ? "Unavailable" : attendanceStatus}
        note={checkInDate ? `Since ${formatTime(attendance.check_in)}` : attendance?.work_date ? `Work date ${formatDate(attendance.work_date)}` : "No check-in yet"}
      />
      <StatCard
        icon="clock" tone="amber" label="Work Duration"
        value={workMs !== null ? formatDuration(workMs) : "—"}
        note={checkOutDate ? "Work session completed" : checkInDate ? "Ongoing" : "Starts at check-in"}
      />
      <StatCard
        icon="coffee" tone="blue" label="Breaks Taken"
        value={isLoading ? "…" : breaksTaken}
        note={activeBreak ? `Active: ${BREAK_LABELS[activeBreak.break_type] || "Break"}` : "Total breaks today"}
      />
      <StatCard
        icon="calendar" tone="amber" label="Schedule"
        value={attendance?.schedule_name || "—"}
        note={attendance?.schedule_name ? "Assigned shift" : "Shown after your first check-in"}
      />
    </section>
  );

  const clockCard = (
    <section className="admin-panel emp-clock" aria-label="Attendance actions">
      <p className="emp-clock-line">
        You are currently{" "}
        <span className={`emp-state ${hasOpenAttendance ? "on" : ""}`}>
          <i /> {activeBreak ? "On Break" : attendanceStatus}
        </span>
      </p>
      <div className="emp-time">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
      <p className="emp-date">{now.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>

      <div className="emp-actions">
        <button type="button" className="emp-btn" onClick={doCheckIn} disabled={checkInDisabled}>
          <Icon name="arrow" size={18} /> {isWorking ? "Processing…" : "Check In"}
        </button>
        <button type="button" className="emp-btn primary" onClick={doStartBreak} disabled={startBreakDisabled}>
          <Icon name="coffee" size={18} /> Start Break
        </button>
        <button type="button" className="emp-btn" onClick={doEndBreak} disabled={endBreakDisabled}>
          <Icon name="stop" size={16} /> End Break
        </button>
        <button type="button" className="emp-btn" onClick={doCheckOut} disabled={checkOutDisabled}>
          <Icon name="logout" size={18} /> Check Out
        </button>
      </div>

      <div className="emp-break-select">
        <label htmlFor="break-type">Break type</label>
        <select id="break-type" value={breakType} onChange={(e) => setBreakType(e.target.value)} disabled={isWorking || !hasOpenAttendance || Boolean(activeBreak)}>
          <option value="SHORT_BREAK">Short break</option>
          <option value="LUNCH">Lunch</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      {activeBreak && <p className="admin-note">End your active break before checking out. It started at {formatTime(activeBreak.started_at)}.</p>}
      <p className="admin-note">Times are recorded by the server, not your browser. Available break types depend on your schedule&rsquo;s policy.</p>
    </section>
  );

  const scheduleCard = (
    <section className="admin-panel" aria-labelledby="sched-title">
      <div className="admin-panel-heading"><div><h2 id="sched-title">Your Schedule</h2></div></div>
      {(workSchedule || attendance?.schedule_name) && (
        <div className="emp-info-row">
          <span className="emp-info-icon"><Icon name="clock" size={18} /></span>
          <span><strong>{workSchedule?.name || "Assigned Shift"}</strong><small>{workSchedule ? `${workSchedule.start_time?.slice(0, 5) || "—"}–${workSchedule.end_time?.slice(0, 5) || "—"} · ${workSchedule.timezone}` : attendance.schedule_name}</small></span>
        </div>
      )}
      {workSchedule ? (
        <>
          <div className="emp-info-row"><span className="emp-info-icon"><Icon name="calendar" size={18} /></span><span><strong>Work Days</strong><small>{(workSchedule.workdays || []).join(", ")}</small></span></div>
          {(workSchedule.break_policy?.rules || []).filter((rule) => rule.is_active).map((rule) => (
            <div className="emp-info-row" key={rule.id}><span className="emp-info-icon"><Icon name="coffee" size={18} /></span><span><strong>{rule.break_type_label || BREAK_LABELS[rule.break_type] || "Break"}</strong><small>{rule.duration_minutes} min · {rule.allowed_start_time?.slice(0, 5)}–{rule.allowed_end_time?.slice(0, 5)}</small></span></div>
          ))}
        </>
      ) : SHOW_DEMO_DATA ? (
        DEMO_SCHEDULE.map(([icon, label, value]) => (
          <div className="emp-info-row" key={label}>
            <span className="emp-info-icon"><Icon name={icon} size={18} /></span>
            <span><strong>{label}</strong><small>{value}</small></span>
          </div>
        ))
      ) : (
        !attendance?.schedule_name && (
          <p className="admin-note">No schedule details available yet. Contact HR if you need your shift confirmed.</p>
        )
      )}
    </section>
  );

  const breaksCard = (
    <section className="admin-panel" aria-labelledby="tb-title">
      <div className="admin-panel-heading">
        <div><h2 id="tb-title">Today&rsquo;s Breaks</h2></div>
        <button type="button" className="admin-link-button" onClick={() => setSection("breaks")}>
          View all <Icon name="arrow" size={13} />
        </button>
      </div>
      <div className="emp-break-list">
        {breakRows.map((r) => (
          <div className="emp-info-row" key={r.type}>
            <span className={`emp-info-icon tone-${BREAK_TONE[r.type]}`}><Icon name="coffee" size={18} /></span>
            <span><strong>{r.label}</strong><small>{r.range}</small></span>
            <span className={`emp-pill emp-right ${r.taken ? (r.active ? "live" : "done") : "idle"}`}>{r.tag}</span>
          </div>
        ))}
      </div>
    </section>
  );

  const historyCard = (limit) => (
    <section className="admin-panel" aria-labelledby="hist-title">
      <div className="admin-panel-heading">
        <div><h2 id="hist-title">Attendance History</h2><p>Your recent attendance records</p></div>
        <button type="button" className="admin-link-button" onClick={() => { setIsRefreshing(true); loadDashboard(); }} disabled={isRefreshing || isWorking}>
          <Icon name="refresh" size={14} /> {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {historyError && <div className="admin-form-error" role="alert">{historyError}</div>}
      {isLoading ? (
        <p className="admin-note">Loading attendance history…</p>
      ) : attendanceHistory.length === 0 ? (
        <p className="admin-note">No attendance records found. Completed and current workday records will appear here.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>DATE</th><th>SCHEDULE</th><th>CHECK IN</th><th>CHECK OUT</th><th>WORK DURATION</th><th>STATUS</th></tr></thead>
            <tbody>
              {attendanceHistory.slice(0, limit).map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.work_date)}</td>
                  <td>{r.schedule_name || "—"}</td>
                  <td>{formatTime(r.check_in)}</td>
                  <td>{formatTime(r.check_out)}</td>
                  <td>{r.check_in ? formatDuration((r.check_out ? new Date(r.check_out) : now) - new Date(r.check_in)) : "—"}</td>
                  <td><span className={`admin-status ${r.check_out ? "status-completed" : "status-ontime"}`}>{r.check_out ? "CLOSED" : r.status || "OPEN"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  /* ---------- pages ---------- */
  function renderOverview() {
    const todayIdx = now.getDay();
    const showCheckIn = !attendance;

    return (
      <div className="emp-overview">
        {notices}

        {/* Welcome banner */}
        <section className="emp-hero" style={{ backgroundImage: `url(${softMint})` }}>
          <span className="emp-hero-icon"><SunIcon /></span>
          <div className="emp-hero-text">
            <h2>{greetingFor(now)}, {firstName}</h2>
            <p>Have a productive and successful day!</p>
          </div>
          <div className="emp-hero-date">
            <small>{now.toLocaleDateString("en-GB", { weekday: "long" })}</small>
            <strong>{now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong>
            <span className={`emp-hero-chip ${hasOpenAttendance ? "on" : ""}`}>
              <i /> {activeBreak ? "You're on break" : hasOpenAttendance ? "You're checked in" : attendance ? "Day completed" : "Not checked in yet"}
            </span>
          </div>
        </section>

        {/* Summary cards */}
        <section className="emp-sum-grid" aria-label="Today at a glance">
          <button type="button" className="emp-sum-card" onClick={() => setSection("attendance")}>
            <span className={`emp-sum-icon ${hasOpenAttendance ? "green" : "grey"}`}>
              <i className="emp-live-dot" />
            </span>
            <span className="emp-sum-body">
              <small>Current Status</small>
              <strong>{isLoading ? "Loading…" : attendanceError ? "Unavailable" : activeBreak ? "On Break" : hasOpenAttendance ? "Checked In" : attendanceStatus}</strong>
              <em>{checkInDate ? `Since ${formatTime(attendance.check_in)}` : "No check-in yet"}</em>
            </span>
            <Icon name="arrow" size={15} />
          </button>
          <button type="button" className="emp-sum-card" onClick={() => setSection("attendance")}>
            <span className="emp-sum-icon green"><Icon name="calendar" size={24} /></span>
            <span className="emp-sum-body">
              <small>Work Schedule</small>
              <strong>{workSchedule ? `${workSchedule.start_time?.slice(0, 5)}–${workSchedule.end_time?.slice(0, 5)}` : attendance?.schedule_name || "—"}</strong>
              <em>{workSchedule ? `${(workSchedule.workdays || []).join(" · ")} · ${workSchedule.timezone}` : attendance?.schedule_name ? "Assigned shift" : "No schedule assigned"}</em>
            </span>
            <Icon name="arrow" size={15} />
          </button>
          <button type="button" className="emp-sum-card" onClick={() => setSection("breaks")}>
            <span className="emp-sum-icon blue"><Icon name="coffee" size={24} /></span>
            <span className="emp-sum-body">
              <small>Break Policy</small>
              <strong>{isLoading ? "…" : `${breaksTaken} ${breaksTaken === 1 ? "Break" : "Breaks"} Today`}</strong>
              <em>{SHOW_DEMO_DATA ? "15m · 30m · 10m" : activeBreak ? `Active: ${BREAK_LABELS[activeBreak.break_type] || "Break"}` : "As per your schedule"}</em>
            </span>
            <Icon name="arrow" size={15} />
          </button>
          <button type="button" className="emp-sum-card" onClick={() => setSection("leave")}>
            <span className="emp-sum-icon orange"><Icon name="plane" size={24} /></span>
            <span className="emp-sum-body">
              <small>Leave Balance</small>
              <strong>{leave.loading ? "Loading…" : leaveRemaining === null ? "—" : dayLabel(leaveRemaining)}</strong>
              <em>{leave.errors.balances ? "Unavailable" : leaveRemaining === null ? "No balance set up" : "Remaining across leave types"}</em>
            </span>
            <Icon name="arrow" size={15} />
          </button>
        </section>

        {/* Attendance + breaks */}
        <div className="emp-row emp-row-main">
          <section className="admin-panel emp-attendance" aria-labelledby="ta-title">
            <div className="admin-panel-heading">
              <div><h2 id="ta-title">Today&rsquo;s Attendance</h2></div>
              <small className="emp-muted">{now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</small>
            </div>

            <ol className="emp-steps" style={{ "--steps": steps.length, "--progress": `${progressPct}%` }}>
              {steps.map((s) => (
                <li key={s.key} className={s.state}>
                  <span className="emp-step-dot">{s.state === "done" && <Icon name="check" size={12} />}</span>
                  <strong>{s.time}</strong>
                  <small>{s.label}</small>
                </li>
              ))}
            </ol>

            <div className="emp-quick-actions-row">
              {showCheckIn ? (
                <button type="button" className="emp-big-btn primary" onClick={doCheckIn} disabled={checkInDisabled}>
                  <Icon name="arrow" size={18} /> {isWorking ? "Processing…" : "Check In"}
                </button>
              ) : (
                <>
                  <button type="button" className="emp-big-btn primary" onClick={doStartBreak} disabled={startBreakDisabled}>
                    <Icon name="coffee" size={18} /> Start Break
                  </button>
                  <button type="button" className="emp-big-btn" onClick={doEndBreak} disabled={endBreakDisabled}>
                    <Icon name="stop" size={15} /> End Break
                  </button>
                  <button type="button" className="emp-big-btn" onClick={doCheckOut} disabled={checkOutDisabled}>
                    <Icon name="logout" size={18} /> Check Out
                  </button>
                </>
              )}
            </div>
            {!showCheckIn && (
              <div className="emp-break-select left">
                <label htmlFor="break-type-ov">Break type</label>
                <select id="break-type-ov" value={breakType} onChange={(e) => setBreakType(e.target.value)} disabled={isWorking || !hasOpenAttendance || Boolean(activeBreak)}>
                  <option value="SHORT_BREAK">Short break</option>
                  <option value="LUNCH">Lunch</option>
                  <option value="OTHER">Other</option>
                </select>
                <span className="emp-live-time">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              </div>
            )}
          </section>

          {breaksCard}
        </div>

        {/* Leave / schedule / assets */}
        <div className="emp-row emp-row-lower">
          <div className="emp-col">
            <div className="emp-row emp-row-two">
              <section className="admin-panel" aria-labelledby="ul-title">
                <div className="admin-panel-heading">
                  <div><h2 id="ul-title">Upcoming Leave</h2></div>
                  <button type="button" className="admin-link-button" onClick={() => setSection("leave")}>View all <Icon name="arrow" size={13} /></button>
                </div>
                {leave.loading ? (
                  <p className="admin-note">Loading your leave…</p>
                ) : leave.errors.requests ? (
                  <div className="admin-form-error" role="alert">{leave.errors.requests}</div>
                ) : upcoming.length === 0 ? (
                  <p className="admin-note">You have no upcoming leave.</p>
                ) : (
                  upcoming.map((r) => (
                    <div className="emp-info-row" key={r.id}>
                      <span className="emp-info-icon tone-orange"><Icon name="plane" size={18} /></span>
                      <span><strong>{r.type}</strong><small>{r.dates}</small></span>
                      <span className="emp-right"><LeaveStatusBadge request={r} /></span>
                    </div>
                  ))
                )}
              </section>

              <section className="admin-panel" aria-labelledby="ms-title">
                <div className="admin-panel-heading">
                  <div><h2 id="ms-title">My Schedule</h2></div>
                  <button type="button" className="admin-link-button" onClick={() => setSection("attendance")}>View full schedule <Icon name="arrow" size={13} /></button>
                </div>
                {workSchedule?.workdays?.length ? (
                  <ul className="emp-week">
                    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day, i) => (
                      <li key={day} className={`${(todayIdx + 6) % 7 === i ? "today" : ""} ${!workSchedule.workdays.includes(day) ? "off" : ""}`}>
                        <span>{day}</span>
                        <span>{workSchedule.workdays.includes(day) ? `${workSchedule.start_time?.slice(0, 5)}–${workSchedule.end_time?.slice(0, 5)}` : "Off"}</span>
                        {(todayIdx + 6) % 7 === i && <em><i /> Today</em>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-note">
                    {attendance?.schedule_name ? `Assigned shift: ${attendance.schedule_name}` : "Your weekly schedule will appear here after HR assigns a shift."}
                  </p>
                )}
              </section>
            </div>

            <section className="admin-panel" aria-labelledby="ra-title">
              <div className="admin-panel-heading">
                <div><h2 id="ra-title">Recent Activity</h2></div>
                <button type="button" className="admin-link-button" onClick={() => setSection("attendance")}>View all <Icon name="arrow" size={13} /></button>
              </div>
              {activity.length === 0 ? (
                <p className="admin-note">Your activity for today will show up here after you check in.</p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>DATE &amp; TIME</th><th>EVENT</th><th>DETAILS</th></tr></thead>
                    <tbody>
                      {activity.map((a, i) => (
                        <tr key={i}>
                          <td>{a.at.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} {formatTime(a.at.toISOString())}</td>
                          <td>{a.event}</td>
                          <td>{a.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="emp-col">
            <section className="admin-panel" aria-labelledby="ma-title">
              <div className="admin-panel-heading">
                <div><h2 id="ma-title">My Assets</h2></div>
                <button type="button" className="admin-link-button" onClick={() => setSection("assets")}>View all <Icon name="arrow" size={13} /></button>
              </div>
              <MyAssetsPreview assets={myAssets} />
            </section>

            <section className="admin-panel" aria-labelledby="qa-title">
              <div className="admin-panel-heading"><div><h2 id="qa-title">Quick Actions</h2></div></div>
              <div className="emp-qa-grid">
                <button type="button" className="emp-qa green" onClick={() => setSection("leave")}><Icon name="plane" size={20} /> Apply for Leave</button>
                <button type="button" className="emp-qa blue" onClick={() => setSection("assets")}><Icon name="laptop" size={20} /> Request New Asset</button>
                <button type="button" className="emp-qa purple" onClick={() => setSection("requests")}><Icon name="file" size={20} /> View My Requests</button>
                <button type="button" className="emp-qa grey" onClick={() => setSection("profile")}><Icon name="user" size={20} /> Update My Profile</button>
              </div>
            </section>

            <section className="emp-cta" style={{ backgroundImage: `url(${darkTeal})` }}>
              <p>Building better workplaces together.</p>
              <button type="button" aria-label="Open my requests" onClick={() => setSection("requests")}><Icon name="arrow" size={16} /></button>
            </section>
          </div>
        </div>
      </div>
    );
  }

  function renderAttendance() {
    return (
      <>
        {notices}
        {statCards}
        <div className="emp-two">
          <div className="emp-col">
            {clockCard}
            <section className="admin-panel" aria-labelledby="tl-title">
              <div className="admin-panel-heading">
                <div><h2 id="tl-title">Today&rsquo;s Timeline</h2></div>
                <small className="emp-muted">{now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</small>
              </div>
              {timeline.length === 0 ? (
                <p className="admin-note">Your timeline starts when you check in.</p>
              ) : (
                <ol className="emp-timeline">
                  {timeline.map((t) => (
                    <li key={t.key} className={`${t.done ? "done" : ""} ${t.active ? "active" : ""}`}>
                      <span className="emp-dot"><Icon name={t.icon} size={15} /></span>
                      <strong>{t.label}</strong>
                      <span className="emp-when">{t.time}</span>
                      {t.tag && <span className="emp-tag">{t.tag}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <div className="emp-col">
            {scheduleCard}
            <section className="admin-panel" aria-labelledby="bp-title">
              <div className="admin-panel-heading"><div><h2 id="bp-title">Break Policy Details</h2></div></div>
              {SHOW_DEMO_DATA ? (
                DEMO_POLICY.map(([label, length, window]) => (
                  <div className="emp-info-row" key={label}>
                    <span className="emp-info-icon"><Icon name="coffee" size={18} /></span>
                    <span><strong>{label}</strong><small>{length} · {window}</small></span>
                  </div>
                ))
              ) : (
                <p className="admin-note">Break rules come from the policy assigned to your work schedule.</p>
              )}
            </section>
            <section className="admin-panel" aria-label="Attendance calendar">
              <MonthCalendar marks={calendarMarks} />
            </section>
          </div>
        </div>
        {historyCard(10)}
      </>
    );
  }

  function renderBreaks() {
    return (
      <>
        {notices}
        <div className="emp-two">
          {clockCard}
          <div className="emp-col">
            {breaksCard}
            <section className="admin-panel" aria-labelledby="bp2-title">
              <div className="admin-panel-heading"><div><h2 id="bp2-title">Break Policy Details</h2></div></div>
              {SHOW_DEMO_DATA ? (
                DEMO_POLICY.map(([label, length, window]) => (
                  <div className="emp-info-row" key={label}>
                    <span className="emp-info-icon"><Icon name="coffee" size={18} /></span>
                    <span><strong>{label}</strong><small>{length} · {window}</small></span>
                  </div>
                ))
              ) : (
                <p className="admin-note">Break rules come from the policy assigned to your work schedule.</p>
              )}
            </section>
          </div>
        </div>
      </>
    );
  }

  function renderLeave() {
    return (
      <>
        {leave.errors.requests && <div className="admin-form-error" role="alert">{leave.errors.requests}</div>}
        <LeaveBalanceCards balances={leave.balances} loading={leave.loading} error={leave.errors.balances} />
        <div className="emp-two">
          <section className="admin-panel"><MonthCalendar marks={calendarLeaveMarks} /></section>
          <LeaveApplyForm
            types={leave.types}
            balances={leave.balances}
            requests={leave.requests}
            typesError={leave.errors.types && leave.types.length === 0 && leave.balances.length === 0 ? leave.errors.types : ""}
            onSubmitted={leave.reload}
          />
        </div>
        <LeaveHistoryTable requests={leave.requests} loading={leave.loading} error="" />
      </>
    );
  }

  function renderAssets() {
    return <MyAssetsPage assets={myAssets} />;
  }

  function renderRequests() {
    return (
      <section className="admin-panel" aria-labelledby="req-title">
        <div className="admin-panel-heading">
          <div><h2 id="req-title">Report an Attendance Issue</h2><p>Missed check-in, missed check-out, incorrect hours, or another issue.</p></div>
          <button type="button" className="admin-primary-button" onClick={openExceptionForm}>Report an issue</button>
        </div>
        {formMessage && <div className="admin-form-success" role="status">{formMessage}</div>}
        {exceptionsError && <div className="admin-form-error" role="alert">{exceptionsError}</div>}
        <h3 className="admin-subheading">My submitted requests</h3>
        {myExceptions.length === 0 ? (
          <p className="admin-note">No attendance issue requests were found.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>SUBMITTED</th><th>ISSUE</th><th>DESCRIPTION</th><th>STATUS</th><th>HR COMMENT</th></tr></thead>
              <tbody>
                {myExceptions.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.submitted_at)}</td>
                    <td>{r.exception_label || ISSUE_LABELS[r.exception_type] || r.exception_type}</td>
                    <td>{r.reason}</td>
                    <td><span className={`admin-status ${statusClassFor(getExceptionStatus(r))}`}>{getExceptionStatus(r)}</span></td>
                    <td>{r.review_comment || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  // function renderProfile() {
  //   const fields = [
  //     ["Full name", name],
  //     ["Email", user?.email || "—"],
  //     ["Role", roleLabel(user?.role)],
  //     ["Employee ID", user?.employee_code || "—"],
  //     ["Department", user?.department_name || user?.department?.name || user?.department || "—"],
  //     ["Designation", user?.designation_name || user?.designation?.name || user?.designation || "—"],
  //   ];
  //   return (
  //     <>
  //       <section className="emp-profile-hero" style={{ backgroundImage: `url(${softMint})` }}>
  //         <span className="emp-profile-avatar">{userInitials(user)}</span>
  //         <div>
  //           <span className={`emp-state ${hasOpenAttendance ? "on" : ""}`}><i /> {hasOpenAttendance ? "On Work" : "Off Duty"}</span>
  //           <h2>{name}</h2>
  //           <p>{roleLabel(user?.role)}</p>
  //         </div>
  //       </section>
  //       <section className="admin-panel" aria-labelledby="bi-title">
  //         <div className="admin-panel-heading"><div><h2 id="bi-title">Basic Information</h2></div></div>
  //         <dl className="people-details">
  //           {fields.map(([k, v]) => (
  //             <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>
  //           ))}
  //         </dl>
  //       </section>
  //     </>
  //   );
  // }

  function renderNotifications() {
    return (
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Notifications</h2><p>Updates about your attendance requests</p></div></div>
        {myExceptions.length === 0 ? (
          <p className="admin-note">You&rsquo;re all caught up.</p>
        ) : (
          myExceptions.map((r, i) => (
            <div className="emp-info-row" key={r.id}>
              <span className="emp-info-icon" style={{ background: AVATAR_TONES[i % AVATAR_TONES.length] }}>{initialsOf(roleLabel(user?.role))}</span>
              <span>
                <strong>{r.exception_label || ISSUE_LABELS[r.exception_type] || "Attendance issue"}</strong>
                <small>Status: {getExceptionStatus(r)} · Submitted {formatDate(r.submitted_at)}</small>
              </span>
            </div>
          ))
        )}
      </section>
    );
  }

  function renderPage() {
    switch (section) {
      case "people": return <MyPeople onLeaderboard={() => setSection("leaderboard")} onRemoteWork={() => setSection("remote-work")} onLeave={() => setSection("leave")} />;
      case "leaderboard": return <Leaderboard user={user} />;
      case "remote-work": return <RemoteWork user={user} />;
      case "attendance": return renderAttendance();
      case "breaks": return renderBreaks();
      case "leave": return renderLeave();
      case "assets": return renderAssets();
      case "requests": return renderRequests();
      case "profile": return (
        <EmployeeMyProfile
          user={user}
          name={name}
          hasOpenAttendance={hasOpenAttendance}
          attendanceStatus={attendanceStatus}
          workSchedule={workSchedule}
          leaveRemaining={leaveRemaining}
          leaveLoading={leave.loading}
          myAssets={myAssets}
          onNavigate={setSection}
        />
      );
      case "notifications": return renderNotifications();
      case "status-updates": return <StatusUpdates user={user} onNavigate={setSection} />;
      default: return renderOverview();
    }
  }

  const [title, subtitle] = PAGE_META[section];

  return (
    <DashboardShell
      rootClass="employee-dashboard"
      user={user}
      onLogout={onLogout}
      nav={NAV}
      section={section}
      setSection={setSection}
      title={title}
      subtitle={subtitle}
      searchPlaceholder="Search policies, leave, schedules..."
      unread={unread}
      homePath="/employee"
      footerLabel="Employee workspace"
    >
      {renderPage()}

      {showExceptionForm && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeExceptionForm(); }}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="exception-modal-title">
            <div className="admin-modal-heading">
              <div><h2 id="exception-modal-title">Report an attendance issue</h2><p>HR will review your request.</p></div>
              <button type="button" className="admin-modal-close" onClick={closeExceptionForm} aria-label="Close form">×</button>
            </div>
            <form onSubmit={handleExceptionSubmit} noValidate>
              <div className="admin-form-field">
                <label htmlFor="exception-type">Issue type *</label>
                <select id="exception-type" value={exceptionType} onChange={(e) => { setExceptionType(e.target.value); setFormError(""); }} required>
                  <option value="">Select an issue</option>
                  <option value="MISSED_CHECK_IN">Missed check-in</option>
                  <option value="MISSED_CHECK_OUT">Missed check-out</option>
                  <option value="INCORRECT_HOURS">Incorrect work hours</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="admin-form-field">
                <label htmlFor="exception-description">Description *</label>
                <textarea id="exception-description" value={exceptionDescription} onChange={(e) => { setExceptionDescription(e.target.value); setFormError(""); }} placeholder="Explain what happened and include relevant details…" rows={5} maxLength={1000} required />
                <span className="emp-count">{exceptionDescription.length}/1000 characters</span>
              </div>
              {formError && <p className="admin-form-error" role="alert">{formError}</p>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary-button" onClick={closeExceptionForm} disabled={isSubmittingException}>Cancel</button>
                <button type="submit" className="admin-primary-button" disabled={isSubmittingException}>{isSubmittingException ? "Submitting…" : "Submit to HR"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </DashboardShell>
  );
}

export default EmployeeDashboard;
