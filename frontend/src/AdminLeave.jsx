import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { StatCard, Pager } from "./DashboardParts";
import {
  AVATAR_TONES,
  callApi,
  getArrayResponse,
  getErrorMessage,
  initialsOf,
} from "./dashboardUtils";
import "./HRPages.css";
import "./AdminHRLeave.css";

/* Leave request endpoints are registered under /api/leave/ in Django. */
const LEAVE_ENDPOINT = "/leave/requests/";

const STATUS_TONE = { Pending: "warn", Approved: "ok", Rejected: "bad", Cancelled: "grey" };
const TYPE_CLASS = (t = "") =>
  /sick/i.test(t) ? "sick" : /casual/i.test(t) ? "casual" : /home|wfh/i.test(t) ? "wfh" : /annual/i.test(t) ? "annual" : /paid/i.test(t) ? "paid" : "other";

const daysBetween = (from, to) => {
  if (!from || !to) return 0;
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
};

function normalizeLeave(r, i) {
  const from = r.start_date || r.from_date || r.from || "";
  const to = r.end_date || r.to_date || r.to || from;
  const rawStatus = String(r.status_label || r.status || "PENDING").toUpperCase();
  return {
    id: r.id ?? i,
    name: r.employee_name || r.applicant_name || r.employee?.name || "—",
    role: r.designation_title || r.employee_designation || r.role || "",
    department: r.department_name || "—",
    email: r.employee_email || r.email || "—",
    phone: r.phone_number || r.phone || "—",
    type: r.leave_type_name || r.leave_type_label || r.leave_type || "Leave",
    from, to,
    days: r.days ?? r.days_count ?? r.total_days ?? daysBetween(from, to),
    reason: r.reason || "—",
    status: rawStatus.startsWith("APPROV") ? "Approved" : rawStatus.startsWith("REJECT") ? "Rejected" : rawStatus.startsWith("CANCEL") ? "Cancelled" : "Pending",
    applied: r.applied_on || r.created_at || "",
  };
}

const fmt = (iso) =>
  iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/* ---------- small pieces ---------- */
function Avatar({ name, index = 0, size = 34 }) {
  return (
    <span className="people-avatar" style={{ width: size, height: size, fontSize: size * 0.34, background: AVATAR_TONES[index % AVATAR_TONES.length] }}>
      {initialsOf(name)}
    </span>
  );
}
const StatusPill = ({ value }) => <span className={`hrp-pill ${STATUS_TONE[value] || "warn"}`}>{value}</span>;
const TypePill = ({ value }) => <span className={`ahl-type ${TYPE_CLASS(value)}`}>{value}</span>;

function LeaveCalendar({ rows }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });

  // mark every day inside each request with its status
  const marks = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      if (!r.from) return;
      const start = new Date(`${r.from}T00:00:00`);
      const end = new Date(`${r.to || r.from}T00:00:00`);
      for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
        map[key] = r.status;
      }
    });
    return map;
  }, [rows]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1).getDay();
    const count = new Date(cursor.y, cursor.m + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [cursor]);

  const shift = (n) =>
    setCursor((c) => {
      const next = new Date(c.y, c.m + n, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });

  const isToday = (day) => day === now.getDate() && cursor.m === now.getMonth() && cursor.y === now.getFullYear();

  return (
    <div className="ahl-cal">
      <div className="ahl-cal-head">
        <div className="ahl-cal-nav">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <strong>{new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</strong>
          <button type="button" onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
        <div className="ahl-cal-legend">
          <span><i className="Approved" />Approved</span>
          <span><i className="Pending" />Pending</span>
          <span><i className="Rejected" />Rejected</span>
          <span><i className="today" />Today</span>
        </div>
      </div>
      <div className="ahl-cal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => <b key={w}>{w}</b>)}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const key = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return (
            <span key={day} className={`${isToday(day) ? "today" : ""} ${marks[key] || ""}`}>{day}</span>
          );
        })}
      </div>
    </div>
  );
}

function SummaryDonut({ counts, total }) {
  const items = [
    ["Approved", counts.Approved, "#12805f"],
    ["Pending", counts.Pending, "#f3a43a"],
    ["Rejected", counts.Rejected, "#e34e56"],
  ];
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="ahl-donut-wrap">
      <svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="Leave request summary">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--ad-border)" strokeWidth="16" />
        {total > 0 && items.map(([label, n, color]) => {
          const len = (n / total) * c;
          const el = (
            <circle key={label} cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="16"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" />
          );
          offset += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" className="ahl-donut-n">{total}</text>
        <text x="70" y="86" textAnchor="middle" className="ahl-donut-l">Total Requests</text>
      </svg>
      <ul className="ahl-donut-legend">
        {items.map(([label, n, color]) => (
          <li key={label}>
            <i style={{ background: color }} />{label}
            <b>{n}</b><span>{total ? Math.round((n / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- page ---------- */
export default function AdminLeave() {
  const [remote, setRemote] = useState([]);
  const [loading, setLoading] = useState(Boolean(LEAVE_ENDPOINT));
  const [error, setError] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [who, setWho] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selectedId, setSelectedId] = useState(null);
  const [checked, setChecked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!LEAVE_ENDPOINT) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get(LEAVE_ENDPOINT);
      setRemote(getArrayResponse(res).map(normalizeLeave));
    } catch (e) {
      setRemote([]);
      setError(getErrorMessage(e, "Could not load leave requests."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const all = remote;
  const label = "Employee";

  const people = useMemo(() => [...new Set(all.map((r) => r.name))].sort(), [all]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (r) =>
        (who === "ALL" || r.name === who) &&
        (status === "ALL" || r.status === status) &&
        (!from || r.to >= from) &&
        (!to || r.from <= to) &&
        (!q || r.name.toLowerCase().includes(q)),
    );
  }, [all, who, status, from, to, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);
  const selected = all.find((r) => r.id === selectedId) || null;

  const counts = {
    Approved: all.filter((r) => r.status === "Approved").length,
    Pending: all.filter((r) => r.status === "Pending").length,
    Rejected: all.filter((r) => r.status === "Rejected").length,
  };

  const overlapping = selected
    ? all.filter((r) => r.id !== selected.id && r.status !== "Rejected" && r.from <= selected.to && r.to >= selected.from)
    : [];

  const recent = [...all].sort((a, b) => String(b.applied).localeCompare(String(a.applied))).slice(0, 5);

  function resetFilters() {
    setFrom(""); setTo(""); setWho("ALL"); setStatus("ALL"); setQuery(""); setPage(1);
  }
  const toggleAll = (on) => setChecked(on ? new Set(visible.map((r) => r.id)) : new Set());
  const toggleOne = (id) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  async function decide(request, decision) {
    setMsg("");
    setErr("");
    if (request.status !== "Pending") { setErr("This request has already been reviewed."); return; }
    setBusy(true);
    try {
      const action = decision === "APPROVED" ? "approve" : "reject";
      await callApi("post", `${LEAVE_ENDPOINT}${request.id}/${action}/`, {});
      setMsg(decision === "APPROVED" ? "Leave request approved." : "Leave request rejected.");
      load();
    } catch (e) {
      setErr(getErrorMessage(e, "Could not save the decision."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hrp-page ahl-page">
      <div className="hrp-toolbar">
        <div className="ahl-seg"><button type="button" className="on" disabled>All Employee Leave Requests</button></div>
      </div>

      {error && <div className="admin-form-error" role="alert">{error}</div>}

      <section className="admin-summary-grid" aria-label="Leave summary">
        <StatCard icon="users" tone="green" label={`Total ${label} Leave Requests`} value={all.length || null} note="All time" />
        <StatCard icon="clock" tone="amber" label="Pending" value={counts.Pending} note="Needs your action" />
        <StatCard icon="check" tone="green" label="Approved" value={counts.Approved} note="Approved requests" />
        <StatCard icon="close" tone="red" label="Rejected" value={counts.Rejected} note="Rejected requests" />
      </section>

      <section className="admin-panel ahl-filterbar" aria-label="Filters">
        <div className="hrp-field-group">
          <label className="hrp-label" htmlFor="lv-from">From</label>
          <input id="lv-from" type="date" className="ahl-select" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div className="hrp-field-group">
          <label className="hrp-label" htmlFor="lv-to">To</label>
          <input id="lv-to" type="date" className="ahl-select" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
        <div className="hrp-field-group">
          <label className="hrp-label" htmlFor="lv-who">{label} Employee</label>
          <select id="lv-who" className="ahl-select" value={who} onChange={(e) => { setWho(e.target.value); setPage(1); }}>
            <option value="ALL">All {label} Employees</option>{people.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="hrp-field-group">
          <label className="hrp-label" htmlFor="lv-status">Status</label>
          <select id="lv-status" className="ahl-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="ALL">All Status</option>
            {["Pending", "Approved", "Rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <label className="people-search ahl-search">
          <Icon name="search" size={16} />
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search by employee name..." aria-label="Search" />
        </label>
        <button type="button" className="admin-secondary-button" onClick={resetFilters}><Icon name="refresh" size={14} /> Reset</button>
      </section>

      {msg && <div className="admin-form-success" role="status">{msg}</div>}
      {err && <div className="admin-form-error" role="alert">{err}</div>}

      <div className={`hrp-split ${selected ? "with-side" : ""}`}>
        <section className="admin-panel hrp-main" aria-label="Leave requests">
          <h3 className="ahl-heading">{label} Leave Requests ({filtered.length})</h3>
          {loading ? (
            <p className="admin-note">Loading leave requests…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-note">No leave requests match your filters.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table hrp-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" aria-label="Select all"
                      checked={visible.length > 0 && visible.every((r) => checked.has(r.id))}
                      onChange={(e) => toggleAll(e.target.checked)} /></th>
                    <th>{label.toUpperCase()} EMPLOYEE</th><th>LEAVE TYPE</th><th>FROM</th><th>TO</th><th>DAYS</th><th>REASON</th><th>STATUS</th><th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={r.id} className={selectedId === r.id ? "sel" : ""}>
                      <td><input type="checkbox" aria-label={`Select ${r.name}`} checked={checked.has(r.id)} onChange={() => toggleOne(r.id)} /></td>
                      <td>
                        <div className="admin-person">
                          <Avatar name={r.name} index={start + i} />
                          <span><strong>{r.name}</strong><small>{r.role}</small></span>
                        </div>
                      </td>
                      <td><TypePill value={r.type} /></td>
                      <td>{fmt(r.from)}</td>
                      <td>{fmt(r.to)}</td>
                      <td>{r.days}</td>
                      <td className="hre-details">{r.reason}</td>
                      <td><StatusPill value={r.status} /></td>
                      <td>
                        <div className="hrp-actions">
                          <button type="button" className="hrp-icon-btn" aria-label={`View ${r.name}'s request`} onClick={() => setSelectedId(r.id)}><Icon name="search" size={15} /></button>
                          <button type="button" className="hrp-icon-btn ok" aria-label={`Approve ${r.name}'s request`} disabled={busy || r.status !== "Pending"} onClick={() => decide(r, "APPROVED")}><Icon name="check" size={15} /></button>
                          <button type="button" className="hrp-icon-btn danger" aria-label={`Reject ${r.name}'s request`} disabled={busy || r.status !== "Pending"} onClick={() => decide(r, "REJECTED")}><Icon name="close" size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={safePage} pages={pages} onPage={(n) => setPage(Math.min(Math.max(n, 1), pages))}
            perPage={perPage} onPerPage={(n) => { setPerPage(n); setPage(1); }}
            total={filtered.length} shown={{ from: start + 1, to: Math.min(start + perPage, filtered.length) }} />
        </section>

        {selected && (
          <aside className="hrp-side">
            <div className="hrp-card">
              <div className="hrp-card-head">
                <h3>Leave Request Details</h3>
                <button type="button" className="hrp-x static" onClick={() => setSelectedId(null)} aria-label="Close"><Icon name="close" size={16} /></button>
              </div>
              <div className="hre-person">
                <Avatar name={selected.name} size={44} />
                <div><strong>{selected.name}</strong><small>{selected.role}</small></div>
                <StatusPill value={selected.status} />
              </div>
              <dl className="hrp-kv">
                <div><dt>Leave Type</dt><dd><TypePill value={selected.type} /></dd></div>
                <div><dt>From Date</dt><dd>{fmt(selected.from)}</dd></div>
                <div><dt>To Date</dt><dd>{fmt(selected.to)}</dd></div>
                <div><dt>Total Days</dt><dd>{selected.days} {selected.days === 1 ? "Day" : "Days"}</dd></div>
                <div><dt>Reason</dt><dd>{selected.reason}</dd></div>
                <div><dt>Applied On</dt><dd>{fmtTime(selected.applied)}</dd></div>
              </dl>
              <h4 className="ahl-sub">Employee Details</h4>
              <dl className="hrp-kv">
                <div><dt>Department</dt><dd>{selected.department}</dd></div>
                <div><dt>Designation</dt><dd>{selected.role || "—"}</dd></div>
                <div><dt>Email</dt><dd>{selected.email}</dd></div>
                <div><dt>Phone</dt><dd>{selected.phone}</dd></div>
              </dl>
              <h4 className="ahl-sub">Actions</h4>
              <div className="ahl-decide">
                <button type="button" className="admin-primary-button" disabled={busy || selected.status !== "Pending"} onClick={() => decide(selected, "APPROVED")}>
                  <Icon name="check" size={16} /> Approve
                </button>
                <button type="button" className="ahl-reject" disabled={busy || selected.status !== "Pending"} onClick={() => decide(selected, "REJECTED")}>
                  <Icon name="close" size={16} /> Reject
                </button>
              </div>
            </div>

            <div className="hrp-card">
              <h3 className="ahl-warn"><Icon name="alert" size={18} /> Overlapping Leave Requests</h3>
              {overlapping.length === 0 ? (
                <p className="admin-note">No one else has leave on the same dates.</p>
              ) : (
                <>
                  <p className="admin-note">{overlapping.length} {overlapping.length === 1 ? "employee has" : "employees have"} leave on the same dates</p>
                  {overlapping.map((o, i) => (
                    <div className="ahl-overlap" key={o.id}>
                      <Avatar name={o.name} index={i} size={34} />
                      <span><strong>{o.name}</strong><small>{o.role}</small><small>{fmt(o.from)} – {fmt(o.to)}</small></span>
                      <TypePill value={o.type} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      <div className="ahl-three">
        <section className="admin-panel" aria-labelledby="cal-title">
          <div className="admin-panel-heading"><div><h2 id="cal-title">{label} Leave Calendar</h2></div></div>
          <LeaveCalendar rows={all} />
        </section>

        <section className="admin-panel" aria-labelledby="sum-title">
          <div className="admin-panel-heading"><div><h2 id="sum-title">Leave Summary</h2><p>({label} Leaves)</p></div></div>
          <SummaryDonut counts={counts} total={all.length} />
        </section>

        <section className="admin-panel" aria-labelledby="hist-title">
          <div className="admin-panel-heading"><div><h2 id="hist-title">Recent {label} Leave History</h2></div></div>
          {recent.length === 0 ? (
            <p className="admin-note">No leave history yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table ahl-mini">
                <thead><tr><th>EMPLOYEE</th><th>TYPE</th><th>FROM – TO</th><th>STATUS</th></tr></thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr key={r.id}>
                      <td><div className="admin-person"><Avatar name={r.name} index={i} size={24} /><span>{r.name}</span></div></td>
                      <td><TypePill value={r.type} /></td>
                      <td>{fmt(r.from)}{r.to !== r.from ? ` – ${fmt(r.to)}` : ""}</td>
                      <td><StatusPill value={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
