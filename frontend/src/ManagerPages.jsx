import { useMemo, useState } from "react";

import { Icon } from "./DashboardIcons";
import { NotConnected, MonthCalendar } from "./DashboardParts";
import { SHOW_DEMO_DATA, getErrorMessage } from "./dashboardUtils";
import { Av, MiniStat, Pager, Pill, downloadCsv } from "./AdminUi";
import { Donut } from "./ManagerCharts";
import { DEMO, summarize } from "./ManagerData";

const STATUS_OPTIONS = ["Present", "Absent", "On Leave", "Work From Home"];
const dash = (v) => v || "—";

/* ---------- shared: team members table with search / filter / pagination ---------- */
export function TeamTable({ team, title, exportName = "team.csv" }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return team.filter((t) => (status === "ALL" || t.status === status) && (!q || [t.name, t.designation].some((v) => String(v).toLowerCase().includes(q))));
  }, [team, query, status]);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const safe = Math.min(page, pages);
  const visible = rows.slice((safe - 1) * size, safe * size);

  return (
    <section className="admin-panel" aria-label={title}>
      <div className="admin-panel-heading">
        <div><h2>{title} ({team.length})</h2></div>
        <button type="button" className="admin-secondary-button ap-small" disabled={!rows.length}
          onClick={() => downloadCsv(exportName, ["Employee", "Designation", "Status", "Check-in", "Check-out", "Work Hours"], rows.map((t) => [t.name, t.designation, t.status, t.check_in, t.check_out, t.work_hours]))}>
          <Icon name="download" size={15} /> Export
        </button>
      </div>
      <div className="ap-toolbar">
        <label className="ap-search"><Icon name="search" size={16} />
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search team members..." aria-label="Search team members" /></label>
        <label className="ap-filter"><small>Status</small>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="ALL">All Status</option>{STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
      </div>
      {rows.length === 0 ? <p className="admin-note">No team members found.</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table ap-table">
            <thead><tr><th>#</th><th>EMPLOYEE</th><th>STATUS</th><th>CHECK-IN</th><th>CHECK-OUT</th><th>WORK HOURS</th></tr></thead>
            <tbody>
              {visible.map((t, i) => (
                <tr key={t.id}>
                  <td>{(safe - 1) * size + i + 1}</td>
                  <td><div className="ap-person"><Av name={t.name} i={i} size={32} /><span><strong>{t.name}</strong><small>{t.designation}</small></span></div></td>
                  <td><Pill>{t.status}</Pill></td>
                  <td>{dash(t.check_in)}</td><td>{dash(t.check_out)}</td><td>{dash(t.work_hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && <Pager page={safe} pages={pages} total={rows.length} size={size} onPage={(n) => setPage(Math.min(Math.max(1, n), pages))} onSize={(n) => { setSize(n); setPage(1); }} noun="members" />}
    </section>
  );
}

function Empty({ title }) {
  return <NotConnected title={`${title} is not available yet.`} text="This will appear here once the manager API returns data for your team." />;
}

export function TeamPage({ data }) {
  return data.team?.length ? <TeamTable team={data.team} title="My Team" exportName="my-team.csv" /> : <Empty title="Your team" />;
}

export function AttendancePage({ data }) {
  const s = summarize(data.team);
  if (!data.team?.length) return <Empty title="Team attendance" />;
  return (
    <div className="ap-page">
      <section className="ap-stats">
        <MiniStat icon="users" tone="green" value={s.total} label="Team Members" />
        <MiniStat icon="check" tone="green" value={s.present} label="Present" note={`${s.pct(s.present)}%`} />
        <MiniStat icon="alert" tone="red" value={s.absent} label="Absent" note={`${s.pct(s.absent)}%`} />
        <MiniStat icon="plane" tone="amber" value={s.leave} label="On Leave" note={`${s.pct(s.leave)}%`} />
      </section>
      <TeamTable team={data.team} title="Today's Attendance" exportName="team-attendance.csv" />
    </div>
  );
}

/* ---------- leave requests (Approve Requests / Team Leave) ---------- */
export function LeavePage({ data, onDecide, pendingOnly = false }) {
  const [filter, setFilter] = useState(pendingOnly ? "Pending" : "ALL");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const all = data.leaves || [];
  const rows = all.filter((l) => filter === "ALL" || l.status === filter);
  const count = (s) => all.filter((l) => l.status === s).length;

  async function decide(id, action) {
    setBusy(id + action); setError("");
    try { await onDecide(id, action); } catch (e) { setError(getErrorMessage(e, "Could not update this request.")); } finally { setBusy(""); }
  }

  return (
    <div className="ap-page">
      <section className="ap-stats">
        <MiniStat icon="plane" tone="amber" value={count("Pending")} label="Pending" note="Need your review" />
        <MiniStat icon="check" tone="green" value={count("Approved")} label="Approved" />
        <MiniStat icon="alert" tone="red" value={count("Rejected")} label="Rejected" />
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div><h2>{pendingOnly ? "Requests for Approval" : "Team Leave Requests"}</h2><p>Review and respond to leave requests from your team.</p></div>
          <select className="admin-select" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
            <option value="ALL">All</option><option>Pending</option><option>Approved</option><option>Rejected</option>
          </select>
        </div>
        {error && <div role="alert" className="admin-form-error">{error}</div>}
        {rows.length === 0 ? <p className="admin-note">No leave requests to show.</p> : <LeaveRows rows={rows} busy={busy} onDecide={decide} />}
      </section>
    </div>
  );
}

export function LeaveRows({ rows, busy = "", onDecide }) {
  return (
    <div className="mgr-leave-list">
      {rows.map((l, i) => (
        <div className="mgr-leave" key={l.id}>
          <div className="ap-person"><Av name={l.name} i={i} size={34} /><span><strong>{l.name}</strong><small>{l.code} · {l.department}</small></span></div>
          <span className="mgr-leave-type"><strong>{l.type}</strong><small>{l.dates}</small></span>
          <Pill>{l.status}</Pill>
          {l.status === "Pending" ? (
            <span className="mgr-decide">
              <button type="button" className="mgr-btn ok" disabled={Boolean(busy)} onClick={() => onDecide(l.id, "approve")}>{busy === `${l.id}approve` ? "…" : "Approve"}</button>
              <button type="button" className="mgr-btn no" disabled={Boolean(busy)} onClick={() => onDecide(l.id, "reject")}>{busy === `${l.id}reject` ? "…" : "Reject"}</button>
            </span>
          ) : <span />}
        </div>
      ))}
    </div>
  );
}

export function AssetsPage({ data }) {
  const rows = data.assets || [];
  if (!rows.length) return <Empty title="Team assets" />;
  return (
    <div className="ap-page">
      <section className="ap-stats">
        <MiniStat icon="laptop" tone="blue" value={rows.length} label="Team Devices" />
        <MiniStat icon="check" tone="green" value={rows.filter((r) => r.status === "Assigned").length} label="Assigned" />
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Team Assets</h2><p>Devices assigned to your team members.</p></div></div>
        <div className="admin-table-wrap">
          <table className="admin-table ap-table">
            <thead><tr><th>DEVICE</th><th>TYPE</th><th>EMPLOYEE</th><th>ASSIGNED ON</th><th>STATUS</th></tr></thead>
            <tbody>{rows.map((a, i) => (
              <tr key={a.id}>
                <td><div className="ap-person"><span className="ap-dev-icon"><Icon name="laptop" size={16} /></span><strong>{a.device}</strong></div></td>
                <td>{a.type}</td>
                <td><div className="ap-person"><Av name={a.employee} i={i} size={28} /><span><strong>{a.employee}</strong><small>{a.department}</small></span></div></td>
                <td>{a.assignedOn}</td><td><Pill>{a.status}</Pill></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function SchedulePage({ data }) {
  const rows = data.schedule || [];
  if (!rows.length) return <Empty title="Team schedule" />;
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading"><div><h2>Upcoming Team Schedule</h2><p>Today and tomorrow for your team.</p></div></div>
      <div className="admin-table-wrap">
        <table className="admin-table ap-table">
          <thead><tr><th>EMPLOYEE</th><th>TODAY</th><th>TOMORROW</th><th>STATUS</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.name}>
              <td><div className="ap-person"><Av name={r.name} i={i} size={30} /><span><strong>{r.name}</strong><small>{r.department}</small></span></div></td>
              <td>{r.today}</td><td>{r.tomorrow}</td><td><Pill>{r.status}</Pill></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}

export function NotificationsPage({ data }) {
  const pending = (data.leaves || []).filter((l) => l.status === "Pending");
  const items = [...pending.map((l) => ({ icon: "plane", title: `${l.name} requested ${l.type}`, when: l.dates })), ...(data.activity || [])];
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading"><div><h2>Notifications</h2><p>Updates about your team.</p></div></div>
      {items.length === 0 ? <p className="admin-note">You&rsquo;re all caught up.</p> : (
        <ul className="mgr-activity">{items.map((a, i) => <li key={i}><span className="mgr-act-icon"><Icon name={a.icon} size={18} /></span><span><strong>{a.title}</strong><small>{a.when}</small></span></li>)}</ul>
      )}
    </section>
  );
}

/* ---------- Team Reports ---------- */
export function ReportsPage({ data }) {
  const [tab, setTab] = useState("attendance");
  const [dept, setDept] = useState("ALL");
  const team = useMemo(() => (data.team || []).filter((t) => dept === "ALL" || t.department === dept), [data.team, dept]);
  const depts = [...new Set((data.team || []).map((t) => t.department).filter(Boolean))];
  const s = summarize(team);
  const leaves = data.leaves || [];
  const assets = data.assets || [];
  const marks = useMemo(() => Object.fromEntries((data.week || []).map((d) => [d.date, d.absent > 0 && d.present === 0 ? "absent" : "present"])), [data.week]);
  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
  const byType = Object.entries(assets.reduce((m, a) => ({ ...m, [a.type]: (m[a.type] || 0) + 1 }), {}));

  if (!team.length && !(data.team || []).length) return <Empty title="Team reports" />;

  return (
    <div className="ap-page">
      <div className="mgr-report-bar">
        <label className="ap-filter"><small>Department</small>
          <select value={dept} onChange={(e) => setDept(e.target.value)}><option value="ALL">All Departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</select></label>
        <button type="button" className="admin-secondary-button" disabled={!team.length}
          onClick={() => downloadCsv("team-report.csv", ["Employee", "Designation", "Status", "Check-in", "Check-out", "Work Hours"], team.map((t) => [t.name, t.designation, t.status, t.check_in, t.check_out, t.work_hours]))}>
          <Icon name="download" size={16} /> Export Report
        </button>
      </div>

      <section className="mgr-seven" aria-label="Team summary">
        <MiniStat icon="users" tone="blue" value={s.total} label="Team Members" />
        <MiniStat icon="check" tone="green" value={s.present} label="Present Today" note={`${s.pct(s.present)}%`} />
        <MiniStat icon="alert" tone="red" value={s.absent} label="Absent Today" note={`${s.pct(s.absent)}%`} />
        <MiniStat icon="plane" tone="amber" value={s.leave} label="On Leave" />
        <MiniStat icon="home" tone="blue" value={s.wfh} label="Work From Home" />
        <MiniStat icon="clock" tone="amber" value={s.late} label="Late Arrival" />
        <MiniStat icon="logout" tone="red" value={s.early} label="Early Check-out" />
      </section>

      <div className="mgr-reports-top">
        <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Team Calendar</h2></div></div><MonthCalendar marks={marks} /></section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div className="ap-person big"><span className="ap-dev-icon big"><Icon name="calendar" size={22} /></span>
              <div><h2>Team Overview</h2><p>{dateLabel} ({today.toLocaleDateString("en-GB", { weekday: "long" })}) <span className={`ap-pill ${isWeekend ? "amber" : "green"}`}>{isWeekend ? "Off Day" : "Working Day"}</span></p></div></div>
          </div>
          <div className="ap-tabs" role="tablist">
            {[["attendance", "Attendance"], ["leave", "Leave"], ["assets", "Assets"]].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {tab === "attendance" && (
            <div className="ap-overview">
              <div className="ap-card"><h3>Team Attendance</h3>
                <div className="mgr-donut-row">
                  <Donut total={s.total} parts={[["Present", s.present, "#14a37f"], ["Absent", s.absent, "#f26d6d"], ["On Leave", s.leave, "#f5c04d"], ["Work From Home", s.wfh, "#4e9bea"]]} />
                  <ul className="ap-donut-legend">
                    {[["Present", s.present, "#14a37f"], ["Absent", s.absent, "#f26d6d"], ["On Leave", s.leave, "#f5c04d"], ["Work From Home", s.wfh, "#4e9bea"]].map(([n, v, c]) => (
                      <li key={n}><i style={{ background: c }} /><span>{n}</span><b>{v}</b><em>{s.pct(v)}%</em></li>))}
                  </ul>
                </div>
              </div>
              <div className="ap-card"><h3>Attendance Insights</h3>
                <div className="ap-metrics">
                  {[["clock", String(s.late), "Late Arrivals"], ["logout", String(s.early), "Early Check-outs"], ["alert", String(s.absent), "Absent Today"]].map(([ic, v, l]) => (
                    <div key={l}><span className="ap-mini-icon green"><Icon name={ic} size={18} /></span><span><b>{v}</b><small>{l}</small></span></div>))}
                </div>
              </div>
            </div>
          )}
          {tab === "leave" && (leaves.length ? <LeaveRows rows={leaves} /> : <p className="admin-note">No leave requests.</p>)}
          {tab === "assets" && (assets.length ? (
            <div className="ap-overview">
              <div className="ap-card"><h3>Assigned devices</h3>
                <div className="mgr-donut-row"><Donut total={assets.length} label="Devices" parts={byType.map(([n, v], i) => [n, v, ["#14a37f", "#4e9bea", "#f5c04d", "#8c7bd1"][i % 4]])} />
                  <ul className="ap-donut-legend">{byType.map(([n, v], i) => <li key={n}><i style={{ background: ["#14a37f", "#4e9bea", "#f5c04d", "#8c7bd1"][i % 4] }} /><span>{n}</span><b>{v}</b><em /></li>)}</ul></div>
              </div>
            </div>
          ) : <p className="admin-note">No devices assigned.</p>)}
        </section>
      </div>

      <TeamTable team={team} title="Team Members" exportName="team-members.csv" />

      {SHOW_DEMO_DATA && data.perf && (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Performance Overview</h2><p>Sample data</p></div></div>
          <div className="ap-stats">
            <MiniStat icon="check" tone="amber" value={data.perf.rating} label="Avg. Rating" />
            <MiniStat icon="chart" tone="green" value={data.perf.progress} label="Goal Progress" />
            <MiniStat icon="alert" tone="red" value={data.perf.atRisk} label="At Risk" />
            <MiniStat icon="file" tone="blue" value={data.perf.review} label="Needs Review" />
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- My Profile ---------- */
const pick = (...v) => v.find((x) => x && x !== "—") || "";
function InfoCard({ title, rows }) {
  return (
    <section className="admin-panel mgr-info">
      <div className="admin-panel-heading"><div><h2>{title}</h2></div></div>
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}</dl>
    </section>
  );
}

export function ProfilePage({ user, name, initials, roleText, data }) {
  const [tab, setTab] = useState("personal");
  const demo = SHOW_DEMO_DATA;
  const p = { ...(demo ? DEMO.profile : {}), ...(data.profile || {}) };
  const designation = pick(user?.designation_name, user?.designation?.name, user?.designation, demo && "Engineering Manager") || roleText;
  const department = pick(user?.department_name, user?.department?.name, user?.department, demo && "Engineering");
  const code = pick(user?.employee_code, demo && "EMP007");
  const email = pick(user?.email);
  const team = data.team || [];
  const personal = [["Full Name", name], ["Date of Birth", p.dob], ["Gender", p.gender], ["Phone Number", p.phone], ["Personal Email", p.personalEmail], ["Address", p.address]];
  const work = [["Employee ID", code], ["Designation", designation], ["Department", department], ["Reporting To", p.reportingTo], ["Date of Joining", p.joined], ["Employment Type", p.employmentType], ["Work Location", p.location], ["Work Email", email]];
  const mgr = [["Team Size", team.length ? `${team.length} Members` : ""], ...(p.manager || [])];

  return (
    <div className="ap-page">
      <section className="admin-panel mgr-profile-hero">
        <span className="mgr-avatar">{initials}</span>
        <div className="mgr-hero-main">
          <h2>{name}</h2>
          <p>{designation}</p>
          {department && <p className="muted">{department} Department</p>}
          {code && <span className="mgr-chip"><Icon name="file" size={13} /> {code}</span>}
        </div>
        <ul className="mgr-contact">
          {[["mail", email], ["phone", p.phone], ["pin", p.location], ["calendar", p.joined && `Joined on ${p.joined}`]].filter(([, v]) => v).map(([ic, v]) => <li key={ic}><Icon name={ic} size={16} /> {v}</li>)}
        </ul>
        {p.quote && <blockquote className="mgr-quote">&ldquo;{p.quote}&rdquo;<footer>— {name}</footer></blockquote>}
      </section>

      <div className="ap-tabs" role="tablist">
        {[["personal", "Personal Information"], ["work", "Work Information"], ["team", "My Team"]].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "personal" && <div className="mgr-three"><InfoCard title="Personal Information" rows={personal} /><InfoCard title="Work Information" rows={work} /><InfoCard title="Manager Information" rows={mgr} /></div>}
      {tab === "work" && <div className="mgr-three two"><InfoCard title="Work Information" rows={work} /><InfoCard title="Manager Information" rows={mgr} /></div>}
      {tab === "team" && (team.length ? <TeamTable team={team} title="My Team" /> : <Empty title="Your team" />)}

      <div className="mgr-three">
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Quick Stats</h2></div></div>
          {p.stats ? <div className="mgr-qs">{p.stats.map(([ic, v, l, tone]) => <div key={l}><span className={`ap-mini-icon ${tone}`}><Icon name={ic} size={18} /></span><span><b>{v}</b><small>{l}</small></span></div>)}</div> : <p className="admin-note">Statistics will appear once the manager API is connected.</p>}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>My Team ({team.length})</h2></div></div>
          {team.length ? <ul className="mgr-mini-team">{team.slice(0, 4).map((t, i) => <li key={t.id}><Av name={t.name} i={i} size={34} /><span><strong>{t.name}</strong><small>{t.designation}</small></span><Pill>{t.status}</Pill></li>)}</ul> : <p className="admin-note">No team members yet.</p>}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Recent Activities</h2></div></div>
          {data.activity?.length ? <ul className="mgr-activity">{data.activity.map((a, i) => <li key={i}><span className="mgr-act-icon"><Icon name={a.icon} size={18} /></span><span><strong>{a.title}</strong><small>{a.when}</small></span></li>)}</ul> : <p className="admin-note">No recent activity.</p>}
        </section>
      </div>
    </div>
  );
}
