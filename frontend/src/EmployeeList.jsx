import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { demoEmployees, resendDemoInvitation } from "./data/employees";
import "./EmployeeList.css";

function EmployeeList() {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [status, setStatus] = useState("All");
  const [, setRefresh] = useState(0);
  const [notice, setNotice] = useState("");

  const navigate = useNavigate();

  const filteredEmployees = useMemo(() => {
    return demoEmployees.filter((employee) => {
      const searchText =
        `${employee.name} ${employee.email} ${employee.id}`.toLowerCase();

      return (
        searchText.includes(search.toLowerCase()) &&
        (department === "All" || employee.department === department) &&
        (status === "All" || employee.status === status)
      );
    });
  }, [search, department, status, demoEmployees]);

  function openProfile(employeeId) {
    navigate(`/employees/${employeeId}`);
  }

  function handleResend(employee) {
    try {
      resendDemoInvitation(employee.id);
      setRefresh((value) => value + 1);
      setNotice(
        `Demo invitation for ${employee.name} is marked Pending. No email was sent.`
      );
    } catch (error) {
      setNotice(error.message || "Could not update invitation status.");
    }
  }

  return (
    <div className="employee-list-page">
      <header className="employee-list-header">
        <div>
          <p className="employee-list-eyebrow">PEOPLE MANAGEMENT</p>
          <h1>Employees</h1>
          <p>View and manage your organization's employee directory.</p>
        </div>

        <button
          className="employee-list-add-button"
          onClick={() => navigate("/employees/new")}
        >
          + Add Employee
        </button>
      </header>

      {notice && (
        <div className="employee-list-notice" role="status">
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}

      <section className="employee-list-stats">
        <article className="employee-list-stat-card">
          <span>Total Employees</span>
          <strong>{demoEmployees.length}</strong>
        </article>
        <article className="employee-list-stat-card">
          <span>Active Employees</span>
          <strong>{demoEmployees.filter((employee) => employee.status === "Active").length}</strong>
        </article>
        <article className="employee-list-stat-card">
          <span>Inactive Employees</span>
          <strong>{demoEmployees.filter((employee) => employee.status === "Inactive").length}</strong>
        </article>
      </section>

      <section className="employee-list-panel">
        <div className="employee-list-panel-heading">
          <div>
            <h2>Employee Directory</h2>
            <p>{filteredEmployees.length} employees found</p>
          </div>
        </div>

        <div className="employee-list-filters">
          <input
            type="search"
            placeholder="Search by name, email or ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search employees"
          />

          <select value={department} onChange={(event) => setDepartment(event.target.value)}
            aria-label="Filter by department">
            <option value="All">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="Human Resources">Human Resources</option>
            <option value="Design">Design</option>
            <option value="Sales">Sales</option>
            <option value="Finance">Finance</option>
            <option value="Marketing">Marketing</option>
            <option value="Operations">Operations</option>
          </select>

          <select value={status} onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status">
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="employee-list-table-wrapper">
          <table className="employee-list-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Role</th>
                <th>Status</th>
                <th>Invitation</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <div className="employee-list-person">
                        <span className="employee-list-avatar">
                          {employee.name.split(" ").map((part) => part[0]).join("")}
                        </span>
                        <div>
                          <button
                            type="button"
                            onClick={() => openProfile(employee.id)}
                            style={{
                              padding: 0,
                              border: "none",
                              background: "none",
                              color: "inherit",
                              font: "inherit",
                              fontWeight: 600,
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            {employee.name}
                          </button>
                          <span>{employee.email}</span>
                        </div>
                      </div>
                    </td>

                    <td>{employee.id}</td>
                    <td>{employee.department}</td>
                    <td>{employee.role}</td>
                    <td>
                      <span className={`employee-list-status ${
                        employee.status === "Active" ? "is-active" : "is-inactive"
                      }`}>
                        {employee.status}
                      </span>
                    </td>
                    <td>
                      <span className={`employee-list-invitation ${
                        employee.invitationStatus === "Pending" ? "is-pending" : "is-not-sent"
                      }`}>
                        {employee.invitationStatus || "Not sent"}
                      </span>
                    </td>
                    <td>
                      <div className="employee-list-actions">
                        <button
                          type="button"
                          onClick={() => openProfile(employee.id)}
                          aria-label={`View ${employee.name}'s profile`}
                          className="employee-list-view-button"
                        >
                          View Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResend(employee)}
                          className="employee-list-resend-button"
                        >
                          Resend Invite
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="employee-list-empty">
                    No employees match your search or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default EmployeeList;