import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { StatCard, NotConnected, Pager } from "./DashboardParts";
import AdminCompanySettings from "./AdminCompanySettings";
import {
  SHOW_DEMO_DATA,
  callApi,
  getArrayResponse,
  getErrorMessage,
  statusTone,
  useOptions,
} from "./dashboardUtils";
import "./HRPages.css";

/* Set to your holidays endpoint when ready, e.g. "/organization/holidays/". */
const HOLIDAYS_ENDPOINT = "/leave/holidays/?include_inactive=true";
const LEAVE_TYPES_ENDPOINT = "/leave/types/?include_inactive=true";

const TABS = [
  { id: "organization", label: "Organization", icon: "building", text: "Departments, designations and work locations." },
  { id: "holidays", label: "Holidays", icon: "calendar" },
  { id: "schedules", label: "Work Schedules", icon: "clock", text: "Shifts, workdays, time zones and break policies assigned to employees." },
  { id: "leave-types", label: "Leave Types", icon: "heart", text: "Annual, sick, casual and other leave types with their yearly balances." },
  { id: "breaks", label: "Break Policies", icon: "coffee", text: "Break types, durations and allowed windows." },
  { id: "asset-cats", label: "Asset Categories", icon: "laptop", text: "Categories used to organize company devices." },
  { id: "events", label: "Events & Gatherings", icon: "people", text: "Company events and team gatherings." },
  { id: "policies", label: "Policy Documents", icon: "file", text: "HR policies employees must read and acknowledge." },
  { id: "notifications", label: "Notifications", icon: "bell", text: "Which notifications are sent, and to whom." },
  { id: "general", label: "General Settings", icon: "gear", text: "Company-wide HR configuration." },
];

const DEMO_HOLIDAYS = [
  ["Republic Day", "2026-01-26", "National"], ["Holi", "2026-03-04", "Festival"],
  ["Mahavir Jayanti", "2026-03-31", "Restricted"], ["Good Friday", "2026-04-03", "Restricted"],
  ["Ambedkar Jayanti", "2026-04-14", "National"], ["Labour Day", "2026-05-01", "National"],
  ["Independence Day", "2026-08-15", "National"], ["Janmashtami", "2026-08-12", "Festival"],
  ["Gandhi Jayanti", "2026-10-02", "National"], ["Diwali", "2026-11-08", "Festival"],
].map(([name, date, type], i) => ({
  id: `demo-${i}`, name, date, type, applicable: type === "Restricted" ? "Selected Locations" : "All Employees", status: "Active", demo: true,
}));

function normalizeHoliday(raw, i) {
  return {
    id: raw.id ?? i,
    name: raw.name || "—",
    date: raw.date || "",
    type: "Company Holiday",
    description: raw.description || "",
    is_active: raw.is_active !== false,
    applicable: "All Employees",
    status: raw.is_active === false ? "Inactive" : "Active",
  };
}

const dayOf = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" }) : "—");
const fmt = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function OrganizationTab() {
  const departments = useOptions("/organization/departments/");
  const designations = useOptions("/organization/designations/");
  const locations = useOptions("/organization/work-locations/");
  const groups = [
    ["Departments", "building", departments],
    ["Designations", "people", designations],
    ["Work Locations", "calendar", locations],
  ];
  return (
    <div className="hrp-org-grid">
      {groups.map(([title, icon, list]) => (
        <section className="admin-panel" key={title}>
          <div className="admin-panel-heading">
            <div><h2>{title}</h2><p>{list.length} configured</p></div>
            <span className="hrp-section-icon sm"><Icon name={icon} size={18} /></span>
          </div>
          {list.length === 0 ? (
            <p className="admin-note">Nothing configured, or the list could not be loaded.</p>
          ) : (
            <ul className="hrp-chip-list">
              {list.map((o) => <li key={o.id}>{o.name}</li>)}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function HolidaysTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(HOLIDAYS_ENDPOINT));
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [form, setForm] = useState({ name: "", date: "", description: "", is_active: true });
  const [editing, setEditing] = useState(null);
  const [formErr, setFormErr] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!HOLIDAYS_ENDPOINT) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get(HOLIDAYS_ENDPOINT);
      setItems(getArrayResponse(res).map(normalizeHoliday));
    } catch (e) {
      setItems([]);
      setError(getErrorMessage(e, "Could not load holidays."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const demoMode = !HOLIDAYS_ENDPOINT && SHOW_DEMO_DATA;
  const all = demoMode ? DEMO_HOLIDAYS : items;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((h) => !q || h.name.toLowerCase().includes(q));
  }, [all, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = all.filter((h) => h.date >= todayIso).length;
  const next = [...all].filter((h) => h.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date))[0];

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setFormErr((e) => ({ ...e, [k]: "" })); setMsg(""); };

  function editHoliday(item) {
    setEditing(item.id);
    setForm({ name: item.name, date: item.date, description: item.description, is_active: item.is_active });
    setMsg("");
  }

  async function create() {
    const e = {};
    if (!form.name.trim()) e.name = "Holiday name is required.";
    if (!form.date) e.date = "Date is required.";
    setFormErr(e);
    if (Object.keys(e).length) return;
    if (!HOLIDAYS_ENDPOINT) { setMsg("Holidays API is not connected yet. Set HOLIDAYS_ENDPOINT in HRSettings.jsx."); return; }
    setBusy(true);
    try {
      const payload = { name: form.name.trim(), date: form.date, description: form.description, is_active: form.is_active };
      if (editing) await callApi("patch", `/leave/holidays/${editing}/`, payload);
      else await callApi("post", "/leave/holidays/", payload);
      setMsg(editing ? "Holiday updated." : "Holiday created.");
      setEditing(null);
      setForm({ name: "", date: "", description: "", is_active: true });
      load();
    } catch (err) {
      setMsg(getErrorMessage(err, "Could not create the holiday."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(h) {
    if (!HOLIDAYS_ENDPOINT) { setMsg("Holiday changes are unavailable."); return; }
    try {
      await callApi("delete", `/leave/holidays/${h.id}/`);
      load();
    } catch (err) {
      setMsg(getErrorMessage(err, "Could not delete the holiday."));
    }
  }

  return (
    <>
      {!HOLIDAYS_ENDPOINT && (
        <NotConnected
          title="Holidays API is not connected yet."
          text={demoMode ? "These holidays are sample data for the design." : "Set HOLIDAYS_ENDPOINT in HRSettings.jsx once the backend provides it."}
        />
      )}
      {error && <div className="admin-form-error" role="alert">{error}</div>}

      <section className="admin-summary-grid" aria-label="Holiday summary">
        <StatCard icon="calendar" tone="green" label="Total Holidays" value={all.length || null} note="This year" />
        <StatCard icon="calendar" tone="blue" label="Upcoming Holidays" value={upcoming} note="Still to come" />
        <StatCard icon="gift" tone="amber" label="Next Holiday" value={next?.name || "—"} note={next ? `${fmt(next.date)} (${dayOf(next.date)})` : "None scheduled"} />
        <StatCard icon="check" tone="blue" label="Active" value={all.filter((h) => h.status === "Active").length} note="Considered in attendance" />
      </section>

      <div className="hrp-split with-side">
        <section className="admin-panel hrp-main" aria-label="Holidays">
          <div className="hrp-filters">
            <label className="people-search">
              <Icon name="search" size={16} />
              <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search holidays..." aria-label="Search holidays" />
            </label>
            <button type="button" className="admin-link-button" onClick={() => { setQuery(""); setPage(1); }}>Clear</button>
          </div>

          {loading ? (
            <p className="admin-note">Loading holidays…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-note">No holidays to show.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table hrp-table">
                <thead><tr><th>#</th><th>HOLIDAY NAME</th><th>DATE</th><th>DAY</th><th>TYPE</th><th>APPLICABLE TO</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  {visible.map((h, i) => (
                    <tr key={h.id}>
                      <td>{start + i + 1}</td>
                      <td><strong>{h.name}</strong></td>
                      <td>{fmt(h.date)}</td><td>{dayOf(h.date)}</td>
                      <td><span className={`hrp-pill ${statusTone(h.type)}`}>{h.type}</span></td>
                      <td>{h.applicable}</td>
                      <td><span className={`hrp-pill ${statusTone(h.status)}`}>{h.status}</span></td>
                      <td><button type="button" className="hrp-icon-btn" aria-label={`Edit ${h.name}`} onClick={() => editHoliday(h)}><Icon name="edit" size={15} /></button>{h.is_active && <button type="button" className="hrp-icon-btn danger" aria-label={`Deactivate ${h.name}`} onClick={() => remove(h)}><Icon name="close" size={15} /></button>}</td>
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

        <aside className="hrp-side">
          <div className="hrp-card">
            <h3>{editing ? "Edit Holiday" : "Add Holiday"}</h3>
            <p className="admin-note">Create a new holiday for your organization.</p>

            <label className="hrp-label" htmlFor="h-name">Holiday Name *</label>
            <input id="h-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Republic Day" />
            {formErr.name && <small className="hrp-error">{formErr.name}</small>}

            <label className="hrp-label" htmlFor="h-date">Date *</label>
            <input id="h-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            {formErr.date && <small className="hrp-error">{formErr.date}</small>}

            <label className="hrp-label" htmlFor="h-desc">Description</label>
            <textarea id="h-desc" rows={3} maxLength={200} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Add a short description (optional)..." />
            {editing && <label className="hrp-checkbox"><input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Active</label>}

            {msg && <p className="admin-note" role="status">{msg}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary-button" onClick={() => { setEditing(null); setForm({ name: "", date: "", description: "", is_active: true }); setFormErr({}); setMsg(""); }}>Clear</button>
              <button type="button" className="admin-primary-button" onClick={create} disabled={busy}>{busy ? "Saving…" : editing ? "Save Changes" : "Create Holiday"}</button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function LeaveTypesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: "", name: "", description: "", is_paid: true, max_consecutive_days: "", is_active: true });

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(getArrayResponse(await apiClient.get(LEAVE_TYPES_ENDPOINT))); setError(""); }
    catch (e) { setError(getErrorMessage(e, "Could not load leave types.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  function startEdit(item) {
    setEditing(item.id);
    setForm({ code: item.code, name: item.name, description: item.description || "", is_paid: item.is_paid, max_consecutive_days: item.max_consecutive_days ?? "", is_active: item.is_active });
    setMessage("");
  }
  function reset() {
    setEditing(null);
    setForm({ code: "", name: "", description: "", is_paid: true, max_consecutive_days: "", is_active: true });
    setMessage("");
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const payload = { ...form, max_consecutive_days: form.max_consecutive_days === "" ? null : Number(form.max_consecutive_days) };
    try {
      if (editing) await apiClient.patch(`/leave/types/${editing}/`, payload);
      else await apiClient.post("/leave/types/", payload);
      setMessage(editing ? "Leave type updated." : "Leave type created."); reset(); await load();
    } catch (e) { setError(getErrorMessage(e, "Could not save the leave type.")); }
    finally { setBusy(false); }
  }
  async function deactivate(item) {
    setBusy(true); setError(""); setMessage("");
    try { await apiClient.delete(`/leave/types/${item.id}/`); setMessage("Leave type deactivated; its history remains available."); await load(); }
    catch (e) { setError(getErrorMessage(e, "Could not deactivate this leave type.")); }
    finally { setBusy(false); }
  }

  return <div className="hrp-data-settings">
    {(error || message) && <div role={error ? "alert" : "status"} className={error ? "admin-form-error" : "admin-form-success"}>{error || message}</div>}
    <div className="admin-summary-grid"><StatCard icon="heart" tone="green" label="Leave Types" value={items.length} note="Configured types"/><StatCard icon="check" tone="blue" label="Active" value={items.filter((item) => item.is_active).length} note="Available to employees"/></div>
    <div className="hrp-settings-columns"><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Leave Types</h2><p>Maintain leave categories while retaining historic requests.</p></div></div>{loading ? <p className="admin-note">Loading leave types…</p> : !items.length ? <p className="admin-note">No leave types are configured.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>CODE</th><th>NAME</th><th>PAID</th><th>MAX DAYS</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.code}</td><td><strong>{item.name}</strong></td><td>{item.is_paid ? "Paid" : "Unpaid"}</td><td>{item.max_consecutive_days ?? "No limit"}</td><td>{item.is_active ? "Active" : "Inactive"}</td><td><button className="admin-link-button" type="button" onClick={() => startEdit(item)}>Edit</button>{item.is_active && <button className="admin-link-button" type="button" disabled={busy} onClick={() => deactivate(item)}>Deactivate</button>}</td></tr>)}</tbody></table></div>}</section>
      <form className="admin-panel hrp-type-form" onSubmit={save}><div className="admin-panel-heading"><div><h2>{editing ? "Edit Leave Type" : "Add Leave Type"}</h2><p>Changes apply to future requests; past records are preserved.</p></div></div><label>Code<input required maxLength={30} disabled={Boolean(editing)} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}/></label><label>Name<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label><label>Description<textarea maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></label><label>Maximum consecutive days<input type="number" min="1" max="366" value={form.max_consecutive_days} onChange={(e) => setForm({ ...form, max_consecutive_days: e.target.value })} placeholder="No limit"/></label><label className="hrp-checkbox"><input type="checkbox" checked={form.is_paid} onChange={(e) => setForm({ ...form, is_paid: e.target.checked })}/> Paid leave</label>{editing && <label className="hrp-checkbox"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}/> Active</label>}<div className="admin-modal-actions"><button className="admin-secondary-button" type="button" onClick={reset}>Clear</button><button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save Changes" : "Create Leave Type"}</button></div></form>
    </div>
  </div>;
}

const emptyBreakRule = () => ({ break_type: "LUNCH", allowed_start_time: "", allowed_end_time: "", duration_minutes: "", duration_mode: "FIXED", is_active: true });
function BreakPoliciesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ code: "", name: "", version: 1, description: "", rules: [] });
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(getArrayResponse(await apiClient.get("/attendance/break-policies/?include_inactive=true"))); setError(""); }
    catch (e) { setError(getErrorMessage(e, "Could not load break policies.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  function newVersion(item) {
    setForm({ code: item.code, name: item.name, version: item.version + 1, description: item.description || "", rules: item.rules.map((rule) => ({ break_type: rule.break_type, allowed_start_time: rule.allowed_start_time?.slice(0, 5), allowed_end_time: rule.allowed_end_time?.slice(0, 5), duration_minutes: rule.duration_minutes, duration_mode: rule.duration_mode, is_active: rule.is_active })) });
    setMessage("");
  }
  async function create(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const payload = { ...form, rules: form.rules.map((rule) => ({ ...rule, duration_minutes: Number(rule.duration_minutes) })) };
    try { await apiClient.post("/attendance/break-policies/", payload); setMessage("New policy version created. Existing schedules retain their prior policy."); setForm({ code: "", name: "", version: 1, description: "", rules: [] }); await load(); }
    catch (e) { setError(getErrorMessage(e, "Could not create this policy version.")); }
    finally { setBusy(false); }
  }
  async function deactivate(item) {
    setBusy(true); setError(""); setMessage("");
    try { await apiClient.delete(`/attendance/break-policies/${item.id}/`); setMessage("Policy deactivated; its schedule and attendance history remains intact."); await load(); }
    catch (e) { setError(getErrorMessage(e, "Could not deactivate this policy.")); }
    finally { setBusy(false); }
  }
  function updateRule(index, key, value) { setForm((current) => ({ ...current, rules: current.rules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, [key]: value } : rule) })); }

  return <div className="hrp-data-settings">{(error || message) && <div role={error ? "alert" : "status"} className={error ? "admin-form-error" : "admin-form-success"}>{error || message}</div>}
    <div className="hrp-settings-columns"><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Break Policies</h2><p>Configured break windows and durations. Changes use a new version to preserve history.</p></div></div>{loading ? <p className="admin-note">Loading policies…</p> : items.length ? items.map((item) => <article className="hrp-policy-row" key={item.id}><div><strong>{item.name} · v{item.version}</strong><small>{item.code} · {item.is_active ? "Active" : "Inactive"}</small>{item.rules.map((rule) => <small key={rule.id}>{rule.break_type_label}: {rule.allowed_start_time.slice(0, 5)}–{rule.allowed_end_time.slice(0, 5)} · {rule.duration_minutes} minutes ({rule.duration_mode_label})</small>)}</div><div>{item.is_active && <><button className="admin-link-button" type="button" onClick={() => newVersion(item)}>New version</button><button className="admin-link-button" type="button" disabled={busy} onClick={() => deactivate(item)}>Deactivate</button></>}</div></article>) : <p className="admin-note">No break policies are configured.</p>}</section>
      <form className="admin-panel hrp-type-form" onSubmit={create}><div className="admin-panel-heading"><div><h2>Create Policy Version</h2><p>Configure break rules based on approved company policy.</p></div></div><label>Policy code<input required maxLength={30} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}/></label><label>Policy name<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label><label>Version<input required type="number" min="1" value={form.version} onChange={(e) => setForm({ ...form, version: Number(e.target.value) })}/></label><label>Description<textarea maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></label>{form.rules.map((rule, index) => <div className="hrp-break-rule" key={index}><div className="hrp-break-rule-head"><strong>Rule {index + 1}</strong><button type="button" className="admin-link-button" onClick={() => setForm({ ...form, rules: form.rules.filter((_, i) => i !== index) })}>Remove</button></div><label>Break type<select value={rule.break_type} onChange={(e) => updateRule(index, "break_type", e.target.value)}><option value="LUNCH">Lunch</option><option value="SHORT_BREAK">Short break</option><option value="OTHER">Other</option></select></label><div className="hrp-rule-grid"><label>Window starts<input required type="time" value={rule.allowed_start_time} onChange={(e) => updateRule(index, "allowed_start_time", e.target.value)}/></label><label>Window ends<input required type="time" value={rule.allowed_end_time} onChange={(e) => updateRule(index, "allowed_end_time", e.target.value)}/></label><label>Minutes<input required type="number" min="1" max="240" value={rule.duration_minutes} onChange={(e) => updateRule(index, "duration_minutes", e.target.value)}/></label><label>Duration rule<select value={rule.duration_mode} onChange={(e) => updateRule(index, "duration_mode", e.target.value)}><option value="FIXED">Fixed</option><option value="MINIMUM">Minimum</option><option value="MAXIMUM">Maximum</option></select></label></div></div>)}<button type="button" className="admin-secondary-button" onClick={() => setForm({ ...form, rules: [...form.rules, emptyBreakRule()] })}>Add break rule</button><div className="admin-modal-actions"><button className="admin-secondary-button" type="button" onClick={() => setForm({ code: "", name: "", version: 1, description: "", rules: [] })}>Clear</button><button className="admin-primary-button" type="submit" disabled={busy || !form.rules.length}>{busy ? "Saving…" : "Create Version"}</button></div></form>
    </div>
  </div>;
}

export default function HRSettings() {
  const [tab, setTab] = useState("organization");
  const active = TABS.find((t) => t.id === tab);

  return (
    <div className="hrp-page">
      <div className="hrp-tabcards" role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            <span className="hrp-tabcard-icon"><Icon name={t.icon} size={20} /></span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "organization" && <OrganizationTab />}
      {tab === "holidays" && <HolidaysTab />}
      {tab === "leave-types" && <LeaveTypesTab />}
      {tab === "schedules" && <AdminCompanySettings key="hr-work-schedules" initialTab="schedules" hideTabs />}
      {tab === "breaks" && <BreakPoliciesTab />}
      {tab !== "organization" && tab !== "holidays" && tab !== "leave-types" && tab !== "schedules" && tab !== "breaks" && (
        <section className="admin-panel admin-settings-placeholder">
          <span className="admin-settings-icon"><Icon name={active.icon} size={26} /></span>
          <h2>{active.label}</h2>
          <p>{active.text} This section will appear once its backend API is connected.</p>
        </section>
      )}
    </div>
  );
}
