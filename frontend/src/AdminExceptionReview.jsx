import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { callApi, getArrayResponse, getErrorMessage, useEmployees } from "./dashboardUtils";
import { Av, MiniStat, Pager, downloadCsv } from "./AdminUi";
import "./AdminPages.css";
import "./AdminExceptionReview.css";

/* ------------------------------------------------------------------
   Backend (change these if your URLs differ). Only real data is shown: if the API
   does not send a field, that row of the details panel is simply not displayed.

   List   : GET  {EXCEPTIONS_ENDPOINT}
            (same URL EmployeeDashboard writes to; for Admin it should return everyone's exceptions)
   Review : POST {EXCEPTIONS_ENDPOINT}{id}/review/   body { decision: "APPROVED" | "REJECTED", remarks }
   Optional fields used when present on a record:
     employee_name, employee_code, department_name, exception_type, exception_label, reason,
     status_label / review_status, submitted_at / occurred_at, review_comment,
     break_time, allowed_window, deviation, location_name, recorded_by,
     attendance_context { check_in, lunch_break, tea_break, check_out, total_work_hours }
   ------------------------------------------------------------------ */
const EXCEPTIONS_ENDPOINT = "/attendance/exceptions/";
const reviewUrl = (id) => `${EXCEPTIONS_ENDPOINT}${id}/review/`;

const CATEGORIES = [
  ["all", "All Exceptions"],
  ["leave", "Leave Exceptions"],
  ["break", "Break Exceptions"],
  ["login", "Login Exceptions"],
  ["early", "Early Check-out"],
  ["missing", "Missing Break"],
  ["other", "Other"],
];

const ROLE_OPTIONS = [["ALL", "All Employees"], ["HR", "HR Employees"], ["MANAGER", "Managers"], ["EMPLOYEE", "Employees"]];
const RANGES = [["all", "All time"], ["7", "Last 7 days"], ["30", "Last 30 days"]];
const STATUS_TONE = { Pending: "amber", Approved: "green", Rejected: "red" };

function categoryOf(text = "") {
  const t = String(text).toLowerCase().replace(/[_-]/g, " ");
  if (/missing|not taken|no lunch/.test(t)) return "missing";
  if (/early (check|out|logout)/.test(t)) return "early";
  if (/leave/.test(t)) return "leave";
  if (/lunch|break|tea/.test(t)) return "break";
  if (/login|late|check in|early (in|login)/.test(t)) return "login";
  return "other";
}
const pretty = (type = "") => String(type).toLowerCase().replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const statusKey = (s = "") => {
  const t = String(s).toUpperCase();
  return t.startsWith("APPROV") ? "Approved" : t.startsWith("REJECT") ? "Rejected" : "Pending";
};
const when = (iso) => {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: String(iso), time: "" };
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
};
const CONTEXT_LABELS = { check_in: "Check-in", lunch_break: "Lunch Break", tea_break: "Tea Break", check_out: "Check-out", total_work_hours: "Total Work Hours" };

function ExceptionPanel({ item, onClose, onDone }) {
  const [decision, setDecision] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const w = when(item.when);
  const pending = item.status === "Pending";

  async function submit() {
    setMsg("");
    setErr("");
    if (!decision) { setErr("Choose Approve or Reject first."); return; }
    setBusy(true);
    try {
      await callApi("post", reviewUrl(item.id), { decision, remarks: remarks.trim() });
      setMsg(decision === "APPROVED" ? "Exception approved." : "Exception rejected.");
      onDone();
    } catch (e) {
      setErr(getErrorMessage(e, "Could not save the decision."));
    } finally {
      setBusy(false);
    }
  }

  const rows = [
    ["Exception Type", <span key="t" className={`aex-type ${item.category}`}>{item.type}</span>],
    ["Date", w.date + (w.time ? `, ${w.time}` : "")],
    item.breakTime && ["Break Time", item.breakTime],
    item.allowed && ["Allowed Window", item.allowed],
    item.deviation && ["Deviation", <span key="d" className="aex-red">{item.deviation}</span>],
    item.department !== "—" && ["Department", item.department],
    item.location && ["Location", item.location],
    item.recordedBy && ["Recorded By", item.recordedBy],
  ].filter(Boolean);

  const ctx = item.context ? Object.entries(item.context).filter(([, v]) => v !== null && v !== undefined && typeof v !== "object") : [];

  return (
    <aside className="admin-panel ap-side aex-panel" aria-label="Exception details">
      <div className="ap-side-head"><div><h2>Exception Details</h2></div>
        <button type="button" className="ap-x" onClick={onClose} aria-label="Close panel"><Icon name="close" size={16} /></button></div>

      <div className="ap-person aex-who">
        <Av name={item.name} i={1} size={46} />
        <span><strong>{item.name}</strong><small>{item.code !== "—" ? `${item.code} · ` : ""}{item.roleLabel}</small></span>
        <span className={`ap-pill ${STATUS_TONE[item.status]}`}>{item.status}</span>
      </div>

      <dl className="aex-kv">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>

      {item.explanation && (
        <section className="aex-block"><h3>Employee Explanation</h3><p className="aex-quote">{item.explanation}</p></section>
      )}

      {ctx.length > 0 && (
        <section className="aex-block"><h3>Attendance Context</h3>
          <dl className="aex-kv">{ctx.map(([k, v]) => <div key={k}><dt>{CONTEXT_LABELS[k] || pretty(k)}</dt><dd>{String(v)}</dd></div>)}</dl></section>
      )}

      <section className="aex-block"><h3>Review Decision</h3>
        {!pending ? (
          <p className="admin-note">This exception was already {item.status.toLowerCase()}.{item.comment ? ` Remarks: ${item.comment}` : ""}</p>
        ) : (
          <>
            <div className="aex-decision">
              <label className={decision === "APPROVED" ? "on" : ""}>
                <input type="radio" name="aex-dec" checked={decision === "APPROVED"} onChange={() => setDecision("APPROVED")} />
                <span><strong>Approve</strong><small>Mark this exception as valid.</small></span></label>
              <label className={decision === "REJECTED" ? "on" : ""}>
                <input type="radio" name="aex-dec" checked={decision === "REJECTED"} onChange={() => setDecision("REJECTED")} />
                <span><strong>Reject</strong><small>Mark this exception as invalid.</small></span></label>
            </div>
            <div className="ap-field"><label htmlFor="aex-remarks">Remarks (Optional)</label>
              <textarea id="aex-remarks" rows={3} maxLength={300} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add remarks for the decision…" /></div>
            {msg && <div role="status" className="admin-form-success">{msg}</div>}
            {err && <div role="alert" className="admin-form-error">{err}</div>}
            <div className="ap-side-actions">
              <button type="button" className="admin-secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="admin-primary-button" onClick={submit} disabled={busy}>{busy ? "Saving…" : decision === "REJECTED" ? "Reject" : "Approve"}</button>
            </div>
          </>
        )}
      </section>
    </aside>
  );
}

export default function AdminExceptionReview() {
  const { employees } = useEmployees();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [dept, setDept] = useState("ALL");
  const [range, setRange] = useState("all");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [selectedId, setSelectedId] = useState(null);

  // lets us show an employee's role / department even if the exception record only has an id
  const lookup = useMemo(() => {
    const map = new Map();
    employees.forEach((e) => [e.id, e.code, e.email].forEach((k) => k != null && k !== "—" && map.set(String(k).toLowerCase(), e)));
    return map;
  }, [employees]);

  const normalize = useCallback((r, i) => {
    const keys = [r.employee?.id ?? r.employee, r.employee_id, r.employee_code, r.employee_email, r.employee?.employee_code, r.employee?.official_email]
      .filter((v) => v != null && typeof v !== "object").map((v) => String(v).toLowerCase());
    const emp = keys.map((k) => lookup.get(k)).find(Boolean);
    const name = r.employee_name || r.employee_full_name || r.author_name || r.employee?.name
      || [r.employee?.first_name, r.employee?.last_name].filter(Boolean).join(" ") || emp?.name || "—";
    const typeText = r.exception_label || pretty(r.exception_type || "Other");
    const role = r.employee_role || r.portal_role || emp?.role || "";
    return {
      id: r.id ?? i,
      name,
      code: r.employee_code || emp?.code || "—",
      department: r.department_name || emp?.department || "—",
      role,
      roleLabel: ROLE_OPTIONS.find(([v]) => v === role)?.[1]?.replace(/s$/, "") || "Employee",
      type: typeText,
      category: categoryOf(r.exception_type || typeText),
      when: r.occurred_at || r.exception_time || r.submitted_at || r.created_at || "",
      details: r.reason || r.details || "—",
      status: statusKey(r.status_label || r.review_status || r.status),
      explanation: r.explanation || r.reason || "",
      breakTime: r.break_time || "",
      allowed: r.allowed_window || "",
      deviation: r.deviation || "",
      location: r.location_name || "",
      recordedBy: r.recorded_by || "",
      context: r.attendance_context && typeof r.attendance_context === "object" ? r.attendance_context : null,
      comment: r.review_comment || "",
    };
  }, [lookup]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get(EXCEPTIONS_ENDPOINT);
      setItems(getArrayResponse(res));
    } catch (e) {
      setItems([]);
      setError(getErrorMessage(e, "Could not load exception requests."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  const all = useMemo(() => items.map(normalize), [items, normalize]);

  // date range applies to the stats and to the table
  const inRange = useMemo(() => {
    if (range === "all") return all;
    const cutoff = Date.now() - Number(range) * 86400000;
    return all.filter((x) => { const t = new Date(x.when).getTime(); return Number.isNaN(t) || t >= cutoff; });
  }, [all, range]);

  const depts = useMemo(() => [...new Set(all.map((x) => x.department).filter((d) => d !== "—"))].sort(), [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inRange.filter((x) =>
      (cat === "all" || x.category === cat) &&
      (roleFilter === "ALL" || x.role === roleFilter) &&
      (status === "ALL" || x.status === status) &&
      (dept === "ALL" || x.department === dept) &&
      (!q || x.name.toLowerCase().includes(q) || String(x.code).toLowerCase().includes(q)));
  }, [inRange, cat, roleFilter, status, dept, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * size, safePage * size);
  const selected = all.find((x) => x.id === selectedId) || null;
  const count = (s) => inRange.filter((x) => x.status === s).length;
  const firstIndex = (safePage - 1) * size;

  const reset = () => { setQuery(""); setRoleFilter("ALL"); setStatus("ALL"); setDept("ALL"); setCat("all"); setPage(1); };
  const on = (setter) => (e) => { setter(e.target.value); setPage(1); };

  function exportCsv() {
    downloadCsv("exception-review.csv", ["Employee", "ID", "Department", "Exception Type", "Date", "Time", "Details", "Status"],
      filtered.map((x) => { const w = when(x.when); return [x.name, x.code, x.department, x.type, w.date, w.time, x.details, x.status]; }));
  }

  return (
    <div className="ap-page aex-page">
      <div className="aex-top">
        <label className="aex-range"><Icon name="calendar" size={16} />
          <select value={range} onChange={on(setRange)} aria-label="Date range">{RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <button type="button" className="admin-secondary-button" onClick={exportCsv} disabled={!filtered.length}><Icon name="download" size={16} /> Export</button>
      </div>

      <section className="ap-stats four" aria-label="Exception summary">
        <MiniStat icon="alert" tone="red" value={loading ? "…" : inRange.length} label="Total Exceptions" note="In selected period" />
        <MiniStat icon="clock" tone="amber" value={count("Pending")} label="Pending Review" note="Needs your action" />
        <MiniStat icon="check" tone="green" value={count("Approved")} label="Approved" note="This period" />
        <MiniStat icon="close" tone="red" value={count("Rejected")} label="Rejected" note="This period" />
      </section>

      <div className={`ap-split${selected ? " has-side" : ""}`}>
        <section className="admin-panel ap-main" aria-label="Exception requests">
          <div className="ap-tabs" role="tablist">
            {CATEGORIES.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={cat === id} className={cat === id ? "on" : ""} onClick={() => { setCat(id); setPage(1); }}>{label}</button>
            ))}
          </div>

          <div className="ap-toolbar">
            <label className="ap-search"><Icon name="search" size={16} />
              <input type="search" value={query} onChange={on(setQuery)} placeholder="Search by employee name or ID..." aria-label="Search" /></label>
            <label className="ap-filter"><small>Employee Type</small>
              <select value={roleFilter} onChange={on(setRoleFilter)}>{ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="ap-filter"><small>Status</small>
              <select value={status} onChange={on(setStatus)}><option value="ALL">All Status</option>{["Pending", "Approved", "Rejected"].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="ap-filter"><small>Department</small>
              <select value={dept} onChange={on(setDept)}><option value="ALL">All Departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</select></label>
            <button type="button" className="admin-link-button" onClick={reset}>Clear Filters</button>
          </div>

          <h3 className="aex-heading">Exception Requests ({filtered.length})</h3>
          {error && <div role="alert" className="admin-form-error">{error}</div>}

          {loading ? <p className="admin-note">Loading exception requests…</p> : filtered.length === 0 ? (
            <p className="admin-note">{error ? "Exception requests could not be loaded." : "No exception requests match your filters."}</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table ap-table">
                <thead><tr><th>#</th><th>EMPLOYEE</th><th>DEPARTMENT</th><th>EXCEPTION TYPE</th><th>DATE &amp; TIME</th><th>DETAILS</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  {visible.map((x, i) => {
                    const w = when(x.when);
                    return (
                      <tr key={x.id} className={selectedId === x.id ? "sel" : ""}>
                        <td>{firstIndex + i + 1}</td>
                        <td><div className="ap-person"><Av name={x.name} i={firstIndex + i} size={34} /><span><strong>{x.name}</strong><small>{x.code}</small></span></div></td>
                        <td>{x.department}</td>
                        <td><span className={`aex-type ${x.category}`}>{x.type}</span></td>
                        <td>{w.date}<small className="aex-sub">{w.time}</small></td>
                        <td className="aex-details">{x.details}</td>
                        <td><span className={`ap-pill ${STATUS_TONE[x.status]}`}>{x.status}</span></td>
                        <td><button type="button" className="admin-secondary-button ap-small" onClick={() => setSelectedId(x.id)}>{x.status === "Pending" ? "Review" : "View"}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <Pager page={safePage} pages={pages} total={filtered.length} size={size} onPage={(n) => setPage(Math.min(Math.max(1, n), pages))} onSize={(n) => { setSize(n); setPage(1); }} noun="requests" />
          )}
        </section>

        {selected && <ExceptionPanel key={selected.id} item={selected} onClose={() => setSelectedId(null)} onDone={load} />}
      </div>
    </div>
  );
}