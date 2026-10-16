import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiClient from "./api/client";
import { userDisplayName, userInitials, roleLabel } from "./auth/userDisplay";
import { Icon } from "./DashboardIcons";
import "./AdminDashboard.css"; // shared look (sidebar, cards, tables)
import "./HRDashboard.css"; // HR-only additions
import burnettLogo from "./assets/burnettpeople-logo.png";
import loginDarkTeal from "./assets/login-dark-teal.png";
import loginSoftMint from "./assets/login-soft-mint.png";

/* ------------------------------------------------------------------
   SETTINGS YOU MAY NEED TO CHANGE
   ------------------------------------------------------------------ */
// true  = sample numbers for cards/charts that have no API yet (design preview)
// false = only real data; unconnected cards show "—"
const SHOW_DEMO_DATA = true;

const EMPLOYEES_ENDPOINT = "/employees/"; // real - your employee API
const EXCEPTIONS_ENDPOINT = null; // e.g. "/attendance/exceptions/review/" when backend is ready

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */
function getArrayResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  return [];
}

function getErrorMessage(error, fallback) {
  if (error?.status === 401) return "Your session has expired. Please sign in again.";
  if (error?.status === 403) return "Your account does not have permission to view this.";
  return error?.message || fallback;
}

function pickName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.name || value.title || "";
}

function normalizeEmployee(raw) {
  const full =
    raw.full_name ||
    raw.name ||
    [raw.first_name, raw.last_name].filter(Boolean).join(" ") ||
    "";
  return {
    id: raw.id ?? raw.employee_code ?? raw.email,
    code: raw.employee_code || raw.code || "—",
    name: full || "—",
    email: raw.email || raw.work_email || "—",
    department: pickName(raw.department_name || raw.department) || "—",
    designation: pickName(raw.designation_name || raw.designation) || "—",
    status: raw.employment_status || raw.status || "—",
  };
}

function initialsOf(name = "") {
  return (
    name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?"
  );
}

const AVATAR_TONES = ["#dbeafe", "#fde8dc", "#dcf5ea", "#e9e3fb", "#fff0cf"];

/* ------------------------------------------------------------------
   Navigation
   ------------------------------------------------------------------ */
const NAV = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "employees", label: "Employees", icon: "users" },
  { id: "schedules", label: "Work Schedules", icon: "calendar" },
  { id: "attendance", label: "Attendance & Breaks", icon: "clock" },
  { id: "exceptions", label: "Exception Reviews", icon: "alert" },
  { id: "leave", label: "Leave Management", icon: "plane" },
  { id: "assets", label: "Assets & Devices", icon: "laptop" },
  { id: "reports", label: "Reports", icon: "chart" },
  { id: "notifications", label: "Notifications", icon: "bell", badge: true },
  { id: "profile", label: "My Profile", icon: "user" },
];

const PAGE_META = {
  overview: ["HR Dashboard", "Manage people, attendance, leave and more."],
  employees: ["Employees", "Search and filter employee records."],
  schedules: ["Work Schedules", "Assign and review shift schedules."],
  attendance: ["Attendance & Breaks", "Track check-ins, breaks and hours."],
  exceptions: ["Exception Reviews", "Review reported attendance issues."],
  leave: ["Leave Management", "Review and track leave requests."],
  assets: ["Assets & Devices", "Track devices issued to employees."],
  reports: ["Reports", "Workforce and attendance reports."],
  notifications: ["Notifications", "Everything that needs your attention."],
  profile: ["My Profile", "Your account details."],
};

/* ------------------------------------------------------------------
   Demo data (only when SHOW_DEMO_DATA = true)
   ------------------------------------------------------------------ */
const DEMO = {
  totalEmployees: 128,
  joined: 8,
  present: 96,
  onLeave: 8,
  invitations: 7,
  exceptions: 4,
  attendance: [
    { present: 62, leave: 14, absent: 22 },
    { present: 45, leave: 10, absent: 14 },
    { present: 42, leave: 12, absent: 12 },
    { present: 70, leave: 18, absent: 20 },
    { present: 72, leave: 20, absent: 22 },
    { present: 76, leave: 22, absent: 24 },
    { present: 70, leave: 18, absent: 28 },
  ],
  leaves: [
    { name: "Aarav Sharma", info: "Annual Leave · 16 - 18 Oct", status: "Pending", ago: "2h ago" },
    { name: "Priya Kumar", info: "Sick Leave · 20 Oct", status: "Pending", ago: "4h ago" },
    { name: "Rohan Thakur", info: "Casual Leave · 22 - 23 Oct", status: "Approved", ago: "1d ago" },
    { name: "Sneha Nair", info: "Annual Leave · 5 - 7 Nov", status: "Pending", ago: "1d ago" },
    { name: "Vikram Kapoor", info: "Medical Leave · 14 Oct", status: "Rejected", ago: "2d ago" },
  ],
  activity: [
    { name: "Aarav Sharma", meta: "ENG-001 · Engineering", action: "Leave applied (Annual Leave)", when: "16 Oct 2026, 09:12 AM", status: "Pending" },
    { name: "Priya Kumar", meta: "HR-003 · Human Resources", action: "Employee invited", when: "16 Oct 2026, 08:45 AM", status: "Success" },
    { name: "Rohan Thakur", meta: "MKT-007 · Marketing", action: "Schedule assigned", when: "15 Oct 2026, 04:20 PM", status: "Success" },
    { name: "Sneha Nair", meta: "PROD-012 · Product", action: "Exception submitted", when: "15 Oct 2026, 11:10 AM", status: "Pending" },
    { name: "Vikram Kapoor", meta: "OPS-005 · Operations", action: "Asset assigned (MacBook Air)", when: "14 Oct 2026, 03:30 PM", status: "Success" },
  ],
  departments: [
    ["Engineering", 32], ["Operations", 24], ["Product & Design", 18], ["Sales & Marketing", 16],
    ["Human Resources", 12], ["Customer Support", 10], ["Finance & Accounts", 8], ["Administration", 8],
  ],
};

const STATUS_CLASS = {
  Pending: "status-pending",
  Approved: "status-completed",
  Success: "status-completed",
  Rejected: "status-rejected",
};

/* ------------------------------------------------------------------
   Small components
   ------------------------------------------------------------------ */
function StatCard({ icon, tone, label, value, note, noteClass, onClick }) {
  return (
    <button type="button" className="admin-stat-card" onClick={onClick}>
      <span className={`admin-stat-icon ${tone}`}><Icon name={icon} size={24} /></span>
      <span className="admin-stat-body">
        <p>{label}</p>
        <h3>{value ?? "—"}</h3>
        <small className={noteClass}>{note}</small>
      </span>
      <span className="admin-stat-arrow"><Icon name="chevron" size={18} /></span>
    </button>
  );
}

function StackedChart({ data }) {
  const W = 640, H = 240, L = 36, R = 10, T = 12, B = 36;
  const max = 120;
  const slot = (W - L - R) / data.length;
  const barW = slot * 0.5;
  const y = (v) => T + (H - T - B) * (1 - v / max);

  const labels = useMemo(() => {
    const out = [];
    for (let i = data.length - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push([
        d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        d.toLocaleDateString("en-GB", { weekday: "short" }),
      ]);
    }
    return out;
  }, [data.length]);

  return (
    <>
      <svg className="admin-chart hr-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Attendance and leave for the last 7 days">
        {[0, 30, 60, 90, 120].map((g) => (
          <g key={g}>
            <line className="grid" x1={L} x2={W - R} y1={y(g)} y2={y(g)} />
            <text x={L - 8} y={y(g) + 4} textAnchor="end">{g}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = L + i * slot + (slot - barW) / 2;
          const p = d.present;
          const l = d.present + d.leave;
          const a = l + d.absent;
          return (
            <g key={i}>
              <rect className="bar-absent" x={x} y={y(a)} width={barW} height={y(l) - y(a)} rx="3" />
              <rect className="bar-leave" x={x} y={y(l)} width={barW} height={y(p) - y(l)} />
              <rect className="bar-present" x={x} y={y(p)} width={barW} height={y(0) - y(p)} />
              <text x={x + barW / 2} y={H - 18} textAnchor="middle">
                <tspan x={x + barW / 2}>{labels[i][0]}</tspan>
                <tspan x={x + barW / 2} dy="13">{labels[i][1]}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
      <div className="hr-legend">
        <span><i className="dot-present" /> Present</span>
        <span><i className="dot-leave" /> On Leave</span>
        <span><i className="dot-absent" /> Absent</span>
      </div>
    </>
  );
}

function NotConnected({ title, text }) {
  return (
    <div className="hr-api-notice" role="status">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

/* ------------------------------------------------------------------
   Pages
   ------------------------------------------------------------------ */
function OverviewPage({ name, stats, departments, go }) {
  const first = (name || "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date();
  const demo = SHOW_DEMO_DATA ? DEMO : null;

  return (
    <>
      <section className="admin-welcome-banner">
        <span className="admin-welcome-icon"><Icon name="sun" size={26} /></span>
        <div className="admin-welcome-copy">
          <h2>{greeting}, {first}</h2>
          <p>Here&rsquo;s what&rsquo;s happening with your people today.</p>
        </div>
        <div className="admin-welcome-date">
          <span>{today.toLocaleDateString("en-GB", { weekday: "long" })}</span>
          <strong>{today.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong>
          <small>Have a productive day!</small>
        </div>
      </section>

      <section className="admin-summary-grid" aria-label="Summary">
        <StatCard
          icon="users" tone="green" label="Total Employees"
          value={stats.total}
          note={stats.totalIsReal ? "From employee records" : demo ? `+${demo.joined} this month` : "No records yet"}
          noteClass={!stats.totalIsReal && demo ? "up" : ""}
          onClick={() => go("employees")}
        />
        <StatCard
          icon="calendar" tone="green" label="Present Today"
          value={demo?.present}
          note={demo ? `${Math.round((demo.present / demo.totalEmployees) * 100)}% of total` : "Attendance API not connected"}
          onClick={() => go("attendance")}
        />
        <StatCard
          icon="plane" tone="blue" label="On Leave Today"
          value={demo?.onLeave}
          note={demo ? `${Math.round((demo.onLeave / demo.totalEmployees) * 100)}% of total` : "Leave API not connected"}
          onClick={() => go("leave")}
        />
        <StatCard
          icon="userplus" tone="amber" label="Pending Invitations"
          value={demo?.invitations}
          note={demo ? "Awaiting response" : "Not connected"}
          onClick={() => go("employees")}
        />
        <StatCard
          icon="alert" tone="red" label="Open Exceptions"
          value={demo?.exceptions}
          note={demo ? "Require review" : "Exceptions API not connected"}
          onClick={() => go("exceptions")}
        />
      </section>

      <div className="admin-row">
        <section className="admin-panel" aria-labelledby="ao-title">
          <div className="admin-panel-heading">
            <div>
              <h2 id="ao-title">Attendance Overview</h2>
              <p>Check-in and leave status for the last 7 days</p>
            </div>
            <select className="admin-select" defaultValue="7" aria-label="Date range">
              <option value="7">Last 7 days</option>
            </select>
          </div>
          {demo ? (
            <StackedChart data={demo.attendance} />
          ) : (
            <p className="admin-note">Attendance data will appear here once the attendance API is connected.</p>
          )}
        </section>

        <section className="admin-panel" aria-labelledby="lr-title">
          <div className="admin-panel-heading">
            <div>
              <h2 id="lr-title">Leave Requests</h2>
              <p>Latest requests waiting for review</p>
            </div>
            <button type="button" className="admin-link-button" onClick={() => go("leave")}>
              View all <Icon name="arrow" size={14} />
            </button>
          </div>
          {demo ? (
            <div className="hr-leave-list">
              {demo.leaves.map((row, i) => (
                <div className="hr-leave-item" key={row.name}>
                  <span className="admin-person-avatar" style={{ background: AVATAR_TONES[i % AVATAR_TONES.length] }}>
                    {initialsOf(row.name)}
                  </span>
                  <span className="hr-leave-copy">
                    <strong>{row.name}</strong>
                    <small>{row.info}</small>
                  </span>
                  <span className={`admin-status ${STATUS_CLASS[row.status]}`}>{row.status}</span>
                  <small className="hr-leave-ago">{row.ago}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-note">Leave request review is not connected to an API yet.</p>
          )}
        </section>
      </div>

      <div className="admin-row">
        <section className="admin-panel" aria-labelledby="ra-title">
          <div className="admin-panel-heading">
            <div>
              <h2 id="ra-title">Recent Activity</h2>
              <p>Latest actions across HR operations</p>
            </div>
          </div>
          {demo ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>EMPLOYEE</th><th>ACTION</th><th>DATE &amp; TIME</th><th>STATUS</th></tr></thead>
                <tbody>
                  {demo.activity.map((row, i) => (
                    <tr key={row.name + i}>
                      <td>
                        <div className="admin-person">
                          <span className="admin-person-avatar" style={{ background: AVATAR_TONES[i % AVATAR_TONES.length] }}>
                            {initialsOf(row.name)}
                          </span>
                          <span><strong>{row.name}</strong><small>{row.meta}</small></span>
                        </div>
                      </td>
                      <td>{row.action}</td>
                      <td>{row.when}</td>
                      <td><span className={`admin-status ${STATUS_CLASS[row.status]}`}>{row.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-note">No recent activity to show yet.</p>
          )}
        </section>

        <section className="admin-panel" aria-labelledby="dept-title">
          <div className="admin-panel-heading">
            <div>
              <h2 id="dept-title">Employees by Department</h2>
              <p>Total employees across departments</p>
            </div>
            <button type="button" className="admin-link-button" onClick={() => go("employees")}>
              View all <Icon name="arrow" size={14} />
            </button>
          </div>
          {departments.length ? (
            <div className="admin-dept-list">
              {departments.map(([dept, count]) => {
                const top = Math.max(...departments.map((d) => d[1]));
                return (
                  <div className="admin-dept-row" key={dept}>
                    <span>{dept}</span>
                    <div className="admin-dept-bar"><span style={{ width: `${(count / top) * 100}%` }} /></div>
                    <b>{count}</b>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="admin-note">Department counts will appear once employee records are available.</p>
          )}
        </section>
      </div>
    </>
  );
}

function EmployeesPage({ employees, loading, error, onRefresh }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");

  const statuses = useMemo(
    () => [...new Set(employees.map((e) => e.status).filter((s) => s && s !== "—"))],
    [employees],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      const matchStatus = status === "ALL" || e.status === status;
      const matchQuery =
        !q || [e.code, e.name, e.email, e.department, e.designation].some((v) => String(v).toLowerCase().includes(q));
      return matchStatus && matchQuery;
    });
  }, [employees, query, status]);

  return (
    <section className="admin-panel">
      <div className="admin-page-intro">
        <div>
          <h2>Employee Overview</h2>
          <p>Search and filter employee information from the backend.</p>
        </div>
        <div className="hr-button-row">
          <button type="button" className="admin-secondary-button" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh records"}
          </button>
          <button type="button" className="admin-secondary-button" onClick={() => navigate("/employees")}>
            Open directory
          </button>
          <button type="button" className="admin-primary-button" onClick={() => navigate("/employees/new")}>
            <Icon name="userplus" size={18} /> Add employee
          </button>
        </div>
      </div>

      <div className="hr-filters">
        <div className="hr-filter-field">
          <label htmlFor="emp-search">Search employees</label>
          <input
            id="emp-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, code, email, department…"
          />
        </div>
        <div className="hr-filter-field">
          <label htmlFor="emp-status">Employment status</label>
          <select id="emp-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ALL">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {error && <div role="alert" className="admin-form-error">{error}</div>}

      <p className="admin-note hr-count">
        {loading ? "Loading employee records…" : `Showing ${filtered.length} of ${employees.length} employee records.`}
      </p>

      {!loading && filtered.length === 0 ? (
        <p className="admin-note">No employee records match your filters.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>EMPLOYEE CODE</th><th>EMPLOYEE</th><th>EMAIL</th><th>DEPARTMENT</th><th>DESIGNATION</th><th>STATUS</th></tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={e.id}>
                  <td>{e.code}</td>
                  <td>
                    <div className="admin-person">
                      <span className="admin-person-avatar" style={{ background: AVATAR_TONES[i % AVATAR_TONES.length] }}>
                        {initialsOf(e.name)}
                      </span>
                      <strong>{e.name}</strong>
                    </div>
                  </td>
                  <td>{e.email}</td>
                  <td>{e.department}</td>
                  <td>{e.designation}</td>
                  <td><span className="admin-status status-ontime">{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ExceptionsPage() {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [issueFilter, setIssueFilter] = useState("ALL");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(EXCEPTIONS_ENDPOINT));
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!EXCEPTIONS_ENDPOINT) return undefined;
    let cancelled = false;
    apiClient
      .get(EXCEPTIONS_ENDPOINT)
      .then((res) => !cancelled && setItems(getArrayResponse(res)))
      .catch((err) => !cancelled && setError(getErrorMessage(err, "Could not load exception requests.")))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const statusOf = (r) => r.status_label || r.review_status || "PENDING";
  const issueOf = (r) => r.exception_type;

  const filtered = items.filter(
    (r) =>
      (statusFilter === "ALL" || statusOf(r) === statusFilter) &&
      (issueFilter === "ALL" || issueOf(r) === issueFilter),
  );

  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>Attendance Exceptions</h2>
          <p>Review reported attendance issues, such as missed check-ins or incorrect records.</p>
        </div>
        {!EXCEPTIONS_ENDPOINT && <span className="hr-connection-status">API not connected</span>}
      </div>

      {!EXCEPTIONS_ENDPOINT && (
        <NotConnected
          title="Exception requests are not connected yet."
          text="Real exception records cannot be loaded or updated until the backend provides the required API."
        />
      )}
      {error && <div role="alert" className="admin-form-error">{error}</div>}

      <div className="hr-filters">
        <div className="hr-filter-field">
          <label htmlFor="ex-status">Filter by status</label>
          <select id="ex-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div className="hr-filter-field">
          <label htmlFor="ex-issue">Filter by issue</label>
          <select id="ex-issue" value={issueFilter} onChange={(e) => setIssueFilter(e.target.value)}>
            <option value="ALL">All issue types</option>
            <option value="MISSED_CHECK_IN">Missed check-in</option>
            <option value="MISSED_CHECK_OUT">Missed check-out</option>
            <option value="INCORRECT_HOURS">Incorrect work hours</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      <div className="hr-exceptions-layout">
        <div className="hr-box">
          <div className="hr-box-heading">
            <h3>Exception requests</h3>
            <small>{filtered.length} records</small>
          </div>
          {loading ? (
            <p className="admin-note">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="hr-empty">
              <span className="hr-empty-icon"><Icon name="alert" size={22} /></span>
              <h4>No exception records available</h4>
              <p>{EXCEPTIONS_ENDPOINT ? "Nothing matches the selected filters." : "Connect the attendance exceptions API to populate this list."}</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>SUBMITTED</th><th>ISSUE</th><th>STATUS</th><th /></tr></thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "—"}</td>
                      <td>{r.exception_label || r.exception_type}</td>
                      <td><span className="admin-status status-pending">{statusOf(r)}</span></td>
                      <td>
                        <button type="button" className="admin-secondary-button hr-small" onClick={() => setSelected(r)}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="hr-box">
          <div className="hr-box-heading"><h3>Request details</h3></div>
          {selected ? (
            <div className="hr-detail">
              <p><b>Issue</b><br />{selected.exception_label || selected.exception_type}</p>
              <p><b>Description</b><br />{selected.reason}</p>
              <p><b>Status</b><br />{statusOf(selected)}</p>
              <p className="admin-note">Approve and reject actions are unavailable until a backend workflow is provided.</p>
            </div>
          ) : (
            <div className="hr-empty">
              <span className="hr-empty-icon"><Icon name="search" size={22} /></span>
              <h4>No request selected</h4>
              <p>When real requests are available, select one from the list to review its details here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ProfilePage({ user, name }) {
  return (
    <section className="admin-panel">
      <div className="admin-page-intro">
        <div>
          <h2>{name}</h2>
          <p>{roleLabel(user?.role)} · {user?.email || "No email on file"}</p>
        </div>
      </div>
    </section>
  );
}

function ComingSoon({ title, text }) {
  return (
    <section className="admin-panel admin-settings-placeholder">
      <span className="admin-settings-icon"><Icon name="gear" size={26} /></span>
      <h2>{title}</h2>
      <p>{text || "This section is not set up yet. It will appear here once its backend is connected."}</p>
    </section>
  );
}

/* ------------------------------------------------------------------
   Main component
   ------------------------------------------------------------------ */
function HRDashboard({ user, onLogout }) {
  const name = userDisplayName(user);

  const [section, setSection] = useState("overview");
  const [bellOpen, setBellOpen] = useState(false);

  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [empError, setEmpError] = useState("");

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true);
    setEmpError("");
    try {
      const res = await apiClient.get(EMPLOYEES_ENDPOINT);
      setEmployees(getArrayResponse(res).map(normalizeEmployee));
    } catch (error) {
      setEmployees([]);
      setEmpError(getErrorMessage(error, "Could not load employee records."));
    } finally {
      setEmpLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadEmployees());
  }, [loadEmployees]);

  // Real department counts from employee records.
  const departments = useMemo(() => {
    const counts = {};
    employees.forEach((e) => {
      if (e.department && e.department !== "—") counts[e.department] = (counts[e.department] || 0) + 1;
    });
    const real = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (real.length) return real;
    return SHOW_DEMO_DATA ? DEMO.departments : [];
  }, [employees]);

  const stats = useMemo(() => {
    if (employees.length) return { total: employees.length, totalIsReal: true };
    return { total: SHOW_DEMO_DATA ? DEMO.totalEmployees : null, totalIsReal: false };
  }, [employees]);

  const unread = SHOW_DEMO_DATA ? DEMO.invitations + DEMO.exceptions : 0;
  const [title, subtitle] = PAGE_META[section];

  function renderPage() {
    switch (section) {
      case "overview":
        return <OverviewPage name={name} stats={stats} departments={departments} go={setSection} />;
      case "employees":
        return <EmployeesPage employees={employees} loading={empLoading} error={empError} onRefresh={loadEmployees} />;
      case "exceptions":
        return <ExceptionsPage />;
      case "leave":
        return <ComingSoon title="Leave Management" text="Leave request review is not connected to an operational API yet." />;
      case "profile":
        return <ProfilePage user={user} name={name} />;
      default:
        return <ComingSoon title={title} />;
    }
  }

  return (
    <div className="admin-dashboard hr-dashboard">
      <aside className="admin-sidebar" style={{ backgroundImage: `url(${loginDarkTeal})` }}>
        <a className="admin-brand" href="/hr" onClick={(e) => { e.preventDefault(); setSection("overview"); }}>
          <img src={burnettLogo} alt="BurnettPeople" />
          <span>YOUR PEOPLE. YOUR FUTURE.</span>
        </a>

        <nav className="admin-nav" aria-label="HR sections">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-nav-link${section === item.id ? " active" : ""}`}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              <span className="admin-nav-icon"><Icon name={item.icon} size={22} /></span>
              {item.label}
              {item.badge && unread > 0 && <span className="admin-nav-badge">{Math.min(unread, 99)}</span>}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-sidebar-tagline">
            <span>Building better workplaces together.</span>
            <span className="admin-tagline-arrow"><Icon name="arrow" size={16} /></span>
          </div>
          <div className="admin-sidebar-profile">
            <span className="admin-profile-avatar">{userInitials(user)}</span>
            <span className="admin-profile-details">
              <strong>{name}</strong>
              <small>{roleLabel(user?.role)}</small>
            </span>
            <span className="admin-online-dot" title="Online" />
          </div>
          <button type="button" className="admin-sidebar-logout" onClick={onLogout}>
            <Icon name="logout" size={18} /> Log out
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header-heading">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="admin-header-actions">
            <label className="admin-search">
              <Icon name="search" size={18} />
              <input type="search" placeholder="Search employees, leaves, schedules..." aria-label="Search" />
              <kbd>Ctrl + K</kbd>
            </label>

            <div className="admin-notification-wrap">
              <button
                type="button"
                className="admin-notification-button"
                onClick={() => setBellOpen((o) => !o)}
                aria-label="Notifications"
                aria-expanded={bellOpen}
              >
                <Icon name="bell" size={20} />
                {unread > 0 && <span className="admin-notification-count">{Math.min(unread, 99)}</span>}
              </button>
              {bellOpen && (
                <div className="admin-notification-popover" role="status">
                  {unread > 0 ? `You have ${unread} items waiting for your action.` : "You're all caught up."}
                </div>
              )}
            </div>

            <div className="admin-header-profile">
              <span className="admin-topbar-avatar">{userInitials(user)}</span>
              <span className="admin-topbar-user-details">
                <strong>{name}</strong>
                <small>{roleLabel(user?.role)}</small>
              </span>
            </div>
          </div>
        </header>

        <main className="admin-workspace" style={{ backgroundImage: `url(${loginSoftMint})` }}>
          {renderPage()}
          <footer className="admin-footer">
            <span>© 2026 BurnettPeople</span>
            <span>HR workspace</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default HRDashboard;