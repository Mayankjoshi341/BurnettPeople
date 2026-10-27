import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { AVATAR_TONES, getErrorMessage, initialsOf } from "./dashboardUtils";
import { Icon } from "./DashboardIcons";
import { downloadCsv } from "./AdminUi";
import "./StatusUpdates.css";

/* ------------------------------------------------------------------
   Backend (unchanged - same calls as before):
     GET   /status-updates/?days=7
     GET   /status-updates/missing/?date=YYYY-MM-DD   (ADMIN / HR / MANAGER only)
     POST  /status-updates/          PATCH /status-updates/{id}/
     GET   /status-updates/users/{id}/history/

   Props:
     user            - logged-in user (role, id, is_superuser)
     onNavigate(id)  - optional; Quick Links card (employee layout) shows only if given
     calendarEvents  - optional; [{ id, start, end, title, subtitle }]. Empty => empty state.

   No sample data anywhere. Anything the API does not send shows "—" or an empty state.
   Optional extra fields (shown automatically when the backend adds them):
     employee_code / author_employee_code / employee_id  -> EMP001 under the name
     author_avatar / avatar / photo                      -> profile photo
   Change those names in ONE place: the `who()` helper below.
   ------------------------------------------------------------------ */

const FORM_ONLY_NOTE = "Fields marked * are required. The time is recorded automatically.";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const shiftDay = (iso, delta) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyForm = { work_status: "IN_PROGRESS", completed_work: "", currently_working: "", testing: "", tech_stack: "", remaining_work: "", blocker: "" };
const formFrom = (item) => ({
  work_status: item.work_status || "IN_PROGRESS",
  completed_work: item.completed_work || "",
  currently_working: item.currently_working || "",
  testing: item.testing || "",
  tech_stack: item.tech_stack || "",
  remaining_work: item.remaining_work || "",
  blocker: item.blocker || "",
});

const STATUS = { IN_PROGRESS: "In Progress", COMPLETED: "Completed", BLOCKED: "Blocked" };
const statusLabel = (s) => STATUS[s] || s || "—";
const roleLabel = (role) => ({ ADMIN: "Admin", HR: "HR", MANAGER: "Manager", EMPLOYEE: "Employee" }[role] || role || "User");
const dateLabel = (v) => (v ? new Date(`${v}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const dateTimeLabel = (v) => (v ? new Date(v).toLocaleString() : "—");
const timeLabel = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const lines = (text) => String(text || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);

/* One place that maps API fields -> what the UI needs. Works for updates AND missing-users rows. */
const who = (x = {}) => ({
  id: x.author_id ?? x.id,
  name: x.author_name ?? x.name ?? "",
  email: x.author_email ?? x.email ?? "",
  role: x.author_role ?? x.role ?? "",
  department: x.department ?? "",
  code: x.employee_code ?? x.author_employee_code ?? x.employee_id ?? "",
  photo: x.author_avatar ?? x.avatar ?? x.photo ?? "",
});

/* Local pagination (no dependency on AdminUi / AdminPages.css) */
function Pager({ page, pages, total, size, onPage, onSize, noun = "items" }) {
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const nums = [];
  for (let n = 1; n <= pages; n += 1) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) nums.push(n);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <div className="sx-pager">
      <span>Showing {from} to {to} of {total} {noun}</span>
      <div className="sx-pager-btns">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><Icon name="chevleft" size={14} /></button>
        {nums.map((n, i) => (n === "…" ? <span key={`e${i}`}>…</span> : <button key={n} type="button" className={n === page ? "on" : ""} onClick={() => onPage(n)}>{n}</button>))}
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page"><Icon name="chevron" size={14} /></button>
        {onSize && <select value={size} onChange={(e) => onSize(Number(e.target.value))} aria-label="Rows per page">{[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}</select>}
      </div>
    </div>
  );
}

/* ---------------- small pieces ---------------- */
function Avatar({ p, i = 0, size = 34 }) {
  if (p.photo) return <img className="sx-av" src={p.photo} alt="" style={{ width: size, height: size }} />;
  return (
    <span className="sx-av" style={{ width: size, height: size, fontSize: size * 0.34, background: AVATAR_TONES[i % AVATAR_TONES.length] }}>
      {initialsOf(p.name)}
    </span>
  );
}

const Pill = ({ status }) => <span className={`sx-pill ${String(status).toLowerCase()}`}>{statusLabel(status)}</span>;

function Stat({ icon, tone, value, label, note, trend }) {
  return (
    <div className="sx-stat">
      <span className={`sx-stat-icon ${tone}`}><Icon name={icon} size={22} /></span>
      <span className="sx-stat-body"><b>{value ?? "—"}</b><strong>{label}</strong>{note && <small>{note}</small>}</span>
      {trend != null && <span className={`sx-trend ${trend >= 0 ? "up" : "down"}`}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}%<small>vs previous day</small></span>}
    </div>
  );
}

function Block({ title, text, tone }) {
  const items = lines(text);
  return (
    <div className={`sx-block${tone ? ` ${tone}` : ""}`}>
      <h4>{title}</h4>
      {items.length === 0 ? <p className="sx-none">Not provided</p> : items.length === 1 ? <p>{items[0]}</p> : <ul>{items.map((s, i) => <li key={i}>{s}</li>)}</ul>}
    </div>
  );
}

function Field({ id, label, required, children }) {
  return (
    <div className="sx-field">
      <label htmlFor={id}>{label}{required && <em> *</em>}</label>
      {children}
    </div>
  );
}

function PersonCell({ p, i, onOpen }) {
  return (
    <div className="sx-person">
      <Avatar p={p} i={i} />
      <span><button type="button" className="sx-link" onClick={onOpen}>{p.name || "—"}</button><small>{p.code || p.email}</small></span>
    </div>
  );
}

function CalendarCard({ title, sub, events }) {
  return (
    <section className="sx-panel sx-card" aria-label={title}>
      <div className="sx-head"><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div></div>
      {events.length ? (
        <ul className="sx-cal">
          {events.map((e, i) => (
            <li key={e.id ?? i}><span className="sx-cal-time">{e.start}{e.end && <small>{e.end}</small>}</span><span><b>{e.title}</b>{e.subtitle && <small>{e.subtitle}</small>}</span></li>
          ))}
        </ul>
      ) : <p className="sx-empty">No events to show.</p>}
    </section>
  );
}

function StatusForm({ title, form, onChange, onSubmit, onCancel, saving, editingId, today }) {
  return (
    <section className="sx-panel sx-card" aria-labelledby="sx-form-title">
      <div className="sx-head">
        <div><h3 id="sx-form-title">{title}</h3><p>{dateLabel(today)}{editingId ? " · Already submitted, you can edit it below." : ""}</p></div>
        {editingId && <span className="sx-saved"><i /> Submitted</span>}
      </div>
      <form onSubmit={onSubmit}>
        <div className="sx-radio" role="radiogroup" aria-label="Work status">
          <span className="sx-label">Work Status <em>*</em></span>
          {Object.entries(STATUS).map(([value, text]) => (
            <button key={value} type="button" role="radio" aria-checked={form.work_status === value}
              className={`sx-opt ${value.toLowerCase()}${form.work_status === value ? " on" : ""}`} onClick={() => onChange("work_status", value)}>
              <i /> {text}
            </button>
          ))}
        </div>
        <div className="sx-grid">
          <Field id="sx-current" label="Currently Working On" required>
            <textarea id="sx-current" rows={3} required value={form.currently_working} onChange={(e) => onChange("currently_working", e.target.value)} placeholder="Describe what you are working on today..." />
          </Field>
          <Field id="sx-tech" label="Technologies / Tools Used">
            <textarea id="sx-tech" rows={3} value={form.tech_stack} onChange={(e) => onChange("tech_stack", e.target.value)} placeholder="e.g. Python, Django, React, PostgreSQL..." />
          </Field>
          <Field id="sx-done" label="Completed Today" required>
            <textarea id="sx-done" rows={3} required value={form.completed_work} onChange={(e) => onChange("completed_work", e.target.value)} placeholder="List the tasks you have completed..." />
          </Field>
          <Field id="sx-next" label="Remaining / Next Steps">
            <textarea id="sx-next" rows={3} value={form.remaining_work} onChange={(e) => onChange("remaining_work", e.target.value)} placeholder="What will you work on next?" />
          </Field>
          <Field id="sx-test" label="Testing / In Review">
            <textarea id="sx-test" rows={2} value={form.testing} onChange={(e) => onChange("testing", e.target.value)} placeholder="Testing details, PR review, feedback, etc..." />
          </Field>
          <Field id="sx-block" label="Issues / Blockers">
            <textarea id="sx-block" rows={2} value={form.blocker} onChange={(e) => onChange("blocker", e.target.value)} placeholder="Any blockers or support needed?" />
          </Field>
        </div>
        <div className="sx-actions">
          <span>{FORM_ONLY_NOTE}</span>
          <button type="button" className="sx-btn" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="sx-btn primary" disabled={saving}>
            <Icon name="plane" size={16} /> {saving ? "Saving…" : editingId ? "Update Status" : "Submit Update"}
          </button>
        </div>
      </form>
    </section>
  );
}

function DetailPanel({ detail, onClose, onHistory, canReview }) {
  const p = who(detail);
  return (
    <aside className="sx-panel sx-side" aria-label="Update details">
      <div className="sx-side-head"><h3>Update Details</h3><button type="button" className="sx-x" onClick={onClose} aria-label="Close details"><Icon name="close" size={16} /></button></div>
      <div className="sx-person big">
        <Avatar p={p} i={1} size={52} />
        <div><h2>{p.name || "—"}</h2><p>{[p.code, roleLabel(p.role)].filter(Boolean).join(" • ")}</p>{p.department && <p>{p.department}</p>}</div>
      </div>
      <dl className="sx-meta">
        <div><dt>Date</dt><dd>{dateLabel(detail.update_date)}</dd></div>
        <div><dt>Work Status</dt><dd><Pill status={detail.work_status} /></dd></div>
        <div><dt>Last Updated</dt><dd>{timeLabel(detail.created_at)}</dd></div>
      </dl>
      <Block title="Currently Working On" text={detail.currently_working} />
      <Block title="Completed Today" text={detail.completed_work} />
      <Block title="Technologies Used" text={detail.tech_stack} />
      <Block title="Remaining / Next Steps" text={detail.remaining_work} />
      <Block title="Testing / In Review" text={detail.testing} />
      {detail.blocker && <Block title="Issues / Blockers" text={detail.blocker} tone="red" />}
      {canReview && <button type="button" className="sx-btn sx-wide" onClick={() => onHistory(detail)}>View last 7 days</button>}
    </aside>
  );
}

/* ================================================================== */
export default function StatusUpdates({ user, onNavigate, calendarEvents = [] }) {
  const role = String(user?.role || "EMPLOYEE").toUpperCase();
  const kind = user?.is_superuser ? "ADMIN" : ["ADMIN", "HR", "MANAGER"].includes(role) ? role : "EMPLOYEE";
  const canReview = kind !== "EMPLOYEE";
  const canSubmit = kind !== "ADMIN"; // Admin is review-only (reference design). Remove this line's condition to allow.
  const canSeeAll = kind === "ADMIN" || kind === "HR";
  const today = todayISO();

  const [updates, setUpdates] = useState([]);
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [reportDate, setReportDate] = useState(today);
  const [showWeek, setShowWeek] = useState(false);
  const [tab, setTab] = useState(kind === "ADMIN" ? "all" : "mine");
  const [q, setQ] = useState("");
  const [fRole, setFRole] = useState("ALL");
  const [fStatus, setFStatus] = useState("ALL");
  const [fDept, setFDept] = useState("ALL");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [detail, setDetail] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiClient.get("/status-updates/?days=7");
      const rows = Array.isArray(result) ? result : (result?.results || []);
      setUpdates(rows);
      if (canReview) {
        const m = await apiClient.get(`/status-updates/missing/?date=${encodeURIComponent(reportDate)}`);
        setMissing(m?.results || []);
      } else setMissing([]);
      const own = rows.find((x) => x.author_id === user?.id && x.update_date === todayISO());
      if (own) { setEditingId(own.id); setForm(formFrom(own)); }
    } catch (e) {
      setError(getErrorMessage(e, "Could not load work status updates."));
    } finally {
      setLoading(false);
    }
  }, [canReview, reportDate, user?.id]);

  useEffect(() => { load(); }, [load]);

  /* ---------- derived data (all from API responses) ---------- */
  const dayUpdates = useMemo(() => updates.filter((x) => x.update_date === reportDate), [updates, reportDate]);
  const scope = showWeek ? updates : dayUpdates;
  const departments = useMemo(() => [...new Set(updates.map((x) => x.department).filter(Boolean))].sort(), [updates]);
  const missingDepts = useMemo(() => [...new Set(missing.map((x) => x.department).filter(Boolean))].sort(), [missing]);

  const filtered = useMemo(() => scope.filter((item) => {
    const p = who(item);
    const hay = [p.name, p.email, p.code, p.department, item.completed_work, item.currently_working, item.tech_stack].join(" ").toLowerCase();
    return (!q || hay.includes(q.toLowerCase()))
      && (fRole === "ALL" || p.role === fRole)
      && (fStatus === "ALL" || item.work_status === fStatus)
      && (fDept === "ALL" || item.department === fDept)
      && (tab !== "blocked" || item.work_status === "BLOCKED")
      && (tab !== "managers" || p.role === "MANAGER");
  }), [scope, q, fRole, fStatus, fDept, tab]);

  const filteredMissing = useMemo(() => missing.filter((x) => {
    const p = who(x);
    return (!q || [p.name, p.email, p.department, p.code].join(" ").toLowerCase().includes(q.toLowerCase()))
      && (fRole === "ALL" || p.role === fRole)
      && (fDept === "ALL" || p.department === fDept);
  }), [missing, q, fRole, fDept]);

  const mine = useMemo(
    () => [...updates].sort((a, b) => String(b.update_date).localeCompare(String(a.update_date))).filter((x) => fStatus === "ALL" || x.work_status === fStatus),
    [updates, fStatus],
  );

  const activeList = canReview ? filtered : mine;
  const pages = Math.max(1, Math.ceil(activeList.length / size));
  const safePage = Math.min(page, pages);
  const visible = activeList.slice((safePage - 1) * size, safePage * size);

  const count = (s) => dayUpdates.filter((x) => x.work_status === s).length;
  const submittedPeople = new Set(dayUpdates.map((x) => x.author_id)).size;
  const prevDate = shiftDay(reportDate, -1);
  const prevCount = new Set(updates.filter((x) => x.update_date === prevDate).map((x) => x.author_id)).size;
  const trend = prevDate >= shiftDay(today, -6) && prevCount > 0 ? Math.round(((submittedPeople - prevCount) / prevCount) * 100) : null;

  const deptRows = useMemo(() => {
    const map = {};
    const row = (k) => (map[k] ||= { submitted: 0, blocked: 0, missing: 0 });
    dayUpdates.forEach((u) => { const r = row(u.department || "No department"); r.submitted += 1; if (u.work_status === "BLOCKED") r.blocked += 1; });
    missing.forEach((p) => { row(p.department || "No department").missing += 1; });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [dayUpdates, missing]);

  /* ---------- actions ---------- */
  const changeField = (field, value) => { setForm((c) => ({ ...c, [field]: value })); setError(""); setNotice(""); };
  const cancelForm = () => {
    const own = updates.find((x) => x.author_id === user?.id && x.update_date === todayISO());
    setForm(own ? formFrom(own) : emptyForm); setError(""); setNotice("");
  };
  const resetFilters = () => { setQ(""); setFRole("ALL"); setFStatus("ALL"); setFDept("ALL"); setPage(1); };
  const goTab = (id) => { setTab(id); setPage(1); };

  async function submit(event) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    const payload = {
      ...form,
      testing: form.testing.trim(),
      tech_stack: form.tech_stack.trim(),
      remaining_work: form.remaining_work.trim() || null,
      blocker: form.blocker.trim() || null,
    };
    try {
      if (editingId) await apiClient.patch(`/status-updates/${editingId}/`, payload);
      else await apiClient.post("/status-updates/", payload);
      setNotice("Your work status update has been saved.");
      await load();
    } catch (e) {
      setError(getErrorMessage(e, "Could not save this update."));
    } finally { setSaving(false); }
  }

  async function openHistory(person) {
    setSelectedUser(person); setHistory([]); setHistoryLoading(true); setError("");
    try {
      const result = await apiClient.get(`/status-updates/users/${person.author_id ?? person.id}/history/`);
      setHistory(result?.updates || []);
      setSelectedUser((c) => ({ ...c, ...(result?.user || {}) }));
    } catch (e) {
      setError(getErrorMessage(e, "Could not load this person's last seven days."));
    } finally { setHistoryLoading(false); }
  }

  function exportCsv() {
    downloadCsv(
      canReview ? `status-updates-${showWeek ? "last-7-days" : reportDate}.csv` : "my-status-updates.csv",
      ["Date", "Employee", "Email", "Role", "Department", "Status", "Last updated", "Completed work", "Currently working", "Testing", "Tech stack", "Remaining work", "Blocker"],
      activeList.map((x) => [x.update_date, x.author_name, x.author_email, roleLabel(x.author_role), x.department, statusLabel(x.work_status), dateTimeLabel(x.created_at), x.completed_work, x.currently_working, x.testing, x.tech_stack, x.remaining_work, x.blocker]),
    );
  }

  const exportBtn = <button type="button" className="sx-btn sx-export" onClick={exportCsv} disabled={!activeList.length}><Icon name="download" size={15} /> Export</button>;
  const alerts = (
    <>
      {error && <div className="sx-alert error" role="alert">{error}</div>}
      {notice && <div className="sx-alert success" role="status">{notice}</div>}
    </>
  );
  const detailPanel = detail ? <DetailPanel detail={detail} onClose={() => setDetail(null)} onHistory={openHistory} canReview={canReview} /> : null;

  const historyModal = selectedUser && (() => {
    const p = who(selectedUser);
    return (
      <div className="sx-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedUser(null); }}>
        <section className="sx-modal" role="dialog" aria-modal="true" aria-labelledby="sx-hist-title">
          <div className="sx-modal-head">
            <div><h2 id="sx-hist-title">{p.name || p.email || "User history"}</h2><p>{[p.email, roleLabel(p.role), "Last 7 days"].filter(Boolean).join(" · ")}</p></div>
            <button type="button" className="sx-x" onClick={() => setSelectedUser(null)} aria-label="Close history">×</button>
          </div>
          {historyLoading ? <p className="sx-empty">Loading history…</p> : history.length ? (
            <div className="sx-hist-list">
              {history.map((item) => (
                <article className="sx-hist-item" key={item.id}>
                  <div className="sx-hist-top"><strong>{dateLabel(item.update_date)}</strong><Pill status={item.work_status} /></div>
                  <Block title="Completed" text={item.completed_work} />
                  <Block title="Currently working on" text={item.currently_working} />
                  {item.testing && <Block title="Testing" text={item.testing} />}
                  {item.tech_stack && <Block title="Tech stack" text={item.tech_stack} />}
                  {item.remaining_work && <Block title="Remaining" text={item.remaining_work} />}
                  {item.blocker && <Block title="Blocker" text={item.blocker} tone="red" />}
                  <small>Submitted {dateTimeLabel(item.created_at)}</small>
                </article>
              ))}
            </div>
          ) : <p className="sx-empty">No updates were submitted in the last seven days.</p>}
        </section>
      </div>
    );
  })();

  /* ================= EMPLOYEE LAYOUT ================= */
  if (!canReview) {
    const cnt = (s) => updates.filter((x) => x.work_status === s).length;
    return (
      <div className="sx-page">
        {alerts}
        <section className="sx-stats four" aria-label="My status summary">
          <Stat icon="file" tone="blue" value={updates.length} label="Total Updates" note="Last 7 days" />
          <Stat icon="check" tone="green" value={cnt("COMPLETED")} label="Completed" note="Last 7 days" />
          <Stat icon="clock" tone="amber" value={cnt("IN_PROGRESS")} label="In Progress" note="Last 7 days" />
          <Stat icon="alert" tone="red" value={cnt("BLOCKED")} label="Blocked" note="Last 7 days" />
        </section>

        <div className="sx-main">
          <StatusForm title="Today’s Status Update" form={form} onChange={changeField} onSubmit={submit} onCancel={cancelForm} saving={saving} editingId={editingId} today={today} />
          <aside className="sx-aside">
            <CalendarCard title="Today’s Calendar" sub={new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} events={calendarEvents} />
            {onNavigate && (
              <section className="sx-panel sx-card" aria-label="Quick links">
                <div className="sx-head"><div><h3>Quick Links</h3></div></div>
                <div className="sx-links">
                  <button type="button" className="green" onClick={() => onNavigate("leaderboard")}><Icon name="flame" size={18} /><span><b>View Leaderboard</b><small>See top performers</small></span></button>
                  <button type="button" className="orange" onClick={() => onNavigate("attendance")}><Icon name="clock" size={18} /><span><b>My Attendance</b><small>Check your attendance</small></span></button>
                  <button type="button" className="blue" onClick={() => onNavigate("leave")}><Icon name="plane" size={18} /><span><b>Apply Leave</b><small>Request time off</small></span></button>
                  <button type="button" className="purple" onClick={() => onNavigate("profile")}><Icon name="user" size={18} /><span><b>My Profile</b><small>Update your details</small></span></button>
                </div>
              </section>
            )}
          </aside>
        </div>

        <div className={`sx-split${detail ? " has-side" : ""}`}>
          <section className="sx-panel sx-card" aria-labelledby="sx-hist-h">
            <div className="sx-head">
              <div><h3 id="sx-hist-h">My Update History</h3><p>View your updates from the last 7 days.</p></div>
              <div className="sx-tools">
                <select aria-label="Filter status" value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }}>
                  <option value="ALL">All Status</option>{Object.entries(STATUS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
                <button type="button" className="sx-btn" onClick={load} disabled={loading}><Icon name="refresh" size={15} /> {loading ? "Refreshing…" : "Refresh"}</button>
                {exportBtn}
              </div>
            </div>
            {loading ? <p className="sx-empty">Loading updates…</p> : visible.length ? (
              <div className="sx-table-wrap">
                <table className="sx-table">
                  <thead><tr><th>#</th><th>DATE</th><th>WORK STATUS</th><th>KEY UPDATE / SUMMARY</th><th>TECHNOLOGIES</th><th>ACTIONS</th></tr></thead>
                  <tbody>
                    {visible.map((item, i) => (
                      <tr key={item.id} className={detail?.id === item.id ? "sel" : ""}>
                        <td>{(safePage - 1) * size + i + 1}</td>
                        <td>{dateLabel(item.update_date)}{item.update_date === today ? " (Today)" : ""}</td>
                        <td><Pill status={item.work_status} /></td>
                        <td><div className="sx-sum">{item.completed_work || item.currently_working || "—"}</div></td>
                        <td><div className="sx-sum">{item.tech_stack || "—"}</div></td>
                        <td><button type="button" className="sx-view" onClick={() => setDetail(item)}>View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="sx-empty">You have not submitted any work status updates in the last 7 days.</p>}
            {!loading && mine.length > 0 && <Pager page={safePage} pages={pages} total={mine.length} size={size} onPage={(n) => setPage(Math.min(Math.max(1, n), pages))} onSize={(n) => { setSize(n); setPage(1); }} noun="updates" />}
          </section>
          {detailPanel}
        </div>
        {historyModal}
      </div>
    );
  }

  /* ================= REVIEW LAYOUTS (Manager / HR / Admin) ================= */
  const tabs = {
    MANAGER: [["mine", "My Update"], ["all", "Team Updates"], ["missing", `Missing Updates${missing.length ? ` (${missing.length})` : ""}`], ["calendar", "Team Calendar"]],
    HR: [["mine", "My Update"], ["all", "All Updates"], ["missing", "Missing Updates"], ["blocked", "Blocked Updates"], ["departments", "Department View"], ["managers", "Manager View"]],
    ADMIN: [["all", "All Updates"], ["missing", "Missing Updates"], ["blocked", "Blocked Updates"], ["departments", "Department View"], ["managers", "Manager View"]],
  }[kind];

  const isToday = reportDate === today;
  const outOfRange = !showWeek && reportDate < shiftDay(today, -6);
  const listTab = ["all", "blocked", "managers"].includes(tab);
  const heading = tab === "blocked" ? "Blocked Updates" : tab === "managers" ? "Manager Updates" : canSeeAll ? "Employee & Manager Updates" : "Team Member Updates";
  const roleOptions = canSeeAll ? ["EMPLOYEE", "MANAGER", "HR", "ADMIN"] : ["EMPLOYEE", "MANAGER", "HR"];

  const filters = (withStatus) => (
    <div className="sx-filters">
      <label className="sx-search"><Icon name="search" size={16} /><input aria-label="Search" placeholder="Search by name, ID or department…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
      {canSeeAll && <select aria-label="Filter department" value={fDept} onChange={(e) => { setFDept(e.target.value); setPage(1); }}><option value="ALL">All Departments</option>{(withStatus ? departments : missingDepts).map((d) => <option key={d} value={d}>{d}</option>)}</select>}
      <select aria-label="Filter role" value={fRole} onChange={(e) => { setFRole(e.target.value); setPage(1); }}><option value="ALL">All Roles</option>{roleOptions.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</select>
      {withStatus && <select aria-label="Filter status" value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1); }}><option value="ALL">All Status</option>{Object.entries(STATUS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}
      <button type="button" className="sx-btn" onClick={resetFilters}><Icon name="refresh" size={15} /> Reset</button>
    </div>
  );

  const body = (() => {
    if (tab === "mine") return <StatusForm title={`My Status Update – ${dateLabel(today)}`} form={form} onChange={changeField} onSubmit={submit} onCancel={cancelForm} saving={saving} editingId={editingId} today={today} />;

    if (tab === "calendar") return <CalendarCard title="Team Calendar" sub={dateLabel(reportDate)} events={calendarEvents} />;

    if (tab === "missing") return (
      <section className="sx-panel sx-card">
        <div className="sx-head"><div><h3>Missing Updates ({filteredMissing.length})</h3><p>Active team members who have not submitted an update for {dateLabel(reportDate)}.</p></div></div>
        {filters(false)}
        {filteredMissing.length ? (
          <div className="sx-table-wrap"><table className="sx-table">
            <thead><tr><th>EMPLOYEE</th><th>ROLE</th><th>DEPARTMENT</th><th>EMAIL</th><th>WORK STATUS</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {filteredMissing.map((x, i) => {
                const p = who(x);
                return (
                  <tr key={p.id}>
                    <td><PersonCell p={p} i={i} onOpen={() => openHistory(x)} /></td>
                    <td>{roleLabel(p.role)}</td><td>{p.department || "—"}</td><td>{p.email || "—"}</td>
                    <td><span className="sx-pill notupdated">Not Updated</span></td>
                    <td><button type="button" className="sx-view" onClick={() => openHistory(x)}>View history</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        ) : <p className="sx-empty">{missing.length ? "No missing submissions match these filters." : `Everyone in your reporting scope has submitted an update for ${dateLabel(reportDate)}.`}</p>}
      </section>
    );

    if (tab === "departments") return (
      <section className="sx-panel sx-card">
        <div className="sx-head"><div><h3>Department View</h3><p>Submissions for {dateLabel(reportDate)}, by department</p></div></div>
        {deptRows.length === 0 ? <p className="sx-empty">No department data for this date.</p> : (
          <div className="sx-table-wrap"><table className="sx-table">
            <thead><tr><th>DEPARTMENT</th><th>SUBMITTED</th><th>NOT SUBMITTED</th><th>BLOCKED</th><th>SUBMISSION RATE</th></tr></thead>
            <tbody>
              {deptRows.map(([name, r]) => {
                const total = r.submitted + r.missing;
                const pct = total ? Math.round((r.submitted / total) * 100) : 0;
                return (
                  <tr key={name}>
                    <td><strong>{name}</strong></td><td>{r.submitted}</td><td>{r.missing}</td><td>{r.blocked}</td>
                    <td><div className="sx-bar"><span style={{ width: `${pct}%` }} /></div><small>{pct}%</small></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </section>
    );

    // list tabs: all / blocked / managers
    return (
      <section className="sx-panel sx-card">
        <div className="sx-head">
          <div><h3>{heading} ({filtered.length})</h3><p>Click a person’s name to see their last seven days of updates.</p></div>
          {kind !== "ADMIN" && exportBtn}
        </div>
        {filters(true)}
        {loading ? <p className="sx-empty">Loading updates…</p> : visible.length ? (
          <div className="sx-table-wrap"><table className="sx-table">
            <thead><tr><th>#</th><th>EMPLOYEE</th>{canSeeAll && <th>DEPARTMENT</th>}<th>ROLE</th><th>WORK STATUS</th>{showWeek && <th>DATE</th>}<th>LAST UPDATED</th><th>KEY UPDATE / SUMMARY</th><th>ACTIONS</th></tr></thead>
            <tbody>
              {visible.map((item, i) => {
                const p = who(item);
                return (
                  <tr key={item.id} className={detail?.id === item.id ? "sel" : ""}>
                    <td>{(safePage - 1) * size + i + 1}</td>
                    <td><PersonCell p={p} i={i} onOpen={() => openHistory(item)} /></td>
                    {canSeeAll && <td>{p.department || "—"}</td>}
                    <td>{roleLabel(p.role)}</td>
                    <td><Pill status={item.work_status} /></td>
                    {showWeek && <td>{dateLabel(item.update_date)}</td>}
                    <td>{dateLabel(item.update_date) === dateLabel(today) ? timeLabel(item.created_at) : `${dateLabel(item.update_date)}, ${timeLabel(item.created_at)}`}</td>
                    <td><div className="sx-sum">{item.completed_work || item.currently_working || "—"}</div></td>
                    <td><button type="button" className="sx-view" onClick={() => setDetail(item)}>View</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        ) : <p className="sx-empty">{showWeek ? "No work status updates found for the selected filters." : `No work status updates found for ${dateLabel(reportDate)}.`}</p>}
        {!loading && filtered.length > 0 && <Pager page={safePage} pages={pages} total={filtered.length} size={size} onPage={(n) => setPage(Math.min(Math.max(1, n), pages))} onSize={(n) => { setSize(n); setPage(1); }} noun="updates" />}
      </section>
    );
  })();

  const hasSidePanel = ["mine", "all", "blocked", "managers"].includes(tab);

  return (
    <div className="sx-page">
      <div className="sx-top">
        <div className="sx-date">
          <button type="button" className="sx-icon-btn" onClick={() => { setReportDate(shiftDay(reportDate, -1)); setPage(1); }} aria-label="Previous day"><Icon name="chevleft" size={15} /></button>
          <label><Icon name="calendar" size={16} />
            <input type="date" value={reportDate} max={today} onChange={(e) => { if (e.target.value) { setReportDate(e.target.value); setPage(1); } }} aria-label="Report date" />
            {isToday && <em>Today</em>}
          </label>
          <button type="button" className="sx-icon-btn" onClick={() => { setReportDate(shiftDay(reportDate, 1)); setPage(1); }} disabled={isToday} aria-label="Next day"><Icon name="chevron" size={15} /></button>
        </div>
        <label className="sx-check"><input type="checkbox" checked={showWeek} onChange={(e) => { setShowWeek(e.target.checked); setPage(1); }} /> Show all last 7 days</label>
        <button type="button" className="sx-btn" onClick={load} disabled={loading}><Icon name="refresh" size={15} /> {loading ? "Refreshing…" : "Refresh"}</button>
        {kind === "ADMIN" && exportBtn}
      </div>

      {alerts}
      {outOfRange && <div className="sx-alert info" role="note">Updates are loaded for the last 7 days only, so older dates show no submitted updates.</div>}

      <section className="sx-stats" aria-label="Status summary">
        <Stat icon="users" tone="blue" value={submittedPeople + missing.length} label={kind === "MANAGER" ? "My Team Members" : "Total Users"} />
        <Stat icon="users" tone="green" value={submittedPeople} label="Submitted" note={dateLabel(reportDate)} trend={trend} />
        <Stat icon="alert" tone="red" value={missing.length} label="Not Submitted" note="For the selected date" />
        <Stat icon="clock" tone="amber" value={count("IN_PROGRESS")} label="In Progress" />
        <Stat icon="check" tone="green" value={count("COMPLETED")} label="Completed" />
        <Stat icon="alert" tone="red" value={count("BLOCKED")} label="Blocked" />
      </section>

      <div className="sx-tabs" role="tablist">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => goTab(id)}>{label}</button>)}
      </div>

      <div className={`sx-split${hasSidePanel && detail ? " has-side" : ""}`}>
        <div className="sx-col">{body}</div>
        {hasSidePanel && detailPanel}
      </div>
      {historyModal}
    </div>
  );
}