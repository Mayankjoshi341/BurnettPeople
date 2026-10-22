import { useMemo, useState } from "react";

import { roleLabel, userDisplayName, userInitials } from "./auth/userDisplay";
import DashboardShell from "./DashboardShell";
import { Icon } from "./DashboardIcons";
import { NotConnected, StatCard, WelcomeBanner } from "./DashboardParts";
import { SHOW_DEMO_DATA, getErrorMessage } from "./dashboardUtils";
import { Av, Pill } from "./AdminUi";
import { BarChart, Donut } from "./ManagerCharts";
import { summarize, useManagerData } from "./ManagerData";
import {
  AssetsPage, AttendancePage, LeavePage, LeaveRows, NotificationsPage,
  ProfilePage, ReportsPage, SchedulePage, TeamPage,
} from "./ManagerPages";
import MyPeople from "./MyPeople";
import { decideLeaveRequest, useLeaveData } from "./features/leave/leaveApi";
import "./AdminPages.css";
import "./ManagerDashboard.css";

const NAV = [
  { id: "overview", label: "Dashboard", icon: "home" },
  { id: "team", label: "My Team", icon: "users" },
  { id: "people", label: "My People", icon: "people" },
  { id: "attendance", label: "Team Attendance", icon: "clock" },
  { id: "leave", label: "Team Leave", icon: "plane" },
  { id: "assets", label: "Team Assets", icon: "laptop" },
  { id: "approvals", label: "Approve Requests", icon: "check", badge: true },
  { id: "schedule", label: "Team Schedule", icon: "calendar" },
  { id: "reports", label: "Reports", icon: "file" },
  { id: "profile", label: "My Profile", icon: "user" },
  { id: "notifications", label: "Notifications", icon: "bell" },
];

const PAGE_META = {
  overview: ["Manager Dashboard", "Your team, their growth, our success."],
  team: ["My Team", "Everyone who reports to you, with today's status."],
  people: ["My People", "Explore your organization, connect with colleagues and celebrate achievements."],
  attendance: ["Team Attendance", "Who is in, out or on leave today."],
  leave: ["Team Leave", "Leave requests from your team."],
  assets: ["Team Assets", "Devices assigned to your team."],
  approvals: ["Approve Requests", "Leave and exception requests waiting for you."],
  schedule: ["Team Schedule", "Shifts for today and tomorrow."],
  reports: ["Team Reports", "View your team's attendance, leave and assets."],
  profile: ["My Profile", "View and manage your personal, work and managerial information."],
  notifications: ["Notifications", "Updates about your team."],
};

function Overview({ data, go, onDecide, name }) {
  const s = summarize(data.team);
  const leaves = data.leaves || [];
  const pending = leaves.filter((l) => l.status === "Pending");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function decide(id, action) {
    setBusy(id + action); setError("");
    try { await onDecide(id, action); } catch (e) { setError(getErrorMessage(e, "Could not update this request.")); } finally { setBusy(""); }
  }

  const parts = [["Present", s.present, "#1f9d73"], ["On Leave", s.leave, "#a9cdf5"], ["Absent", s.absent, "#d5dbe0"]];

  return (
    <>
      <WelcomeBanner name={name} text="Here's what's happening with your team today." />

      <section className="admin-summary-grid mgr-five" aria-label="Team summary">
        <StatCard icon="users" tone="green" label="My Team" value={data.team ? s.total : null} note="Active members" onClick={() => go("team")} />
        <StatCard icon="calendar" tone="green" label="Present Today" value={data.team ? s.present : null} note={data.team ? `${Math.round(s.pct(s.present))}% of team` : "Not connected"} onClick={() => go("attendance")} />
        <StatCard icon="plane" tone="blue" label="On Leave Today" value={data.team ? s.leave : null} note={data.team ? `${Math.round(s.pct(s.leave))}% of team` : "Not connected"} onClick={() => go("leave")} />
        <StatCard icon="alert" tone="red" label="Pending Approvals" value={data.leaves ? pending.length : null} note="Leave requests" onClick={() => go("approvals")} />
        <StatCard icon="laptop" tone="blue" label="Assigned Assets" value={data.assets ? data.assets.length : null} note="Team devices" onClick={() => go("assets")} />
      </section>

      <div className="mgr-grid-main">
        <section className="admin-panel" aria-labelledby="mt-title">
          <div className="admin-panel-heading">
            <div><h2 id="mt-title">Team Attendance</h2><p>Attendance trend for the last 7 days</p></div>
            <select className="admin-select" defaultValue="7" aria-label="Date range"><option value="7">Last 7 days</option></select>
          </div>
          {data.week?.length ? (
            <>
              <BarChart data={data.week} />
              <div className="mgr-legend">{parts.map(([n, , c]) => <span key={n}><i style={{ background: c }} /> {n}</span>)}</div>
            </>
          ) : <p className="admin-note">Attendance data will appear here once the manager API is connected.</p>}
        </section>

        <section className="admin-panel" aria-labelledby="ls-title">
          <div className="admin-panel-heading">
            <div><h2 id="ls-title">Team Leave Summary</h2></div>
            <button type="button" className="admin-link-button" onClick={() => go("reports")}>View all <Icon name="arrow" size={13} /></button>
          </div>
          {data.team?.length ? (
            <div className="mgr-donut-row">
              <Donut total={s.total} parts={parts} label="Team Members" />
              <ul className="ap-donut-legend">
                {parts.map(([n, v, c]) => <li key={n}><i style={{ background: c }} /><span>{n}</span><b>{v}</b><em>({Math.round(s.pct(v))}%)</em></li>)}
              </ul>
            </div>
          ) : <p className="admin-note">No team data yet.</p>}
        </section>
      </div>

      <div className="mgr-grid-main">
        <section className="admin-panel" aria-labelledby="lr-title">
          <div className="admin-panel-heading">
            <div><h2 id="lr-title">Leave Requests for Review</h2></div>
            <button type="button" className="admin-link-button" onClick={() => go("approvals")}>View all <Icon name="arrow" size={13} /></button>
          </div>
          {error && <div role="alert" className="admin-form-error">{error}</div>}
          {pending.length ? <LeaveRows rows={pending.slice(0, 5)} busy={busy} onDecide={decide} /> : <p className="admin-note">No requests are waiting for your review.</p>}
        </section>

        <section className="admin-panel" aria-labelledby="ta-title">
          <div className="admin-panel-heading">
            <div><h2 id="ta-title">Team Activity</h2></div>
            <button type="button" className="admin-link-button" onClick={() => go("notifications")}>View all <Icon name="arrow" size={13} /></button>
          </div>
          {data.activity?.length ? (
            <ul className="mgr-activity">
              {data.activity.map((a, i) => <li key={i}><span className="mgr-act-icon"><Icon name={a.icon} size={18} /></span><span><strong>{a.title}</strong><small>{a.when}</small></span></li>)}
            </ul>
          ) : <p className="admin-note">No recent team activity.</p>}
        </section>
      </div>

      <div className="mgr-grid-lower">
        <section className="admin-panel" aria-labelledby="us-title">
          <div className="admin-panel-heading">
            <div><h2 id="us-title">Upcoming Team Schedule</h2></div>
            <button type="button" className="admin-link-button" onClick={() => go("schedule")}>View all <Icon name="arrow" size={13} /></button>
          </div>
          {data.schedule?.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>EMPLOYEE</th><th>TODAY</th><th>TOMORROW</th><th>STATUS</th></tr></thead>
                <tbody>{data.schedule.slice(0, 3).map((r, i) => (
                  <tr key={r.name}>
                    <td><div className="ap-person"><Av name={r.name} i={i} size={30} /><span><strong>{r.name}</strong><small>{r.department}</small></span></div></td>
                    <td>{r.today}</td><td>{r.tomorrow}</td><td><Pill>{r.status}</Pill></td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          ) : <p className="admin-note">Schedules will appear here once available.</p>}
        </section>

        <section className="admin-panel" aria-labelledby="as-title">
          <div className="admin-panel-heading">
            <div><h2 id="as-title">Team Assets</h2></div>
            <button type="button" className="admin-link-button" onClick={() => go("assets")}>View all <Icon name="arrow" size={13} /></button>
          </div>
          {data.assets?.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>DEVICE</th><th>EMPLOYEE</th><th>ASSIGNED ON</th><th>STATUS</th></tr></thead>
                <tbody>{data.assets.slice(0, 3).map((a) => (
                  <tr key={a.id}>
                    <td><div className="ap-person"><span className="ap-dev-icon"><Icon name="laptop" size={15} /></span><strong>{a.device}</strong></div></td>
                    <td><strong>{a.employee}</strong><small className="mgr-sub">{a.department}</small></td>
                    <td>{a.assignedOn}</td><td><Pill>{a.status}</Pill></td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          ) : <p className="admin-note">No team devices to show.</p>}
        </section>
      </div>
    </>
  );
}

export default function ManagerDashboard({ user, onLogout }) {
  const name = userDisplayName(user);
  const { data: teamData, hasData, loading, error } = useManagerData();
  const [section, setSection] = useState("overview");

  /* Leave requests always come from the leave API (never from sample data). */
  const leave = useLeaveData();
  const data = useMemo(() => ({ ...teamData, leaves: leave.requests }), [teamData, leave.requests]);
  const decideLeave = async (id, action) => {
    await decideLeaveRequest(id, action);
    await leave.reload();
  };
  const isLeaveSection = section === "leave" || section === "approvals";

  const pendingCount = leave.requests.filter((l) => l.status === "Pending").length;
  const [title, subtitle] = PAGE_META[section];

  function renderPage() {
    switch (section) {
      case "team": return <TeamPage data={data} />;
      case "people": return <MyPeople />;
      case "attendance": return <AttendancePage data={data} />;
      case "leave": return <LeavePage data={data} onDecide={decideLeave} />;
      case "assets": return <AssetsPage data={data} />;
      case "approvals": return <LeavePage data={data} onDecide={decideLeave} pendingOnly />;
      case "schedule": return <SchedulePage data={data} />;
      case "reports": return <ReportsPage data={data} />;
      case "profile": return <ProfilePage user={user} name={name} initials={userInitials(user)} roleText={roleLabel(user?.role)} data={data} />;
      case "notifications": return <NotificationsPage data={data} />;
      default: return <Overview data={data} go={setSection} onDecide={decideLeave} name={name} />;
    }
  }

  return (
    <DashboardShell
      rootClass="manager-dashboard"
      user={user}
      onLogout={onLogout}
      nav={NAV}
      section={section}
      setSection={setSection}
      title={title}
      subtitle={subtitle}
      searchPlaceholder="Search team members, leave, attendance..."
      unread={pendingCount}
      homePath="/manager"
      footerLabel="Manager workspace"
    >
      {error && !isLeaveSection && <div role="alert" className="admin-form-error">{error}</div>}
      {leave.errors.requests && (isLeaveSection || section === "overview") && (
        <div role="alert" className="admin-form-error">{leave.errors.requests}</div>
      )}
      {loading && !isLeaveSection && <p className="admin-note">Loading your team…</p>}
      {isLeaveSection && leave.loading && <p className="admin-note">Loading leave requests…</p>}
      {!SHOW_DEMO_DATA && !hasData && !loading && !error && !isLeaveSection && (
        <NotConnected title="Team data is not connected yet." text="Team, attendance and leave data will appear here once the manager API is available." />
      )}
      {(hasData || section === "profile" || section === "people" || isLeaveSection) && renderPage()}
    </DashboardShell>
  );
}
