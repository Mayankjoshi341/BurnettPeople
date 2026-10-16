import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import apiClient from "./api/client";
import "./AdminDashboard.css";
import burnettLogo from "./assets/burnettpeople-logo.png";
import loginDarkTeal from "./assets/login-dark-teal.png";
import loginSoftMint from "./assets/login-soft-mint.png";

/* ------------------------------------------------------------------
   SETTINGS YOU MAY NEED TO CHANGE
   ------------------------------------------------------------------ */
// true  = reference-style sample numbers (for design preview only)
// false = real data only; cards show "—" until your metrics API responds
const SHOW_DEMO_DATA = true;

// Backend endpoints - change to match your Django URLs
const METRICS_ENDPOINT = "/admin/metrics/";
const HR_CREATE_ENDPOINT = "/auth/hr-users/";

/* ------------------------------------------------------------------
   Icons (inline SVG, no extra package needed)
   ------------------------------------------------------------------ */
const ICONS = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  users: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  building: "M4 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M14 9h5a1 1 0 0 1 1 1v11M2 21h20M8 7h2M8 11h2M8 15h2",
  calendar: "M3 5h18v16H3zM3 10h18M8 3v4M16 3v4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  alert: "M12 3L2 21h20L12 3zM12 10v4M12 17.5v.01",
  plane: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  laptop: "M4 5h16v11H4zM2 20h20",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  chevron: "M9 6l6 6-6 6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  check: "M5 12l5 5L20 7",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  userplus: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6",
};

function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ------------------------------------------------------------------
   Navigation (reference design)
   ------------------------------------------------------------------ */
const NAV = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "employees", label: "Employees", icon: "users" },
  { id: "hr-roles", label: "HR & Roles", icon: "shield" },
  { id: "departments", label: "Departments & Designations", icon: "building" },
  { id: "schedules", label: "Work Schedules", icon: "calendar" },
  { id: "attendance", label: "Attendance & Breaks", icon: "clock" },
  { id: "exceptions", label: "Exception Reviews", icon: "alert" },
  { id: "leave", label: "Leave Management", icon: "plane" },
  { id: "assets", label: "Assets & Devices", icon: "laptop" },
  { id: "notifications", label: "Notifications", icon: "bell", badge: true },
  { id: "settings", label: "Settings", icon: "gear" },
];

const PAGE_META = {
  overview: ["Admin Dashboard", "Your people, your operations, one place."],
  employees: ["Employees", "Browse and manage the employee directory."],
  "hr-roles": ["HR & Roles", "Onboard HR users and review access roles."],
  departments: ["Departments & Designations", "Organize teams and job titles."],
  schedules: ["Work Schedules", "Assign and review shift schedules."],
  attendance: ["Attendance & Breaks", "Track check-ins, breaks and hours."],
  exceptions: ["Exception Reviews", "Resolve attendance exceptions."],
  leave: ["Leave Management", "Approve and track leave requests."],
  assets: ["Assets & Devices", "Track devices issued to employees."],
  notifications: ["Notifications", "Everything that needs your attention."],
  settings: ["Settings", "Company preferences and configuration."],
};

/* ------------------------------------------------------------------
   Demo data (only used when SHOW_DEMO_DATA = true)
   ------------------------------------------------------------------ */
const DEMO = {
  totals: { employees: 128, joinedThisMonth: 8, activeToday: 96, invitations: 7, exceptions: 4 },
  attendance: [60, 70, 52, 85, 90, 104, 96],
  attention: { invitations: 7, exceptions: 4, schedules: 3, assets: 2 },
  activity: [
    { initials: "AS", name: "Aarav Sharma", meta: "ENG-001 · Engineering", event: "Checked in", when: "09:02 AM", status: "On time", tone: "ontime" },
    { initials: "PK", name: "Priya Kumar", meta: "HR-003 · Human Resources", event: "Leave applied (Annual Leave)", when: "08:45 AM", status: "Pending", tone: "pending" },
    { initials: "RT", name: "Rohan Thakur", meta: "MKT-007 · Marketing", event: "Asset assigned (MacBook Air)", when: "Yesterday", status: "Completed", tone: "completed" },
    { initials: "SN", name: "Sneha Nair", meta: "PROD-012 · Product", event: "Invitation sent", when: "Yesterday", status: "Pending", tone: "pending" },
    { initials: "VK", name: "Vikram Kapoor", meta: "OPS-005 · Operations", event: "Schedule updated (General Shift)", when: "2 days ago", status: "Completed", tone: "completed" },
  ],
  departments: [
    ["Engineering", 32], ["Operations", 24], ["Product & Design", 18], ["Sales & Marketing", 16],
    ["Human Resources", 12], ["Customer Support", 10], ["Finance & Accounts", 8], ["Administration", 8],
  ],
};

const AVATAR_TONES = ["#dbeafe", "#fde8dc", "#dcf5ea", "#e9e3fb", "#fff0cf"];

function initialsOf(name = "") {
  return (
    name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "AD"
  );
}

/* ------------------------------------------------------------------
   Small components
   ------------------------------------------------------------------ */
function AttendanceChart({ data }) {
  const W = 640, H = 230, L = 36, R = 12, T = 12, B = 34;
  const max = 120;
  const step = (W - L - R) / (data.length - 1);
  const x = (i) => L + i * step;
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const points = data.map((v, i) => `${x(i)},${y(v)}`);
  const line = `M${points.join(" L")}`;
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  // last 7 days labels ending today
  const labels = useMemo(() => {
    const out = [];
    for (let i = data.length - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push({
        top: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        bottom: d.toLocaleDateString("en-GB", { weekday: "short" }),
      });
    }
    return out;
  }, [data.length]);

  return (
    <svg className="admin-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Attendance trend for the last 7 days">
      <defs>
        <linearGradient id="adAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14a37f" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#14a37f" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 30, 60, 90, 120].map((g) => (
        <g key={g}>
          <line className="grid" x1={L} x2={W - R} y1={y(g)} y2={y(g)} />
          <text x={L - 8} y={y(g) + 4} textAnchor="end">{g}</text>
        </g>
      ))}
      <path className="area" d={area} />
      <path className="line" d={line} />
      {data.map((v, i) => (
        <circle key={i} className="dot" cx={x(i)} cy={y(v)} r="4" />
      ))}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 16} textAnchor="middle">
          <tspan x={x(i)}>{l.top}</tspan>
          <tspan x={x(i)} dy="13">{l.bottom}</tspan>
        </text>
      ))}
    </svg>
  );
}

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

function HRFormModal({ onClose }) {
  const [form, setForm] = useState({ full_name: "", email: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const errors = {};
    if (!form.full_name.trim()) errors.full_name = "Enter the HR user's full name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Enter a valid work email.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setBusy(true);
    try {
      const result = await apiClient.post(HR_CREATE_ENDPOINT, {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        role: "HR",
      });
      setSuccess(result?.detail || "HR user created. An invitation has been sent.");
      setForm({ full_name: "", email: "" });
    } catch (requestError) {
      const fields = requestError?.fieldErrors || {};
      setFieldErrors(
        Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, [].concat(v).join(" ")]))
      );
      setError(requestError?.message || "Could not create the HR user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="hr-form-title">
        <div className="admin-modal-heading">
          <div>
            <h2 id="hr-form-title">Add HR user</h2>
            <p>They will get an email invitation to set their password.</p>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="admin-form-field">
            <label htmlFor="hr-name">Full name</label>
            <input
              id="hr-name"
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              aria-invalid={Boolean(fieldErrors.full_name)}
              autoComplete="off"
            />
            {fieldErrors.full_name && <span className="admin-field-error">{fieldErrors.full_name}</span>}
          </div>

          <div className="admin-form-field">
            <label htmlFor="hr-email">Work email</label>
            <input
              id="hr-email"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              autoComplete="off"
              placeholder="name@company.com"
            />
            {fieldErrors.email && <span className="admin-field-error">{fieldErrors.email}</span>}
          </div>

          <div className="admin-role-preview">
            <span>Role that will be assigned</span>
            <strong>HR</strong>
          </div>

          {error && <div role="alert" className="admin-form-error">{error}</div>}
          {success && <div role="status" className="admin-form-success">{success}</div>}

          <div className="admin-modal-actions">
            <button type="button" className="admin-secondary-button" onClick={onClose}>Close</button>
            <button type="submit" className="admin-primary-button" disabled={busy}>
              {busy ? "Creating…" : "Create HR user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Pages
   ------------------------------------------------------------------ */
function OverviewPage({ user, data, go }) {
  const first = (user?.first_name || user?.full_name || user?.name || "Admin").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date();

  const t = data?.totals;
  const a = data?.attention;

  return (
    <>
      <section className="admin-welcome-banner">
        <span className="admin-welcome-icon"><Icon name="sun" size={26} /></span>
        <div className="admin-welcome-copy">
          <h2>{greeting}, {first}</h2>
          <p>Here&rsquo;s what&rsquo;s happening with your organization today.</p>
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
          value={t?.employees}
          note={t ? `+${t.joinedThisMonth} this month` : "Metrics API not connected"}
          noteClass={t ? "up" : ""}
          onClick={() => go("employees")}
        />
        <StatCard
          icon="calendar" tone="green" label="Active Today"
          value={t?.activeToday}
          note={t ? `${Math.round((t.activeToday / t.employees) * 100)}% of total` : "Metrics API not connected"}
          onClick={() => go("attendance")}
        />
        <StatCard
          icon="plane" tone="amber" label="Pending Invitations"
          value={t?.invitations}
          note={t ? "Awaiting response" : "Metrics API not connected"}
          onClick={() => go("employees")}
        />
        <StatCard
          icon="alert" tone="red" label="Open Exceptions"
          value={t?.exceptions}
          note={t ? "Require review" : "Metrics API not connected"}
          onClick={() => go("exceptions")}
        />
      </section>

      <div className="admin-row">
        <section className="admin-panel" aria-labelledby="wf-title">
          <div className="admin-panel-heading">
            <div>
              <h2 id="wf-title">Workforce Overview</h2>
              <p>Attendance trend for the last 7 days</p>
            </div>
            <select className="admin-select" defaultValue="7" aria-label="Date range">
              <option value="7">Last 7 days</option>
            </select>
          </div>
          {data?.attendance ? (
            <AttendanceChart data={data.attendance} />
          ) : (
            <p className="admin-note">Attendance data will appear here once the metrics API is connected.</p>
          )}
        </section>

        <section className="admin-panel" aria-labelledby="na-title">
          <div className="admin-panel-heading">
            <div>
              <h2 id="na-title">Needs attention</h2>
              <p>Items that require your action</p>
            </div>
            <button type="button" className="admin-link-button" onClick={() => go("notifications")}>
              View all <Icon name="arrow" size={14} />
            </button>
          </div>
          <div className="admin-attention-list">
            {[
              ["plane", "tone-blue", "Invitations awaiting response", "Employees who haven't set their password yet", a?.invitations, "employees"],
              ["alert", "tone-red", "Attendance exceptions", "Require HR review", a?.exceptions, "exceptions"],
              ["calendar", "tone-amber", "Schedule assignments", "Employees without an active schedule", a?.schedules, "schedules"],
              ["laptop", "tone-blue", "Asset returns", "Devices pending return", a?.assets, "assets"],
            ].map(([icon, tone, title, sub, count, target]) => (
              <button key={title} type="button" className="admin-attention-item" onClick={() => go(target)}>
                <span className={`admin-attention-icon ${tone}`}><Icon name={icon} size={20} /></span>
                <span className="admin-attention-copy">
                  <strong>{title}</strong>
                  <small>{sub}</small>
                </span>
                <span className={`admin-count-pill ${tone}`}>{count ?? "—"}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="admin-row">
        <section className="admin-panel" aria-labelledby="ra-title">
          <div className="admin-panel-heading">
            <div>
              <h2 id="ra-title">Recent Activity</h2>
              <p>Latest actions across your organization</p>
            </div>
            <button type="button" className="admin-link-button" onClick={() => go("notifications")}>
              View all <Icon name="arrow" size={14} />
            </button>
          </div>
          {data?.activity?.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>EMPLOYEE</th><th>EVENT</th><th>TIME</th><th>STATUS</th></tr>
                </thead>
                <tbody>
                  {data.activity.map((row, i) => (
                    <tr key={row.name + i}>
                      <td>
                        <div className="admin-person">
                          <span className="admin-person-avatar" style={{ background: AVATAR_TONES[i % AVATAR_TONES.length] }}>
                            {row.initials}
                          </span>
                          <span><strong>{row.name}</strong><small>{row.meta}</small></span>
                        </div>
                      </td>
                      <td>{row.event}</td>
                      <td>{row.when}</td>
                      <td><span className={`admin-status status-${row.tone}`}>{row.status}</span></td>
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
            <button type="button" className="admin-link-button" onClick={() => go("departments")}>
              View all <Icon name="arrow" size={14} />
            </button>
          </div>
          {data?.departments?.length ? (
            <div className="admin-dept-list">
              {data.departments.map(([name, count]) => {
                const top = Math.max(...data.departments.map((d) => d[1]));
                return (
                  <div className="admin-dept-row" key={name}>
                    <span>{name}</span>
                    <div className="admin-dept-bar"><span style={{ width: `${(count / top) * 100}%` }} /></div>
                    <b>{count}</b>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="admin-note">Department data will appear here once the metrics API is connected.</p>
          )}
        </section>
      </div>
    </>
  );
}

function HrRolesPage({ onAddHr }) {
  return (
    <section className="admin-panel">
      <div className="admin-page-intro">
        <div>
          <h2>HR &amp; Roles</h2>
          <p>Start HR onboarding and see what each role can do.</p>
        </div>
        <button type="button" className="admin-primary-button" onClick={onAddHr}>
          <Icon name="userplus" size={18} /> Add HR user
        </button>
      </div>

      <div className="admin-information-panel">
        <span className="admin-info-icon">i</span>
        <div>
          <strong>How access works</strong>
          <p>Admins create HR users. HR users onboard employees. Everyone gets an email to set their own password.</p>
        </div>
      </div>

      <h3 className="admin-subheading">System roles</h3>
      <div className="admin-role-grid">
        {[
          ["role-admin", "Admin", "Full control of users, roles and settings."],
          ["role-hr", "HR", "Onboard employees, manage schedules and leave."],
          ["role-manager", "Manager", "Review team attendance and requests."],
          ["role-employee", "Employee", "View own profile, attendance and leave."],
        ].map(([cls, title, text]) => (
          <article key={title}>
            <span className={`role-dot ${cls}`} />
            <strong>{title}</strong>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function EmployeesPage() {
  const navigate = useNavigate();
  return (
    <section className="admin-panel">
      <div className="admin-page-intro">
        <div>
          <h2>Employees</h2>
          <p>Open the employee directory to search, view and edit profiles.</p>
        </div>
        <button type="button" className="admin-primary-button" onClick={() => navigate("/employees")}>
          Open directory <Icon name="arrow" size={16} />
        </button>
      </div>
    </section>
  );
}

function ComingSoon({ title }) {
  return (
    <section className="admin-panel admin-settings-placeholder">
      <span className="admin-settings-icon"><Icon name="gear" size={26} /></span>
      <h2>{title}</h2>
      <p>This section is not set up yet. It will appear here once its backend is connected.</p>
    </section>
  );
}

/* ------------------------------------------------------------------
   Main component
   ------------------------------------------------------------------ */
export default function AdminDashboard({ user, onLogout }) {
  const [section, setSection] = useState("overview");
  const [hrOpen, setHrOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [data, setData] = useState(SHOW_DEMO_DATA ? DEMO : null);

  const displayName = user?.full_name || user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Admin";
  const roleLabel = user?.role ? user.role.charAt(0) + user.role.slice(1).toLowerCase() : "Admin";
  const unread = data?.attention
    ? data.attention.invitations + data.attention.exceptions + data.attention.schedules + data.attention.assets
    : 0;

  // Try the real metrics endpoint; keep demo/empty state if it fails.
  useEffect(() => {
    if (SHOW_DEMO_DATA) return undefined;
    let cancelled = false;
    apiClient
      .get(METRICS_ENDPOINT)
      .then((res) => !cancelled && res && setData(res))
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const [title, subtitle] = PAGE_META[section];

  function renderPage() {
    switch (section) {
      case "overview": return <OverviewPage user={user} data={data} go={setSection} />;
      case "employees": return <EmployeesPage />;
      case "hr-roles": return <HrRolesPage onAddHr={() => setHrOpen(true)} />;
      default: return <ComingSoon title={title} />;
    }
  }

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar" style={{ backgroundImage: `url(${loginDarkTeal})` }}>
        <a className="admin-brand" href="/admin" onClick={(e) => { e.preventDefault(); setSection("overview"); }}>
          <img src={burnettLogo} alt="BurnettPeople" />
          <span>YOUR PEOPLE. YOUR FUTURE.</span>
        </a>

        <nav className="admin-nav" aria-label="Admin sections">
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
            <span className="admin-profile-avatar">{initialsOf(displayName)}</span>
            <span className="admin-profile-details">
              <strong>{displayName}</strong>
              <small>{roleLabel}</small>
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
              <input type="search" placeholder="Search employees, schedules, leaves..." aria-label="Search" />
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
                  {unread > 0
                    ? `You have ${unread} items waiting for your action.`
                    : "You're all caught up."}
                </div>
              )}
            </div>

            <div className="admin-header-profile">
              <span className="admin-topbar-avatar">{initialsOf(displayName)}</span>
              <span className="admin-topbar-user-details">
                <strong>{displayName}</strong>
                <small>{roleLabel}</small>
              </span>
            </div>
          </div>
        </header>

        <main className="admin-workspace" style={{ backgroundImage: `url(${loginSoftMint})` }}>
          {renderPage()}
          <footer className="admin-footer">
            <span>© 2026 BurnettPeople</span>
            <span>Admin workspace</span>
          </footer>
        </main>
      </div>

      {hrOpen && <HRFormModal onClose={() => setHrOpen(false)} />}
    </div>
  );
}
