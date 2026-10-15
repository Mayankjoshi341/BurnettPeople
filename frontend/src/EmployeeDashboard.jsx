
import { useState } from "react";
import { userDisplayName, userInitials, roleLabel } from "./auth/userDisplay";
import "./EmployeeDashboard.css";

function EmployeeDashboard({ user, onLogout }) {
  const name = userDisplayName(user);

  const [exceptionType, setExceptionType] = useState("");
  const [exceptionDescription, setExceptionDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [showExceptionForm, setShowExceptionForm] = useState(false);

  const scheduleAvailable = false;
  const attendanceHistory = [];

  function openExceptionForm() {
    setFormError("");
    setShowExceptionForm(true);
  }

  function closeExceptionForm() {
    setShowExceptionForm(false);
    setExceptionType("");
    setExceptionDescription("");
    setFormError("");
  }

  function handleExceptionSubmit(event) {
    event.preventDefault();

    if (!exceptionType) {
      setFormError("Please select an attendance issue.");
      return;
    }

    if (!exceptionDescription.trim()) {
      setFormError("Please describe the attendance issue.");
      return;
    }

    if (exceptionDescription.trim().length < 10) {
      setFormError("Please enter at least 10 characters in the description.");
      return;
    }

    setFormError(
      "Your request has not been submitted because the attendance exceptions API is not connected yet."
    );
  }

  return (
    <div className="employee-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>

        <nav aria-label="Employee navigation">
          <a href="#dashboard" className="active">
            Dashboard
          </a>
          <a href="#attendance">My Attendance</a>
          <a href="#schedule">My Schedule</a>
          <a href="#history">Attendance History</a>
          <a href="#exception">Report an Issue</a>
          <a href="#profile">My Profile</a>
        </nav>
      </aside>

      <main className="employee-main" id="dashboard">
        <header className="employee-header">
          <div>
            <p>EMPLOYEE PORTAL</p>
            <h1>My Dashboard</h1>
          </div>

          <div className="employee-profile" id="profile">
            <span>{userInitials(user)}</span>

            <div>
              <strong>{name}</strong>
              <p>{roleLabel(user?.role)}</p>
            </div>

            <button
              type="button"
              className="employee-logout"
              onClick={onLogout}
            >
              Log out
            </button>
          </div>
        </header>

        <section className="employee-welcome">
          <p>YOUR WORKSPACE</p>
          <h2>Welcome, {name}!</h2>
          <p>
            Check your attendance information and schedule from one place.
            Live attendance actions will be enabled when the backend API is
            available.
          </p>
        </section>

        <section className="employee-summary" id="attendance">
          <article className="employee-card">
            <p>Today's Attendance</p>
            <h3>Not connected</h3>
            <span>No live attendance status is available yet.</span>
          </article>

          <article className="employee-card">
            <p>Check-in Time</p>
            <h3>—</h3>
            <span>Requires the attendance API.</span>
          </article>

          <article className="employee-card">
            <p>Check-out Time</p>
            <h3>—</h3>
            <span>Requires the attendance API.</span>
          </article>
        </section>

        <section className="employee-content">
          <article className="employee-card employee-attendance-actions">
            <div className="employee-section-heading">
              <div>
                <h2>Attendance Actions</h2>
                <p>Record the start and end of your workday.</p>
              </div>
              <span className="employee-status-badge">Not connected</span>
            </div>

            <div className="employee-action-buttons">
              <button type="button" disabled>
                Check in
              </button>
              <button type="button" disabled>
                Check out
              </button>
            </div>

            <p className="employee-help-text">
              Check-in and check-out are disabled until a supported attendance
              endpoint is available.
            </p>

            <div className="employee-break-section">
              <h3>Break Management</h3>
              <div className="employee-action-buttons">
                <button type="button" disabled>
                  Start break
                </button>
                <button type="button" disabled>
                  End break
                </button>
              </div>
              <p className="employee-help-text">
                Break tracking is not connected to the backend yet.
              </p>
            </div>
          </article>

          <article className="employee-card" id="schedule">
            <div className="employee-section-heading">
              <div>
                <h2>My Schedule</h2>
                <p>Your assigned working hours.</p>
              </div>
            </div>

            {scheduleAvailable ? (
              <p>Your schedule will appear here.</p>
            ) : (
              <div className="employee-empty-state">
                <span className="employee-empty-icon">◷</span>
                <h3>No schedule available</h3>
                <p>
                  A schedule will appear here when schedule data is provided
                  by the backend.
                </p>
              </div>
            )}
          </article>
        </section>

        <section className="employee-card employee-history-section" id="history">
          <div className="employee-section-heading">
            <div>
              <h2>Attendance History</h2>
              <p>Review your previous workday records.</p>
            </div>
          </div>

          {attendanceHistory.length === 0 ? (
            <div className="employee-empty-state">
              <span className="employee-empty-icon">▤</span>
              <h3>No attendance records available</h3>
              <p>
                Attendance history will appear here when the backend provides
                saved attendance records.
              </p>
            </div>
          ) : (
            <div className="employee-table-wrapper">
              <table className="employee-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Check in</th>
                    <th>Check out</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceHistory.map((record) => (
                    <tr key={record.id}>
                      <td>{record.date}</td>
                      <td>{record.checkIn || "—"}</td>
                      <td>{record.checkOut || "—"}</td>
                      <td>{record.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="employee-card employee-report-section" id="exception">
          <div className="employee-section-heading">
            <div>
              <h2>Report an Attendance Issue</h2>
              <p>
                Report a missed check-in, incorrect work hours, or another
                attendance problem.
              </p>
            </div>
          </div>

          <div className="employee-notice" role="status">
            The form can validate your input, but it cannot submit or save a
            request until the attendance exceptions API is connected.
          </div>

          <button
            type="button"
            className="employee-primary-button"
            onClick={openExceptionForm}
          >
            Report an issue
          </button>
        </section>

        {showExceptionForm && (
          <div
            className="employee-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeExceptionForm();
              }
            }}
          >
            <section
              className="employee-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="exception-modal-title"
            >
              <div className="employee-modal-heading">
                <div>
                  <p>ATTENDANCE SUPPORT</p>
                  <h2 id="exception-modal-title">
                    Report an attendance issue
                  </h2>
                </div>

                <button
                  type="button"
                  className="employee-modal-close"
                  onClick={closeExceptionForm}
                  aria-label="Close form"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleExceptionSubmit} noValidate>
                <div className="employee-form-field">
                  <label htmlFor="exception-type">Issue type *</label>
                  <select
                    id="exception-type"
                    value={exceptionType}
                    onChange={(event) => {
                      setExceptionType(event.target.value);
                      setFormError("");
                    }}
                    required
                  >
                    <option value="">Select an issue</option>
                    <option value="MISSED_CHECK_IN">Missed check-in</option>
                    <option value="MISSED_CHECK_OUT">Missed check-out</option>
                    <option value="INCORRECT_HOURS">
                      Incorrect work hours
                    </option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="employee-form-field">
                  <label htmlFor="exception-description">Description *</label>
                  <textarea
                    id="exception-description"
                    value={exceptionDescription}
                    onChange={(event) => {
                      setExceptionDescription(event.target.value);
                      setFormError("");
                    }}
                    placeholder="Explain what happened and include relevant details..."
                    rows={5}
                    maxLength={1000}
                    required
                  />
                  <span className="employee-character-count">
                    {exceptionDescription.length}/1000 characters
                  </span>
                </div>

                {formError && (
                  <p className="employee-form-message" role="alert">
                    {formError}
                  </p>
                )}

                <div className="employee-modal-actions">
                  <button
                    type="button"
                    className="employee-secondary-button"
                    onClick={closeExceptionForm}
                  >
                    Cancel
                  </button>

                  <button type="submit" className="employee-primary-button">
                    Validate request
                  </button>
                </div>

                <p className="employee-help-text">
                  This action validates the form only. It does not create or
                  send a request.
                </p>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default EmployeeDashboard;
