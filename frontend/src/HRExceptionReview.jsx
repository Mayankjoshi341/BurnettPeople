import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { NotConnected, Pager, StatCard } from "./DashboardParts";
import {
  AVATAR_TONES,
  SHOW_DEMO_DATA,
  callApi,
  downloadCsv,
  getArrayResponse,
  getErrorMessage,
  initialsOf,
} from "./dashboardUtils";
import "./HRPages.css";
import "./HRAttendance.css";

/* ------------------------------------------------------------------
   Set these when the backend is ready. While EXCEPTIONS_ENDPOINT is null,
   sample data is shown (when SHOW_DEMO_DATA is true).

   List  : GET  {EXCEPTIONS_ENDPOINT}
   Review: POST {EXCEPTIONS_ENDPOINT}{id}/review/   body: { decision: "APPROVED" | "REJECTED", remarks }
   (Tell me your real URLs / field names and I will align this file.)
   ------------------------------------------------------------------ */
const EXCEPTIONS_ENDPOINT = "/attendance/exceptions/";
const reviewUrl = (id) => `${EXCEPTIONS_ENDPOINT}${id}/review/`;

/* Tabs -> which exception types they show */
const CATEGORIES = [
  ["all", "All Exceptions"],
  ["break", "Break Exceptions"],
  ["lunch", "Lunch Exceptions"],
  ["login", "Login Exceptions"],
  ["early", "Early Check-out"],
  ["missing", "Missing Break"],
  ["other", "Other"],
];

function categoryOf(typeText = "") {
  const t = typeText.toLowerCase().replace(/[_-]/g, " ");
  if (/missing|not taken|missed lunch|no lunch/.test(t)) return "missing";
  if (/early (check|out|logout)/.test(t)) return "early";
  if (/lunch/.test(t)) return "lunch";
  if (/break|tea/.test(t)) return "break";
  if (/login|late|early (in|login)/.test(t)) return "login";
  return "other";
}

function prettyType(type = "") {
  return String(type)
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusKey(s = "") {
  const t = String(s).toUpperCase();
  if (t.startsWith("APPROV")) return "Approved";
  if (t.startsWith("REJECT")) return "Rejected";
  return "Pending";
}
const STATUS_TONE = { Pending: "warn", Approved: "ok", Rejected: "bad" };

const fmtDateTime = (iso) => {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: String(iso), time: "" };
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
};

function normalizeException(r, i) {
  const when = r.occurred_at || r.exception_time || r.submitted_at || r.created_at || "";
  const type = r.exception_label || r.exception_type || "Other";
  return {
    id: r.id ?? i,
    name: r.employee_name || r.employee?.name || r.employee_full_name || (r.employee_code ? `Employee ${r.employee_code}` : "—"),
    code: r.employee_code || r.employee?.employee_code || "—",
    department: r.department_name || r.employee?.department_name || "—",
    type: r.exception_label ? r.exception_label : prettyType(type),
    category: categoryOf(r.exception_type || r.exception_label || ""),
    when,
    details: r.reason || r.details || "—",
    status: statusKey(r.status_label || r.review_status || r.status),
    breakTime: r.break_time || "",
    allowed: r.allowed_window || "",
    deviation: r.deviation || "",
    location: r.location_name || "",
    recordedBy: r.recorded_by || "",
    explanation: r.explanation || r.reason || "",
    context: r.context || null,
    comment: r.review_comment || "",
  };
}

/* ---------- sample data ---------- */
const iso = (day, h, m) => new Date(2026, 9, day, h, m).toISOString();
const DEMO = [
  ["Aarav Sharma", "EMP001", "Engineering", "Lunch Out of Window", iso(15, 14, 20), "Took lunch at 2:20 PM due to client meeting.", "Pending", "lunch"],
  ["Neha Gupta", "EMP004", "Design", "Tea Break Out of Window", iso(15, 18, 25), "Tea break taken after 6 PM.", "Pending", "break"],
  ["Karan Mehta", "EMP007", "Sales", "Late Login", iso(15, 10, 45), "Traffic issue.", "Approved", "login"],
  ["Priya Singh", "EMP010", "Marketing", "Early Check-out", iso(14, 17, 30), "Left early for doctor appointment.", "Pending", "early"],
  ["Rohit Jain", "EMP011", "Finance", "Missing Lunch Break", iso(14, 0, 0), "No lunch break recorded.", "Rejected", "missing"],
  ["Simran Kaur", "EMP012", "HR", "Break Duration Exceeded", iso(14, 13, 0), "Lunch break 55 minutes (allowed 30 minutes).", "Pending", "break"],
  ["Vikram Kapoor", "EMP005", "Product", "Early Login", iso(13, 9, 15), "Came early to prepare for release.", "Approved", "login"],
  ["Ananya Singh", "EMP006", "Engineering", "Tea Break Missing", iso(13, 0, 0), "No tea break recorded (4 PM–6 PM).", "Pending", "missing"],
  ["Aditya Verma", "EMP013", "Design", "Break Out of Window", iso(12, 15, 45), "Took break before 4 PM.", "Pending", "break"],
  ["Meera Joshi", "EMP014", "Marketing", "Late Login", iso(12, 11, 10), "Personal work.", "Rejected", "login"],
].map(([name, code, department, type, when, details, status, category], i) => ({
  id: `demo-${i}`, name, code, department, type, category, when, details, status,
  breakTime: "02:20 PM – 02:50 PM (30m)", allowed: "01:00 PM – 02:00 PM (30m)", deviation: "20 minutes late",
  location: "Indore Office", recordedBy: "System (Attendance)", explanation: details, comment: "",
  context: [["Check-in", "10:02 AM (On Time)"], ["Lunch Break", "02:20 PM – 02:50 PM (30m)"], ["Tea Break", "04:15 PM – 04:35 PM (20m)"], ["Check-out", "06:58 PM (On Time)"], ["Total Work Hours", "8h 26m"]],
  demo: true,
}));

function ReviewPanel({ item, onClose, onDone }) {
  const [decision, setDecision] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const when = fmtDateTime(item.when);
  const reviewed = item.status !== "Pending";

  async function submit() {
    setMsg("");
    setErr("");
    if (!decision) { setErr("Choose Approve or Reject first."); return; }
    if (item.demo || !EXCEPTIONS_ENDPOINT) { setErr("This is sample data. Set EXCEPTIONS_ENDPOINT in HRExceptionReview.jsx to save decisions."); return; }
    setBusy(true);
    try {
      await callApi("patch", reviewUrl(item.id), { review_status: decision, review_comment: remarks.trim() });
      setMsg(decision === "APPROVED" ? "Exception approved." : "Exception rejected.");
      onDone();
    } catch (e) {
      setErr(getErrorMessage(e, "Could not save the decision."));
    } finally {
      setBusy(false);
    }
  }

  const rows = [
    ["alert", "Exception Type", item.type],
    ["calendar", "Date", when.date],
    ["clock", "Break Time", item.breakTime],
    ["clock", "Allowed Window", item.allowed],
    ["alert", "Deviation", item.deviation],
    ["building", "Location", item.location],
    ["user", "Recorded By", item.recordedBy],
  ].filter(([, , v]) => v);

  return (
    <aside className="hrp-side">
      <div className="hrp-card">
        <div className="hrp-card-head">
          <h3>Exception Details</h3>
          <button type="button" className="hrp-x static" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </div>
        <div className="hre-person">
          <span className="people-avatar" style={{ width: 46, height: 46, fontSize: 15, background: AVATAR_TONES[0] }}>{initialsOf(item.name)}</span>
          <div><strong>{item.name}</strong><small>{item.code} · {item.department}</small></div>
          <span className={`hrp-pill ${STATUS_TONE[item.status]}`}>{item.status}</span>
        </div>
        <dl className="hrp-kv">
          {rows.map(([, k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </div>

      {item.explanation && (
        <div className="hrp-card">
          <h3>Employee Explanation</h3>
          <p className="hre-quote">{item.explanation}</p>
        </div>
      )}

      {item.context && (
        <div className="hrp-card">
          <h3>Attendance Context</h3>
          <dl className="hrp-kv">
            {item.context.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
      )}

      <div className="hrp-card">
        <h3>Review Decision</h3>
        {reviewed ? (
          <p className="admin-note">
            This exception was already {item.status.toLowerCase()}.{item.comment ? ` Remarks: ${item.comment}` : ""}
          </p>
        ) : (
          <>
            <div className="hre-decision">
              <label className={decision === "APPROVED" ? "on" : ""}>
                <input type="radio" name="dec" checked={decision === "APPROVED"} onChange={() => setDecision("APPROVED")} />
                <span><strong>Approve</strong><small>Mark this exception as valid.</small></span>
              </label>
              <label className={decision === "REJECTED" ? "on" : ""}>
                <input type="radio" name="dec" checked={decision === "REJECTED"} onChange={() => setDecision("REJECTED")} />
                <span><strong>Reject</strong><small>Mark this exception as invalid.</small></span>
              </label>
            </div>
            <label className="hrp-label" htmlFor="rv-remarks">Remarks (Optional)</label>
            <textarea id="rv-remarks" rows={3} maxLength={300} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add remarks for the decision…" />
            {msg && <p className="admin-form-success" role="status">{msg}</p>}
            {err && <p className="admin-form-error" role="alert">{err}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button>
              <button type="button" className="admin-primary-button" onClick={submit} disabled={busy}>
                {busy ? "Saving…" : decision === "REJECTED" ? "Reject" : "Approve"}
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

export default function HRExceptionReview() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(EXCEPTIONS_ENDPOINT));
  const [error, setError] = useState("");

  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [dept, setDept] = useState("ALL");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selectedId, setSelectedId] = useState(null);
  const [checked, setChecked] = useState(() => new Set());

  const load = useCallback(async () => {
    if (!EXCEPTIONS_ENDPOINT) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get(EXCEPTIONS_ENDPOINT);
      setItems(getArrayResponse(res).map(normalizeException));
    } catch (e) {
      setItems([]);
      setError(getErrorMessage(e, "Could not load exception requests."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const demoMode = !EXCEPTIONS_ENDPOINT && SHOW_DEMO_DATA;
  const all = demoMode ? DEMO : items;

  const types = useMemo(() => [...new Set(all.map((x) => x.type))].sort(), [all]);
  const depts = useMemo(() => [...new Set(all.map((x) => x.department).filter((d) => d !== "—"))].sort(), [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (x) =>
        (cat === "all" || x.category === cat) &&
        (type === "ALL" || x.type === type) &&
        (status === "ALL" || x.status === status) &&
        (dept === "ALL" || x.department === dept) &&
        (!q || x.name.toLowerCase().includes(q) || String(x.code).toLowerCase().includes(q)),
    );
  }, [all, cat, query, type, status, dept]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);
  const selected = all.find((x) => x.id === selectedId) || null;

  const count = (s) => all.filter((x) => x.status === s).length;

  const toggleAll = (on) => setChecked(on ? new Set(visible.map((x) => x.id)) : new Set());
  const toggleOne = (id) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  function exportCsv() {
    downloadCsv("exception-review.csv", [
      ["Employee", "Code", "Department", "Exception Type", "Date", "Time", "Details", "Status"],
      ...filtered.map((x) => {
        const w = fmtDateTime(x.when);
        return [x.name, x.code, x.department, x.type, w.date, w.time, x.details, x.status];
      }),
    ]);
  }

  return (
    <div className="hrp-page">
      <div className="hrp-toolbar">
        <select className="admin-select" defaultValue="7" aria-label="Date range"><option value="7">Last 7 days</option></select>
        <button type="button" className="admin-secondary-button" onClick={exportCsv} disabled={!filtered.length}>
          <Icon name="arrow" size={14} /> Export
        </button>
      </div>

      {!EXCEPTIONS_ENDPOINT && (
        <NotConnected
          title="Exception review API is not connected yet."
          text={demoMode
            ? "These requests are sample data for the design. Set EXCEPTIONS_ENDPOINT in HRExceptionReview.jsx once the backend provides it."
            : "Set EXCEPTIONS_ENDPOINT in HRExceptionReview.jsx once the backend provides an HR review API."}
        />
      )}
      {error && <div className="admin-form-error" role="alert">{error}</div>}

      <section className="admin-summary-grid" aria-label="Exception summary">
        <StatCard icon="alert" tone="red" label="Total Exceptions" value={all.length || null} note="In selected period" />
        <StatCard icon="calendar" tone="amber" label="Pending Review" value={count("Pending")} note="Needs your action" />
        <StatCard icon="check" tone="green" label="Approved" value={count("Approved")} note="This period" />
        <StatCard icon="close" tone="red" label="Rejected" value={count("Rejected")} note="This period" />
      </section>

      <div className={`hrp-split ${selected ? "with-side" : ""}`}>
        <section className="admin-panel hrp-main" aria-label="Exception requests">
          <div className="hrp-tabbar" role="tablist">
            {CATEGORIES.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={cat === id} className={cat === id ? "on" : ""}
                onClick={() => { setCat(id); setPage(1); }}>{label}</button>
            ))}
          </div>

          <div className="hrp-filters hra-table-filters">
            <label className="people-search">
              <Icon name="search" size={16} />
              <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search by employee name or ID..." aria-label="Search" />
            </label>
            <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Exception type">
              <option value="ALL">All Types</option>{types.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
              <option value="ALL">All Status</option>
              {["Pending", "Approved", "Rejected"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }} aria-label="Department">
              <option value="ALL">All Departments</option>{depts.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <button type="button" className="admin-link-button" onClick={() => { setQuery(""); setType("ALL"); setStatus("ALL"); setDept("ALL"); setCat("all"); setPage(1); }}>Clear Filters</button>
          </div>

          <h3 className="hre-heading">Exception Requests ({filtered.length})</h3>

          {loading ? (
            <p className="admin-note">Loading exception requests…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-note">No exception requests to show.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table hrp-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" aria-label="Select all"
                      checked={visible.length > 0 && visible.every((x) => checked.has(x.id))}
                      onChange={(e) => toggleAll(e.target.checked)} /></th>
                    <th>#</th><th>EMPLOYEE</th><th>DEPARTMENT</th><th>EXCEPTION TYPE</th><th>DATE &amp; TIME</th><th>DETAILS</th><th>STATUS</th><th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((x, i) => {
                    const w = fmtDateTime(x.when);
                    return (
                      <tr key={x.id} className={selectedId === x.id ? "sel" : ""}>
                        <td><input type="checkbox" aria-label={`Select ${x.name}`} checked={checked.has(x.id)} onChange={() => toggleOne(x.id)} /></td>
                        <td>{start + i + 1}</td>
                        <td>
                          <div className="admin-person">
                            <span className="admin-person-avatar" style={{ background: AVATAR_TONES[(start + i) % AVATAR_TONES.length] }}>{initialsOf(x.name)}</span>
                            <span><strong>{x.name}</strong><small>{x.code}</small></span>
                          </div>
                        </td>
                        <td>{x.department}</td>
                        <td><span className={`hre-type ${x.category}`}>{x.type}</span></td>
                        <td>{w.date}<small className="hre-sub">{w.time}</small></td>
                        <td className="hre-details">{x.details}</td>
                        <td><span className={`hrp-pill ${STATUS_TONE[x.status]}`}>{x.status}</span></td>
                        <td>
                          <button type="button" className="admin-secondary-button hr-small" onClick={() => setSelectedId(x.id)}>
                            {x.status === "Pending" ? "Review" : "View"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pager page={safePage} pages={pages} onPage={(n) => setPage(Math.min(Math.max(n, 1), pages))}
            perPage={perPage} onPerPage={(n) => { setPerPage(n); setPage(1); }}
            total={filtered.length} shown={{ from: start + 1, to: Math.min(start + perPage, filtered.length) }} />
        </section>

        {selected && (
          <ReviewPanel key={selected.id} item={selected} onClose={() => setSelectedId(null)} onDone={load} />
        )}
      </div>
    </div>
  );
}
