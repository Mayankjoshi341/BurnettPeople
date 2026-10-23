import { useMemo, useState } from "react";

import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { SHOW_DEMO_DATA, formatDate, getErrorMessage, useEmployees } from "./dashboardUtils";
import { Av, MiniStat, Pager, Pill, downloadCsv } from "./AdminUi";

/* Backend: PATCH (or PUT) this URL with { manager, designation, status } */
const EMPLOYEE_UPDATE_ENDPOINT = (id) => `/employees/${id}/`;
const STATUSES = ["Active", "On Leave", "Inactive"];

/* Sample rows - used only when SHOW_DEMO_DATA is true and the API returns nothing */
const DEMO_EMP = [
  ["Rohan Thakur", "Engineering", "Senior Developer", "Neha Gupta", "Active"],
  ["Neha Gupta", "Engineering", "Team Lead", "Vikram Kapoor", "Active"],
  ["Vikram Kapoor", "Product", "Product Manager", "Priya Nair", "Active"],
  ["Priya Nair", "HR", "HR Executive", "Anita Patel", "Active"],
  ["Aarav Sharma", "Marketing", "Marketing Specialist", "Rohit Mehta", "Active"],
  ["Kavya Mehta", "Finance", "Accountant", "Rahul Verma", "On Leave"],
  ["Rahul Verma", "Operations", "Operations Lead", "Amit Singh", "Active"],
  ["Aditya Singh", "Operations", "Operations Executive", "Rahul Verma", "Active"],
  ["Simran Joshi", "Design", "UI/UX Designer", "Pikram Kapoor", "Active"],
  ["Karan Malhotra", "Sales", "Sales Executive", "Meera Iyer", "Inactive"],
].map(([name, department, designation, manager, status], i) => ({
  id: `demo-${i + 1}`,
  code: `EMP${String(i + 1).padStart(3, "0")}`,
  name,
  email: `${name.split(" ")[0].toLowerCase()}@burnettpeople.com`,
  department,
  designation,
  manager,
  status,
  phone: "+91 98765 43210",
  joined: "2024-01-15",
  type: "Full-time",
  location: "Indore Office",
  schedule: "General Shift (Mon - Fri, 9:30 AM - 6:30 PM)",
}));

function EmployeePanel({ person, index, managers, onClose, onSave }) {
  const [tab, setTab] = useState("overview");
  const [manager, setManager] = useState(person.managerId == null ? "" : String(person.managerId));
  const [designation, setDesignation] = useState(person.designation === "—" ? "" : person.designation);
  const [status, setStatus] = useState(STATUSES.includes(person.status) ? person.status : "Active");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState({ type: "", text: "" });

  async function run(label, payload) {
    setBusy(label);
    setNote({ type: "", text: "" });
    try {
      await onSave(person, payload);
      setNote({ type: "ok", text: `${label} saved.` });
    } catch (e) {
      setNote({ type: "err", text: getErrorMessage(e, "Could not save the change.") });
    } finally {
      setBusy("");
    }
  }

  const rows = [
    ["Employee ID", person.code],
    ["Work Email", person.email],
    ["Phone Number", person.phone],
    ["Department", person.department],
    ["Designation", person.designation],
    ["Reporting Manager", person.manager],
    ["Employment Type", person.type],
    ["Date of Joining", person.joined ? formatDate(person.joined) : "—"],
    ["Work Location", person.location],
    ["Working Schedule", person.schedule],
  ];

  return (
    <aside className="admin-panel ap-side" aria-label="Employee details">
      <div className="ap-side-head">
        <div className="ap-person big">
          <Av name={person.name} i={index} size={56} />
          <div>
            <Pill>{person.status}</Pill>
            <h2>{person.name}</h2>
            <p>{person.designation}</p>
          </div>
        </div>
        <button type="button" className="ap-x" onClick={onClose} aria-label="Close panel"><Icon name="close" size={16} /></button>
      </div>

      <div className="ap-tabs sm" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "overview"} className={tab === "overview" ? "on" : ""} onClick={() => setTab("overview")}>Overview</button>
        <button type="button" role="tab" aria-selected={tab === "manage"} className={tab === "manage" ? "on" : ""} onClick={() => setTab("manage")}>Manager &amp; Role</button>
      </div>

      {tab === "overview" ? (
        <dl className="ap-kv">
          {rows.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      ) : (
        <div className="ap-manage">
          <div className="ap-field">
            <label htmlFor="mg-mgr">Reporting manager</label>
            <div className="ap-inline">
              <select id="mg-mgr" value={manager} onChange={(e) => setManager(e.target.value)}>
                <option value="">Select manager</option>
                {managers.filter((m) => String(m.id) !== String(person.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <button type="button" className="admin-primary-button" disabled={manager === String(person.managerId ?? "") || Boolean(busy)} onClick={() => run("Manager", { manager: manager || null })}>
                {busy === "Manager" ? "…" : "Assign"}
              </button>
            </div>
          </div>
          <div className="ap-field">
            <label htmlFor="mg-role">Designation</label>
            <div className="ap-inline">
              <input id="mg-role" value={designation} onChange={(e) => setDesignation(e.target.value)} />
              <button type="button" className="admin-primary-button" disabled={!designation.trim() || designation === person.designation || Boolean(busy)} onClick={() => run("Designation", { designation: designation.trim() })}>
                {busy === "Designation" ? "…" : "Update"}
              </button>
            </div>
          </div>
          <div className="ap-field">
            <label htmlFor="mg-status">Status</label>
            <div className="ap-inline">
              <select id="mg-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="button" className="admin-primary-button" disabled={status === person.status || Boolean(busy)} onClick={() => run("Status", { status })}>
                {busy === "Status" ? "…" : "Update"}
              </button>
            </div>
          </div>
          {note.text && <div role={note.type === "err" ? "alert" : "status"} className={note.type === "err" ? "admin-form-error" : "admin-form-success"}>{note.text}</div>}
        </div>
      )}

      {person.email !== "—" && (
        <a className="admin-secondary-button ap-mailbtn" href={`mailto:${person.email}`}><Icon name="mail" size={16} /> Send email</a>
      )}
    </aside>
  );
}

/* canAdd / onAdd: kept for HR - the Admin dashboard leaves canAdd=false so no "Add employee" action exists. */
export default function AdminEmployees({ canAdd = false, onAdd }) {
  const { employees, loading, error, reload } = useEmployees();
  const usingDemo = SHOW_DEMO_DATA && !loading && employees.length === 0;
  const base = usingDemo ? DEMO_EMP : employees;

  const [edits, setEdits] = useState({});
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("ALL");
  const [desig, setDesig] = useState("ALL");
  const [mgr, setMgr] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [selectedId, setSelectedId] = useState(null);

  const rows = useMemo(() => base.map((r) => ({ ...r, ...edits[r.id] })), [base, edits]);
  const uniq = (key) => [...new Set(rows.map((r) => r[key]).filter((v) => v && v !== "—"))].sort();
  const depts = uniq("department");
  const desigs = uniq("designation");
  const mgrs = rows.filter((r) => r.id != null && (r.role === "MANAGER" || /manager|lead|head|director/i.test(r.designation)));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (dept === "ALL" || r.department === dept) &&
        (desig === "ALL" || r.designation === desig) &&
        (mgr === "ALL" || r.manager === mgr) &&
        (status === "ALL" || r.status === status) &&
        (!q || [r.name, r.email, r.code, r.department].some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [rows, query, dept, desig, mgr, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * size, safePage * size);
  const selectedIndex = rows.findIndex((r) => r.id === selectedId);
  const selected = selectedIndex >= 0 ? rows[selectedIndex] : null;

  const countBy = (fn) => rows.filter(fn).length;
  const managersCount = countBy((r) => /manager|lead|head|director/i.test(r.designation));

  const clear = () => { setQuery(""); setDept("ALL"); setDesig("ALL"); setMgr("ALL"); setStatus("ALL"); setPage(1); };
  const reset = (setter) => (e) => { setter(e.target.value); setPage(1); };

  async function save(person, payload) {
    if (!usingDemo) {
      const fn = apiClient.patch || apiClient.put;
      if (typeof fn !== "function") throw new Error("Update API is not connected yet.");
      await fn.call(apiClient, EMPLOYEE_UPDATE_ENDPOINT(person.id), payload);
    }
    setEdits((p) => ({ ...p, [person.id]: { ...p[person.id], ...payload } }));
    if (!usingDemo) reload();
  }

  function exportCsv() {
    downloadCsv(
      "employees.csv",
      ["Employee ID", "Name", "Email", "Department", "Designation", "Manager", "Status"],
      filtered.map((r) => [r.code, r.name, r.email, r.department, r.designation, r.manager, r.status]),
    );
  }

  return (
    <div className="ap-page">
      <section className="ap-stats" aria-label="Employee summary">
        <MiniStat icon="users" tone="green" value={rows.length} label="Total Employees" note={usingDemo ? "Sample data" : "From employee records"} />
        <MiniStat icon="shield" tone="blue" value={managersCount} label="Managers & Leads" note={rows.length ? `${Math.round((managersCount / rows.length) * 100)}% of total` : ""} />
        <MiniStat icon="plane" tone="amber" value={countBy((r) => r.status === "On Leave")} label="On Leave" note="Currently" />
        <MiniStat icon="alert" tone="red" value={countBy((r) => r.status === "Inactive")} label="Inactive" note="Not in service" />
        {canAdd ? (
          <button type="button" className="ap-cta" onClick={onAdd}>
            <Icon name="userplus" size={22} />
            <span><strong>Add New Employee</strong><small>Go to Employee Onboarding</small></span>
          </button>
        ) : (
          <div className="ap-cta readonly" role="note">
            <Icon name="lock" size={22} />
            <span><strong>View &amp; manage only</strong><small>New employees are onboarded by HR</small></span>
          </div>
        )}
      </section>

      <div className={`ap-split${selected ? " has-side" : ""}`}>
        <section className="admin-panel ap-main" aria-label="Employee directory">
          <div className="ap-toolbar">
            <label className="ap-search">
              <Icon name="search" size={16} />
              <input type="search" value={query} onChange={reset(setQuery)} placeholder="Search by name, email, employee ID..." aria-label="Search employees" />
            </label>
            <label className="ap-filter"><small>Department</small>
              <select value={dept} onChange={reset(setDept)}><option value="ALL">All Departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</select></label>
            <label className="ap-filter"><small>Designation</small>
              <select value={desig} onChange={reset(setDesig)}><option value="ALL">All Designations</option>{desigs.map((d) => <option key={d}>{d}</option>)}</select></label>
            <label className="ap-filter"><small>Manager</small>
              <select value={mgr} onChange={reset(setMgr)}><option value="ALL">All Managers</option>{mgrs.map((d) => <option key={d}>{d}</option>)}</select></label>
            <label className="ap-filter"><small>Status</small>
              <select value={status} onChange={reset(setStatus)}><option value="ALL">All Status</option>{STATUSES.map((d) => <option key={d}>{d}</option>)}</select></label>
            <button type="button" className="admin-link-button" onClick={clear}>Clear</button>
            <button type="button" className="admin-secondary-button ap-small" onClick={exportCsv} disabled={!filtered.length}><Icon name="download" size={15} /> Export</button>
          </div>

          {error && !usingDemo && <div role="alert" className="admin-form-error">{error}</div>}

          {loading ? (
            <p className="admin-note">Loading employees…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-note">No employees match your filters.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table ap-table">
                <thead>
                  <tr><th>#</th><th>EMPLOYEE</th><th>EMPLOYEE ID</th><th>DEPARTMENT</th><th>DESIGNATION</th><th>MANAGER</th><th>STATUS</th><th>ACTIONS</th></tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={r.id} className={r.id === selectedId ? "sel" : ""}>
                      <td>{(safePage - 1) * size + i + 1}</td>
                      <td>
                        <div className="ap-person">
                          <Av name={r.name} i={i} />
                          <span><strong>{r.name}</strong><small>{r.email}</small></span>
                        </div>
                      </td>
                      <td>{r.code}</td>
                      <td>{r.department}</td>
                      <td>{r.designation}</td>
                      <td>{r.manager}</td>
                      <td><Pill>{r.status}</Pill></td>
                      <td>
                        <div className="ap-actions">
                          <button type="button" className="ap-icon-btn" onClick={() => setSelectedId(r.id)} aria-label={`Manage ${r.name}`}><Icon name="edit" size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <Pager page={safePage} pages={pages} total={filtered.length} size={size} onPage={(n) => setPage(Math.min(Math.max(1, n), pages))} onSize={(n) => { setSize(n); setPage(1); }} noun="employees" />
          )}
        </section>

        {selected && (
          <EmployeePanel key={selected.id} person={selected} index={selectedIndex} managers={mgrs} onClose={() => setSelectedId(null)} onSave={save} />
        )}
      </div>
    </div>
  );
}
