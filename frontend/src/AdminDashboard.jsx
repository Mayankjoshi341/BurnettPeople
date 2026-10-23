import { useEffect, useMemo, useState } from "react";
import StatusUpdates from "./StatusUpdates";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import AdminAssets from "./AdminAssets";
import AdminAuditLogs from "./AdminAuditLogs";
import AdminCompanySettings from "./AdminCompanySettings";
import AdminEmployees from "./AdminEmployees";
import AdminReports from "./AdminReports";
import AdminHRManagers from "./AdminHRManagers"; // NEW: HR & Manager Overview
import AdminLeave from "./AdminLeave"; // NEW: Leave Management
import MyPeople from "./MyPeople";
import "./AdminDashboard.css";
import "./AdminPages.css";
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
   Navigation (reference design)
   ------------------------------------------------------------------ */
const NAV = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "employees", label: "Employees", icon: "users" },
  { id: "people", label: "My People", icon: "people" },
  { id: "hr-roles", label: "HR & Manager Management", icon: "shield" },
  { id: "company", label: "Company Settings", icon: "building" },
  { id: "attendance", label: "Attendance & Breaks", icon: "clock" },
  { id: "exceptions", label: "Exception Reviews", icon: "alert" },
  { id: "leave", label: "Leave Management", icon: "plane" },
  { id: "assets", label: "Assets & Devices", icon: "laptop" },
  { id: "reports", label: "Reports", icon: "file" },
  { id: "audit", label: "Audit Logs", icon: "lock" },
  { id: "notifications", label: "Notifications", icon: "bell", badge: true },
  { id: "status-updates", label: "Work Status Updates", icon: "file" },
  // { id: "settings", label: "Settings", icon: "gear" },
];

const PAGE_META = {
  overview: ["Admin Dashboard", "Your people, your operations, one place."],
  employees: ["Employee Management", "View employees, review details and update managers, roles and status."],
  people: ["My People", "Explore your organization, connect with colleagues and celebrate achievements."],
  "hr-roles": ["HR & Manager Overview", "Manage HR employees, assign managers, and view reporting structure."],
  company: ["Company Settings", "Manage your organization structure, roles, locations, schedules and basic information."],
  departments: ["Company Settings", "Manage your organization structure, roles, locations, schedules and basic information."],
  schedules: ["Company Settings", "Manage your organization structure, roles, locations, schedules and basic information."],
  attendance: ["Attendance & Breaks", "Track check-ins, breaks and hours."],
  exceptions: ["Exception Reviews", "Resolve attendance exceptions."],
  leave: ["Leave Management", "Review and manage HR leave requests and manager leave requests."],
  assets: ["Assets & Devices", "Manage company devices and equipment, and track their status."],
  reports: ["Reports", "View attendance, leave and workplace activity reports by date."],
  audit: ["Audit Logs", "Track all activities and changes happening in the system. Monitor user actions, data changes, and security events."],
  notifications: ["Notifications", "Everything that needs your attention."],
  settings: ["Settings", "Company preferences and configuration."],
  "status-updates": [
  "Work Status Updates",
  "Record completed work, current focus, testing, tech stack and blockers.",
],
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
  // "departments" / "schedules" (used by Overview shortcuts) live inside Company Settings
  const activeNav = section === "departments" || section === "schedules" ? "company" : section;

  function renderPage() {
    switch (section) {
      case "overview": return <OverviewPage user={user} data={data} go={setSection} />;
      case "employees": return <AdminEmployees />;
      case "people": return <MyPeople />;
      case "hr-roles":
        return (
          <AdminHRManagers
            adminName={displayName}
            onAddHr={() => setHrOpen(true)}
            onOpenAudit={() => setSection("audit")}
          />
        );
      case "company":
      case "departments": return <AdminCompanySettings key={section} initialTab="departments" />;
      case "schedules": return <AdminCompanySettings key={section} initialTab="schedules" />;
      case "leave": return <AdminLeave />;
      case "assets": return <AdminAssets />;
      case "reports": return <AdminReports />;
      case "audit": return <AdminAuditLogs />;
      case "status-updates": return <StatusUpdates user={user} />;
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
              className={`admin-nav-link${activeNav === item.id ? " active" : ""}`}
              aria-current={activeNav === item.id ? "page" : undefined}
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