import { useEffect, useMemo, useState } from "react";

import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { SHOW_DEMO_DATA, getArrayResponse, getErrorMessage } from "./dashboardUtils";
import { Av, MiniStat, Pill, downloadCsv } from "./AdminUi";

/* Backend: GET /attendance/reports/daily/?date=YYYY-MM-DD  ->
   { summary:{total,present,absent,leave,wfh}, metrics:[{icon,value,label}],
     employees:[{name,code,department,check_in,check_out,work_hours,status,location,remarks}] } */
const REPORT_ENDPOINT = "/attendance/reports/daily/";

const DEMO_REPORT = {
  summary: { total: 46, present: 40, absent: 3, leave: 2, wfh: 1 },
  metrics: [
    { icon: "clock", value: "09:12 AM", label: "Average Check-in" },
    { icon: "logout", value: "06:34 PM", label: "Average Check-out" },
    { icon: "clock", value: "8h 12m", label: "Average Work Hours" },
    { icon: "alert", value: "2", label: "Late Arrivals" },
    { icon: "alert", value: "1", label: "Early Check-out" },
    { icon: "alert", value: "0", label: "Missing Check-out" },
  ],
  employees: [
    ["Aarav Sharma", "EMP001", "Engineering", "09:01 AM", "06:15 PM", "8h 14m", "Present", "Office", ""],
    ["Priya Nair", "EMP002", "Product", "09:08 AM", "06:32 PM", "8h 24m", "Present", "Office", ""],
    ["Rohan Thakur", "EMP003", "Engineering", "", "", "", "Absent", "", "No check-in"],
    ["Neha Gupta", "EMP004", "Design", "09:15 AM", "06:28 PM", "8h 13m", "Present", "Office", ""],
    ["Vikram Kapoor", "EMP005", "HR", "", "", "", "On Leave", "", "Casual Leave"],
    ["Ananya Singh", "EMP006", "Marketing", "09:22 AM", "06:41 PM", "8h 19m", "Present", "Office", ""],
    ["Karan Mehta", "EMP007", "Sales", "09:05 AM", "", "", "Work From Home", "Remote", "Client meetings"],
    ["Simran Kaur", "EMP008", "Finance", "09:18 AM", "06:20 PM", "8h 02m", "Present", "Office", ""],
  ].map(([name, code, department, check_in, check_out, work_hours, status, location, remarks]) => ({ name, code, department, check_in, check_out, work_hours, status, location, remarks })),
};

const pad = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a, b) => isoOf(a) === isoOf(b);

function Calendar({ selected, onSelect, holidayDates }) {
  const [cursor, setCursor] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));
  const today = new Date();
  const cells = useMemo(() => {
    const first = cursor.getDay();
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const out = Array(first).fill(null);
    for (let d = 1; d <= days; d += 1) out.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return out;
  }, [cursor]);
  const shift = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <div className="ap-cal">
      <div className="ap-cal-head">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="chevleft" size={16} /></button>
        <strong>{cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</strong>
        <button type="button" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevron" size={16} /></button>
      </div>
      <div className="ap-cal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => <span key={w} className="wd">{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          const holiday = holidayDates.has(isoOf(d));
          const cls = ["day", sameDay(d, selected) && "sel", sameDay(d, today) && "today", holiday && "hol", weekend && "we"].filter(Boolean).join(" ");
          return (
            <button key={d.getDate()} type="button" className={cls} onClick={() => onSelect(d)} aria-pressed={sameDay(d, selected)}>
              {d.getDate()}
              {!weekend && !holiday && d <= today && <i />}
            </button>
          );
        })}
      </div>
      <div className="ap-legend">
        <span><i className="g" /> Working Day</span><span><i className="r" /> Holiday</span><span><i className="d" /> Today</span>
      </div>
    </div>
  );
}

function Donut({ summary }) {
  const parts = [["Present", summary.present, "#14a37f"], ["Absent", summary.absent, "#f26d6d"], ["On Leave", summary.leave, "#f5c04d"], ["Work From Home", summary.wfh ?? 0, "#4e9bea"]];
  const total = parts.reduce((n, p) => n + p[1], 0) || 1;
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="ap-donut-wrap">
      <svg viewBox="0 0 140 140" className="ap-donut" role="img" aria-label="Attendance summary chart">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--ad-border)" strokeWidth="16" />
        {parts.map(([label, n, color]) => {
          const len = (n / total) * C;
          const el = <circle key={label} cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />;
          offset += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" className="n">{summary.total}</text>
        <text x="70" y="86" textAnchor="middle" className="l">Employees</text>
      </svg>
      <ul className="ap-donut-legend">
        {parts.map(([label, n, color]) => (
          <li key={label}><i style={{ background: color }} /><span>{label}</span><b>{label === "Work From Home" && summary.wfh == null ? "—" : n}</b><em>{label === "Work From Home" && summary.wfh == null ? "Not tracked" : `${Math.round((n / (summary.total || 1)) * 100)}%`}</em></li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminReports() {
  const [date, setDate] = useState(() => new Date());
  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dept, setDept] = useState("ALL");
  const [live, setLive] = useState({ iso: "", data: null, error: "" });
  const [holidays, setHolidays] = useState([]);

  useEffect(() => {
    if (SHOW_DEMO_DATA) return undefined;
    let off = false;
    apiClient.get("/leave/holidays/")
      .then((r) => { if (!off) setHolidays(getArrayResponse(r).filter((h) => h.is_active)); })
      .catch(() => { if (!off) setHolidays([]); });
    return () => { off = true; };
  }, []);

  const iso = isoOf(date);
  const holidayDates = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);
  const upcomingHolidays = useMemo(() => holidays.filter((h) => h.date >= isoOf(new Date())).slice(0, 4), [holidays]);
  useEffect(() => {
    if (SHOW_DEMO_DATA) return undefined;
    let off = false;
    apiClient.get(`${REPORT_ENDPOINT}?date=${iso}`)
      .then((r) => !off && setLive({ iso, data: r, error: "" }))
      .catch((e) => !off && setLive({ iso, data: null, error: getErrorMessage(e, "Could not load the report.") }));
    return () => { off = true; };
  }, [iso]);

  const loading = !SHOW_DEMO_DATA && live.iso !== iso;
  const report = SHOW_DEMO_DATA ? DEMO_REPORT : live.data;
  const error = SHOW_DEMO_DATA ? "" : live.error;
  const s = report?.summary;
  const all = useMemo(() => report?.employees || [], [report]);
  const depts = [...new Set(all.map((e) => e.department).filter(Boolean))].sort();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((e) => (tab !== "leave" || e.status === "On Leave") && (status === "ALL" || e.status === status) && (dept === "ALL" || e.department === dept) && (!q || [e.name, e.code, e.department].some((v) => String(v ?? "").toLowerCase().includes(q))));
  }, [all, query, status, dept, tab]);

  const dayName = date.toLocaleDateString("en-GB", { weekday: "long" });
  const longDate = date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const workCoverage = s ? (s.total ? "Scheduled employees" : "No scheduled employees") : "Schedule unavailable";

  function exportCsv() {
    downloadCsv(`daily-report-${iso}.csv`, ["Employee", "ID", "Department", "Check-in", "Check-out", "Work Hours", "Status", "Location", "Remarks"], rows.map((e) => [e.name, e.code, e.department, e.check_in, e.check_out, e.work_hours, e.status, e.location, e.remarks]));
  }

  return (
    <div className="ap-reports">
      <aside className="ap-rep-left">
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Select Date</h2></div>
            <button type="button" className="admin-secondary-button ap-small" onClick={() => setDate(new Date())}>Today</button></div>
          <Calendar key={iso.slice(0, 7)} selected={date} onSelect={setDate} holidayDates={holidayDates} />
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Upcoming Holidays</h2></div></div>
          <ul className="ap-holidays">
            {upcomingHolidays.map(({ date: d, name }) => {
              const dt = new Date(`${d}T00:00:00`);
              return (
                <li key={d}>
                  <span className="ap-hdate"><b>{pad(dt.getDate())}</b>{dt.toLocaleDateString("en-GB", { month: "short" })}</span>
                  <span><strong>{name}</strong><small>Configured company holiday</small></span>
                  <span className="ap-pill red">Holiday</span>
                </li>
              );
            })}
            {upcomingHolidays.length === 0 && <li className="admin-note">No upcoming holidays are configured.</li>}
          </ul>
        </section>
      </aside>

      <div className="ap-rep-right">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div className="ap-person big">
              <span className="ap-dev-icon big"><Icon name="calendar" size={22} /></span>
              <div><h2>Daily Report</h2><p>{longDate} ({dayName}) <span className={`ap-pill ${s?.total ? "green" : "amber"}`}>{workCoverage}</span></p></div>
            </div>
            <button type="button" className="admin-secondary-button" onClick={exportCsv} disabled={!rows.length}><Icon name="download" size={16} /> Export</button>
          </div>

          {error && <div role="alert" className="admin-form-error">{error}</div>}
          {loading && <p className="admin-note">Loading report…</p>}

          {s ? (
            <>
              <div className="ap-stats five">
                <MiniStat icon="users" tone="green" value={s.total} label="Total Employees" />
                <MiniStat icon="check" tone="green" value={s.present} label="Present" note={`${Math.round((s.present / (s.total || 1)) * 100)}%`} />
                <MiniStat icon="clock" tone="red" value={s.absent} label="Absent" note={`${Math.round((s.absent / (s.total || 1)) * 100)}%`} />
                <MiniStat icon="plane" tone="amber" value={s.leave} label="On Leave" note={`${Math.round((s.leave / (s.total || 1)) * 100)}%`} />
                <MiniStat icon="home" tone="blue" value={s.wfh} label="Work From Home" note={s.wfh == null ? "Not tracked by attendance records" : `${Math.round((s.wfh / (s.total || 1)) * 100)}%`} />
              </div>

              <div className="ap-tabs" role="tablist">
                {[["overview", "Overview"], ["attendance", "Attendance"], ["leave", "Leave"]].map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
                ))}
              </div>

              {tab === "overview" && (
                <div className="ap-overview">
                  <div className="ap-card"><h3>Attendance Summary</h3><Donut summary={s} /></div>
                  <div className="ap-card"><h3>Key Metrics</h3>
                    <div className="ap-metrics">
                      {(report.metrics || []).map((m) => (
                        <div key={m.label}><span className="ap-mini-icon green"><Icon name={m.icon || "clock"} size={18} /></span><span><b>{m.value}</b><small>{m.label}</small></span></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            !loading && !error && <p className="admin-note">No report data for this date.</p>
          )}
        </section>

        {s && (
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><h2>Employee Details ({longDate})</h2></div></div>
            <div className="ap-toolbar">
              <label className="ap-search"><Icon name="search" size={16} />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, employee ID, or department..." aria-label="Search employees" /></label>
              <label className="ap-filter"><small>Status</small>
                <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All Status</option>{["Present", "Absent", "On Leave", "Work From Home"].map((x) => <option key={x}>{x}</option>)}</select></label>
              <label className="ap-filter"><small>Department</small>
                <select value={dept} onChange={(e) => setDept(e.target.value)}><option value="ALL">All Departments</option>{depts.map((x) => <option key={x}>{x}</option>)}</select></label>
            </div>
            {rows.length === 0 ? <p className="admin-note">No employees match your filters.</p> : (
              <div className="admin-table-wrap">
                <table className="admin-table ap-table">
                  <thead><tr><th>#</th><th>EMPLOYEE</th><th>ID</th><th>DEPARTMENT</th><th>CHECK-IN</th><th>CHECK-OUT</th><th>WORK HOURS</th><th>STATUS</th><th>ASSIGNED LOCATION</th><th>REMARKS</th></tr></thead>
                  <tbody>
                    {rows.map((e, i) => (
                      <tr key={e.code || i}>
                        <td>{i + 1}</td>
                        <td><div className="ap-person"><Av name={e.name} i={i} size={28} /><strong>{e.name}</strong></div></td>
                        <td>{e.code}</td><td>{e.department}</td>
                        <td>{e.check_in || "—"}</td><td>{e.check_out || "—"}</td><td>{e.work_hours || "—"}</td>
                        <td><Pill>{e.status}</Pill></td><td>{e.location || "—"}</td><td>{e.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
