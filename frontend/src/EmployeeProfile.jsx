
import { useNavigate, useParams } from "react-router-dom";
import { demoEmployees } from "./data/employees";
import "./EmployeeProfile.css";

function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const employee = demoEmployees.find(
    (item) => item.id.toLowerCase() === (id || "").toLowerCase()
  );

  if (!employee) {
    return (
      <main className="employee-profile-page">
        <button
          type="button"
          className="employee-profile-back"
          onClick={() => navigate("/employees")}
        >
          ← Back to Employees
        </button>

        <h1>Employee not found</h1>
        <p>
          This employee does not exist in the current demo data.
        </p>
      </main>
    );
  }

  const initials = employee.name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const displayValue = (value) =>
    value === undefined || value === null || String(value).trim() === ""
      ? "—"
      : value;

  const formatDate = (date) => {
    if (!date) return "—";

    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <main className="employee-profile-page">
      <button
        type="button"
        className="employee-profile-back"
        onClick={() => navigate("/employees")}
      >
        ← Back to Employees
      </button>

      <header className="employee-profile-header">
        <div className="employee-profile-identity">
          <div className="employee-profile-avatar">{initials}</div>

          <div>
            <p className="employee-profile-eyebrow">
              EMPLOYEE PROFILE
            </p>
            <h1>{employee.name}</h1>
            <p>
              {displayValue(employee.designation)} ·{" "}
              {displayValue(employee.department)}
            </p>
          </div>
        </div>

        <span
          className={`employee-profile-status ${
            employee.status === "Active" ? "is-active" : "is-inactive"
          }`}
        >
          {displayValue(employee.status)}
        </span>
      </header>

      <section className="employee-profile-card">
        <h2>Personal &amp; Work Information</h2>

        <div className="employee-profile-grid">
          <div>
            <span>Employee ID</span>
            <strong>{displayValue(employee.id)}</strong>
          </div>

          <div>
            <span>Work Email</span>
            <strong>{displayValue(employee.email)}</strong>
          </div>

          <div>
            <span>Phone Number</span>
            <strong>{displayValue(employee.phone)}</strong>
          </div>

          <div>
            <span>Department</span>
            <strong>{displayValue(employee.department)}</strong>
          </div>

          <div>
            <span>Designation</span>
            <strong>{displayValue(employee.designation)}</strong>
          </div>

          <div>
            <span>System Role</span>
            <strong>{displayValue(employee.role)}</strong>
          </div>

          <div>
            <span>Employment Type</span>
            <strong>{displayValue(employee.employmentType)}</strong>
          </div>

          <div>
            <span>Joining Date</span>
            <strong>{formatDate(employee.joiningDate)}</strong>
          </div>

          <div>
            <span>Reporting Manager</span>
            <strong>{displayValue(employee.manager)}</strong>
          </div>
        </div>
      </section>

      <p className="employee-profile-note">
        Demo profile: details are stored in this browser only and are
        not connected to the backend.
      </p>
    </main>
  );
}

export default EmployeeProfile;
