import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "./api/client";
import "./EmployeeProfile.css";

function displayValue(value) {
  return value === undefined || value === null || String(value).trim() === "" ? "—" : value;
}

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function activationText(status) {
  const labels = {
    EMAIL_PENDING: "Invitation email queued; delivery not yet confirmed",
    ACTIVATION_PENDING: "Invitation sent; account not activated",
    DELIVERY_FAILED: "Invitation delivery failed",
    INVITATION_EXPIRED: "Invitation expired",
    INVITATION_REVOKED: "Invitation revoked",
    ACTIVATED: "Account activated",
    NOT_INVITED: "No invitation recorded",
    NO_PORTAL_ACCOUNT: "No linked portal account",
  };
  return labels[status] || status || "Unknown";
}

function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profileResult, setProfileResult] = useState({ id: null, employee: null, error: null, loading: true });
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        // The route uses the database primary key (employee.id), not employee_code.
        const data = await apiClient.get(`/employees/${encodeURIComponent(id)}/`);
        if (active) setProfileResult({ id, employee: data, error: null, loading: false });
      } catch (requestError) {
        if (active) setProfileResult({ id, employee: null, error: requestError, loading: false });
      }
    }
    loadProfile();
    return () => { active = false; };
  }, [id, retryVersion]);

  const loading = profileResult.id !== id || profileResult.loading;
  const employee = profileResult.id === id ? profileResult.employee : null;
  const error = profileResult.id === id ? profileResult.error : null;

  const backButton = <button type="button" className="employee-profile-back" onClick={() => navigate("/employees")}>← Back to Employees</button>;

  if (loading) {
    return <main className="employee-profile-page">{backButton}<h1>Loading employee profile…</h1><p>Please wait while the saved record is retrieved.</p></main>;
  }

  if (error || !employee) {
    const status = error?.status;
    const title = status === 404 ? "Employee not found" : status === 403 ? "Access denied" : status === 401 ? "Sign in required" : "Could not load employee";
    const detail = status === 404
      ? "No saved employee record matches this database ID."
      : status === 403
        ? "Your account is not permitted to view this employee profile."
        : status === 401
          ? "Your session is no longer valid. Please sign in again."
          : error?.message || "The server could not return this employee profile.";
    return <main className="employee-profile-page">{backButton}<h1>{title}</h1><p role="alert">{detail}</p>
      {status !== 403 && status !== 404 && <button type="button" className="employee-profile-back" onClick={() => { setProfileResult({ id, employee: null, error: null, loading: true }); setRetryVersion((value) => value + 1); }}>Retry</button>}
    </main>;
  }

  const name = `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.official_email;
  const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const status = employee.employment_status;

  return (
    <main className="employee-profile-page">
      {backButton}
      <header className="employee-profile-header">
        <div className="employee-profile-identity">
          <div className="employee-profile-avatar">{initials}</div>
          <div>
            <p className="employee-profile-eyebrow">EMPLOYEE PROFILE</p>
            <h1>{name}</h1>
            <p>{displayValue(employee.designation_title)} · {displayValue(employee.department_name)}</p>
          </div>
        </div>
        <span className={`employee-profile-status ${status === "ACTIVE" ? "is-active" : "is-inactive"}`}>{displayValue(status)}</span>
      </header>

      <section className="employee-profile-card">
        <h2>Personal &amp; Work Information</h2>
        <div className="employee-profile-grid">
          <div><span>Employee Code</span><strong>{displayValue(employee.employee_code)}</strong></div>
          <div><span>Official Email</span><strong>{displayValue(employee.official_email)}</strong></div>
          <div><span>Phone Number</span><strong>{displayValue(employee.phone_number)}</strong></div>
          <div><span>Department</span><strong>{displayValue(employee.department_name)}</strong></div>
          <div><span>Designation</span><strong>{displayValue(employee.designation_title)}</strong></div>
          <div><span>Portal Role</span><strong>{displayValue(employee.portal_role)}</strong></div>
          <div><span>Employment Type</span><strong>{displayValue(employee.employment_type)}</strong></div>
          <div><span>Employment Status</span><strong>{displayValue(status)}</strong></div>
          <div><span>Joining Date</span><strong>{formatDate(employee.date_of_joining)}</strong></div>
          <div><span>Exit Date</span><strong>{formatDate(employee.date_of_exit)}</strong></div>
          <div><span>Reporting Manager</span><strong>{displayValue(employee.manager_name)}</strong></div>
          <div><span>Work Location</span><strong>{displayValue(employee.work_location_name)}</strong></div>
          <div><span>Account Activation</span><strong>{activationText(employee.account_activation_status)}</strong></div>
          <div><span>Database Record ID</span><strong>{displayValue(employee.id)}</strong></div>
        </div>
      </section>
    </main>
  );
}

export default EmployeeProfile;