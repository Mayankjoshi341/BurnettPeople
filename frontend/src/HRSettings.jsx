import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { StatCard, NotConnected, Pager } from "./DashboardParts";
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
const HOLIDAYS_ENDPOINT = null;

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
    type: raw.holiday_type || raw.type || "—",
    applicable: raw.applicable_to || "All Employees",
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
  const [type, setType] = useState("ALL");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [form, setForm] = useState({ name: "", date: "", type: "", applicable: "ALL", description: "", optional: false });
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
    return all.filter((h) => (type === "ALL" || h.type === type) && (!q || h.name.toLowerCase().includes(q)));
  }, [all, query, type]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = all.filter((h) => h.date >= todayIso).length;
  const next = [...all].filter((h) => h.date >= todayIso).sort((a, b) => a.date.localeCompare(b.date))[0];

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setFormErr((e) => ({ ...e, [k]: "" })); setMsg(""); };

  async function create() {
    const e = {};
    if (!form.name.trim()) e.name = "Holiday name is required.";
    if (!form.date) e.date = "Date is required.";
    if (!form.type) e.type = "Select a type.";
    setFormErr(e);
    if (Object.keys(e).length) return;
    if (!HOLIDAYS_ENDPOINT) { setMsg("Holidays API is not connected yet. Set HOLIDAYS_ENDPOINT in HRSettings.jsx."); return; }
    setBusy(true);
    try {
      await callApi("post", HOLIDAYS_ENDPOINT, {
        name: form.name.trim(), date: form.date, holiday_type: form.type,
        applicable_to: form.applicable, description: form.description, is_optional: form.optional,
      });
      setMsg("Holiday created.");
      setForm({ name: "", date: "", type: "", applicable: "ALL", description: "", optional: false });
      load();
    } catch (err) {
      setMsg(getErrorMessage(err, "Could not create the holiday."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(h) {
    if (h.demo || !HOLIDAYS_ENDPOINT) { setMsg("Sample data cannot be deleted."); return; }
    try {
      await callApi("delete", `${HOLIDAYS_ENDPOINT}${h.id}/`);
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
            <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Holiday type">
              <option value="ALL">All Types</option>
              {["National", "Festival", "Restricted", "Optional"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="button" className="admin-link-button" onClick={() => { setQuery(""); setType("ALL"); setPage(1); }}>Clear</button>
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
                      <td><button type="button" className="hrp-icon-btn danger" aria-label={`Delete ${h.name}`} onClick={() => remove(h)}><Icon name="close" size={15} /></button></td>
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
            <h3>Add Holiday</h3>
            <p className="admin-note">Create a new holiday for your organization.</p>

            <label className="hrp-label" htmlFor="h-name">Holiday Name *</label>
            <input id="h-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Republic Day" />
            {formErr.name && <small className="hrp-error">{formErr.name}</small>}

            <label className="hrp-label" htmlFor="h-date">Date *</label>
            <input id="h-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            {formErr.date && <small className="hrp-error">{formErr.date}</small>}

            <label className="hrp-label" htmlFor="h-type">Type *</label>
            <select id="h-type" value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option value="">Select type</option>
              {["National", "Festival", "Restricted", "Optional"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {formErr.type && <small className="hrp-error">{formErr.type}</small>}

            <span className="hrp-label">Applicable To *</span>
            <div className="hrp-radios">
              <label><input type="radio" name="app" checked={form.applicable === "ALL"} onChange={() => set("applicable", "ALL")} /> All Employees</label>
              <label><input type="radio" name="app" checked={form.applicable === "SELECTED"} onChange={() => set("applicable", "SELECTED")} /> Selected Locations</label>
            </div>

            <label className="hrp-label" htmlFor="h-desc">Description</label>
            <textarea id="h-desc" rows={3} maxLength={200} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Add a short description (optional)..." />

            <label className="hrp-check">
              <input type="checkbox" checked={form.optional} onChange={(e) => set("optional", e.target.checked)} />
              <span><strong>Mark as Optional Holiday</strong><small>Employees can choose to take leave on this day</small></span>
            </label>

            {msg && <p className="admin-note" role="status">{msg}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary-button" onClick={() => { setForm({ name: "", date: "", type: "", applicable: "ALL", description: "", optional: false }); setFormErr({}); setMsg(""); }}>Cancel</button>
              <button type="button" className="admin-primary-button" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create Holiday"}</button>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
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
      {tab !== "organization" && tab !== "holidays" && (
        <section className="admin-panel admin-settings-placeholder">
          <span className="admin-settings-icon"><Icon name={active.icon} size={26} /></span>
          <h2>{active.label}</h2>
          <p>{active.text} This section will appear once its backend API is connected.</p>
        </section>
      )}
    </div>
  );
}
