import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import apiClient from "./api/client";
import { roleLabel, userDisplayName, userInitials } from "./auth/userDisplay";
import "./EmployeeDashboard.css";
import "./HRDashboard.css";

function getErrorMessage(error) {
  const fieldMessages = Object.values(error?.fieldErrors || {}).flat();
  return fieldMessages.join(" ") || error?.message || "Unable to complete the request.";
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function normaliseException(item) {
  return {
    ...item,
    employeeName: item.employee_name || item.employee_code || `Employee #${item.employee ?? "—"}`,
    type: item.exception_label || item.exception_type || "Other",
    date: formatDateTime(item.submitted_at),
    status: item.review_status || "PENDING",
    description: item.reason || "No explanation provided.",
  };
}

function HRDashboard({ user, onLogout }) {
  const name = userDisplayName(user);
  const [exceptions, setExceptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const loadExceptions = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await apiClient.get("/attendance/exceptions/");
      const data = Array.isArray(response) ? response : Array.isArray(response?.results) ? response.results : null;
      if (!data) throw new Error("The attendance exceptions API returned an unexpected response.");
      setExceptions(data.map(normaliseException));
    } catch (requestError) {
      setExceptions([]);
      setError(getErrorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExceptions();
  }, [loadExceptions]);

  const filteredExceptions = useMemo(() => exceptions.filter((item) => {
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    const matchesType = typeFilter === "ALL" || item.exception_type === typeFilter;
    return matchesStatus && matchesType;
  }), [exceptions, statusFilter, typeFilter]);

  const selectedRequest = exceptions.find((item) => item.id === selectedId) || null;
  const pendingCount = exceptions.filter((item) => item.review_status === "PENDING").length;

  async function reviewException(reviewStatus) {
    if (!selectedRequest || selectedRequest.review_status !== "PENDING") return;
    setReviewBusy(true);
    setError("");
    setNotice("");
    try {
      await apiClient.patch(`/attendance/exceptions/${selectedRequest.id}/review/`, {
        review_status: reviewStatus,
        review_comment: reviewComment.trim(),
      });
      setNotice(`Attendance issue ${reviewStatus.toLowerCase()}.`);
      setReviewComment("");
      await loadExceptions();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <div className="employee-dashboard hr-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>
        <nav aria-label="HR navigation">
          <NavLink to="/hr" end>Dashboard</NavLink>
          <NavLink to="/employees">Employees</NavLink>
          <a href="#exceptions" className="active">Attendance Exceptions</a>
          <a href="#profile">My Profile</a>
        </nav>
      </aside>

      <main className="employee-main">
        <header className="employee-header">
          <div><p>HR PORTAL</p><h1>Attendance Review</h1></div>
          <div className="employee-profile" id="profile">
            <span>{userInitials(user)}</span>
            <div><strong>{name}</strong><p>{roleLabel(user?.role)}</p></div>
            <button type="button" className="employee-logout" onClick={onLogout}>Log out</button>
          </div>
        </header>

        <section className="employee-welcome">
          <p>ATTENDANCE MANAGEMENT</p>
          <h2>Review attendance issues</h2>
          <p>Read each employee explanation and record an approval or rejection. Only authorised HR/Admin accounts can submit a review.</p>
        </section>

        {error && <div className="employee-form-message" role="alert">{error}</div>}
        {notice && <div className="employee-notice" role="status">{notice}</div>}

        <section className="employee-summary">
          <article className="employee-card"><p>Total reported issues</p><h3>{isLoading ? "Loading…" : exceptions.length}</h3><span>Saved attendance exceptions</span></article>
          <article className="employee-card"><p>Pending review</p><h3>{isLoading ? "Loading…" : pendingCount}</h3><span>Require an HR decision</span></article>
          <article className="employee-card"><p>Reviewed</p><h3>{isLoading ? "Loading…" : exceptions.length - pendingCount}</h3><span>Approved or rejected</span></article>
        </section>

        <section className="employee-card hr-exceptions-section" id="exceptions">
          <div className="employee-section-heading">
            <div><h2>Attendance Exceptions</h2><p>Filter, inspect, and review saved exception records.</p></div>
            <button type="button" className="employee-secondary-button" onClick={loadExceptions} disabled={isLoading || reviewBusy}>Refresh</button>
          </div>

          <div className="hr-exception-filters">
            <div className="employee-form-field"><label htmlFor="exception-status-filter">Review status</label>
              <select id="exception-status-filter" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setSelectedId(null); }}>
                <option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option>
              </select>
            </div>
            <div className="employee-form-field"><label htmlFor="exception-type-filter">Issue type</label>
              <select id="exception-type-filter" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setSelectedId(null); }}>
                <option value="ALL">All issue types</option>
                <option value="MISSED_CHECK_IN">Missed check-in</option>
                <option value="MISSED_CHECK_OUT">Missed check-out</option>
                <option value="LATE_ARRIVAL">Late arrival</option>
                <option value="BREAK_OUTSIDE_WINDOW">Break outside allowed window</option>
                <option value="BREAK_DURATION">Break duration issue</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {isLoading ? <div className="employee-empty-state" role="status"><h3>Loading attendance issues…</h3><p>Fetching records from the backend.</p></div> : filteredExceptions.length === 0 ? (
            <div className="employee-empty-state"><span className="employee-empty-icon">▤</span><h3>No matching issues</h3><p>There are no attendance exceptions for the selected filters.</p></div>
          ) : (
            <div className="employee-table-wrapper"><table className="employee-history-table">
              <thead><tr><th>Employee</th><th>Issue</th><th>Submitted</th><th>Status</th><th>Details</th></tr></thead>
              <tbody>{filteredExceptions.map((item) => <tr key={item.id}>
                <td>{item.employeeName}</td><td>{item.type}</td><td>{item.date}</td><td>{item.status}</td>
                <td><button type="button" className="employee-secondary-button" onClick={() => { setSelectedId(item.id); setReviewComment(item.review_comment || ""); }}>View</button></td>
              </tr>)}</tbody>
            </table></div>
          )}
        </section>

        <section className="employee-card" aria-live="polite">
          <div className="employee-section-heading"><div><h2>Issue details</h2><p>Select a row above to inspect the explanation and review the request.</p></div></div>
          {!selectedRequest ? <div className="employee-empty-state"><span className="employee-empty-icon">↖</span><h3>No issue selected</h3><p>Choose View on a row to open its details.</p></div> : (
            <>
              <p><strong>Employee:</strong> {selectedRequest.employeeName}</p>
              <p><strong>Issue:</strong> {selectedRequest.type}</p>
              <p><strong>Submitted:</strong> {selectedRequest.date}</p>
              <p><strong>Review status:</strong> {selectedRequest.status_label || selectedRequest.review_status}</p>
              <p><strong>Employee explanation:</strong> {selectedRequest.description}</p>
              {selectedRequest.review_status !== "PENDING" && <p><strong>Previous HR comment:</strong> {selectedRequest.review_comment || "No comment added."}</p>}
              {selectedRequest.review_status === "PENDING" && (
                <>
                  <div className="employee-form-field"><label htmlFor="review-comment">HR review comment (optional)</label><textarea id="review-comment" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} rows={3} maxLength={4000} placeholder="Add context for the employee or audit trail…" /></div>
                  <div className="employee-action-buttons">
                    <button type="button" className="employee-primary-button" disabled={reviewBusy} onClick={() => reviewException("APPROVED")}>{reviewBusy ? "Saving…" : "Approve issue"}</button>
                    <button type="button" className="employee-secondary-button" disabled={reviewBusy} onClick={() => reviewException("REJECTED")}>Reject issue</button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default HRDashboard;
