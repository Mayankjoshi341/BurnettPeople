import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  roleLabel,
  userDisplayName,
  userInitials,
} from "./auth/userDisplay";
import "./AdminDashboard.css";

const initialHrForm = {
  firstName: "",
  lastName: "",
  email: "",
};

function AdminDashboard({ user, onLogout }) {
  const name = userDisplayName(user);

  const [showHrForm, setShowHrForm] = useState(false);
  const [form, setForm] = useState(initialHrForm);
  const [errors, setErrors] = useState({});
  const [integrationMessage, setIntegrationMessage] = useState("");

  function openHrForm() {
    setForm(initialHrForm);
    setErrors({});
    setIntegrationMessage("");
    setShowHrForm(true);
  }

  function closeHrForm() {
    setShowHrForm(false);
    setErrors({});
    setIntegrationMessage("");
  }

  function updateField(event) {
    const { name: fieldName, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [fieldName]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [fieldName]: "",
      form: "",
    }));

    setIntegrationMessage("");
  }

  function handleHrSubmit(event) {
    event.preventDefault();

    const nextErrors = {};
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const email = form.email.trim();

    if (!firstName) {
      nextErrors.firstName = "First name is required.";
    }

    if (!lastName) {
      nextErrors.lastName = "Last name is required.";
    }

    if (!email) {
      nextErrors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    setErrors(nextErrors);
    setIntegrationMessage("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    // The HR account-creation endpoint has not been connected here.
    // Never display a success message until the server confirms creation.
    setErrors({
      form:
        "The form is valid, but HR account creation is not connected yet. No account has been created.",
    });
  }

  return (
    <div className="employee-dashboard admin-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>

        <nav aria-label="Admin navigation">
          <NavLink to="/admin" end>
            Dashboard
          </NavLink>
          <a href="#users">User Management</a>
          <NavLink to="/employees">Employees</NavLink>
          <NavLink to="/admin#roles">Roles &amp; Permissions</NavLink>
          <NavLink to="/admin#settings">Company Settings</NavLink>
        </nav>
      </aside>

      <main className="employee-main">
        <header className="employee-header">
          <div>
            <p>Administration Portal</p>
            <h1>Admin Dashboard</h1>
          </div>

          <div className="employee-profile">
            <span aria-hidden="true">{userInitials(user)}</span>
            <div className="employee-profile-info">
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
          <p>COMPANY OVERVIEW</p>
          <h2>Welcome, {name}!</h2>
          <p>
            Manage HR onboarding and access the protected employee directory.
            Company-wide metrics and administration settings depend on their
            respective backend APIs.
          </p>
        </section>

        <section className="employee-summary">
          <article className="employee-card">
            <p>Total Users</p>
            <h3>—</h3>
            <span>Metrics API not connected</span>
          </article>

          <article className="employee-card">
            <p>Active Employees</p>
            <h3>—</h3>
            <span>Metrics API not connected</span>
          </article>

          <article className="employee-card">
            <p>System Roles</p>
            <h3>4</h3>
            <span>ADMIN, HR, MANAGER, EMPLOYEE</span>
          </article>
        </section>

        <section
          className="employee-card admin-management-section"
          id="users"
        >
          <div className="admin-section-heading">
            <div>
              <p className="admin-eyebrow">ACCESS MANAGEMENT</p>
              <h2>User Management</h2>
              <p>
                Start HR onboarding from here. HR account creation will work
                once the appropriate backend endpoint is connected.
              </p>
            </div>

            <button
              type="button"
              className="admin-primary-button"
              onClick={openHrForm}
            >
              <span aria-hidden="true">+</span> Add HR
            </button>
          </div>

          <div className="admin-information-panel">
            <div className="admin-information-icon" aria-hidden="true">
              <span>i</span>
            </div>
            <div>
              <strong>HR account onboarding</strong>
              <p>
                The form is ready for frontend validation. Submitting it will
                not create an account until the HR creation API is connected.
              </p>
            </div>
          </div>

          <div className="admin-role-grid">
            <article>
              <span className="admin-role-dot admin-role-dot-admin" />
              <strong>Admin</strong>
              <p>System administration</p>
            </article>
            <article>
              <span className="admin-role-dot admin-role-dot-hr" />
              <strong>HR</strong>
              <p>Employee and manager onboarding</p>
            </article>
            <article>
              <span className="admin-role-dot admin-role-dot-manager" />
              <strong>Manager</strong>
              <p>Team-level access</p>
            </article>
            <article>
              <span className="admin-role-dot admin-role-dot-employee" />
              <strong>Employee</strong>
              <p>Employee self-service</p>
            </article>
          </div>
        </section>

        <section className="admin-secondary-grid">
          <article className="employee-card" id="roles">
            <p className="admin-eyebrow">SECURITY</p>
            <h2>Roles &amp; Permissions</h2>
            <p>
              Role assignment and permission changes require the existing
              authorized backend endpoints. This section does not change
              anyone&apos;s access.
            </p>
          </article>

          <article className="employee-card" id="settings">
            <p className="admin-eyebrow">CONFIGURATION</p>
            <h2>Company Settings</h2>
            <p>
              Company-wide settings will be connected when the corresponding
              API becomes available.
            </p>
          </article>
        </section>

        {showHrForm && (
          <div
            className="admin-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeHrForm();
              }
            }}
          >
            <section
              className="admin-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-hr-modal-title"
            >
              <div className="admin-modal-heading">
                <div>
                  <p className="admin-eyebrow">USER MANAGEMENT</p>
                  <h2 id="admin-hr-modal-title">Add HR Account</h2>
                  <p>
                    Enter the details for the HR team member.
                  </p>
                </div>

                <button
                  type="button"
                  className="admin-modal-close"
                  onClick={closeHrForm}
                  aria-label="Close Add HR form"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleHrSubmit} noValidate>
                <div className="admin-form-field">
                  <label htmlFor="admin-hr-first-name">First name</label>
                  <input
                    id="admin-hr-first-name"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={updateField}
                    maxLength={100}
                    required
                    aria-invalid={Boolean(errors.firstName)}
                  />
                  {errors.firstName && (
                    <span className="admin-field-error">
                      {errors.firstName}
                    </span>
                  )}
                </div>

                <div className="admin-form-field">
                  <label htmlFor="admin-hr-last-name">Last name</label>
                  <input
                    id="admin-hr-last-name"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={updateField}
                    maxLength={100}
                    required
                    aria-invalid={Boolean(errors.lastName)}
                  />
                  {errors.lastName && (
                    <span className="admin-field-error">
                      {errors.lastName}
                    </span>
                  )}
                </div>

                <div className="admin-form-field">
                  <label htmlFor="admin-hr-email">Official email</label>
                  <input
                    id="admin-hr-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={updateField}
                    maxLength={254}
                    placeholder="hr@company.com"
                    required
                    aria-invalid={Boolean(errors.email)}
                  />
                  {errors.email && (
                    <span className="admin-field-error">
                      {errors.email}
                    </span>
                  )}
                </div>

                <div className="admin-role-preview">
                  <span>Assigned role</span>
                  <strong>HR</strong>
                  <p>
                    Role selection is fixed for this form.
                  </p>
                </div>

                {errors.form && (
                  <p className="admin-form-error" role="alert">
                    {errors.form}
                  </p>
                )}

                {integrationMessage && (
                  <p className="admin-form-notice" role="status">
                    {integrationMessage}
                  </p>
                )}

                <div className="admin-modal-actions">
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={closeHrForm}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-primary-button"
                  >
                    Validate Details
                  </button>
                </div>

                <p className="admin-form-footnote">
                  No account or invitation will be created by this frontend
                  form until it is connected to the authorized HR creation API.
                </p>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;