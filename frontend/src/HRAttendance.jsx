import { useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { NotConnected, Pager } from "./DashboardParts";
import {
  AVATAR_TONES,
  SHOW_DEMO_DATA,
  downloadCsv,
  getErrorMessage,
  initialsOf,
  useEmployees,
} from "./dashboardUtils";
import "./HRPages.css";
import "./HRAttendance.css";

/* ------------------------------------------------------------------
   Set this to your HR attendance-overview endpoint when the backend is ready.
   While it is null, sample data is shown (when SHOW_DEMO_DATA is true).

   Expected JSON (the code below is tolerant, send me your real shape if different):
   {
     "summary": { "total": 142, "present": 118, "absent": 12, "on_leave": 6, "wfh": 4, "late": 2 },
     "week": [ { "date": "2026-10-10", "present": 129, "absent": 7, "on_leave": 5, "wfh": 1, "total": 142 }, ... 7 days ],
     "breaks": [ { "name": "Lunch Break", "window": "1:00 – 2:00 PM", "taken": 118, "total": 142,
                   "on_time": 110, "late": 6, "missed": 4, "not_taken": 22 } ],
     "employees": [ { "id": 1, "name": "Aarav Sharma", "code": "EMP001", "department": "Engineering",
                      "days": { "2026-10-10": "P", "2026-10-11": "A" }, "present_days": 6,
                      "work_hours": "48h 20m", "lunch_avg": "29m", "tea_avg": "19m", "status": "Present" } ]
   }
   ------------------------------------------------------------------ */
const ATTENDANCE_OVERVIEW_ENDPOINT = null; // e.g. "/attendance/overview/"
const EMPTY_ROWS = [];

const TOTAL_DEMO = 142;
const DEMO_WEEK_COUNTS = [
  [129, 7, 5, 1], [127, 8, 6, 1], [134, 4, 3, 1], [131, 6, 4, 1],
  [125, 9, 6, 2], [128, 8, 5, 1], [118, 12, 6, 6],
]; // present, absent, on leave, wfh (each row sums to 142)

const DEMO_BREAKS = [
  { name: "Lunch Break", window: "1:00 – 2:00 PM", icon: "coffee", taken: 118, total: 142, onTime: 110, late: 6, missed: 4, notTaken: 22 },
  { name: "Tea Break", window: "4:00 – 6:00 PM", icon: "coffee", taken: 112, total: 142, onTime: 105, late: 5, missed: 2, notTaken: 30 },
];

const DEMO_EMPLOYEES = [
  ["Aarav Sharma", "EMP001", "Engineering", "PPPAPPP", "48h 20m", "29m", "19m"],
  ["Neha Gupta", "EMP004", "Design", "PPLPPPP", "47h 55m", "30m", "18m"],
  ["Karan Mehta", "EMP007", "Sales", "PPPPPAP", "45h 10m", "28m", "20m"],
  ["Priya Singh", "EMP010", "Marketing", "PAPPPPP", "46h 30m", "30m", "19m"],
  ["Rohit Jain", "EMP011", "Finance", "PPPPPLP", "47h 05m", "29m", "19m"],
  ["Simran Kaur", "EMP012", "HR", "PPPPPPP", "48h 55m", "30m", "20m"],
  ["Vikram Kapoor", "EMP005", "Product", "PWPPPPP", "47h 20m", "28m", "18m"],
  ["Ananya Singh", "EMP006", "Engineering", "PPAPPPP", "45h 50m", "30m", "19m"],
];

const CELL_LABEL = { P: "Present", A: "Absent", L: "On Leave", W: "Work From Home" };

function lastSevenDates() {
  const out = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d);
  }
  return out;
}
const shortDay = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const weekday = (d) => d.toLocaleDateString("en-GB", { weekday: "short" });

function buildDemo() {
  const dates = lastSevenDates();
  return {
    dates,
    week: DEMO_WEEK_COUNTS.map(([present, absent, leave, wfh]) => ({ present, absent, leave, wfh, total: TOTAL_DEMO })),
    summary: { total: TOTAL_DEMO, present: 118, absent: 12, leave: 6, wfh: 4, late: 2 },
    breaks: DEMO_BREAKS,
    rows: DEMO_EMPLOYEES.map(([name, code, department, cells, hours, lunch, tea], i) => ({
      id: `demo-${i}`, name, code, department,
      cells: cells.split(""),
      presentDays: cells.split("").filter((c) => c === "P" || c === "W").length,
      workHours: hours, lunch, tea, status: "Present",
    })),
  };
}

function normalizeOverview(res) {
  const week = (res.week || []).slice(-7);
  const dates = week.map((w) => new Date(`${w.date}T00:00:00`));
  const s = res.summary || {};
  return {
    dates,
    week: week.map((w) => ({
      present: w.present ?? 0, absent: w.absent ?? 0, leave: w.on_leave ?? w.leave ?? 0,
      wfh: w.wfh ?? w.work_from_home ?? 0, total: w.total ?? 0,
    })),
    summary: {
      total: s.total ?? 0, present: s.present ?? 0, absent: s.absent ?? 0,
      leave: s.on_leave ?? s.leave ?? 0, wfh: s.wfh ?? 0, late: s.late ?? 0,
    },
    breaks: (res.breaks || []).map((b) => ({
      name: b.name, window: b.window || "", icon: "coffee", taken: b.taken ?? 0, total: b.total ?? 0,
      onTime: b.on_time ?? 0, late: b.late ?? 0, missed: b.missed ?? 0, notTaken: b.not_taken ?? 0,
    })),
    rows: (res.employees || []).map((e) => ({
      id: e.id, name: e.name || e.employee_name || "—", code: e.code || e.employee_code || "—",
      department: e.department || e.department_name || "—",
      cells: week.map((w) => e.days?.[w.date] || "—"),
      presentDays: e.present_days ?? 0, workHours: e.work_hours || "—",
      lunch: e.lunch_avg || "—", tea: e.tea_avg || "—", status: e.status || "—",
    })),
  };
}

function Donut({ value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <div className="hra-donut" role="img" aria-label={`${value} present, ${pct} percent`}>
      <svg viewBox="0 0 64 64" width="64" height="64">
        <circle cx="32" cy="32" r={r} className="track" />
        <circle cx="32" cy="32" r={r} className="arc" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
      </svg>
      <span><strong>{value}</strong><small>{pct}%</small></span>
    </div>
  );
}

function Glance({ s }) {
  const items = [
    ["users", "green", "Total Employees", s.total, null],
    ["user", "green", "Present", s.present, s.total],
    ["clock", "red", "Absent", s.absent, s.total],
    ["userplus", "amber", "On Leave", s.leave, s.total],
    ["home", "blue", "Work From Home", s.wfh, s.total],
    ["alert", "red", "Late Arrivals", s.late, s.total],
  ];
  return (
    <div className="hra-glance-cards">
      {items.map(([icon, tone, label, value, total]) => (
        <div className="hra-mini" key={label}>
          <span className={`admin-stat-icon ${tone}`}><Icon name={icon} size={22} /></span>
          <span className="hra-mini-body">
            <strong>{value ?? "—"}</strong>
            <small>{label}</small>
          </span>
          {total ? <span className={`hra-pct ${tone}`}>{Math.round((value / total) * 100)}%</span> : null}
        </div>
      ))}
    </div>
  );
}

export default function HRAttendance({ onOpenExceptions }) {
  const { employees } = useEmployees();
  const [remote, setRemote] = useState(null);
  const [loading, setLoading] = useState(Boolean(ATTENDANCE_OVERVIEW_ENDPOINT));
  const [error, setError] = useState("");

  const [tab, setTab] = useState("employee");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dept, setDept] = useState("ALL");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const [selectedDay, setSelectedDay] = useState(6);

  useEffect(() => {
    if (!ATTENDANCE_OVERVIEW_ENDPOINT) return undefined;
    let cancelled = false;
    apiClient
      .get(ATTENDANCE_OVERVIEW_ENDPOINT)
      .then((res) => !cancelled && setRemote(normalizeOverview(res)))
      .catch((e) => !cancelled && setError(getErrorMessage(e, "Could not load attendance overview.")))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const demoMode = !ATTENDANCE_OVERVIEW_ENDPOINT && SHOW_DEMO_DATA;
  const data = useMemo(() => (demoMode ? buildDemo() : remote), [demoMode, remote]);

  // Real total from your employee records overrides the sample total
  const summary = data
    ? { ...data.summary, total: employees.length || data.summary.total }
    : { total: employees.length || null };

  const rows = data?.rows || EMPTY_ROWS;
  const departments = useMemo(() => [...new Set(rows.map((r) => r.department).filter((d) => d && d !== "—"))].sort(), [rows]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (dept === "ALL" || r.department === dept) &&
        (status === "ALL" || r.status === status) &&
        (!q || r.name.toLowerCase().includes(q) || String(r.code).toLowerCase().includes(q)),
    );
  }, [rows, query, dept, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);

  const deptView = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const m = (map[r.department] = map[r.department] || { n: 0, present: 0 });
      m.n += 1;
      m.present += r.presentDays;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  function exportCsv() {
    if (!data) return;
    const header = ["Employee", "Code", "Department", ...data.dates.map(shortDay), "Present Days", "Work Hours", "Lunch Avg", "Tea Avg", "Status"];
    downloadCsv("attendance-overview.csv", [
      header,
      ...filtered.map((r) => [r.name, r.code, r.department, ...r.cells, `${r.presentDays}/7`, r.workHours, r.lunch, r.tea, r.status]),
    ]);
  }

  return (
    <div className="hrp-page">
      <div className="hrp-toolbar">
        <select className="admin-select" defaultValue="7" aria-label="Date range"><option value="7">Last 7 days</option></select>
        <select className="admin-select" value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }} aria-label="Department">
          <option value="ALL">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button type="button" className="admin-secondary-button" onClick={exportCsv} disabled={!data}>
          <Icon name="arrow" size={14} /> Export
        </button>
      </div>

      {!ATTENDANCE_OVERVIEW_ENDPOINT && (
        <NotConnected
          title="Attendance overview API is not connected yet."
          text={demoMode
            ? "Numbers below are sample data (only the Total Employees count is real). Set ATTENDANCE_OVERVIEW_ENDPOINT in HRAttendance.jsx once the backend provides it."
            : "Set ATTENDANCE_OVERVIEW_ENDPOINT in HRAttendance.jsx once the backend provides it."}
        />
      )}
      {error && <div className="admin-form-error" role="alert">{error}</div>}
      {loading && <p className="admin-note">Loading attendance overview…</p>}

      <section className="admin-panel hra-glance" aria-label="Today at a glance">
        <div className="hra-glance-title">
          <h2>Today at a Glance</h2>
          <small>{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</small>
        </div>
        <Glance s={summary} />
      </section>

      <div className="admin-row">
        <section className="admin-panel" aria-labelledby="wk-title">
          <div className="admin-panel-heading"><div><h2 id="wk-title">Weekly Attendance Overview</h2></div></div>
          {data?.week?.length ? (
            <>
              <div className="hra-week">
                {data.week.map((w, i) => (
                  <button key={i} type="button" className={`hra-day ${selectedDay === i ? "on" : ""}`} onClick={() => setSelectedDay(i)}>
                    <span className="hra-day-head"><b>{shortDay(data.dates[i])}</b><small>{weekday(data.dates[i])}</small></span>
                    <Donut value={w.present} total={w.total} />
                    <ul className="hra-dots">
                      <li className="p">{w.present}</li>
                      <li className="a">{w.absent}</li>
                      <li className="l">{w.leave}</li>
                      <li className="w">{w.wfh}</li>
                    </ul>
                  </button>
                ))}
              </div>
              <div className="hra-legend">
                <span><i className="p" /> Present</span><span><i className="a" /> Absent</span>
                <span><i className="l" /> On Leave</span><span><i className="w" /> Work From Home</span>
              </div>
            </>
          ) : (
            <p className="admin-note">Weekly attendance will appear once the attendance API is connected.</p>
          )}
        </section>

        <section className="admin-panel" aria-labelledby="bs-title">
          <div className="admin-panel-heading">
            <div><h2 id="bs-title">Today&rsquo;s Break Status</h2><p>{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</p></div>
            <button type="button" className="admin-link-button" onClick={() => setTab("break")}>View Details <Icon name="arrow" size={14} /></button>
          </div>
          {data?.breaks?.length ? (
            data.breaks.map((b) => {
              const pct = b.total ? Math.round((b.taken / b.total) * 100) : 0;
              return (
                <div className="hra-break" key={b.name}>
                  <span className="hra-break-icon"><Icon name={b.icon} size={22} /></span>
                  <div className="hra-break-body">
                    <div className="hra-break-top">
                      <strong>{b.name}{b.window ? ` (${b.window})` : ""}</strong>
                      <span>{b.taken} / {b.total} <b>{pct}%</b></span>
                    </div>
                    <div className="admin-dept-bar"><span style={{ width: `${pct}%` }} /></div>
                    <div className="hra-chips">
                      <span className="ok">On Time <b>{b.onTime}</b></span>
                      <span className="bad">Late <b>{b.late}</b></span>
                      <span className="warn">Missed <b>{b.missed}</b></span>
                      <span className="neutral">Not Taken <b>{b.notTaken}</b></span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="admin-note">Break status will appear once the attendance API is connected.</p>
          )}
        </section>
      </div>

      <section className="admin-panel" aria-label="Attendance details">
        <div className="hrp-tabbar" role="tablist">
          {[["employee", "Employee Attendance"], ["break", "Break Details"], ["department", "Department View"], ["exceptions", "Today's Exceptions"]].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === "employee" && (
          <>
            <div className="hrp-filters hra-table-filters">
              <label className="people-search">
                <Icon name="search" size={16} />
                <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search by employee name or ID..." aria-label="Search employees" />
              </label>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
                <option value="ALL">All Status</option>
                {[...new Set(rows.map((r) => r.status))].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {visible.length === 0 ? (
              <p className="admin-note">No attendance rows to show.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table hrp-table">
                  <thead>
                    <tr>
                      <th>#</th><th>EMPLOYEE</th><th>DEPARTMENT</th>
                      {data.dates.map((d, i) => <th key={i} className="hra-th-day">{shortDay(d)}<small>{weekday(d)}</small></th>)}
                      <th>PRESENT DAYS (7)</th><th>WORK HOURS (TOTAL)</th><th>LUNCH (AVG)</th><th>TEA (AVG)</th><th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r, i) => (
                      <tr key={r.id}>
                        <td>{start + i + 1}</td>
                        <td>
                          <div className="admin-person">
                            <span className="admin-person-avatar" style={{ background: AVATAR_TONES[(start + i) % AVATAR_TONES.length] }}>{initialsOf(r.name)}</span>
                            <span><strong>{r.name}</strong><small>{r.code}</small></span>
                          </div>
                        </td>
                        <td>{r.department}</td>
                        {r.cells.map((c, j) => (
                          <td key={j}><span className={`hra-cell ${c}`} title={CELL_LABEL[c] || ""}>{c}</span></td>
                        ))}
                        <td>{r.presentDays}/7</td>
                        <td>{r.workHours}</td><td>{r.lunch}</td><td>{r.tea}</td>
                        <td><span className="hrp-pill ok">{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={safePage} pages={pages} onPage={(n) => setPage(Math.min(Math.max(n, 1), pages))}
              perPage={perPage} onPerPage={(n) => { setPerPage(n); setPage(1); }}
              total={filtered.length} shown={{ from: start + 1, to: Math.min(start + perPage, filtered.length) }} />
          </>
        )}

        {tab === "break" && (
          data?.breaks?.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>BREAK</th><th>WINDOW</th><th>TAKEN</th><th>ON TIME</th><th>LATE</th><th>MISSED</th><th>NOT TAKEN</th></tr></thead>
                <tbody>
                  {data.breaks.map((b) => (
                    <tr key={b.name}>
                      <td><strong>{b.name}</strong></td><td>{b.window || "—"}</td>
                      <td>{b.taken} / {b.total}</td><td>{b.onTime}</td><td>{b.late}</td><td>{b.missed}</td><td>{b.notTaken}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="admin-note">No break data yet.</p>
        )}

        {tab === "department" && (
          deptView.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>DEPARTMENT</th><th>EMPLOYEES IN VIEW</th><th>AVG PRESENT DAYS (OF 7)</th></tr></thead>
                <tbody>
                  {deptView.map(([name, m]) => (
                    <tr key={name}><td><strong>{name}</strong></td><td>{m.n}</td><td>{(m.present / m.n).toFixed(1)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="admin-note">No department data yet.</p>
        )}

        {tab === "exceptions" && (
          <div className="hrp-empty-inline">
            <p className="admin-note">Review today&rsquo;s attendance and break exceptions on the Exception Review page.</p>
            {onOpenExceptions && (
              <button type="button" className="admin-primary-button" onClick={onOpenExceptions}>Open Exception Review <Icon name="arrow" size={14} /></button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
