import { useEffect, useMemo, useState } from "react";

import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { SHOW_DEMO_DATA, getErrorMessage } from "./dashboardUtils";
import { Av, FormPanel, MiniStat, Pager, Pill, useResource } from "./AdminUi";

/* Backend (adjust to your Django URLs): list/create at <endpoint>, update/delete at <endpoint><id>/ */
const ORG_PROFILE_ENDPOINT = "/org/profile/";

const STATUS = { k: "status", label: "Status", type: "select", options: ["Active", "Inactive"], def: "Active" };
const obj = (keys, list) => list.map((row, i) => ({ id: `demo-${i + 1}`, ...Object.fromEntries(keys.map((k, j) => [k, row[j]])) }));

const TABS = [
  {
    id: "departments", label: "Departments", icon: "building", endpoint: "/org/departments/", noun: "department",
    desc: "Manage departments in your organization. Departments help organize employees and reporting structure.",
    cols: [["name", "Department Name"], ["code", "Code"], ["description", "Description"], ["head", "Head (Manager)"], ["employees", "Employees"], ["status", "Status"]],
    fields: [
      { k: "name", label: "Department Name", req: true, ph: "e.g. Engineering" },
      { k: "code", label: "Department Code", req: true, ph: "e.g. ENG" },
      { k: "description", label: "Description", type: "textarea", ph: "Brief description about this department..." },
      { k: "head", label: "Department Head (Manager)", ph: "Manager name (optional)" },
      STATUS,
    ],
    demo: obj(["name", "code", "description", "head", "employees", "status"], [
      ["Engineering", "ENG", "Product development, engineering", "Rohit Mehta", 32, "Active"],
      ["Product & Design", "PD", "Product management and design", "Neha Gupta", 18, "Active"],
      ["Operations", "OPS", "Daily operations and facilities", "Vikram Kapoor", 24, "Active"],
      ["Sales & Marketing", "SM", "Sales, business development", "Aarav Sharma", 16, "Active"],
      ["Human Resources", "HR", "HR operations, people ops", "Priya Nair", 10, "Active"],
      ["Finance & Accounts", "FIN", "Finance, accounting and audit", "Rahul Verma", 8, "Active"],
      ["Administration", "ADMIN", "Office administration", "Aditya Singh", 6, "Active"],
      ["Customer Support", "CS", "Customer success and support", "Kavya Mehta", 12, "Active"],
      ["Legal & Compliance", "LEGAL", "Legal, compliance and policy", "", 0, "Inactive"],
      ["IT & Infrastructure", "IT", "IT support, infrastructure", "", 0, "Inactive"],
    ]),
  },
  {
    id: "designations", label: "Designations", icon: "tag", endpoint: "/org/designations/", noun: "designation",
    desc: "Job titles used across the company. Designations define levels and reporting.",
    cols: [["name", "Designation"], ["code", "Code"], ["department", "Department"], ["level", "Level"], ["employees", "Employees"], ["status", "Status"]],
    fields: [
      { k: "name", label: "Designation Name", req: true, ph: "e.g. Senior Developer" },
      { k: "code", label: "Code", req: true, ph: "e.g. SR-DEV", half: true },
      { k: "level", label: "Level", type: "select", ph: "Select level", options: ["Junior", "Mid", "Senior", "Lead", "Manager", "Director"], half: true },
      { k: "department", label: "Department", ph: "e.g. Engineering" },
      STATUS,
    ],
    demo: obj(["name", "code", "department", "level", "employees", "status"], [
      ["Senior Developer", "SR-DEV", "Engineering", "Senior", 9, "Active"],
      ["Team Lead", "TL", "Engineering", "Lead", 5, "Active"],
      ["Product Manager", "PM", "Product & Design", "Manager", 4, "Active"],
      ["HR Executive", "HR-EX", "Human Resources", "Mid", 6, "Active"],
      ["Marketing Specialist", "MKT-SP", "Sales & Marketing", "Mid", 8, "Active"],
      ["Accountant", "ACC", "Finance & Accounts", "Mid", 5, "Active"],
    ]),
  },
  { id: "roles", label: "Roles & Permissions", icon: "shield" },
  {
    id: "locations", label: "Work Locations", icon: "pin", endpoint: "/org/locations/", noun: "location",
    desc: "Offices and remote locations where employees work.",
    cols: [["name", "Location"], ["city", "City"], ["type", "Type"], ["employees", "Employees"], ["status", "Status"]],
    fields: [
      { k: "name", label: "Location Name", req: true, ph: "e.g. Indore Office" },
      { k: "city", label: "City", req: true, ph: "e.g. Indore", half: true },
      { k: "type", label: "Type", type: "select", options: ["Office", "Remote", "Hybrid"], def: "Office", half: true },
      STATUS,
    ],
    demo: obj(["name", "city", "type", "employees", "status"], [
      ["Indore Office", "Indore", "Office", 78, "Active"],
      ["Bangalore Office", "Bengaluru", "Office", 32, "Active"],
      ["Pune Office", "Pune", "Office", 18, "Active"],
      ["Mumbai Office", "Mumbai", "Office", 0, "Inactive"],
    ]),
  },
  {
    id: "schedules", label: "Work Schedules", icon: "calendar", endpoint: "/org/schedules/", noun: "schedule",
    desc: "Shift timings and break policies assigned to employees.",
    cols: [["name", "Schedule"], ["hours", "Work Hours"], ["days", "Work Days"], ["breaks", "Break Policy"], ["employees", "Employees"], ["status", "Status"]],
    fields: [
      { k: "name", label: "Schedule Name", req: true, ph: "e.g. General Shift" },
      { k: "hours", label: "Work Hours", req: true, ph: "9:00 AM – 6:00 PM", half: true },
      { k: "days", label: "Work Days", req: true, ph: "Mon – Fri", half: true },
      { k: "breaks", label: "Break Policy", ph: "e.g. 3 breaks (15m + 30m + 10m)" },
      STATUS,
    ],
    demo: obj(["name", "hours", "days", "breaks", "employees", "status"], [
      ["General Shift", "9:00 AM – 6:00 PM", "Mon – Fri", "3 breaks (15m + 30m + 10m)", 96, "Active"],
      ["Early Shift", "7:00 AM – 4:00 PM", "Mon – Sat", "2 breaks (30m + 15m)", 22, "Active"],
      ["Night Shift", "9:00 PM – 6:00 AM", "Mon – Fri", "2 breaks (30m + 15m)", 10, "Active"],
      ["Weekend Support", "10:00 AM – 7:00 PM", "Sat – Sun", "1 break (45m)", 0, "Inactive"],
    ]),
  },
  { id: "org", label: "Organization Profile", icon: "gear" },
];

const ROLES = [
  ["role-admin", "Admin", ["Full control of users, roles and settings", "Manage company structure", "View every report"]],
  ["role-hr", "HR", ["Onboard employees", "Manage schedules and leave", "Review attendance exceptions"]],
  ["role-manager", "Manager", ["Review team attendance", "Approve team requests", "View team reports"]],
  ["role-employee", "Employee", ["View own profile and attendance", "Apply for leave", "Report attendance issues"]],
];

const ORG_FIELDS = [
  { k: "company", label: "Company Name", req: true, ph: "BurnettPeople" },
  { k: "industry", label: "Industry", ph: "e.g. Technology", half: true },
  { k: "size", label: "Company Size", ph: "e.g. 100 - 250", half: true },
  { k: "email", label: "Official Email", type: "email", ph: "hr@company.com", half: true },
  { k: "phone", label: "Phone", ph: "+91 …", half: true },
  { k: "timezone", label: "Time Zone", ph: "Asia/Kolkata (IST)" },
  { k: "address", label: "Address", type: "textarea", ph: "Registered office address", max: 300 },
];

function Cell({ k, row, i }) {
  if (k === "status") return <Pill>{row.status || "Active"}</Pill>;
  if (k === "head") return row.head ? <span className="ap-person"><Av name={row.head} i={i} size={26} />{row.head}</span> : "—";
  if (k === "employees") return row.employees ?? 0;
  if (k === "name") return <strong>{row.name}</strong>;
  return row[k] || "—";
}

function OrgProfile() {
  const [values, setValues] = useState(SHOW_DEMO_DATA ? { company: "BurnettPeople", industry: "Technology", size: "100 - 250", email: "hr@burnettpeople.com", phone: "", timezone: "Asia/Kolkata (IST)", address: "" } : {});
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = useState(SHOW_DEMO_DATA);

  useEffect(() => {
    if (SHOW_DEMO_DATA) return undefined;
    let off = false;
    apiClient.get(ORG_PROFILE_ENDPOINT).then((r) => { if (!off) { setValues(r || {}); setLoaded(true); } }).catch(() => { if (!off) setLoaded(true); });
    return () => { off = true; };
  }, []);

  async function save(v) {
    if (!SHOW_DEMO_DATA) {
      const fn = apiClient.patch || apiClient.put;
      if (typeof fn !== "function") throw new Error("Update API is not connected yet.");
      await fn.call(apiClient, ORG_PROFILE_ENDPOINT, v);
    }
    setValues(v);
    setNote("Organization profile saved.");
  }

  if (!loaded) return <p className="admin-note">Loading profile…</p>;
  return (
    <div className="ap-orgform">
      <FormPanel key={JSON.stringify(values)} title="Organization Profile" subtitle="Basic information about your company" fields={ORG_FIELDS} initial={values} submitLabel="Save Profile" onSubmit={save} />
      {note && <div role="status" className="admin-form-success">{note}</div>}
    </div>
  );
}

export default function AdminCompanySettings({ initialTab = "departments" }) {
  const resources = {
    departments: useResource(TABS[0].endpoint, TABS[0].demo),
    designations: useResource(TABS[1].endpoint, TABS[1].demo),
    locations: useResource(TABS[3].endpoint, TABS[3].demo),
    schedules: useResource(TABS[4].endpoint, TABS[4].demo),
  };
  const [tabId, setTabId] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState({ mode: "add" });
  const [msg, setMsg] = useState("");

  const tab = TABS.find((t) => t.id === tabId);
  const res = resources[tabId];

  const filtered = useMemo(() => {
    if (!res) return [];
    const q = query.trim().toLowerCase();
    return res.rows.filter((r) => (status === "ALL" || (r.status || "Active") === status) && (!q || Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))));
  }, [res, query, status]);

  const size = 10;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * size, safePage * size);

  const activeCount = (list) => list.filter((r) => (r.status || "Active") === "Active").length;
  const dep = resources.departments.rows;
  const totalEmployees = dep.reduce((n, r) => n + (Number(r.employees) || 0), 0);

  function pick(id) {
    setTabId(id); setQuery(""); setStatus("ALL"); setPage(1); setPanel({ mode: "add" }); setMsg("");
  }

  async function remove(row) {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return;
    try { await res.remove(row.id); setMsg(""); } catch (e) { setMsg(getErrorMessage(e, "Could not delete this item.")); }
  }

  return (
    <div className="ap-page">
      <div className="ap-tabcards" role="tablist" aria-label="Company settings sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === tabId} className={t.id === tabId ? "on" : ""} onClick={() => pick(t.id)}>
            <span className="ap-tabicon"><Icon name={t.icon} size={20} /></span>{t.label}
          </button>
        ))}
      </div>

      {tabId === "roles" && (
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Roles &amp; Permissions</h2><p>System roles and what each one can do.</p></div></div>
          <div className="admin-role-grid">
            {ROLES.map(([cls, title, perms]) => (
              <article key={title}>
                <span className={`role-dot ${cls}`} />
                <strong>{title}</strong>
                <ul className="ap-perms">{perms.map((p) => <li key={p}>{p}</li>)}</ul>
              </article>
            ))}
          </div>
          <p className="admin-note">Roles are fixed by the system. Access is assigned when a user is created.</p>
        </section>
      )}

      {tabId === "org" && <section className="admin-panel ap-main"><OrgProfile /></section>}

      {tab.endpoint && (
        <div className={`ap-split${panel ? " has-side" : ""}`}>
          <section className="admin-panel ap-main" aria-label={tab.label}>
            <div className="admin-panel-heading">
              <div className="ap-person big">
                <span className="ap-dev-icon big"><Icon name={tab.icon} size={22} /></span>
                <div><h2>{tab.label}</h2><p>{tab.desc}</p></div>
              </div>
              <button type="button" className="admin-primary-button" onClick={() => setPanel({ mode: "add" })}><Icon name="plus" size={16} /> Add {tab.noun}</button>
            </div>

            <div className="ap-toolbar">
              <label className="ap-search">
                <Icon name="search" size={16} />
                <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={`Search ${tab.label.toLowerCase()}...`} aria-label="Search" />
              </label>
              <label className="ap-filter"><small>Status</small>
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="ALL">All</option><option>Active</option><option>Inactive</option></select></label>
              <button type="button" className="admin-link-button" onClick={() => { setQuery(""); setStatus("ALL"); setPage(1); }}>Clear</button>
            </div>

            {(res.error || msg) && <div role="alert" className="admin-form-error">{msg || res.error}</div>}

            {res.loading ? <p className="admin-note">Loading…</p> : filtered.length === 0 ? <p className="admin-note">Nothing here yet. Use “Add {tab.noun}” to create the first one.</p> : (
              <div className="admin-table-wrap">
                <table className="admin-table ap-table">
                  <thead><tr><th>#</th>{tab.cols.map(([k, label]) => <th key={k}>{label.toUpperCase()}</th>)}<th>ACTIONS</th></tr></thead>
                  <tbody>
                    {visible.map((r, i) => (
                      <tr key={r.id}>
                        <td>{(safePage - 1) * size + i + 1}</td>
                        {tab.cols.map(([k]) => <td key={k}><Cell k={k} row={r} i={i} /></td>)}
                        <td><div className="ap-actions">
                          <button type="button" className="ap-icon-btn" onClick={() => setPanel({ mode: "edit", row: r })} aria-label={`Edit ${r.name}`}><Icon name="edit" size={15} /></button>
                          <button type="button" className="ap-icon-btn danger" onClick={() => remove(r)} aria-label={`Delete ${r.name}`}><Icon name="trash" size={15} /></button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!res.loading && filtered.length > 0 && <Pager page={safePage} pages={pages} total={filtered.length} size={size} onPage={(n) => setPage(Math.min(Math.max(1, n), pages))} noun={`${tab.noun}s`} />}
          </section>

          {panel && (
            <FormPanel
              key={`${tabId}-${panel.row?.id || "new"}`}
              title={panel.mode === "edit" ? `Edit ${tab.noun}` : `Add ${tab.noun}`}
              subtitle={panel.mode === "edit" ? "Update the details below" : `Create a new ${tab.noun} for your organization.`}
              fields={tab.fields}
              initial={panel.row || {}}
              submitLabel={panel.mode === "edit" ? "Save Changes" : `Create ${tab.noun}`}
              onSubmit={(v) => (panel.mode === "edit" ? res.update(panel.row.id, v) : res.create({ ...v, employees: 0 }))}
              onClose={() => setPanel(null)}
            />
          )}
        </div>
      )}

      <section className="ap-stats four" aria-label="Company summary">
        <MiniStat icon="building" tone="green" value={dep.length} label="Total Departments" note={`${activeCount(dep)} active, ${dep.length - activeCount(dep)} inactive`} />
        <MiniStat icon="users" tone="blue" value={totalEmployees} label="Total Employees" note="Across all departments" />
        <MiniStat icon="pin" tone="purple" value={resources.locations.rows.length} label="Work Locations" note={`${activeCount(resources.locations.rows)} active`} />
        <MiniStat icon="calendar" tone="green" value={resources.schedules.rows.length} label="Work Schedules" note="Active schedules" />
      </section>
    </div>
  );
}
