import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Icon } from "./DashboardIcons";
import { StatCard, Pager } from "./DashboardParts";
import {
  AVATAR_TONES,
  SHOW_DEMO_DATA,
  callApi,
  getErrorMessage,
  initialsOf,
  statusLabel,
  statusTone,
  useEmployees,
} from "./dashboardUtils";
import "./HRPages.css";
import "./AdminHRLeave.css";

/* ------------------------------------------------------------------
   Backend notes (change when your API is final)
   - Assign manager : PATCH /employees/{id}/   body { manager: <employee id> }
   - Role change    : set ROLE_CHANGE_URL below. While it is null the "Make Manager"
                      action explains that the backend endpoint is missing.
   ------------------------------------------------------------------ */
const ROLE_CHANGE_URL = null; // e.g. (id) => `/employees/${id}/change-role/`

const ROLE_META = {
  EMPLOYEE: { label: "Employee", cls: "emp" },
  MANAGER: { label: "Manager", cls: "mgr" },
  HR: { label: "HR", cls: "hr" },
  ADMIN: { label: "Admin", cls: "adm" },
};

const SYSTEM_ROLES = [
  ["role-admin", "Admin", "Full control of users, roles and settings."],
  ["role-hr", "HR", "Onboard employees, manage schedules and leave."],
  ["role-manager", "Manager", "Review team attendance and requests."],
  ["role-employee", "Employee", "View own profile, attendance and leave."],
];

/* Sample rows - shown ONLY when the API returns no employees and SHOW_DEMO_DATA is true */
const DEMO_ROWS = [
  ["Rohit Kumar", "EMP-001", "Engineering", "Software Engineer", "EMPLOYEE", "Vikram Singh"],
  ["Neha Kapoor", "EMP-002", "Product", "Product Manager", "MANAGER", ""],
  ["Vikram Singh", "EMP-003", "Design", "Design Lead", "MANAGER", ""],
  ["Priya Rathi", "EMP-004", "HR", "HR Executive", "HR", "Anita Sharma"],
  ["Amit Sharma", "EMP-005", "Marketing", "Marketing Executive", "EMPLOYEE", "Neha Kapoor"],
  ["Sneha Desai", "EMP-006", "Engineering", "QA Engineer", "EMPLOYEE", "Rohit Kumar"],
  ["Pooja Lakhwani", "EMP-007", "Product", "UI/UX Designer", "EMPLOYEE", "Vikram Singh"],
  ["Ishan Kulkarni", "EMP-008", "Design", "Graphic Designer", "EMPLOYEE", "Vikram Singh"],
].map(([name, code, department, designation, role, manager], i) => ({
  id: `demo-${i}`, name, code, department, designation, role, manager,
  managerId: manager ? `m-${manager}` : null,
  email: `${name.split(" ")[0].toLowerCase()}@burnettpeople.com`,
  status: "ACTIVE", demo: true,
}));
// give the demo managers ids that match the rows that point to them
DEMO_ROWS.forEach((r) => { if (r.role === "MANAGER") r.id = `m-${r.name}`; });

const DEMO_CHANGES = [
  ["check", "ok", "Anita Sharma added as HR", "Today, 10:30 AM"],
  ["user", "info", "Neha Kapoor promoted to Manager", "Oct 20, 2026, 04:15 PM"],
  ["user", "info", "Vikram Singh assigned as manager to Rohit Kumar", "Oct 18, 2026, 02:20 PM"],
  ["close", "bad", "Pooja Lakhwani removed from manager", "Oct 15, 2026, 11:45 AM"],
];

function Avatar({ name, index = 0, size = 34 }) {
  return (
    <span className="people-avatar" style={{ width: size, height: size, fontSize: size * 0.34, background: AVATAR_TONES[index % AVATAR_TONES.length] }}>
      {initialsOf(name)}
    </span>
  );
}

function RolePill({ role }) {
  const m = ROLE_META[role] || { label: role || "—", cls: "emp" };
  return <span className={`ahl-role ${m.cls}`}>{m.label}</span>;
}

/* ---------- Modals ---------- */
function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="admin-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="admin-modal-heading">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AssignModal({ all, managers, target, onClose, onSaved }) {
  const [employeeId, setEmployeeId] = useState(target?.id ?? "");
  const [managerId, setManagerId] = useState(target?.managerId ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const employee = all.find((e) => String(e.id) === String(employeeId));

  async function save() {
    setErr("");
    setMsg("");
    if (!employee) { setErr("Choose an employee."); return; }
    if (employee.demo) { setErr("This is sample data. Connect the employee API to save changes."); return; }
    setBusy(true);
    try {
      await callApi("patch", `/employees/${employee.id}/`, { manager: managerId ? Number(managerId) : null });
      setMsg("Reporting manager updated.");
      onSaved();
    } catch (e) {
      setErr(getErrorMessage(e, "Could not update the manager."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Assign Manager" subtitle="Choose who this employee reports to." onClose={onClose}>
      <label className="hrp-label" htmlFor="am-emp">Employee</label>
      <select id="am-emp" className="ahl-select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
        <option value="">Select employee…</option>
        {all.filter((e) => e.role !== "ADMIN").map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
      </select>

      <label className="hrp-label" htmlFor="am-mgr">Reporting manager</label>
      <select id="am-mgr" className="ahl-select" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
        <option value="">No manager</option>
        {managers.filter((m) => String(m.id) !== String(employeeId)).map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
      </select>

      {msg && <p className="admin-form-success" role="status">{msg}</p>}
      {err && <p className="admin-form-error" role="alert">{err}</p>}
      <div className="admin-modal-actions">
        <button type="button" className="admin-secondary-button" onClick={onClose}>Close</button>
        <button type="button" className="admin-primary-button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </Modal>
  );
}

function TeamModal({ manager, all, onClose }) {
  const team = all.filter((e) => String(e.managerId) === String(manager.id));
  return (
    <Modal title={`${manager.name}'s Team`} subtitle={`${team.length} direct report${team.length === 1 ? "" : "s"}`} onClose={onClose}>
      {team.length === 0 ? (
        <p className="admin-note">No one reports to this manager yet.</p>
      ) : (
        <ul className="ahl-team">
          {team.map((m, i) => (
            <li key={m.id}>
              <Avatar name={m.name} index={i} />
              <span><strong>{m.name}</strong><small>{m.designation} · {m.department}</small></span>
              <RolePill role={m.role} />
            </li>
          ))}
        </ul>
      )}
      <div className="admin-modal-actions">
        <button type="button" className="admin-secondary-button" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function PromoteModal({ all, onClose }) {
  const [employeeId, setEmployeeId] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit() {
    setErr("");
    setMsg("");
    const employee = all.find((e) => String(e.id) === String(employeeId));
    if (!employee) { setErr("Choose an employee."); return; }
    if (!ROLE_CHANGE_URL) { setErr("The role-change API is not connected yet. Set ROLE_CHANGE_URL in AdminHRManagers.jsx once the backend provides it."); return; }
    setBusy(true);
    try {
      await callApi("post", ROLE_CHANGE_URL(employee.id), { role: "MANAGER" });
      setMsg(`${employee.name} is now a Manager.`);
    } catch (e) {
      setErr(getErrorMessage(e, "Could not change the role."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Make Manager" subtitle="Promote an existing employee to Manager." onClose={onClose}>
      <label className="hrp-label" htmlFor="pm-emp">Employee</label>
      <select id="pm-emp" className="ahl-select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
        <option value="">Select employee…</option>
        {all.filter((e) => e.role === "EMPLOYEE").map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
      </select>
      {msg && <p className="admin-form-success" role="status">{msg}</p>}
      {err && <p className="admin-form-error" role="alert">{err}</p>}
      <div className="admin-modal-actions">
        <button type="button" className="admin-secondary-button" onClick={onClose}>Close</button>
        <button type="button" className="admin-primary-button" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Make Manager"}</button>
      </div>
    </Modal>
  );
}

/* ---------- Page ---------- */
export default function AdminHRManagers({ adminName = "Admin", onAddHr, onOpenAudit }) {
  const navigate = useNavigate();
  const { employees: real, loading, error, reload } = useEmployees();

  const demoMode = !loading && real.length === 0 && SHOW_DEMO_DATA;
  const all = demoMode ? DEMO_ROWS : real;

  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("ALL");
  const [designation, setDesignation] = useState("ALL");
  const [role, setRole] = useState("ALL");
  const [manager, setManager] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [checked, setChecked] = useState(() => new Set());
  const [modal, setModal] = useState(null); // { kind: "assign"|"team"|"promote", target }

  const managers = useMemo(() => all.filter((e) => e.role === "MANAGER" && e.status === "ACTIVE"), [all]);
  const uniq = (key) => [...new Set(all.map((e) => e[key]).filter((v) => v && v !== "—"))].sort();
  const departments = useMemo(() => uniq("department"), [all]); // eslint-disable-line react-hooks/exhaustive-deps
  const designations = useMemo(() => uniq("designation"), [all]); // eslint-disable-line react-hooks/exhaustive-deps
  const roles = useMemo(() => uniq("role"), [all]); // eslint-disable-line react-hooks/exhaustive-deps
  const managerNames = useMemo(() => uniq("manager"), [all]); // eslint-disable-line react-hooks/exhaustive-deps

  const hrCount = all.filter((e) => e.role === "HR").length;
  const managerCount = all.filter((e) => e.role === "MANAGER").length;
  const withManager = all.filter((e) => e.managerId !== null && e.managerId !== undefined && e.manager !== "—" && e.manager !== "").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((e) => {
      const hasManager = Boolean(e.manager) && e.manager !== "—";
      const tabOk =
        tab === "all" ||
        (tab === "hr" && e.role === "HR") ||
        (tab === "managers" && e.role === "MANAGER") ||
        (tab === "unassigned" && e.role !== "ADMIN" && e.role !== "MANAGER" && !hasManager);
      return (
        tabOk &&
        (dept === "ALL" || e.department === dept) &&
        (designation === "ALL" || e.designation === designation) &&
        (role === "ALL" || e.role === role) &&
        (manager === "ALL" || e.manager === manager) &&
        (status === "ALL" || e.status === status) &&
        (!q || [e.name, e.email, e.code, e.department].some((v) => String(v).toLowerCase().includes(q)))
      );
    });
  }, [all, tab, query, dept, designation, role, manager, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);

  const reset = () => {
    setQuery(""); setDept("ALL"); setDesignation("ALL"); setRole("ALL"); setManager("ALL"); setStatus("ALL"); setTab("all"); setPage(1);
  };
  const toggleAll = (on) => setChecked(on ? new Set(visible.map((e) => e.id)) : new Set());
  const toggleOne = (id) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const hrPeople = all.filter((e) => e.role === "HR");
  const goTab = (t) => { setTab(t); setPage(1); document.getElementById("ahl-table")?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  return (
    <div className="hrp-page ahl-page">
      <div className="hrp-toolbar">
        <button type="button" className="admin-primary-button" onClick={onAddHr}>
          <Icon name="userplus" size={16} /> Add HR Employee
        </button>
        <button type="button" className="admin-secondary-button" onClick={() => goTab("managers")}>
          <Icon name="users" size={16} /> Manage Managers
        </button>
      </div>

      {demoMode && (
        <div className="dash-notice" role="status">
          <strong>Showing sample employees.</strong>
          <p>No employee records were returned by the API, so these rows are sample data for the design.</p>
        </div>
      )}
      {error && <div className="admin-form-error" role="alert">{error}</div>}

      <section className="admin-summary-grid ahl-stats3" aria-label="HR and manager summary">
        <StatCard icon="people" tone="green" label="HR Employees" value={loading ? null : hrCount} note="With the HR role" />
        <StatCard icon="user" tone="green" label="Managers" value={loading ? null : managerCount} note="With the Manager role" />
        <StatCard icon="users" tone="green" label="Employees with Manager" value={loading ? null : withManager}
          note={all.length ? `${Math.round((withManager / all.length) * 100)}% of ${all.length}` : "—"} />
      </section>

      <section className="admin-panel" id="ahl-table" aria-label="Employees">
        <div className="hrp-tabbar" role="tablist">
          {[["all", "All Employees"], ["hr", "HR Employees"], ["managers", "Managers"], ["unassigned", "Unassigned Employees"]].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""}
              onClick={() => { setTab(id); setPage(1); }}>{label}</button>
          ))}
        </div>

        <div className="hrp-filters ahl-filters">
          <label className="people-search">
            <Icon name="search" size={16} />
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search by name, email, department..." aria-label="Search" />
          </label>
          <select value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }} aria-label="Department">
            <option value="ALL">All Departments</option>{departments.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={designation} onChange={(e) => { setDesignation(e.target.value); setPage(1); }} aria-label="Designation">
            <option value="ALL">All Designations</option>{designations.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role">
            <option value="ALL">All Roles</option>{roles.map((v) => <option key={v} value={v}>{ROLE_META[v]?.label || v}</option>)}
          </select>
          <select value={manager} onChange={(e) => { setManager(e.target.value); setPage(1); }} aria-label="Manager">
            <option value="ALL">All Managers</option>{managerNames.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
            <option value="ALL">All Status</option>
            {["ACTIVE", "PREBOARDING", "NOTICE_PERIOD", "EXITED"].map((v) => <option key={v} value={v}>{statusLabel(v)}</option>)}
          </select>
          <button type="button" className="admin-secondary-button" onClick={reset}><Icon name="refresh" size={14} /> Reset</button>
          <button type="button" className="admin-link-button" onClick={reload} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
        </div>

        {loading ? (
          <p className="admin-note">Loading employees…</p>
        ) : filtered.length === 0 ? (
          <p className="admin-note">No employees match your filters.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table hrp-table">
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label="Select all"
                    checked={visible.length > 0 && visible.every((e) => checked.has(e.id))}
                    onChange={(e) => toggleAll(e.target.checked)} /></th>
                  <th>EMPLOYEE</th><th>EMPLOYEE ID</th><th>DEPARTMENT</th><th>DESIGNATION</th>
                  <th>ROLE</th><th>MANAGER</th><th>STATUS</th><th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e, i) => {
                  const isManager = e.role === "MANAGER";
                  const hasManager = Boolean(e.manager) && e.manager !== "—";
                  return (
                    <tr key={e.id}>
                      <td><input type="checkbox" aria-label={`Select ${e.name}`} checked={checked.has(e.id)} onChange={() => toggleOne(e.id)} /></td>
                      <td>
                        <div className="admin-person">
                          <Avatar name={e.name} index={start + i} />
                          <span><strong>{e.name}</strong><small>{e.email}</small></span>
                        </div>
                      </td>
                      <td>{e.code}</td>
                      <td>{e.department}</td>
                      <td>{e.designation}</td>
                      <td><RolePill role={e.role} /></td>
                      <td>
                        {hasManager ? (
                          <div className="admin-person">
                            <Avatar name={e.manager} index={i + 2} size={28} />
                            <span>{e.manager}</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td><span className={`hrp-pill ${statusTone(e.status)}`}>{statusLabel(e.status)}</span></td>
                      <td>
                        <div className="hrp-actions">
                          {isManager ? (
                            <button type="button" className="admin-secondary-button hr-small" onClick={() => setModal({ kind: "team", target: e })}>View Team</button>
                          ) : (
                            <button type="button" className="admin-secondary-button hr-small" disabled={e.role === "ADMIN"} onClick={() => setModal({ kind: "assign", target: e })}>Assign Manager</button>
                          )}
                          <button type="button" className="hrp-icon-btn" aria-label={`Open ${e.name}'s profile`} disabled={e.demo}
                            onClick={() => navigate(`/employees/${e.id}`)}><Icon name="pencil" size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pager page={safePage} pages={pages} onPage={(n) => setPage(Math.min(Math.max(n, 1), pages))}
          perPage={perPage} onPerPage={(n) => { setPerPage(n); setPage(1); }}
          total={filtered.length} shown={{ from: start + 1, to: Math.min(start + perPage, filtered.length) }} />
      </section>

      <div className="ahl-three">
        <section className="admin-panel" id="ahl-structure" aria-labelledby="rs-title">
          <div className="admin-panel-heading"><div><h2 id="rs-title">Reporting Structure</h2></div></div>
          <div className="ahl-tree">
            <div className="ahl-node top">
              <Avatar name={adminName} index={1} size={38} />
              <span><strong>{adminName}</strong><small>Administrator</small></span>
            </div>
            <div className="ahl-branches">
              <div className="ahl-node hr">
                <Icon name="people" size={22} />
                <span><strong>HR Team</strong><small>{hrCount} Employees</small></span>
              </div>
              <div className="ahl-node mgr">
                <Icon name="users" size={22} />
                <span><strong>Managers</strong><small>{managerCount} Managers</small></span>
              </div>
            </div>
            <div className="ahl-branches">
              <div className="ahl-avatars">
                {hrPeople.slice(0, 3).map((p, i) => <Avatar key={p.id} name={p.name} index={i} size={26} />)}
                {hrPeople.length > 3 && <small>+{hrPeople.length - 3}</small>}
              </div>
              <div className="ahl-avatars">
                {managers.slice(0, 3).map((p, i) => <Avatar key={p.id} name={p.name} index={i + 1} size={26} />)}
                {managers.length > 3 && <small>+{managers.length - 3}</small>}
              </div>
            </div>
            <div className="ahl-branches">
              <button type="button" className="admin-secondary-button hr-small" onClick={() => goTab("hr")}>View HR Employees</button>
              <button type="button" className="admin-secondary-button hr-small" onClick={() => goTab("managers")}>View Managers</button>
            </div>
          </div>
        </section>

        <section className="admin-panel" aria-labelledby="rc-title">
          <div className="admin-panel-heading">
            <div><h2 id="rc-title">Recent Role Changes</h2>{SHOW_DEMO_DATA && <p>Sample data</p>}</div>
            {onOpenAudit && <button type="button" className="admin-link-button" onClick={onOpenAudit}>View All <Icon name="arrow" size={14} /></button>}
          </div>
          {SHOW_DEMO_DATA ? (
            <ul className="ahl-changes">
              {DEMO_CHANGES.map(([icon, tone, text, when]) => (
                <li key={text}>
                  <span className={`ahl-change-icon ${tone}`}><Icon name={icon} size={16} /></span>
                  <span><strong>{text}</strong><small>{when}</small></span>
                  <small className="ahl-by">by {adminName}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-note">Role changes will appear here from the Audit Logs once the audit API provides them.</p>
          )}
        </section>

        <section className="admin-panel" aria-labelledby="qa-title">
          <div className="admin-panel-heading"><div><h2 id="qa-title">Quick Actions</h2></div></div>
          <div className="ahl-quick">
            <button type="button" className="ahl-tile green" onClick={onAddHr}>
              <Icon name="userplus" size={22} /><strong>Add HR Employee</strong><small>Create new HR account</small>
            </button>
            <button type="button" className="ahl-tile amber" onClick={() => setModal({ kind: "promote" })}>
              <Icon name="users" size={22} /><strong>Make Manager</strong><small>Promote existing employee</small>
            </button>
            <button type="button" className="ahl-tile blue" onClick={() => setModal({ kind: "assign", target: null })}>
              <Icon name="user" size={22} /><strong>Assign Manager</strong><small>Assign manager to employees</small>
            </button>
            <button type="button" className="ahl-tile purple" onClick={() => document.getElementById("ahl-structure")?.scrollIntoView({ behavior: "smooth", block: "center" })}>
              <Icon name="people" size={22} /><strong>View Hierarchy</strong><small>See reporting structure</small>
            </button>
          </div>
        </section>
      </div>

      <details className="admin-panel ahl-roles">
        <summary>System roles</summary>
        <div className="admin-role-grid">
          {SYSTEM_ROLES.map(([cls, title, text]) => (
            <article key={title}>
              <span className={`role-dot ${cls}`} />
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </details>

      {modal?.kind === "assign" && (
        <AssignModal all={all} managers={managers} target={modal.target} onClose={() => setModal(null)} onSaved={reload} />
      )}
      {modal?.kind === "team" && <TeamModal manager={modal.target} all={all} onClose={() => setModal(null)} />}
      {modal?.kind === "promote" && <PromoteModal all={all} onClose={() => setModal(null)} />}
    </div>
  );
}