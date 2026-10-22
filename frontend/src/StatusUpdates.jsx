import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { getErrorMessage } from "./dashboardUtils";
import "./StatusUpdates.css";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const emptyForm = {
  work_status: "IN_PROGRESS",
  completed_work: "",
  currently_working: "",
  testing: "",
  tech_stack: "",
  remaining_work: "",
  blocker: "",
};
const statusLabel = { IN_PROGRESS: "In progress", COMPLETED: "Completed", BLOCKED: "Blocked" };
const roleLabel = (role) => ({ ADMIN: "Admin", HR: "HR", MANAGER: "Manager", EMPLOYEE: "Employee" }[role] || role || "User");
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
const dateTimeLabel = (value) => value ? new Date(value).toLocaleString() : "—";

export default function StatusUpdates({ user }) {
  const role = String(user?.role || "EMPLOYEE").toUpperCase();
  const canReview = ["ADMIN", "HR", "MANAGER"].includes(role) || Boolean(user?.is_superuser);
  const canSeeAll = ["ADMIN", "HR"].includes(role) || Boolean(user?.is_superuser);
  const [updates, setUpdates] = useState([]);
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [filterText, setFilterText] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterDepartment, setFilterDepartment] = useState("ALL");
  const [missingSearch, setMissingSearch] = useState("");
  const [missingRole, setMissingRole] = useState("ALL");
  const [missingDepartment, setMissingDepartment] = useState("ALL");
  const [selectedUser, setSelectedUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reportDate, setReportDate] = useState(todayISO);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiClient.get("/status-updates/?days=7");
      const rows = Array.isArray(result) ? result : (result?.results || []);
      setUpdates(rows);
      if (canReview) {
        const missingResult = await apiClient.get(`/status-updates/missing/?date=${encodeURIComponent(reportDate)}`);
        setMissing(missingResult?.results || []);
      } else {
        setMissing([]);
      }
      const ownToday = rows.find((item) => item.author_id === user?.id && item.update_date === todayISO());
      if (ownToday) {
        setEditingId(ownToday.id);
        setForm({
          work_status: ownToday.work_status || "IN_PROGRESS",
          completed_work: ownToday.completed_work || "",
          currently_working: ownToday.currently_working || "",
          testing: ownToday.testing || "",
          tech_stack: ownToday.tech_stack || "",
          remaining_work: ownToday.remaining_work || "",
          blocker: ownToday.blocker || "",
        });
      }
    } catch (e) {
      setError(getErrorMessage(e, "Could not load work status updates."));
    } finally {
      setLoading(false);
    }
  }, [canReview, reportDate, user?.id]);

  useEffect(() => { load(); }, [load]);

  const departments = useMemo(() => [...new Set(updates.map((x) => x.department).filter(Boolean))].sort(), [updates]);
  const missingDepartments = useMemo(() => [...new Set(missing.map((x) => x.department).filter(Boolean))].sort(), [missing]);
  const filteredMissing = useMemo(() => missing.filter((person) => {
    const haystack = [person.name, person.email, person.department, person.designation].join(" ").toLowerCase();
    return (!missingSearch || haystack.includes(missingSearch.toLowerCase()))
      && (missingRole === "ALL" || person.role === missingRole)
      && (missingDepartment === "ALL" || person.department === missingDepartment);
  }), [missing, missingSearch, missingRole, missingDepartment]);
  const filtered = useMemo(() => updates.filter((item) => {
    const haystack = [item.author_name, item.author_email, item.department, item.completed_work, item.currently_working, item.tech_stack].join(" ").toLowerCase();
    return (!filterText || haystack.includes(filterText.toLowerCase()))
      && (filterRole === "ALL" || item.author_role === filterRole)
      && (filterStatus === "ALL" || item.work_status === filterStatus)
      && (filterDepartment === "ALL" || item.department === filterDepartment);
  }), [updates, filterText, filterRole, filterStatus, filterDepartment]);

  function changeField(field, value) { setForm((current) => ({ ...current, [field]: value })); setError(""); setNotice(""); }
  function clearFormFields() { setForm(emptyForm); setError(""); setNotice(""); }

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
      setSelectedUser((current) => ({ ...current, ...(result?.user || {}) }));
    } catch (e) {
      setError(getErrorMessage(e, "Could not load this person's last seven days."));
    } finally { setHistoryLoading(false); }
  }

  return (
    <div className="status-updates-page">
      <div className="status-updates-intro">
        <div><span className="status-eyebrow">DAILY WORK LOG</span><h2>Work Status Updates</h2><p>Record completed work, current focus, testing, technology and blockers. Submit one update per day; edit today's update if your work changes.</p></div>
        <div className="status-week-card"><strong>{updates.length}</strong><span>updates in the last 7 days visible to you</span></div>
      </div>

      {error && <div className="status-alert status-alert-error" role="alert">{error}</div>}
      {notice && <div className="status-alert status-alert-success" role="status">{notice}</div>}

      <section className="status-panel">
        <div className="status-panel-heading"><div><h3>{editingId ? "Edit today's update" : "Add today's update"}</h3><p>Timestamp is recorded automatically when you submit.</p></div>{editingId && <button type="button" className="status-secondary-button" onClick={clearFormFields}>Clear fields</button>}</div>
        <form className="status-form" onSubmit={submit}>
          <div className="status-field"><label htmlFor="work-status">Overall status *</label><select id="work-status" value={form.work_status} onChange={(e) => changeField("work_status", e.target.value)}><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="BLOCKED">Blocked</option></select></div>
          <div className="status-field status-field-wide"><label htmlFor="completed-work">Completed work *</label><textarea id="completed-work" value={form.completed_work} onChange={(e) => changeField("completed_work", e.target.value)} placeholder="What did you complete today?" required rows={3} /></div>
          <div className="status-field status-field-wide"><label htmlFor="currently-working">Currently working on *</label><textarea id="currently-working" value={form.currently_working} onChange={(e) => changeField("currently_working", e.target.value)} placeholder="What are you working on now?" required rows={3} /></div>
          <div className="status-field status-field-wide"><label htmlFor="testing">Testing</label><textarea id="testing" value={form.testing} onChange={(e) => changeField("testing", e.target.value)} placeholder="Tests run, results, or planned testing (optional)" rows={2} /></div>
          <div className="status-field status-field-wide"><label htmlFor="tech-stack">Tech stack used</label><input id="tech-stack" value={form.tech_stack} onChange={(e) => changeField("tech_stack", e.target.value)} placeholder="e.g. Django, React, PostgreSQL, Redis" /></div>
          <div className="status-field status-field-wide"><label htmlFor="remaining-work">Remaining work <span>Optional</span></label><textarea id="remaining-work" value={form.remaining_work} onChange={(e) => changeField("remaining_work", e.target.value)} placeholder="What is left to do?" rows={2} /></div>
          <div className="status-field status-field-wide"><label htmlFor="blocker">Blocker <span>Optional</span></label><textarea id="blocker" value={form.blocker} onChange={(e) => changeField("blocker", e.target.value)} placeholder="Any blocker? Leave blank if none." rows={2} /></div>
          <div className="status-form-actions"><span>Required fields are marked with *</span><button className="status-primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Update status" : "Submit status update"}</button></div>
        </form>
      </section>

      {canReview && <section className="status-panel">
        <div className="status-panel-heading"><div><h3>Missing submissions</h3><p>Active team members who have not submitted an update for the selected date.</p></div><label className="status-date-filter">Date <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} /></label></div>
        <div className="status-filters status-missing-filters"><input aria-label="Search missing submissions" placeholder="Search missing users…" value={missingSearch} onChange={(e) => setMissingSearch(e.target.value)} /><select aria-label="Filter missing role" value={missingRole} onChange={(e) => setMissingRole(e.target.value)}><option value="ALL">All roles</option><option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option><option value="HR">HR</option></select><select aria-label="Filter missing department" value={missingDepartment} onChange={(e) => setMissingDepartment(e.target.value)}><option value="ALL">All departments</option>{missingDepartments.map((department) => <option key={department} value={department}>{department}</option>)}</select></div>
        {filteredMissing.length ? <div className="status-table-wrap"><table className="status-table"><thead><tr><th>Team member</th><th>Role</th><th>Department</th><th>Email</th><th /></tr></thead><tbody>{filteredMissing.map((person) => <tr key={person.id}><td><button className="status-person-link" type="button" onClick={() => openHistory(person)}>{person.name}</button></td><td>{roleLabel(person.role)}</td><td>{person.department || "—"}</td><td>{person.email}</td><td><button className="status-small-button" type="button" onClick={() => openHistory(person)}>View history</button></td></tr>)}</tbody></table></div> : <p className="status-empty">{missing.length ? "No missing submissions match these filters." : `Everyone in the visible reporting scope has submitted an update for ${dateLabel(reportDate)}.`}</p>}
      </section>}

      <section className="status-panel">
        <div className="status-panel-heading"><div><h3>{canSeeAll ? "Organization updates" : role === "MANAGER" ? "My team's updates" : "My updates"}</h3><p>Click a person's name to see their last seven days of updates.</p></div><button type="button" className="status-secondary-button" onClick={load} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></div>
        {canReview && <div className="status-filters"><input aria-label="Search updates" placeholder="Search name, work, email…" value={filterText} onChange={(e) => setFilterText(e.target.value)} /><select aria-label="Filter role" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}><option value="ALL">All roles</option><option value="EMPLOYEE">Employee</option><option value="MANAGER">Manager</option><option value="HR">HR</option><option value="ADMIN">Admin</option></select><select aria-label="Filter status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}><option value="ALL">All statuses</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="BLOCKED">Blocked</option></select><select aria-label="Filter department" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}><option value="ALL">All departments</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}</select></div>}
        {loading ? <p className="status-empty">Loading updates…</p> : filtered.length ? <div className="status-table-wrap"><table className="status-table"><thead><tr>{canReview && <th>Person</th>}<th>Timestamp</th><th>Status</th><th>Completed work</th><th>Currently working</th><th>Testing</th><th>Tech stack</th><th>Remaining work</th><th>Blocker</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}>{canReview && <td><button type="button" className="status-person-link" onClick={() => openHistory(item)}>{item.author_name}<small>{roleLabel(item.author_role)}{item.department ? ` · ${item.department}` : ""}</small></button></td>}<td><strong>{dateLabel(item.update_date)}</strong><small>{dateTimeLabel(item.created_at)}</small></td><td><span className={`status-pill status-${item.work_status.toLowerCase()}`}>{statusLabel[item.work_status] || item.work_status}</span></td><td className="status-cell-text">{item.completed_work}</td><td className="status-cell-text">{item.currently_working}</td><td className="status-cell-text">{item.testing || "—"}</td><td className="status-cell-text">{item.tech_stack || "—"}</td><td className="status-cell-text">{item.remaining_work || "—"}</td><td className="status-cell-text">{item.blocker || "—"}</td></tr>)}</tbody></table></div> : <p className="status-empty">No work status updates found for the selected filters.</p>}
      </section>

      {selectedUser && <div className="status-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedUser(null); }}><section className="status-history-modal" role="dialog" aria-modal="true" aria-labelledby="status-history-title"><div className="status-modal-heading"><div><span className="status-eyebrow">LAST 7 DAYS</span><h3 id="status-history-title">{selectedUser.name || selectedUser.author_name || selectedUser.email || "User history"}</h3><p>{selectedUser.email || selectedUser.author_email} · {roleLabel(selectedUser.role || selectedUser.author_role)}</p></div><button type="button" className="status-close-button" onClick={() => setSelectedUser(null)} aria-label="Close history">×</button></div>{historyLoading ? <p className="status-empty">Loading history…</p> : history.length ? <div className="status-history-list">{history.map((item) => <article className="status-history-item" key={item.id}><div className="status-history-item-top"><strong>{dateLabel(item.update_date)}</strong><span className={`status-pill status-${item.work_status.toLowerCase()}`}>{statusLabel[item.work_status]}</span></div><p><b>Completed:</b> {item.completed_work}</p><p><b>Currently working:</b> {item.currently_working}</p>{item.testing && <p><b>Testing:</b> {item.testing}</p>}{item.tech_stack && <p><b>Tech stack:</b> {item.tech_stack}</p>}{item.remaining_work && <p><b>Remaining:</b> {item.remaining_work}</p>}{item.blocker && <p><b>Blocker:</b> {item.blocker}</p>}<small>Submitted {dateTimeLabel(item.created_at)}</small></article>)}</div> : <p className="status-empty">No updates were submitted in the last seven days.</p>}</section></div>}
    </div>
  );
}
