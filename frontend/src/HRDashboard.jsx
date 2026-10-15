import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import apiClient from "./api/client";
import {
  roleLabel,
  userDisplayName,
  userInitials,
} from "./auth/userDisplay";
import "./EmployeeDashboard.css";
import "./HRDashboard.css";

function getEmployeeName(employee) {
  const name = [employee.first_name, employee.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || "Unnamed employee";
}

function getErrorMessage(error) {
  if (error?.status === 401) {
    return "Your session may have expired. Please log in again.";
  }

  if (error?.status === 403) {
    return "You do not have permission to view employee records.";
  }

  return error?.message || "Unable to load employee records. Please try again.";
}

function getDepartment(employee) {
  const department = employee.department_name ?? employee.department;
  if (department && typeof department === "object") {
    return department.name || department.title || "—";
  }

  return department || "—";
}

function getDesignation(employee) {
  const designation = employee.designation_title ?? employee.designation;
  if (designation && typeof designation === "object") {
    return designation.title || designation.name || "—";
  }

  return designation || "—";
}

function HRDashboard({ user, onLogout }) {
  const name = userDisplayName(user);

  const [employees, setEmployees] = useState([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [employeeError, setEmployeeError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [employmentFilter, setEmploymentFilter] = useState("ALL");

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Attendance exceptions are placeholders until a real API is available.
  const exceptions = [];
  const isLoadingExceptions = false;
  const exceptionError = "";

  const loadEmployees = useCallback(async () => {
    setIsLoadingEmployees(true);
    setEmployeeError("");

    try {
      const response = await apiClient.get("/employees/");

      const records = Array.isArray(response)
        ? response
        : Array.isArray(response?.results)
          ? response.results
          : null;

      if (!records) {
        throw new Error("The employee API returned an unexpected response.");
      }

      setEmployees(records);
    } catch (error) {
      setEmployees([]);
      setEmployeeError(getErrorMessage(error));
    } finally {
      setIsLoadingEmployees(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return employees.filter((employee) => {
      const employeeName = getEmployeeName(employee).toLowerCase();
      const employeeCode = String(employee.employee_code || "").toLowerCase();
      const email = String(employee.official_email || "").toLowerCase();
      const department = String(getDepartment(employee)).toLowerCase();
      const designation = String(getDesignation(employee)).toLowerCase();
      const status = String(employee.employment_status || "").toUpperCase();

      const matchesSearch =
        !normalizedSearch ||
        employeeName.includes(normalizedSearch) ||
        employeeCode.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        department.includes(normalizedSearch) ||
        designation.includes(normalizedSearch);

      const matchesEmployment =
        employmentFilter === "ALL" || status === employmentFilter;

      return matchesSearch && matchesEmployment;
    });
  }, [employees, searchTerm, employmentFilter]);

  const filteredExceptions = exceptions.filter((request) => {
    const matchesStatus =
      statusFilter === "ALL" || request.status === statusFilter;

    const matchesType =
      typeFilter === "ALL" || request.type === typeFilter;

    return matchesStatus && matchesType;
  });

  return (
    <div className="employee-dashboard hr-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>

        <nav>
          <NavLink to="/hr" end>
            Dashboard
          </NavLink>

          <NavLink to="/employees">
            Employees
          </NavLink>

          <a href="#attendance">Attendance</a>
          <a href="#exceptions">Attendance Exceptions</a>
          <a href="#leaves">Leave Requests</a>
          <a href="#profile">My Profile</a>
        </nav>
      </aside>

      <main className="employee-main">
        <header className="employee-header">
          <div>
            <p>HR PORTAL</p>
            <h1>HR Dashboard</h1>
          </div>

          <div className="employee-profile" id="profile">
            <span>{userInitials(user)}</span>

            <div>
              <strong>{name}</strong>
              <p>{roleLabel(user?.role)}</p>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="employee-logout"
            >
              Log out
            </button>
          </div>
        </header>

        <section className="employee-welcome">
          <p>HR OVERVIEW</p>
          <h2>Welcome, {name}!</h2>
          <p>
            Review employee information and monitor attendance workflows from
            your HR workspace.
          </p>
        </section>

        <section className="employee-summary">
          <article className="employee-card">
            <p>Employee Records</p>
            {isLoadingEmployees ? (
              <h3>Loading…</h3>
            ) : employeeError ? (
              <h3>Unavailable</h3>
            ) : (
              <h3>{employees.length}</h3>
            )}
            <span>
              {employeeError
                ? "Employee data could not be loaded."
                : "Records returned by the employee API."}
            </span>
          </article>

          <article className="employee-card" id="attendance">
            <p>Present Today</p>
            <h3>—</h3>
            <span>Attendance data is not connected yet.</span>
          </article>

          <article className="employee-card">
            <p>Pending Exceptions</p>
            <h3>—</h3>
            <span>Waiting for an attendance exceptions API.</span>
          </article>
        </section>

        <section className="employee-card hr-employee-preview">
          <div className="hr-section-heading">
            <div>
              <p className="hr-eyebrow">EMPLOYEE DIRECTORY</p>
              <h2>Employee Overview</h2>
              <p>Search and filter employee information from the backend.</p>
            </div>

            <div className="hr-employee-actions">
              <button
                type="button"
                className="hr-secondary-button"
                onClick={loadEmployees}
                disabled={isLoadingEmployees}
              >
                {isLoadingEmployees ? "Refreshing…" : "Refresh records"}
              </button>

              <NavLink className="hr-directory-link" to="/employees">
                Open directory →
              </NavLink>
            </div>
          </div>

          <div className="hr-exception-filters hr-employee-filters">
            <div className="hr-filter-field">
              <label htmlFor="employee-search">Search employees</label>
              <input
                id="employee-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Name, code, email, department…"
                disabled={isLoadingEmployees || Boolean(employeeError)}
              />
            </div>

            <div className="hr-filter-field">
              <label htmlFor="employment-status-filter">
                Employment status
              </label>
              <select
                id="employment-status-filter"
                value={employmentFilter}
                onChange={(event) => setEmploymentFilter(event.target.value)}
                disabled={isLoadingEmployees || Boolean(employeeError)}
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </div>
          </div>

          {!isLoadingEmployees && !employeeError && (
            <p className="hr-preview-note" aria-live="polite">
              Showing {filteredEmployees.length} of {employees.length} employee
              records.
            </p>
          )}

          {isLoadingEmployees ? (
            <div className="hr-empty-state" role="status">
              <span className="hr-state-icon">◷</span>
              <h4>Loading employee records…</h4>
              <p>Please wait while the employee directory is loaded.</p>
            </div>
          ) : employeeError ? (
            <div className="hr-empty-state" role="alert">
              <span className="hr-state-icon">!</span>
              <h4>Could not load employees</h4>
              <p>{employeeError}</p>
              <button
                type="button"
                className="hr-secondary-button"
                onClick={loadEmployees}
              >
                Retry
              </button>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="hr-empty-state">
              <span className="hr-state-icon">≡</span>
              <h4>
                {employees.length === 0
                  ? "No employee records found"
                  : "No matching employees"}
              </h4>
              <p>
                {employees.length === 0
                  ? "The API returned no employee records. Check the employee directory for available records."
                  : "Try another search term or choose a different employment status."}
              </p>

              {employees.length > 0 && (
                <button
                  type="button"
                  className="hr-secondary-button"
                  onClick={() => {
                    setSearchTerm("");
                    setEmploymentFilter("ALL");
                  }}
                >
                  Clear filters
                </button>
              )}

              {employees.length === 0 && (
                <NavLink className="hr-directory-link" to="/employees">
                  Open employee directory →
                </NavLink>
              )}
            </div>
          ) : (
            <div className="hr-exception-table-wrap">
              <table className="hr-exception-table">
                <thead>
                  <tr>
                    <th>Employee Code</th>
                    <th>Employee</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Employment Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id ?? employee.employee_code}>
                      <td>{employee.employee_code || "—"}</td>
                      <td>{getEmployeeName(employee)}</td>
                      <td>{employee.official_email || "—"}</td>
                      <td>{getDepartment(employee)}</td>
                      <td>{getDesignation(employee)}</td>
                      <td>{employee.employment_status || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="employee-card hr-exceptions-section" id="exceptions">
          <div className="hr-section-heading">
            <div>
              <p className="hr-eyebrow">ATTENDANCE MANAGEMENT</p>
              <h2>Attendance Exceptions</h2>
              <p>
                Review reported attendance issues, such as missed check-ins or
                incorrect attendance records.
              </p>
            </div>

            <span className="hr-connection-status">API not connected</span>
          </div>

          <div className="hr-api-notice" role="status">
            <strong>Exception requests are not connected yet.</strong>
            <p>
              Real exception records cannot be loaded or updated until the
              backend provides the required API.
            </p>
          </div>

          <div className="hr-exception-filters">
            <div className="hr-filter-field">
              <label htmlFor="exception-status">Filter by status</label>
              <select
                id="exception-status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setSelectedRequest(null);
                }}
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="hr-filter-field">
              <label htmlFor="exception-type">Filter by issue</label>
              <select
                id="exception-type"
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  setSelectedRequest(null);
                }}
              >
                <option value="ALL">All issue types</option>
                <option value="MISSED_CHECK_IN">Missed check-in</option>
                <option value="MISSED_CHECK_OUT">Missed check-out</option>
                <option value="INCORRECT_HOURS">Incorrect work hours</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="hr-exceptions-layout">
            <div className="hr-exception-list">
              <div className="hr-list-heading">
                <h3>Exception requests</h3>
                <span>{filteredExceptions.length} records</span>
              </div>

              {isLoadingExceptions ? (
                <div className="hr-empty-state" role="status">
                  <span className="hr-state-icon">◷</span>
                  <h4>Loading requests…</h4>
                  <p>Please wait while attendance exceptions are loaded.</p>
                </div>
              ) : exceptionError ? (
                <div className="hr-empty-state" role="alert">
                  <span className="hr-state-icon">!</span>
                  <h4>Unable to load requests</h4>
                  <p>{exceptionError}</p>
                </div>
              ) : filteredExceptions.length === 0 ? (
                <div className="hr-empty-state">
                  <span className="hr-state-icon">≡</span>
                  <h4>No exception records available</h4>
                  <p>
                    No real records are available to display. Connect the
                    attendance exceptions API to populate this list.
                  </p>
                </div>
              ) : (
                <div className="hr-exception-table-wrap">
                  <table className="hr-exception-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Issue</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredExceptions.map((request) => (
                        <tr key={request.id}>
                          <td>{request.employeeName}</td>
                          <td>{request.type}</td>
                          <td>{request.date}</td>
                          <td>{request.status}</td>
                          <td>
                            <button
                              type="button"
                              className="hr-view-button"
                              onClick={() => setSelectedRequest(request)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <aside className="hr-exception-details">
              <h3>Request details</h3>

              {selectedRequest ? (
                <div className="hr-detail-content">
                  <p>
                    <strong>Employee:</strong> {selectedRequest.employeeName}
                  </p>
                  <p>
                    <strong>Issue:</strong> {selectedRequest.type}
                  </p>
                  <p>
                    <strong>Date:</strong> {selectedRequest.date}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedRequest.status}
                  </p>
                  <p>
                    <strong>Description:</strong>{" "}
                    {selectedRequest.description || "No description provided."}
                  </p>
                  <button
                    type="button"
                    className="hr-secondary-button"
                    onClick={() => setSelectedRequest(null)}
                  >
                    Clear selection
                  </button>
                </div>
              ) : (
                <div className="hr-detail-empty">
                  <span className="hr-state-icon">↖</span>
                  <h4>No request selected</h4>
                  <p>
                    When real requests are available, select one from the list
                    to review its details here.
                  </p>
                </div>
              )}

              <p className="hr-detail-note">
                Approve and reject actions are unavailable until a backend
                workflow is provided.
              </p>
            </aside>
          </div>
        </section>

        <section className="employee-content" id="leaves">
          <article className="employee-card">
            <h3>Leave Requests</h3>
            <p>
              Leave request review is not connected to an operational API yet.
            </p>
          </article>

          <article className="employee-card">
            <h3>Employee Management</h3>
            <p>
              Use the employee directory to view and manage existing employee
              records.
            </p>
            <NavLink className="hr-directory-link" to="/employees">
              Open employee directory →
            </NavLink>
          </article>
        </section>
      </main>
    </div>
  );
}

export default HRDashboard;