import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Icon } from "./DashboardIcons";
import { StatCard, Pager } from "./DashboardParts";
import {
  AVATAR_TONES,
  SHOW_DEMO_DATA,
  activationText,
  callApi,
  formatDate,
  getErrorMessage,
  initialsOf,
  statusLabel,
  statusTone,
  useEmployees,
  useOptions,
} from "./dashboardUtils";
import "./HRPages.css";

const STATUSES = ["PREBOARDING", "ACTIVE", "NOTICE_PERIOD", "EXITED"];

/* Sample rows shown ONLY when the API returns no employees and SHOW_DEMO_DATA is true */
const DEMO_ROWS = [
  ["Rohan Thakur", "EMP001", "Engineering", "Senior Developer", "Neha Gupta", "ACTIVE"],
  ["Neha Gupta", "EMP002", "Engineering", "Team Lead", "Vikram Kapoor", "ACTIVE"],
  ["Vikram Kapoor", "EMP003", "Product", "Product Manager", "Priya Nair", "ACTIVE"],
  ["Priya Nair", "EMP004", "HR", "HR Executive", "Anita Patel", "ACTIVE"],
  ["Aarav Sharma", "EMP005", "Marketing", "Marketing Specialist", "Rohit Mehta", "ACTIVE"],
  ["Kavya Mehta", "EMP006", "Finance", "Accountant", "Rahul Verma", "NOTICE_PERIOD"],
].map(([name, code, department, designation, manager, status], i) => ({
  id: `demo-${i}`, code, name, email: `${name.split(" ")[0].toLowerCase()}@burnettpeople.com`,
  department, designation, manager, status, phone: "+91 98765 43210", role: "EMPLOYEE",
  joined: "2024-01-15", location: "Indore Office", employmentType: "FULL_TIME",
  activation: "ACTIVATED", hasUser: true, demo: true,
}));

function Avatar({ name, index, size = 36 }) {
  return (
    <span className="people-avatar" style={{ width: size, height: size, fontSize: size * 0.34, background: AVATAR_TONES[index % AVATAR_TONES.length] }}>
      {initialsOf(name)}
    </span>
  );
}

function Pill({ value }) {
  return <span className={`hrp-pill ${statusTone(value)}`}>{statusLabel(value)}</span>;
}

function EmployeePanel({ emp, managers, designations, onClose, onSaved }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [mgr, setMgr] = useState(emp.managerId ?? "");
  const [des, setDes] = useState(emp.designationId ?? "");
  const [st, setSt] = useState(emp.status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save(label, body) {
    setMsg("");
    setErr("");
    if (emp.demo) {
      setErr("This is sample data. Connect the employee API to save changes.");
      return;
    }
    setBusy(true);
    try {
      await callApi("patch", `/employees/${emp.id}/`, body);
      setMsg(`${label} updated.`);
      onSaved();
    } catch (e) {
      setErr(getErrorMessage(e, `Could not update ${label.toLowerCase()}.`));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setMsg("");
    setErr("");
    if (emp.demo) {
      setErr("This is sample data. Connect the employee API to send invitations.");
      return;
    }
    setBusy(true);
    try {
      const r = await callApi("post", `/employees/${emp.id}/resend-invitation/`, {});
      setMsg(`${r?.detail || "Invitation request accepted."} A queued request does not confirm delivery.`);
      onSaved();
    } catch (e) {
      setErr(getErrorMessage(e, "Could not resend the invitation."));
    } finally {
      setBusy(false);
    }
  }

  const rows = {
    overview: [
      ["Employee ID", emp.code],
      ["Work Email", emp.email],
      ["Phone Number", emp.phone],
      ["Department", emp.department],
      ["Designation", emp.designation],
      ["Reporting Manager", emp.manager],
      ["Employment Type", emp.employmentType],
      ["Date of Joining", emp.joined ? formatDate(emp.joined) : "—"],
      ["Work Location", emp.location],
    ],
    job: [
      ["Portal Role", emp.role],
      ["Employment Status", statusLabel(emp.status)],
      ["Exit Date", emp.exitDate ? formatDate(emp.exitDate) : "—"],
      ["Account", activationText(emp.activation)],
    ],
  };

  const canResend = emp.hasUser && emp.activation !== "ACTIVATED";

  return (
    <aside className="hrp-side">
      <div className="hrp-card hrp-profile-card">
        <button type="button" className="hrp-x" onClick={onClose} aria-label="Close details"><Icon name="close" size={16} /></button>
        <div className="hrp-profile-head">
          <Avatar name={emp.name} index={0} size={60} />
          <div>
            <Pill value={emp.status} />
            <h3>{emp.name}</h3>
            <small>{emp.designation}</small>
          </div>
          {emp.email !== "—" && (
            <a className="hrp-icon-btn" href={`mailto:${emp.email}`} aria-label="Send email"><Icon name="mail" size={16} /></a>
          )}
        </div>

        <div className="hrp-tabs">
          {[["overview", "Overview"], ["job", "Job Details"], ["attendance", "Attendance"], ["leave", "Leave"], ["assets", "Assets"]].map(([id, label]) => (
            <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {rows[tab] ? (
          <dl className="hrp-kv">
            {rows[tab].map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>
            ))}
          </dl>
        ) : (
          <p className="admin-note">This tab will show real data once its API is connected.</p>
        )}
        {!emp.demo && (
          <button type="button" className="admin-link-button" onClick={() => navigate(`/employees/${emp.id}`)}>
            Open full profile <Icon name="arrow" size={14} />
          </button>
        )}
      </div>

      <div className="hrp-card">
        <h3>Manager &amp; Role</h3>
        <label className="hrp-label" htmlFor="mg-sel">Assign / change reporting manager</label>
        <div className="hrp-inline">
          <select id="mg-sel" value={mgr} onChange={(e) => setMgr(e.target.value)}>
            <option value="">No manager</option>
            {managers.filter((m) => m.id !== emp.id).map((m) => <option key={m.id} value={m.id}>{m.name} ({m.code})</option>)}
          </select>
          <button type="button" className="admin-secondary-button hr-small" disabled={busy || String(mgr) === String(emp.managerId ?? "")}
            onClick={() => save("Manager", { manager: mgr ? Number(mgr) : null })}>Assign</button>
        </div>

        <label className="hrp-label" htmlFor="ds-sel">Change designation</label>
        <div className="hrp-inline">
          <select id="ds-sel" value={des} onChange={(e) => setDes(e.target.value)} disabled={!designations.length}>
            {!designations.length && <option value="">{emp.designation}</option>}
            {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button type="button" className="admin-secondary-button hr-small" disabled={busy || !designations.length || String(des) === String(emp.designationId ?? "")}
            onClick={() => save("Designation", { designation: Number(des) })}>Update</button>
        </div>
      </div>

      <div className="hrp-card">
        <h3>Status Management</h3>
        <div className="hrp-inline">
          <select value={st} onChange={(e) => setSt(e.target.value)} aria-label="Employment status">
            {[...new Set([emp.status, ...STATUSES])].filter((s) => s && s !== "—").map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <button type="button" className="admin-secondary-button hr-small" disabled={busy || st === emp.status}
            onClick={() => save("Status", { employment_status: st })}>Update Status</button>
        </div>
        {canResend && (
          <button type="button" className="admin-secondary-button hrp-full" disabled={busy} onClick={resend}>
            <Icon name="mail" size={14} /> Resend invitation
          </button>
        )}
        {msg && <p className="admin-form-success" role="status">{msg}</p>}
        {err && <p className="admin-form-error" role="alert">{err}</p>}
      </div>
    </aside>
  );
}

export default function HREmployeeManagement({ onAdd }) {
  const navigate = useNavigate();
  const { employees: real, loading, error, reload } = useEmployees();
  const designationOptions = useOptions("/organization/designations/");

  const demoMode = !loading && real.length === 0 && SHOW_DEMO_DATA;
  const employees = demoMode ? DEMO_ROWS : real;

  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("ALL");
  const [role, setRole] = useState("ALL");
  const [manager, setManager] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selectedId, setSelectedId] = useState(null);
  const [checked, setChecked] = useState(() => new Set());

  const uniq = (key) => [...new Set(employees.map((e) => e[key]).filter((v) => v && v !== "—"))].sort();
  const departments = useMemo(() => uniq("department"), [employees]); // eslint-disable-line react-hooks/exhaustive-deps
  const roles = useMemo(() => uniq("role"), [employees]); // eslint-disable-line react-hooks/exhaustive-deps
  const managerNames = useMemo(() => uniq("manager"), [employees]); // eslint-disable-line react-hooks/exhaustive-deps
  const managerChoices = useMemo(
    () => employees.filter((e) => e.role === "MANAGER" && e.status === "ACTIVE"),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter(
      (e) =>
        (dept === "ALL" || e.department === dept) &&
        (role === "ALL" || e.role === role) &&
        (manager === "ALL" || e.manager === manager) &&
        (status === "ALL" || e.status === status) &&
        (!q || [e.name, e.email, e.code].some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [employees, query, dept, role, manager, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);
  const selected = employees.find((e) => e.id === selectedId) || null;

  const now = new Date();
  const joinedThisMonth = employees.filter((e) => {
    if (!e.joined) return false;
    const d = new Date(`${e.joined}T00:00:00`);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const managersCount = employees.filter((e) => e.role === "MANAGER").length;
  const exited = employees.filter((e) => e.status === "EXITED").length;
  const total = employees.length;

  const clear = () => {
    setQuery(""); setDept("ALL"); setRole("ALL"); setManager("ALL"); setStatus("ALL"); setPage(1);
  };
  const toggleAll = (on) => setChecked(on ? new Set(visible.map((e) => e.id)) : new Set());
  const toggleOne = (id) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  return (
    <div className="hrp-page">
      {demoMode && (
        <div className="dash-notice" role="status">
          <strong>Showing sample employees.</strong>
          <p>No employee records were returned by the API, so these rows are sample data for the design.</p>
        </div>
      )}
      {error && <div className="admin-form-error" role="alert">{error}</div>}

      <section className="admin-summary-grid hrp-stats6" aria-label="Employee summary">
        <StatCard icon="shield" tone="green" label="Total Employees" value={total || null}
          note={demoMode ? "Sample data" : "From employee records"} />
        <StatCard icon="users" tone="blue" label="Managers" value={managersCount}
          note={total ? `${((managersCount / total) * 100).toFixed(1)}% of total` : "—"} />
        <StatCard icon="userplus" tone="green" label="New Joiners" value={joinedThisMonth} note="This month" />
        <StatCard icon="calendar" tone="amber" label="On Leave" value={SHOW_DEMO_DATA ? 5 : null}
          note={SHOW_DEMO_DATA ? "Sample (leave API not connected)" : "Leave API not connected"} />
        <StatCard icon="alert" tone="red" label="Exited" value={exited} note="Not in service" />
        <button type="button" className="hrp-add-card" onClick={onAdd || (() => navigate("/employees/new"))}>
          <Icon name="userplus" size={22} />
          <span><strong>Add New Employee</strong><small>Go to Employee Onboarding</small></span>
        </button>
      </section>

      <div className={`hrp-split ${selected ? "with-side" : ""}`}>
        <section className="admin-panel hrp-main" aria-label="Employees">
          <div className="hrp-filters">
            <label className="people-search">
              <Icon name="search" size={16} />
              <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search by name, email, employee ID..." aria-label="Search employees" />
            </label>
            <select value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }} aria-label="Department">
              <option value="ALL">All Departments</option>
              {departments.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role">
              <option value="ALL">All Roles</option>
              {roles.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={manager} onChange={(e) => { setManager(e.target.value); setPage(1); }} aria-label="Manager">
              <option value="ALL">All Managers</option>
              {managerNames.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
              <option value="ALL">All Status</option>
              {STATUSES.map((v) => <option key={v} value={v}>{statusLabel(v)}</option>)}
            </select>
            <button type="button" className="admin-link-button" onClick={clear}>Clear</button>
            <button type="button" className="admin-link-button" onClick={reload} disabled={loading}>
              <Icon name="refresh" size={14} /> {loading ? "Loading…" : "Refresh"}
            </button>
            <button type="button" className="admin-link-button" onClick={() => navigate("/employees")}>
              Open directory <Icon name="arrow" size={14} />
            </button>
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
                    <th>#</th><th>EMPLOYEE</th><th>EMPLOYEE ID</th><th>DEPARTMENT</th>
                    <th>DESIGNATION</th><th>MANAGER</th><th>STATUS</th><th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e, i) => (
                    <tr key={e.id} className={selectedId === e.id ? "sel" : ""}>
                      <td><input type="checkbox" aria-label={`Select ${e.name}`} checked={checked.has(e.id)} onChange={() => toggleOne(e.id)} /></td>
                      <td>{start + i + 1}</td>
                      <td>
                        <div className="admin-person">
                          <Avatar name={e.name} index={start + i} />
                          <span><strong>{e.name}</strong><small>{e.email}</small></span>
                        </div>
                      </td>
                      <td>{e.code}</td>
                      <td>{e.department}</td>
                      <td>{e.designation}</td>
                      <td>{e.manager}</td>
                      <td><Pill value={e.status} /></td>
                      <td>
                        <div className="hrp-actions">
                          <button type="button" className="hrp-icon-btn" aria-label={`View ${e.name}`} onClick={() => setSelectedId(e.id)}><Icon name="search" size={15} /></button>
                          <button type="button" className="hrp-icon-btn" aria-label={`Edit ${e.name}`} disabled={e.demo} onClick={() => navigate(`/employees/${e.id}`)}><Icon name="pencil" size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pager
            page={safePage} pages={pages} onPage={(n) => setPage(Math.min(Math.max(n, 1), pages))}
            perPage={perPage} onPerPage={(n) => { setPerPage(n); setPage(1); }}
            total={filtered.length} shown={{ from: start + 1, to: Math.min(start + perPage, filtered.length) }}
          />
        </section>

        {selected && (
          <EmployeePanel
            key={selected.id}
            emp={selected}
            managers={managerChoices}
            designations={designationOptions}
            onClose={() => setSelectedId(null)}
            onSaved={reload}
          />
        )}
      </div>
    </div>
  );
}
