import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "./api/client";
import "./EmployeeList.css";

function listFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function displayName(employee) {
  return `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.official_email || "Unnamed employee";
}

function employmentLabel(status) {
  const labels = {
    PREBOARDING: "Preboarding",
    ACTIVE: "Active",
    NOTICE_PERIOD: "Notice period",
    EXITED: "Exited",
  };
  return labels[status] || status || "Unknown";
}

function activationLabel(status) {
  const labels = {
    EMAIL_PENDING: "Email queued",
    ACTIVATION_PENDING: "Sent · awaiting activation",
    DELIVERY_FAILED: "Delivery failed",
    INVITATION_EXPIRED: "Invitation expired",
    INVITATION_REVOKED: "Invitation revoked",
    ACTIVATED: "Activated",
    NOT_INVITED: "Not invited",
    NO_PORTAL_ACCOUNT: "No portal account",
  };
  return labels[status] || status || "Unknown";
}

function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [employmentStatus, setEmploymentStatus] = useState("All");
  const [activationFilter, setActivationFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [resendingId, setResendingId] = useState(null);
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();

  const loadEmployees = useCallback(async () => {
    try {
      const query = activationFilter === "All" ? "" : `?activation_status=${encodeURIComponent(activationFilter)}`;
      const data = await apiClient.get(`/employees/${query}`);
      setEmployees(listFromResponse(data));
      setLoadError("");
    } catch (error) {
      setLoadError(error?.message || "Could not load employees from the server.");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [activationFilter]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const departments = useMemo(() => {
    const options = new Map();
    for (const employee of employees) {
      if (employee.department !== null && employee.department !== undefined) {
        options.set(String(employee.department), employee.department_name || `Department ${employee.department}`);
      }
    }
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [employees]);

  const filteredEmployees = useMemo(() => employees.filter((employee) => {
    const name = displayName(employee);
    const departmentId = employee.department === null || employee.department === undefined ? "" : String(employee.department);
    const searchable = `${name} ${employee.official_email || ""} ${employee.employee_code || ""}`.toLowerCase();
    return searchable.includes(search.trim().toLowerCase()) &&
      (department === "All" || departmentId === department) &&
      (employmentStatus === "All" || employee.employment_status === employmentStatus);
  }), [employees, search, department, employmentStatus]);

  async function handleResend(employee) {
    setResendingId(employee.id);
    setNotice("");
    try {
      const result = await apiClient.post(`/employees/${employee.id}/resend-invitation/`, {});
      const deliveryStatus = result?.delivery_status || "UNKNOWN";
      setNotice(`${result?.detail || "Invitation request accepted."} Delivery status: ${deliveryStatus}. A queued request does not confirm that the email was delivered.`);
      await loadEmployees();
    } catch (error) {
      setNotice(error?.message || "Could not resend the invitation.");
    } finally {
      setResendingId(null);
    }
  }

  const activeCount = employees.filter((employee) => employee.employment_status === "ACTIVE").length;
  const preboardingCount = employees.filter((employee) => employee.employment_status === "PREBOARDING").length;
  const exitedCount = employees.filter((employee) => employee.employment_status === "EXITED").length;

  return (
    <div className="employee-list-page">
      <header className="employee-list-header">
        <div>
          <p className="employee-list-eyebrow">PEOPLE MANAGEMENT</p>
          <h1>Employees</h1>
          <p>View and manage persisted employee records and invitation states.</p>
        </div>
        <button className="employee-list-add-button" onClick={() => navigate("/employees/new")}>+ Add Employee</button>
      </header>

      {notice && <div className="employee-list-notice" role="status">{notice}
        <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">×</button>
      </div>}
      {loadError && <div className="employee-list-notice" role="alert">{loadError}
        <button type="button" onClick={loadEmployees} aria-label="Retry loading employees">Retry</button>
      </div>}

      <section className="employee-list-stats">
        <article className="employee-list-stat-card"><span>Employees in current result</span><strong>{loading ? "—" : employees.length}</strong></article>
        <article className="employee-list-stat-card"><span>Active Employment</span><strong>{loading ? "—" : activeCount}</strong></article>
        <article className="employee-list-stat-card"><span>Preboarding</span><strong>{loading ? "—" : preboardingCount}</strong></article>
        <article className="employee-list-stat-card"><span>Exited</span><strong>{loading ? "—" : exitedCount}</strong></article>
      </section>

      <section className="employee-list-panel">
        <div className="employee-list-panel-heading"><div><h2>Employee Directory</h2><p>{loading ? "Loading employees…" : `${filteredEmployees.length} employees match your filters`}</p></div></div>

        <div className="employee-list-filters">
          <input type="search" placeholder="Search by name, email or ID…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search employees" />
          <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter by department">
            <option value="All">All Departments</option>
            {departments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select value={employmentStatus} onChange={(event) => setEmploymentStatus(event.target.value)} aria-label="Filter by employment status">
            <option value="All">All Employment Statuses</option>
            <option value="PREBOARDING">Preboarding</option>
            <option value="ACTIVE">Active</option>
            <option value="NOTICE_PERIOD">Notice period</option>
            <option value="EXITED">Exited</option>
          </select>
          <select value={activationFilter} onChange={(event) => { setLoading(true); setActivationFilter(event.target.value); }} aria-label="Filter by account activation status">
            <option value="All">All Account States</option>
            <option value="pending">Not activated</option>
            <option value="activated">Activated</option>
          </select>
          <button type="button" className="employee-list-view-button" onClick={() => { setLoading(true); loadEmployees(); }} disabled={loading}>Refresh</button>
        </div>

        <div className="employee-list-table-wrapper">
          <table className="employee-list-table">
            <thead><tr><th>Employee</th><th>Employee ID</th><th>Department</th><th>Portal Role</th><th>Employment Status</th><th>Account / Invitation</th><th>Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="employee-list-empty">Loading employee records…</td></tr> : null}
              {!loading && !loadError && filteredEmployees.length === 0 ? <tr><td colSpan="7" className="employee-list-empty">No employees match your search or filters.</td></tr> : null}
              {!loading && filteredEmployees.map((employee) => {
                const name = displayName(employee);
                const activation = employee.account_activation_status || "UNKNOWN";
                const canResend = Boolean(employee.user) && activation !== "ACTIVATED";
                const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
                return <tr key={employee.id}>
                  <td><div className="employee-list-person"><span className="employee-list-avatar">{initials || "?"}</span><div>
                    <button type="button" onClick={() => navigate(`/employees/${employee.id}`)} style={{ padding: 0, border: "none", background: "none", color: "inherit", font: "inherit", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>{name}</button>
                    <span>{employee.official_email}</span>
                  </div></div></td>
                  <td>{employee.employee_code}</td>
                  <td>{employee.department_name || (employee.department ? `Department ${employee.department}` : "—")}</td>
                  <td>{employee.portal_role || "No portal account"}</td>
                  <td><span className={`employee-list-status ${employee.employment_status === "ACTIVE" ? "is-active" : "is-inactive"}`}>{employmentLabel(employee.employment_status)}</span></td>
                  <td><span className={`employee-list-invitation ${activation === "ACTIVATED" ? "is-active" : "is-pending"}`}>{activationLabel(activation)}</span></td>
                  <td><div className="employee-list-actions">
                    <button type="button" onClick={() => navigate(`/employees/${employee.id}`)} aria-label={`View ${name}'s profile`} className="employee-list-view-button">View Profile</button>
                    <button type="button" onClick={() => handleResend(employee)} className="employee-list-resend-button" disabled={!canResend || resendingId !== null}>
                      {resendingId === employee.id ? "Queuing…" : "Resend Invite"}
                    </button>
                  </div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default EmployeeList;