import { useEffect, useMemo, useState } from "react";

import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { NotConnected, Pager } from "./DashboardParts";
import { AVATAR_TONES, downloadCsv, formatTime, getErrorMessage, initialsOf, todayISO } from "./dashboardUtils";
import "./HRReports.css";

/* ==================================================================
   HR  >  Reports  >  Daily Report
   ------------------------------------------------------------------
   BACKEND CONTRACT (to be built later - this page is the reference)

   GET /attendance/reports/daily/
       ?date=YYYY-MM-DD            required, any past day or today
       &department=<name>          optional
       &role=<EMPLOYEE|MANAGER|HR> optional
       &status=<PRESENT|ON_LEAVE|ABSENT|HALF_DAY>   optional (table only)
       &q=<text>                   optional: employee name, e-mail or employee code
       &page=1&page_size=10        table pagination

   200 OK
   {
     "date": "2026-10-19",
     "summary":  { "total": 124, "present": 100, "on_leave": 10, "absent": 6, "half_day": 8 },
     "previous": { "total": 124, "present": 97,  "on_leave": 12, "absent": 7, "half_day": 8 },   // the day before, optional (used for the trend arrows)
     "departments": [ { "name": "Engineering", "present": 25, "on_leave": 3, "absent": 2, "half_day": 4 }, ... ],
     "filters": { "departments": ["Engineering", ...], "roles": ["EMPLOYEE", "MANAGER", "HR"] },
     "employees": {
       "count": 124, "page": 1, "page_size": 10,
       "results": [ {
         "id": 1, "name": "Mayank Joshi", "email": "mayank@company.com", "employee_code": "EMP001",
         "role": "EMPLOYEE", "department": "Engineering", "schedule": "09:00 - 18:00",
         "check_in": "09:05", "check_out": "18:12", "work_hours": "8h 07m",
         "status": "PRESENT", "leave_type": null, "remark": ""
       } ]
     }
   }
   summary / departments are for the whole day and ignore the table filters.
   ================================================================== */
const DAILY_REPORT_ENDPOINT = "/attendance/reports/daily/";

/* While the API does not exist yet, show clearly-labelled SAMPLE data so the design can be reviewed.
   Set to false before production: the page then shows an error / "not connected" notice instead. */
const PREVIEW_SAMPLE_DATA = true;

const STATUS = {
  PRESENT: { label: "Present", color: "#0f9d6e", key: "present" },
  ON_LEAVE: { label: "On Leave", color: "#ef6a6a", key: "leave" },
  ABSENT: { label: "Absent", color: "#f5be3f", key: "absent" },
  HALF_DAY: { label: "Half Day", color: "#4a90e2", key: "half" },
};
const ORDER = ["PRESENT", "ON_LEAVE", "ABSENT", "HALF_DAY"];
const ROLE_LABEL = { ADMIN: "Admin", HR: "HR", MANAGER: "Manager", EMPLOYEE: "Employee" };

/* ---------- helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (iso) => new Date(`${iso}T00:00:00`);
const shift = (iso, days) => { const d = parseISO(iso); d.setDate(d.getDate() + days); return toISO(d); };
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
const timeText = (v) => (!v ? "—" : /^\d{4}-\d{2}-\d{2}T/.test(String(v)) ? formatTime(v) : String(v));
const asNumber = (v) => Number(v) || 0;

function normalizeSummary(s = {}) {
  return { total: asNumber(s.total), present: asNumber(s.present), leave: asNumber(s.on_leave ?? s.leave), absent: asNumber(s.absent), half: asNumber(s.half_day ?? s.half) };
}
function normalizeReport(res) {
  const list = Array.isArray(res?.employees) ? res.employees : res?.employees?.results || [];
  return {
    date: res?.date,
    summary: normalizeSummary(res?.summary),
    previous: res?.previous ? normalizeSummary(res.previous) : null,
    departments: (res?.departments || []).map((d) => ({ name: d.name || "—", present: asNumber(d.present), leave: asNumber(d.on_leave ?? d.leave), absent: asNumber(d.absent), half: asNumber(d.half_day ?? d.half) })),
    filters: { departments: res?.filters?.departments || [], roles: res?.filters?.roles || [] },
    count: res?.employees?.count ?? list.length,
    rows: list.map((e, i) => ({
      id: e.id ?? i,
      name: e.name || e.full_name || "—",
      email: e.email || e.official_email || "",
      code: e.employee_code || e.code || "—",
      role: String(e.role || e.portal_role || "").toUpperCase(),
      department: e.department || e.department_name || "—",
      schedule: e.schedule || "—",
      checkIn: e.check_in, checkOut: e.check_out, hours: e.work_hours || "—",
      status: String(e.status || "").toUpperCase(),
      remark: e.leave_type || e.remark || "",
    })),
  };
}

/* ---------- sample data (design preview only) ---------- */
const FIRST = ["Mayank", "Anita", "Rohit", "Priya", "Neha", "Vikram", "Sneha", "Amit", "Pooja", "Karan", "Aarav", "Simran", "Rahul", "Kavya", "Aditya", "Meera"];
const LAST = ["Joshi", "Sharma", "Kumar", "Rathi", "Kapoor", "Singh", "Desai", "Mehta", "Lakhwani", "Gupta", "Verma", "Nair", "Iyer", "Patel"];
const SAMPLE_DEPTS = ["Engineering", "Product", "Design", "HR", "Sales", "Other"];
const SAMPLE_ROWS = Array.from({ length: 124 }, (_, i) => {
  const status = i % 12 === 3 ? "ON_LEAVE" : i % 20 === 7 ? "ABSENT" : i % 15 === 5 ? "HALF_DAY" : "PRESENT";
  const away = status === "ON_LEAVE" || status === "ABSENT";
  const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 3 + 1) % LAST.length]}`;
  return {
    id: i + 1, name, email: `${name.split(" ")[0].toLowerCase()}${i}@burnettpeople.com`, employee_code: `EMP${String(i + 1).padStart(3, "0")}`,
    role: i % 11 === 2 ? "MANAGER" : i % 17 === 4 ? "HR" : "EMPLOYEE", department: SAMPLE_DEPTS[(i * 5) % SAMPLE_DEPTS.length],
    schedule: "09:00 - 18:00", check_in: away ? null : `09:${pad((i * 7) % 30)}`, check_out: away || status === "HALF_DAY" ? null : `18:${pad((i * 5) % 30)}`,
    work_hours: away ? null : status === "HALF_DAY" ? "4h 10m" : `8h ${pad((i * 3) % 40)}m`, status,
    leave_type: status === "ON_LEAVE" ? ["Sick Leave", "Casual Leave", "Personal Work"][i % 3] : null, remark: "",
  };
});
function sampleReport({ department, role, status, q, page, pageSize }) {
  const count = (list, s) => list.filter((r) => r.status === s).length;
  const summaryOf = (list) => ({ total: list.length, present: count(list, "PRESENT"), on_leave: count(list, "ON_LEAVE"), absent: count(list, "ABSENT"), half_day: count(list, "HALF_DAY") });
  const needle = (q || "").trim().toLowerCase();
  const filtered = SAMPLE_ROWS.filter((r) =>
    (!department || r.department === department) && (!role || r.role === role) && (!status || r.status === status) &&
    (!needle || [r.name, r.email, r.employee_code].some((v) => v.toLowerCase().includes(needle))));
  const summary = summaryOf(SAMPLE_ROWS);
  return {
    summary,
    previous: { ...summary, present: summary.present - 3, on_leave: summary.on_leave + 2, absent: summary.absent + 1 },
    departments: SAMPLE_DEPTS.map((name) => { const list = SAMPLE_ROWS.filter((r) => r.department === name); const s = summaryOf(list); return { name, present: s.present, on_leave: s.on_leave, absent: s.absent, half_day: s.half_day }; }),
    filters: { departments: SAMPLE_DEPTS, roles: ["EMPLOYEE", "MANAGER", "HR"] },
    employees: { count: filtered.length, results: filtered.slice((page - 1) * pageSize, page * pageSize) },
  };
}

/* ---------- small visual components ---------- */
function Trend({ now, before, total, totalBefore, isTotal }) {
  if (before === undefined || before === null) return null;
  let value;
  if (isTotal) value = before ? Math.round(((now - before) / before) * 100) : 0;
  else value = Math.round(pct(now, total) - pct(before, totalBefore));
  const up = value >= 0;
  return <em className={`hrr-trend ${up ? "up" : "down"}`}>{up ? "↗" : "↘"} {Math.abs(value)}%</em>;
}

function StatTile({ icon, tone, label, value, share, trend, caption }) {
  return (
    <div className={`hrr-stat ${tone}`}>
      <span className="hrr-stat-icon"><Icon name={icon} size={24} /></span>
      <span className="hrr-stat-body">
        <small>{label}</small>
        <b>{value ?? "—"}</b>
        {caption && <i>{caption}</i>}
      </span>
      <span className="hrr-stat-side">
        {share !== undefined && <span className="hrr-share">{share}%</span>}
        {trend}
      </span>
    </div>
  );
}

function DatePicker({ value, onChange }) {
  const sel = parseISO(value);
  const [cursor, setCursor] = useState({ y: sel.getFullYear(), m: sel.getMonth() });
  const today = todayISO();
  const first = new Date(cursor.y, cursor.m, 1).getDay();
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const move = (n) => setCursor((c) => { const d = new Date(c.y, c.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <div className="hrr-cal">
      <div className="hrr-cal-head">
        <button type="button" onClick={() => move(-1)} aria-label="Previous month"><Icon name="chevleft" size={16} /></button>
        <strong>{new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</strong>
        <button type="button" onClick={() => move(1)} aria-label="Next month"><Icon name="chevron" size={16} /></button>
      </div>
      <div className="hrr-cal-grid" role="grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => <span key={w} className="wd">{w}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const iso = `${cursor.y}-${pad(cursor.m + 1)}-${pad(d)}`;
          const weekend = [0, 6].includes(new Date(cursor.y, cursor.m, d).getDay());
          const future = iso > today;
          return (
            <button key={d} type="button" disabled={future} aria-pressed={iso === value}
              className={["day", iso === value && "sel", iso === today && "today", weekend && "we"].filter(Boolean).join(" ")}
              onClick={() => onChange(iso)}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}

function Donut({ summary }) {
  const total = summary.total || 1;
  const R = 56, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 160 160" className="hrr-donut" role="img" aria-label="Attendance distribution">
      <circle cx="80" cy="80" r={R} fill="none" stroke="var(--ad-border)" strokeWidth="20" />
      {ORDER.map((k) => {
        const v = summary[STATUS[k].key];
        const len = (v / total) * C;
        const el = v > 0 ? <circle key={k} cx="80" cy="80" r={R} fill="none" stroke={STATUS[k].color} strokeWidth="20" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)" /> : null;
        offset += len;
        return el;
      })}
      <text x="80" y="78" textAnchor="middle" className="n">{summary.total}</text>
      <text x="80" y="97" textAnchor="middle" className="l">Employees</text>
    </svg>
  );
}

function DeptChart({ departments }) {
  const W = 560, H = 230, L = 34, B = 28, T = 8, R = 6;
  const totals = departments.map((d) => d.present + d.leave + d.absent + d.half);
  const top = Math.max(10, Math.ceil(Math.max(...totals, 1) / 10) * 10);
  const slot = (W - L - R) / Math.max(departments.length, 1);
  const bw = Math.min(40, slot * 0.55);
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const ticks = [];
  for (let v = 0; v <= top; v += top / 5) ticks.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="hrr-bars" role="img" aria-label="Department-wise attendance">
      {ticks.map((v) => (<g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 8} y={y(v) + 4} textAnchor="end">{Math.round(v)}</text></g>))}
      {departments.map((d, i) => {
        const x = L + i * slot + (slot - bw) / 2;
        let base = 0;
        return (
          <g key={d.name}>
            {[["PRESENT", d.present], ["ON_LEAVE", d.leave], ["ABSENT", d.absent], ["HALF_DAY", d.half]].map(([k, v]) => {
              const rect = v > 0 ? <rect key={k} x={x} y={y(base + v)} width={bw} height={y(base) - y(base + v)} fill={STATUS[k].color} /> : null;
              base += v;
              return rect;
            })}
            <text x={x + bw / 2} y={H - 8} textAnchor="middle">{d.name.length > 11 ? `${d.name.slice(0, 10)}…` : d.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

function StatusPill({ status }) {
  const meta = STATUS[status];
  return <span className={`hrr-pill ${meta?.key || "none"}`}>{meta?.label || "—"}</span>;
}

function DetailModal({ row, index, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rows = [["Employee ID", row.code], ["Email", row.email || "—"], ["Role", ROLE_LABEL[row.role] || "—"], ["Department", row.department], ["Work schedule", row.schedule], ["Check in", timeText(row.checkIn)], ["Check out", timeText(row.checkOut)], ["Work hours", row.hours], ["Leave type / remark", row.remark || "—"]];
  return (
    <div className="admin-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal hrr-modal" role="dialog" aria-modal="true" aria-labelledby="hrr-detail-title">
        <div className="admin-modal-heading">
          <div className="hrr-person big">
            <span className="hrr-av" style={{ background: AVATAR_TONES[index % AVATAR_TONES.length] }}>{initialsOf(row.name)}</span>
            <div><h2 id="hrr-detail-title">{row.name}</h2><StatusPill status={row.status} /></div>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <dl className="hrr-kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </div>
    </div>
  );
}

/* ---------- page ---------- */
export default function HRReports() {
  const [date, setDate] = useState(todayISO);
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [report, setReport] = useState(null);
  const [source, setSource] = useState("loading"); // loading | api | sample | error
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let off = false;
    const timer = setTimeout(async () => {
      setSource((s) => (s === "api" || s === "sample" ? s : "loading"));
      const params = { date, department, role, status, q: query, page, pageSize };
      try {
        const qs = new URLSearchParams({ date, page: String(page), page_size: String(pageSize) });
        [["department", department], ["role", role], ["status", status], ["q", query.trim()]].forEach(([k, v]) => v && qs.set(k, v));
        const res = await apiClient.get(`${DAILY_REPORT_ENDPOINT}?${qs}`);
        if (!off) { setReport(normalizeReport(res)); setSource("api"); setError(""); }
      } catch (e) {
        if (off) return;
        if (PREVIEW_SAMPLE_DATA) { setReport(normalizeReport(sampleReport(params))); setSource("sample"); setError(""); }
        else { setReport(null); setSource("error"); setError(getErrorMessage(e, "Could not load the daily report.")); }
      }
    }, 250);
    return () => { off = true; clearTimeout(timer); };
  }, [date, department, role, status, query, page, pageSize]);

  const s = report?.summary;
  const prev = report?.previous;
  const pages = Math.max(1, Math.ceil((report?.count || 0) / pageSize));
  const isToday = date === todayISO();
  const filtersActive = Boolean(department || role || status || query);

  const dateText = useMemo(() => parseISO(date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }), [date]);

  const pick = (setter) => (e) => { setter(e.target.value); setPage(1); };
  const resetFilters = () => { setDepartment(""); setRole(""); setStatus(""); setQuery(""); setPage(1); };
  const goTo = (iso) => { if (iso <= todayISO()) { setDate(iso); setPage(1); } };

  function exportReport() {
    if (!report) return;
    downloadCsv(`daily-report-${date}.csv`, [
      ["Employee", "Employee ID", "Role", "Department", "Work Schedule", "Check In", "Check Out", "Work Hours", "Status", "Leave Type / Remark"],
      ...report.rows.map((r) => [r.name, r.code, ROLE_LABEL[r.role] || "", r.department, r.schedule, timeText(r.checkIn), timeText(r.checkOut), r.hours, STATUS[r.status]?.label || "", r.remark]),
    ]);
  }

  return (
    <div className="hrr-page">
      <div className="hrr-controls">
        <div className="hrr-date">
          <button type="button" className="hrr-icon-btn" onClick={() => goTo(shift(date, -1))} aria-label="Previous day"><Icon name="chevleft" size={16} /></button>
          <label><Icon name="calendar" size={16} />
            <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && goTo(e.target.value)} aria-label="Report date" />
            <span>{dateText}</span></label>
          <button type="button" className="hrr-icon-btn" onClick={() => goTo(shift(date, 1))} disabled={isToday} aria-label="Next day"><Icon name="chevron" size={16} /></button>
        </div>
        <button type="button" className="admin-secondary-button" onClick={() => goTo(todayISO())} disabled={isToday}>Today</button>
        <button type="button" className="admin-primary-button" onClick={exportReport} disabled={!report}><Icon name="download" size={16} /> Export Report</button>
      </div>

      {source === "sample" && (
        <NotConnected title="Sample data (design preview)" text={`The daily report API is not connected yet, so these numbers are made up. The backend contract is written at the top of HRReports.jsx (GET ${DAILY_REPORT_ENDPOINT}). Set PREVIEW_SAMPLE_DATA to false before production.`} />
      )}
      {source === "error" && <div role="alert" className="admin-form-error">{error} <br />Expected endpoint: GET {DAILY_REPORT_ENDPOINT}?date={date}</div>}
      {source === "loading" && !report && <p className="admin-note">Loading daily report…</p>}

      {report && s && (
        <>
          <section className="hrr-stats" aria-label="Day summary">
            <StatTile icon="users" tone="blue" label="Total Employees" value={s.total}
              trend={<Trend isTotal now={s.total} before={prev?.total} />} caption={prev ? "vs previous day" : ""} />
            <StatTile icon="check" tone="green" label="Present" value={s.present} share={pct(s.present, s.total)}
              trend={<Trend now={s.present} before={prev?.present} total={s.total} totalBefore={prev?.total} />} />
            <StatTile icon="calendar" tone="red" label="On Leave" value={s.leave} share={pct(s.leave, s.total)}
              trend={<Trend now={s.leave} before={prev?.leave} total={s.total} totalBefore={prev?.total} />} />
            <StatTile icon="user" tone="rose" label="Absent" value={s.absent} share={pct(s.absent, s.total)}
              trend={<Trend now={s.absent} before={prev?.absent} total={s.total} totalBefore={prev?.total} />} />
            <StatTile icon="clock" tone="amber" label="Half Day" value={s.half} share={pct(s.half, s.total)}
              trend={<Trend now={s.half} before={prev?.half} total={s.total} totalBefore={prev?.total} />} />
          </section>

          <div className="hrr-top">
            <section className="admin-panel" aria-labelledby="hrr-cal-title">
              <div className="admin-panel-heading"><div><h2 id="hrr-cal-title">Select Date</h2></div></div>
              <DatePicker key={date.slice(0, 7)} value={date} onChange={goTo} />
            </section>

            <section className="admin-panel" aria-labelledby="hrr-dist-title">
              <div className="admin-panel-heading"><div><h2 id="hrr-dist-title">Attendance Distribution</h2></div></div>
              <div className="hrr-dist">
                <Donut summary={s} />
                <ul className="hrr-legend">
                  {ORDER.map((k) => (
                    <li key={k}><i style={{ background: STATUS[k].color }} /><span>{STATUS[k].label}</span><b>{s[STATUS[k].key]}</b><em>({pct(s[STATUS[k].key], s.total)}%)</em></li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="admin-panel" aria-labelledby="hrr-dept-title">
              <div className="admin-panel-heading"><div><h2 id="hrr-dept-title">Department-wise Attendance</h2></div></div>
              <div className="hrr-chart-legend">{ORDER.map((k) => <span key={k}><i style={{ background: STATUS[k].color }} /> {STATUS[k].label}</span>)}</div>
              {report.departments.length ? <DeptChart departments={report.departments} /> : <p className="admin-note">No department data for this day.</p>}
            </section>
          </div>

          <section className="admin-panel hrr-filters" aria-label="Filters">
            <select value={department} onChange={pick(setDepartment)} aria-label="Department"><option value="">All Departments</option>{report.filters.departments.map((d) => <option key={d} value={d}>{d}</option>)}</select>
            <select value={role} onChange={pick(setRole)} aria-label="Role"><option value="">All Roles</option>{report.filters.roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] || r}</option>)}</select>
            <select value={status} onChange={pick(setStatus)} aria-label="Status"><option value="">All Status</option>{ORDER.map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}</select>
            <label className="hrr-search"><Icon name="search" size={16} />
              <input type="search" value={query} onChange={pick(setQuery)} placeholder="Search by employee name, email or ID..." aria-label="Search employees" /></label>
            <button type="button" className="admin-secondary-button" onClick={resetFilters} disabled={!filtersActive}><Icon name="refresh" size={15} /> Reset</button>
          </section>

          <section className="admin-panel" aria-labelledby="hrr-table-title">
            <div className="admin-panel-heading">
              <div><h2 id="hrr-table-title">Employee Attendance ({report.count})</h2><p>{dateText}</p></div>
              <div className="hrr-chart-legend inline">{ORDER.map((k) => <span key={k}><i style={{ background: STATUS[k].color }} /> {STATUS[k].label}</span>)}</div>
            </div>

            {report.rows.length === 0 ? (
              <p className="admin-note">{filtersActive ? "No employees match these filters." : "No attendance records for this day."}</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table hrr-table">
                  <thead><tr><th>#</th><th>EMPLOYEE</th><th>ROLE</th><th>DEPARTMENT</th><th>WORK SCHEDULE</th><th>CHECK IN</th><th>CHECK OUT</th><th>WORK HOURS</th><th>STATUS</th><th>LEAVE TYPE / REMARK</th><th /></tr></thead>
                  <tbody>
                    {report.rows.map((r, i) => (
                      <tr key={r.id}>
                        <td>{(page - 1) * pageSize + i + 1}</td>
                        <td>
                          <div className="hrr-person">
                            <span className="hrr-av" style={{ background: AVATAR_TONES[i % AVATAR_TONES.length] }}>{initialsOf(r.name)}</span>
                            <span><strong>{r.name}</strong><small>{r.email || r.code}</small></span>
                          </div>
                        </td>
                        <td className="hrr-role">{ROLE_LABEL[r.role] || "—"}</td>
                        <td>{r.department}</td>
                        <td>{r.schedule}</td>
                        <td>{timeText(r.checkIn)}</td>
                        <td>{timeText(r.checkOut)}</td>
                        <td>{r.hours}</td>
                        <td><StatusPill status={r.status} /></td>
                        <td>{r.remark || "—"}</td>
                        <td><button type="button" className="admin-secondary-button hrr-view" onClick={() => setDetail({ row: r, index: i })}>View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {report.count > 0 && (
              <Pager page={page} pages={pages} total={report.count} size={pageSize} onPage={(n) => setPage(Math.min(Math.max(1, n), pages))}
                onSize={(n) => { setPageSize(n); setPage(1); }} noun="results" />
            )}
          </section>
        </>
      )}

      {detail && <DetailModal row={detail.row} index={detail.index} onClose={() => setDetail(null)} />}
    </div>
  );
}