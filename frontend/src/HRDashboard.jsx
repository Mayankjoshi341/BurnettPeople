import { useMemo, useState } from "react";
import StatusUpdates from "./StatusUpdates";
import { userDisplayName } from "./auth/userDisplay";
import DashboardShell from "./DashboardShell";
import { Icon } from "./DashboardIcons";
import MyPeople from "./MyPeople";
import HREmployeeManagement from "./HREmployeeManagement";
import HREmployeeOnboarding from "./HREmployeeOnboarding";
import HRAssets from "./HRAssets";
import HRSettings from "./HRSettings";
import HRProfile from "./HRProfile";
import HRAttendance from "./HRAttendance";
import HRExceptionReview from "./HRExceptionReview";
import {
  AVATAR_TONES,
  SHOW_DEMO_DATA,
  initialsOf,
  useEmployees,
} from "./dashboardUtils";
import "./HRDashboard.css"; // HR overview additions
import "./HRPages.css"; // Employee Management / Onboarding / Assets / Settings / Profile

/* ------------------------------------------------------------------
   Navigation
   ------------------------------------------------------------------ */
const NAV = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "people", label: "My People", icon: "people" },
  { id: "employees", label: "Employees", icon: "users" },
  { id: "onboarding", label: "Onboarding", icon: "userplus" },
  { id: "attendance", label: "Attendance & Breaks", icon: "clock" },
  { id: "exceptions", label: "Exception Reviews", icon: "alert" },
  { id: "leave", label: "Leave Management", icon: "plane" },
  { id: "assets", label: "Assets & Devices", icon: "laptop" },
  { id: "reports", label: "Reports", icon: "chart" },
  { id: "settings", label: "HR Settings", icon: "gear" },
  { id: "notifications", label: "Notifications", icon: "bell", badge: true },
  { id: "profile", label: "My Profile", icon: "user" },
  { id: "status-updates", label: "Work Status Updates", icon: "file" },
];

const PAGE_META = {
  overview: ["HR Dashboard", "Manage people, attendance, leave and more."],
  people: ["My People", "Explore your organization, connect with colleagues and celebrate achievements."],
  employees: ["Employee Management", "Manage employees, assign managers, update details and control access."],
  onboarding: ["Employee Onboarding", "Add a new employee to your organization and send an invitation."],
  attendance: ["Attendance Overview", "View today's attendance, break activity and the last 7 days at a glance."],
  exceptions: ["Exception Review", "Review and approve employee attendance and break exceptions."],
  leave: ["Leave Management", "Review and track leave requests."],
  assets: ["Assets & Devices", "View company devices, assign them to employees and track assignments."],
  reports: ["Reports", "Workforce and attendance reports."],
  settings: ["HR Settings", "Manage company policies, time-off rules, assets, schedules and other HR configurations."],
  notifications: ["Notifications", "Everything that needs your attention."],
  profile: ["My Profile", "View and manage your personal, work and HR information."],
  "status-updates": [
  "Work Status Updates",
  "Record completed work, current focus, testing, tech stack and blockers.",],
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
  const { employees } = useEmployees();

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
      case "people":
        return <MyPeople canAdd onAdd={() => setSection("onboarding")} />;
      case "employees":
        return <HREmployeeManagement onAdd={() => setSection("onboarding")} />;
      case "onboarding":
        return <HREmployeeOnboarding onBack={() => setSection("employees")} onDone={() => setSection("employees")} />;
      case "attendance":
        return <HRAttendance onOpenExceptions={() => setSection("exceptions")} />;
      case "exceptions":
        return <HRExceptionReview />;
      case "assets":
        return <HRAssets />;
      case "settings":
        return <HRSettings />;
      case "profile":
        return <HRProfile user={user} />;
      case "leave":
        return <ComingSoon title="Leave Management" text="Leave request review is not connected to an operational API yet." />;
      case "status-updates": return <StatusUpdates user={user} />;
      default:
        return <ComingSoon title={title} />;
    }
  }

  return (
    <DashboardShell
      rootClass="hr-dashboard"
      user={user}
      onLogout={onLogout}
      nav={NAV}
      section={section}
      setSection={setSection}
      title={title}
      subtitle={subtitle}
      searchPlaceholder="Search employees, leaves, schedules..."
      unread={unread}
      homePath="/hr"
      footerLabel="HR workspace"
    >
      {renderPage()}
    </DashboardShell>
  );
}

export default HRDashboard;