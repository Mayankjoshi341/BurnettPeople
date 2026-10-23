import { useEffect, useMemo, useState } from "react";

import { Icon } from "./DashboardIcons";
import { getArrayResponse, getErrorMessage, SHOW_DEMO_DATA } from "./dashboardUtils";
import apiClient from "./api/client";
import { Av, Pager, downloadCsv } from "./AdminUi";
import "./AdminAudit.css";

/* Backend: GET /audit/logs/ -> array (or { results: [] }) of log rows.
   Accepted keys (snake_case or camelCase):
   id, at|timestamp|created_at, user|user_name, email|user_email, action, module, details|description,
   ip|ip_address, status, user_agent|userAgent, location, session|session_id, raw (optional object) */
const AUDIT_ENDPOINT = "/audit/logs/";

const ACTION_ICON = { Login: "user", Logout: "logout", Update: "edit", Create: "plus", Delete: "trash", Invite: "mail", Export: "download" };
const ACTION_TONE = { Login: "green", Logout: "grey", Update: "blue", Create: "amber", Delete: "red", Invite: "purple", Export: "teal" };
const STATUS_TONE = { success: "green", failed: "red", warning: "amber" };
const DETAIL_ICON = { User: "user", Action: "tag", Module: "grid", Description: "file", "IP Address": "lock", "User Agent": "laptop", Location: "pin", "Session ID": "clock", Status: "check" };

/* ---------- sample data (only when SHOW_DEMO_DATA is true) ---------- */
const BASE = [
  ["10:24:15", "Mayank Joshi", "mayank@burnettpeople.com", "Login", "Authentication", "User logged in successfully", "203.0.113.12"],
  ["10:18:42", "Amit Sharma", "amit@burnettpeople.com", "Update", "Employee", "Updated employee profile (EMP-001)", "203.0.113.45"],
  ["10:15:30", "Priya Rathi", "priya@burnettpeople.com", "Create", "Leave", "Created leave request (LV-2026-015)", "203.0.113.89"],
  ["10:12:11", "Admin User", "admin@burnettpeople.com", "Delete", "Department", "Deleted department (DEP-004)", "203.0.113.12"],
  ["10:05:22", "Rohit Kumar", "rohit@burnettpeople.com", "Update", "Attendance", "Updated attendance record (ATT-2026-1023)", "203.0.113.67"],
  ["09:58:17", "Sneha Desai", "sneha@burnettpeople.com", "Invite", "Employee", "Sent invitation email (emp.sneha@burnettpeople.com)", "203.0.113.23"],
  ["09:45:03", "Admin User", "admin@burnettpeople.com", "Update", "Role & Permissions", "Updated role permissions (Manager)", "203.0.113.12"],
  ["09:32:48", "Neha Kapoor", "neha@burnettpeople.com", "Login", "Authentication", "User logged in successfully", "203.0.113.91"],
  ["09:21:11", "Vikram Singh", "vikram@burnettpeople.com", "Update", "Work Schedule", "Updated work schedule (SCH-002)", "203.0.113.54"],
  ["09:10:32", "Pooja Lakhwani", "pooja@burnettpeople.com", "Create", "Attendance", "Check-in recorded (ATT-2026-1022)", "203.0.113.88"],
];
const AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/118.0.0.0";

function buildDemo() {
  const out = [];
  for (let day = 0; day < 4; day += 1) {
    BASE.forEach((b, i) => {
      const failed = day > 0 && i === 7;
      out.push({
        id: `demo-${day}-${i}`,
        at: `2026-10-${19 - day}T${b[0]}`,
        user: b[1], email: b[2], action: b[3], module: b[4],
        details: failed ? "Invalid password attempt" : b[5],
        ip: b[6], status: failed ? "Failed" : "Success",
        userAgent: AGENT, location: "Indore, Madhya Pradesh, India",
        session: `f3a9c2e8-4b1a-4d7e-8f5e-1a2b3c4d5e${String(day * 10 + i).padStart(2, "0")}`,
      });
    });
  }
  return out;
}
const DEMO_LOGS = buildDemo();
const DEMO_TREND = [["file", "green", "Total Events", 12], ["user", "blue", "User Actions", 8], ["list", "blue", "Data Changes", 15], ["shield", "green", "Security Events", 23]];

/* ---------- helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const dayOf = (at) => { const d = new Date(at); return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtDate = (at) => new Date(at).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
const fmtTime = (at) => new Date(at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function normalize(r) {
  const email = r.email || r.user_email || r.user?.email || "";
  return {
    id: r.id,
    at: r.at || r.timestamp || r.created_at || "",
    user: r.user_name || (typeof r.user === "string" ? r.user : r.user?.name) || email || "System",
    email,
    action: r.action || "—",
    module: r.module || "—",
    details: r.details || r.description || "—",
    ip: r.ip || r.ip_address || "—",
    status: r.status || "Success",
    userAgent: r.user_agent || r.userAgent || "—",
    location: r.location || "—",
    session: r.session || r.session_id || "—",
    raw: r.raw,
  };
}

const titleOf = (r) => (r.action === "Login" ? "User Login" : `${r.action} ${r.module}`);
const rawOf = (r) => r.raw || Object.fromEntries(Object.entries({
  id: r.id,
  created_at: r.at,
  user_name: r.user,
  user_email: r.email,
  action: r.action,
  module: r.module,
  details: r.details,
  status: r.status,
}).filter(([, value]) => value !== undefined && value !== "" && value !== "—"));

function Chip({ tone, icon, children }) {
  return <span className={`au-chip ${tone}`}>{icon && <Icon name={icon} size={12} />}{children}</span>;
}
const StatusPill = ({ status }) => <span className={`ap-pill ${STATUS_TONE[String(status).toLowerCase()] || "grey"}`}>{status}</span>;

function LogPanel({ log, onClose }) {
  const [tab, setTab] = useState("details");
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(tab === "raw" ? { ...log, raw: undefined } : rawOf(log), null, 2);

  async function copy() {
    try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  }

  const rows = [
    ["User", log.email ? `${log.user} (${log.email})` : log.user], ["Action", log.action], ["Module", log.module],
    ["Description", log.details], ["IP Address", log.ip], ["User Agent", log.userAgent],
    ["Location", log.location], ["Session ID", log.session],
  ];

  return (
    <aside className="admin-panel ap-side au-panel" aria-label="Log details">
      <div className="ap-side-head"><div><h2>Log Details</h2></div>
        <button type="button" className="ap-x" onClick={onClose} aria-label="Close panel"><Icon name="close" size={16} /></button></div>

      <div className="au-event">
        <span className={`au-event-icon ${ACTION_TONE[log.action] || "grey"}`}><Icon name={ACTION_ICON[log.action] || "file"} size={22} /></span>
        <div className="au-event-main"><strong>{titleOf(log)}</strong><small>{log.details}</small></div>
        <div className="au-event-side"><StatusPill status={log.status} /><small>{fmtDate(log.at)}<br />{fmtTime(log.at)}</small></div>
      </div>

      <div className="ap-tabs sm" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "details"} className={tab === "details" ? "on" : ""} onClick={() => setTab("details")}>Details</button>
        <button type="button" role="tab" aria-selected={tab === "raw"} className={tab === "raw" ? "on" : ""} onClick={() => setTab("raw")}>Raw Data</button>
      </div>

      {tab === "details" && (
        <dl className="au-kv">
          {rows.map(([k, v]) => <div key={k}><dt><Icon name={DETAIL_ICON[k]} size={14} /> {k}</dt><dd>{v}</dd></div>)}
          <div><dt><Icon name={DETAIL_ICON.Status} size={14} /> Status</dt><dd><StatusPill status={log.status} /></dd></div>
        </dl>
      )}

      <div className="au-json-head"><strong>{tab === "details" ? "Additional Information" : "Full record"}</strong>
        <button type="button" className="ap-icon-btn" onClick={copy} aria-label="Copy JSON" title={copied ? "Copied" : "Copy"}><Icon name={copied ? "check" : "file"} size={14} /></button></div>
      <pre className="au-json" tabIndex={0}>{json}</pre>
    </aside>
  );
}

export default function AdminAuditLogs() {
  const [rawRows, setRawRows] = useState(SHOW_DEMO_DATA ? DEMO_LOGS : []);
  const [loading, setLoading] = useState(!SHOW_DEMO_DATA);
  const [error, setError] = useState("");
  useEffect(() => {
    if (SHOW_DEMO_DATA) return undefined;
    let active = true;
    async function loadAllPages() {
      setLoading(true);
      setError("");
      try {
        const first = await apiClient.get(`${AUDIT_ENDPOINT}?page_size=200`);
        const all = getArrayResponse(first);
        const count = Number(first?.count ?? all.length);
        const pages = Math.ceil(count / 200);
        for (let page = 2; page <= pages; page += 1) {
          const next = await apiClient.get(`${AUDIT_ENDPOINT}?page=${page}&page_size=200`);
          all.push(...getArrayResponse(next));
        }
        if (active) setRawRows(all);
      } catch (e) {
        if (active) setError(getErrorMessage(e, "Could not load audit logs."));
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAllPages();
    return () => { active = false; };
  }, []);
  const rows = useMemo(() => rawRows.map(normalize).sort((a, b) => String(b.at).localeCompare(String(a.at))), [rawRows]);

  const blank = { from: "", to: "", user: "ALL", action: "ALL", module: "ALL", status: "ALL" };
  const [f, setF] = useState(blank);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [selectedId, setSelectedId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [menu, setMenu] = useState(false);

  const uniq = (key) => [...new Set(rows.map((r) => r[key]).filter((v) => v && v !== "—"))].sort();
  const set = (k) => (e) => { setF((p) => ({ ...p, [k]: e.target.value })); setPage(1); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const d = dayOf(r.at);
      return (!f.from || d >= f.from) && (!f.to || d <= f.to) &&
        (f.user === "ALL" || r.user === f.user) && (f.action === "ALL" || r.action === f.action) &&
        (f.module === "ALL" || r.module === f.module) && (f.status === "ALL" || r.status === f.status) &&
        (!q || [r.user, r.email, r.details, r.module, r.ip].some((v) => String(v).toLowerCase().includes(q)));
    });
  }, [rows, f, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safe = Math.min(page, pages);
  const visible = filtered.slice((safe - 1) * size, safe * size);
  const selected = filtered.find((r) => r.id === selectedId) || filtered[0];

  const dataChanges = rows.filter((r) => ["Create", "Update", "Delete"].includes(r.action)).length;
  const security = rows.filter((r) => r.status !== "Success" || r.module === "Authentication" || /role/i.test(r.module)).length;
  const stats = [rows.length, rows.length - dataChanges, dataChanges, security];

  function exportAs(kind) {
    setMenu(false);
    if (kind === "csv") {
      downloadCsv("audit-logs.csv", ["Time", "User", "Email", "Action", "Module", "Details", "IP Address", "Status"],
        filtered.map((r) => [`${fmtDate(r.at)} ${fmtTime(r.at)}`, r.user, r.email, r.action, r.module, r.details, r.ip, r.status]));
    } else {
      const url = URL.createObjectURL(new Blob([JSON.stringify(filtered.map((r) => ({ ...r, raw: undefined })), null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = "audit-logs.json"; a.click(); URL.revokeObjectURL(url);
    }
  }

  const reset = () => { setF(blank); setQuery(""); setPage(1); };
  const FILTERS = [["user", "User", "All Users", uniq("user")], ["action", "Action Type", "All Actions", uniq("action")], ["module", "Module", "All Modules", uniq("module")], ["status", "Status", "All Status", uniq("status")]];

  return (
    <div className="ap-page au-page">
      <div className="au-top">
        <div className="au-export">
          <button type="button" className="admin-secondary-button" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} disabled={!filtered.length}>
            <Icon name="download" size={16} /> Export Logs <Icon name="chevdown" size={14} />
          </button>
          {menu && (
            <div className="au-menu" role="menu" onMouseLeave={() => setMenu(false)}>
              <button type="button" role="menuitem" onClick={() => exportAs("csv")}>Export as CSV</button>
              <button type="button" role="menuitem" onClick={() => exportAs("json")}>Export as JSON</button>
            </div>
          )}
        </div>
      </div>

      <section className="ap-stats" aria-label="Audit summary">
        {[["file", "green", "Total Events"], ["user", "blue", "User Actions"], ["list", "blue", "Data Changes"], ["shield", "green", "Security Events"]].map(([icon, tone, label], i) => (
          <div className="ap-mini au-stat" key={label}>
            <span className={`ap-mini-icon ${tone}`}><Icon name={icon} size={22} /></span>
            <span className="ap-mini-body"><b>{stats[i].toLocaleString()}</b><strong>{label}</strong></span>
            {SHOW_DEMO_DATA ? <span className="au-trend"><em className={DEMO_TREND[i][3] > 20 ? "bad" : ""}>↗ {DEMO_TREND[i][3]}%</em><small>vs last month</small></span> : <span className="au-trend"><small>in loaded logs</small></span>}
          </div>
        ))}
      </section>

      <section className="admin-panel au-filters" aria-label="Filters">
        <div className="ap-filter au-range"><small>Date Range</small>
          <div className="au-dates"><Icon name="calendar" size={15} />
            <input type="date" value={f.from} onChange={set("from")} max={f.to || undefined} aria-label="From date" /><span>–</span>
            <input type="date" value={f.to} onChange={set("to")} min={f.from || undefined} aria-label="To date" /></div></div>
        {FILTERS.map(([k, label, all, opts]) => (
          <label className="ap-filter" key={k}><small>{label}</small>
            <select value={f[k]} onChange={set(k)}><option value="ALL">{all}</option>{opts.map((o) => <option key={o}>{o}</option>)}</select></label>
        ))}
        <button type="button" className="admin-secondary-button au-reset" onClick={reset}><Icon name="refresh" size={15} /> Reset</button>
      </section>

      <div className={`ap-split${panelOpen && selected ? " has-side" : ""}`}>
        <section className="admin-panel ap-main" aria-label="Audit logs">
          <div className="admin-panel-heading">
            <div><h2>Audit Logs ({filtered.length.toLocaleString()})</h2></div>
            <label className="ap-search au-search"><Icon name="search" size={16} />
              <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search logs..." aria-label="Search logs" /></label>
          </div>

          {error && <div role="alert" className="admin-form-error">{error}</div>}
          {loading ? <p className="admin-note">Loading logs…</p> : filtered.length === 0 ? <p className="admin-note">No logs match your filters.</p> : (
            <div className="admin-table-wrap">
              <table className="admin-table ap-table au-table">
                <thead><tr><th>TIME</th><th>USER</th><th>ACTION</th><th>MODULE</th><th>DETAILS</th><th>IP ADDRESS</th><th>STATUS</th><th /></tr></thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={r.id} className={selected?.id === r.id ? "sel" : ""} onClick={() => { setSelectedId(r.id); setPanelOpen(true); }}>
                      <td><span className="au-time"><b>{fmtDate(r.at)}</b>{fmtTime(r.at)}</span></td>
                      <td><div className="ap-person"><Av name={r.user} i={i} size={32} /><span><strong>{r.user}</strong><small>({r.email || "—"})</small></span></div></td>
                      <td><Chip tone={ACTION_TONE[r.action] || "grey"} icon={ACTION_ICON[r.action]}>{r.action}</Chip></td>
                      <td>{r.module}</td>
                      <td className="wrap">{r.details}</td>
                      <td>{r.ip}</td>
                      <td><StatusPill status={r.status} /></td>
                      <td><button type="button" className="ap-icon-btn flat" aria-label={`View log ${titleOf(r)}`} onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); setPanelOpen(true); }}><Icon name="more" size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <Pager page={safe} pages={pages} total={filtered.length} size={size} onPage={(n) => setPage(Math.min(Math.max(1, n), pages))} onSize={(n) => { setSize(n); setPage(1); }} noun="results" />
          )}
        </section>

        {panelOpen && selected && <LogPanel key={selected.id} log={selected} onClose={() => setPanelOpen(false)} />}
      </div>
    </div>
  );
}
