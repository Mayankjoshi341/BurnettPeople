import { useState } from "react";

import { Icon } from "./DashboardIcons";
import { getErrorMessage } from "./dashboardUtils";
import { Av, FormPanel, MiniStat, Pager, Pill, useResource } from "./AdminUi";

const READ_ONLY_LOOKUPS = new Set();

const STATUS = { k: "status", label: "Status", type: "select", options: ["Active", "Inactive"], def: "Active" };
const obj = (keys, list) => list.map((row, i) => ({ id: `demo-${i + 1}`, ...Object.fromEntries(keys.map((k, j) => [k, row[j]])) }));

const TABS = [
  {
    id: "departments", label: "Departments", icon: "building", endpoint: "/organization/departments/?include_inactive=true", noun: "department",
    desc: "Manage departments in your organization. Departments help organize employees and reporting structure.",
    cols: [["name", "Department Name"], ["code", "Code"], ["description", "Description"], ["status", "Status"]],
    fields: [
      { k: "name", label: "Department Name", req: true, ph: "e.g. Engineering" },
      { k: "code", label: "Department Code", req: true, ph: "e.g. ENG" },
      { k: "description", label: "Description", type: "textarea", ph: "Brief description about this department..." },
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
    id: "designations", label: "Designations", icon: "tag", endpoint: "/organization/designations/?include_inactive=true", noun: "designation",
    desc: "Job titles used across the company. Designations define levels and reporting.",
    cols: [["name", "Designation"], ["grade", "Grade"], ["status", "Status"]],
    fields: [
      { k: "title", label: "Designation Name", req: true, ph: "e.g. Senior Developer" },
      { k: "grade", label: "Grade", ph: "Optional grade or level" },
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
    id: "locations", label: "Work Locations", icon: "pin", endpoint: "/organization/work-locations/?include_inactive=true", noun: "location",
    desc: "Offices and remote locations where employees work.",
    cols: [["name", "Location"], ["address", "Address"], ["timezone", "Time Zone"], ["status", "Status"]],
    fields: [
      { k: "name", label: "Location Name", req: true, ph: "e.g. Indore Office" },
      { k: "address", label: "Address", type: "textarea", ph: "Office or work location address" },
      { k: "timezone", label: "IANA Time Zone", req: true, ph: "Asia/Kolkata", def: "Asia/Kolkata" },
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
    id: "schedules", label: "Work Schedules", icon: "calendar", endpoint: "/attendance/schedules/?include_inactive=true", noun: "schedule",
    desc: "Shift timings and break policies assigned to employees.",
    cols: [["name", "Schedule"], ["hours", "Work Hours"], ["days", "Work Days"], ["breaks", "Break Policy"], ["status", "Status"]],
    fields: [
      { k: "name", label: "Schedule Name", req: true, ph: "e.g. General Shift" },
      { k: "start_time", label: "Start Time", type: "time", req: true, half: true },
      { k: "end_time", label: "End Time", type: "time", req: true, half: true },
      { k: "workdays", label: "Work Days", type: "multiselect", req: true, options: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] },
      { k: "timezone", label: "IANA Time Zone", req: true, ph: "Asia/Kolkata", def: "Asia/Kolkata" },
      { k: "break_policy_id", label: "Break Policy", type: "select", req: true, ph: "Select an active policy", options: [] },
      { k: "late_grace_minutes", label: "Late Grace (minutes)", type: "number", req: true, def: "5" },
      STATUS,
    ],
    demo: obj(["name", "hours", "days", "breaks", "employees", "status"], [
      ["General Shift", "9:00 AM – 6:00 PM", "Mon – Fri", "3 breaks (15m + 30m + 10m)", 96, "Active"],
      ["Early Shift", "7:00 AM – 4:00 PM", "Mon – Sat", "2 breaks (30m + 15m)", 22, "Active"],
      ["Night Shift", "9:00 PM – 6:00 AM", "Mon – Fri", "2 breaks (30m + 15m)", 10, "Active"],
      ["Weekend Support", "10:00 AM – 7:00 PM", "Sat – Sun", "1 break (45m)", 0, "Inactive"],
    ]),
  },
  {
    id: "schedule-assignments", label: "Schedule Assignments", icon: "users", endpoint: "/attendance/assignments/?page_size=200", noun: "assignment",
    desc: "Effective-dated schedule assignments and their retained history.",
    cols: [["employee", "Employee"], ["schedule_name", "Schedule"], ["effective_from", "Effective From"], ["effective_until", "Effective Until"], ["status", "Status"]],
    fields: [],
  },
  { id: "org", label: "Organization Profile", icon: "gear" },
];

const ROLES = [
  ["role-admin", "Admin", ["Full control of users, roles and settings", "Manage company structure", "View every report"]],
  ["role-hr", "HR", ["Onboard employees", "Manage schedules and leave", "Review attendance exceptions"]],
  ["role-manager", "Manager", ["Review team attendance", "Approve team requests", "View team reports"]],
  ["role-employee", "Employee", ["View own profile and attendance", "Apply for leave", "Report attendance issues"]],
];

function Cell({ k, row, i }) {
  if (k === "status") return <Pill>{row.status || (row.effective_until && row.effective_until < new Date().toISOString().slice(0, 10) ? "Ended" : row.is_active === false ? "Inactive" : "Active")}</Pill>;
  if (k === "head") return row.head ? <span className="ap-person"><Av name={row.head} i={i} size={26} />{row.head}</span> : "—";
  if (k === "employees") return row.employees ?? 0;
  if (k === "name") return <strong>{row.name || row.title || "—"}</strong>;
  if (k === "employee") return <strong>{row.employee_code ? `${row.employee_code} · ${[row.employee_first_name, row.employee_last_name].filter(Boolean).join(" ")}` : "—"}</strong>;
  if (k === "schedule_name") return row.work_schedule?.name || "—";
  if (k === "hours") return [row.start_time, row.end_time].filter(Boolean).map((v) => v.slice(0, 5)).join("–") || "—";
  if (k === "days") return Array.isArray(row.workdays) ? row.workdays.join(", ") : "—";
  if (k === "breaks") return row.break_policy?.name || "—";
  return row[k] || "—";
}

function OrgProfile() {
  return (
    <div className="ap-orgform">
      <h2>Organization Profile</h2>
      <p className="admin-note">The backend does not currently store company profile fields such as industry, company size, or registered address. This section is read-only until those settings have a persistent API and database model.</p>
    </div>
  );
}

export default function AdminCompanySettings({ initialTab = "departments", hideTabs = false }) {
  const resources = {
    departments: useResource(TABS[0].endpoint, TABS[0].demo),
    designations: useResource(TABS[1].endpoint, TABS[1].demo),
    locations: useResource(TABS[3].endpoint, TABS[3].demo),
    schedules: useResource(TABS[4].endpoint, TABS[4].demo),
    assignments: useResource(TABS[5].endpoint),
    breakPolicies: useResource("/attendance/break-policies/"),
    employees: useResource("/employees/"),
  };
  const [tabId, setTabId] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState(null);
  const [msg, setMsg] = useState("");

  const tab = TABS.find((t) => t.id === tabId);
  const res = resources[tabId];
  const readOnly = READ_ONLY_LOOKUPS.has(tabId);
  const assignmentCreateFields = [
    { k: "employee_id", label: "Employee", type: "select", req: true, ph: "Select an active employee", options: resources.employees.rows.filter((employee) => employee.employment_status === "ACTIVE").map((employee) => ({ value: String(employee.id), label: `${employee.employee_code} · ${employee.first_name} ${employee.last_name}` })) },
    { k: "work_schedule_id", label: "Work Schedule", type: "select", req: true, ph: "Select an active schedule", options: resources.schedules.rows.filter((schedule) => schedule.is_active).map((schedule) => ({ value: String(schedule.id), label: schedule.name })) },
    { k: "effective_from", label: "Effective From", type: "date", req: true },
    { k: "effective_until", label: "Effective Until", type: "date" },
  ];
  const assignmentEditFields = [{ k: "effective_until", label: "Effective Until", type: "date", req: true }];
  const fields = tabId === "schedules"
    ? tab.fields.map((field) => field.k === "break_policy_id"
      ? { ...field, options: resources.breakPolicies.rows.map((policy) => ({ value: String(policy.id), label: policy.name })) }
      : field)
    : tabId === "schedule-assignments"
      ? (panel?.mode === "edit" ? assignmentEditFields : assignmentCreateFields)
      : tab.fields;
  const rowStatus = (row) => row.status || (tabId === "schedule-assignments"
    ? row.effective_until && row.effective_until < new Date().toISOString().slice(0, 10) ? "Ended" : "Active"
    : row.is_active === false ? "Inactive" : "Active");

  const filtered = (res?.rows || []).filter((r) => {
    const q = query.trim().toLowerCase();
    const currentStatus = rowStatus(r);
    return (status === "ALL" || currentStatus === status) && (!q || Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)));
  });

  const size = 10;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * size, safePage * size);

  const activeCount = (list) => list.filter((r) => rowStatus(r) === "Active").length;
  const dep = resources.departments.rows;
  const totalEmployees = resources.employees.rows.filter((employee) => employee.employment_status === "ACTIVE").length;

  function pick(id) {
    setTabId(id); setQuery(""); setStatus("ALL"); setPage(1); setPanel(null); setMsg("");
  }

  async function remove(row) {
    if (!window.confirm(`Deactivate "${row.name || row.title}"? Existing employee and schedule history will be retained.`)) return;
    try { await res.remove(row.id); setMsg(""); } catch (e) { setMsg(getErrorMessage(e, "Could not delete this item.")); }
  }

  return (
    <div className="ap-page">
      <section className="ap-stats four" aria-label="Company summary">
        <MiniStat icon="building" tone="green" value={dep.length} label="Total Departments" note={`${activeCount(dep)} active, ${dep.length - activeCount(dep)} inactive`} />
        <MiniStat icon="users" tone="blue" value={totalEmployees} label="Total Employees" note="Across all departments" />
        <MiniStat icon="pin" tone="purple" value={resources.locations.rows.length} label="Work Locations" note={`${activeCount(resources.locations.rows)} active`} />
        <MiniStat icon="calendar" tone="green" value={resources.schedules.rows.length} label="Work Schedules" note="Configured schedules" />
      </section>

      {!hideTabs && <div className="ap-tabcards" role="tablist" aria-label="Company settings sections">
        {TABS.filter((t) => !["roles", "org", "schedule-assignments"].includes(t.id)).map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === tabId} className={t.id === tabId ? "on" : ""} onClick={() => pick(t.id)}>
            <span className="ap-tabicon"><Icon name={t.icon} size={20} /></span>{t.label}
          </button>
        ))}
      </div>}

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
              {!readOnly && <button type="button" className="admin-primary-button" onClick={() => setPanel({ mode: "add" })}><Icon name="plus" size={16} /> {tabId === "schedule-assignments" ? "Assign schedule" : `Add ${tab.noun}`}</button>}
            </div>

            {readOnly && <p className="admin-note">Showing configured schedules. This screen is read-only; assignments and schedule history are managed separately.</p>}

            <div className="ap-toolbar">
              <label className="ap-search">
                <Icon name="search" size={16} />
                <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={`Search ${tab.label.toLowerCase()}...`} aria-label="Search" />
              </label>
              <label className="ap-filter"><small>Status</small>
                <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="ALL">All</option><option>Active</option><option>{tabId === "schedule-assignments" ? "Ended" : "Inactive"}</option></select></label>
              <button type="button" className="admin-link-button" onClick={() => { setQuery(""); setStatus("ALL"); setPage(1); }}>Clear</button>
            </div>

            {(res.error || msg) && <div role="alert" className="admin-form-error">{msg || res.error}</div>}

            {res.loading ? <p className="admin-note">Loading…</p> : filtered.length === 0 ? <p className="admin-note">No company records found.</p> : (
              <div className="admin-table-wrap">
                <table className="admin-table ap-table">
                  <thead><tr><th>#</th>{tab.cols.map(([k, label]) => <th key={k}>{label.toUpperCase()}</th>)}{!readOnly && <th>ACTIONS</th>}</tr></thead>
                  <tbody>
                    {visible.map((r, i) => (
                      <tr key={r.id}>
                        <td>{(safePage - 1) * size + i + 1}</td>
                        {tab.cols.map(([k]) => <td key={k}><Cell k={k} row={r} i={i} /></td>)}
                        {!readOnly && <td><div className="ap-actions">
                          <button type="button" className="ap-icon-btn" onClick={() => setPanel({ mode: "edit", row: r })} aria-label={tabId === "schedule-assignments" ? `End schedule assignment ${r.employee_code}` : `Edit ${r.name || r.title}`}><Icon name="edit" size={15} /></button>
                          {tabId !== "schedule-assignments" && <button type="button" className="ap-icon-btn danger" onClick={() => remove(r)} aria-label={`Deactivate ${r.name || r.title}`}><Icon name="trash" size={15} /></button>}
                        </div></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!res.loading && filtered.length > 0 && <Pager page={safePage} pages={pages} total={filtered.length} size={size} onPage={(n) => setPage(Math.min(Math.max(1, n), pages))} noun={`${tab.noun}s`} />}
          </section>

          {panel && !readOnly && (
            <FormPanel
              key={`${tabId}-${panel.row?.id || "new"}`}
              title={panel.mode === "edit" ? `Edit ${tab.noun}` : `Add ${tab.noun}`}
              subtitle={panel.mode === "edit" ? "Update the details below" : `Create a new ${tab.noun} for your organization.`}
              fields={fields}
              initial={panel.row ? {
                ...panel.row,
                status: panel.row.is_active === false ? "Inactive" : "Active",
                ...(tabId === "schedules" ? {
                  start_time: panel.row.start_time?.slice(0, 5),
                  end_time: panel.row.end_time?.slice(0, 5),
                  break_policy_id: String(panel.row.break_policy?.id || ""),
                } : {}),
                ...(tabId === "schedule-assignments" ? {
                  effective_until: panel.row.effective_until || "",
                } : {}),
              } : {}}
              submitLabel={panel.mode === "edit" ? "Save Changes" : `Create ${tab.noun}`}
              onSubmit={(v) => {
                if (tabId === "schedule-assignments") {
                  const payload = panel.mode === "edit" ? v : { ...v, effective_until: v.effective_until || null };
                  return panel.mode === "edit" ? res.update(panel.row.id, payload) : res.create(payload);
                }
                const payload = { ...v, is_active: v.status !== "Inactive" };
                delete payload.status;
                if (tabId === "schedules") payload.late_grace_minutes = Number(payload.late_grace_minutes);
                return panel.mode === "edit" ? res.update(panel.row.id, payload) : res.create(payload);
              }}
              onClose={() => setPanel(null)}
            />
          )}
        </div>
      )}

    </div>
  );
}
