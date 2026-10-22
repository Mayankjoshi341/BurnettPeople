import { useMemo, useState } from "react";

import { Icon } from "../../DashboardIcons";
import { getErrorMessage } from "../../dashboardUtils";
import {
  dayLabel,
  estimateWorkingDays,
  formatLeaveRange,
  rangesOverlap,
  requestLeaveDraft,
  submitLeaveRequest,
} from "./leaveApi";

const STATUS_CLASS = {
  PENDING: "status-pending",
  APPROVED: "status-completed",
  REJECTED: "status-rejected",
  CANCELLED: "status-upcoming",
};

const BALANCE_STYLE = [
  ["calendar", "green"],
  ["heart", "red"],
  ["calendar", "amber"],
  ["plane", "green"],
];

export function LeaveStatusBadge({ request }) {
  return (
    <span className={`admin-status ${STATUS_CLASS[request.statusKey] || "status-pending"}`}>
      {request.status}
    </span>
  );
}

/* ---------- balances ---------- */
export function LeaveBalanceCards({ balances, loading, error }) {
  if (loading) return <p className="admin-note">Loading your leave balance…</p>;
  if (error) return <div className="admin-form-error" role="alert">{error}</div>;
  if (balances.length === 0) {
    return <p className="admin-note">No leave balance has been set up for you yet. Contact HR if this looks wrong.</p>;
  }

  return (
    <section className="admin-summary-grid" aria-label="Leave balance">
      {balances.map((b, i) => {
        const [icon, tone] = BALANCE_STYLE[i % BALANCE_STYLE.length];
        const pct = b.total ? Math.min(100, Math.max(0, (b.used / b.total) * 100)) : 0;
        return (
          <div className="admin-stat-card" key={b.id}>
            <span className={`admin-stat-icon ${tone}`}><Icon name={icon} size={24} /></span>
            <span className="admin-stat-body">
              <h3>{b.total === null ? "—" : dayLabel(b.total)}</h3>
              <p>{b.name}</p>
              <small className="up">{b.remaining === null ? "—" : `${b.remaining} remaining`}</small>
              <span className="emp-progress"><i style={{ width: `${pct}%` }} /></span>
              <small>{b.total === null ? `${b.used} used` : `${b.used} / ${b.total} used`}</small>
            </span>
          </div>
        );
      })}
    </section>
  );
}

/* ---------- history ---------- */
export function LeaveHistoryTable({ requests, loading, error }) {
  return (
    <section className="admin-panel" aria-labelledby="myl-title">
      <div className="admin-panel-heading">
        <div><h2 id="myl-title">My Leave Requests</h2><p>View and track your leave requests</p></div>
      </div>
      {error && <div className="admin-form-error" role="alert">{error}</div>}
      {loading ? (
        <p className="admin-note">Loading your leave requests…</p>
      ) : requests.length === 0 ? (
        <p className="admin-note">You have not applied for any leave yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>TYPE</th><th>DATES</th><th>DURATION</th><th>REASON</th><th>STATUS</th></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.type}</strong></td>
                  <td>{r.dates}</td>
                  <td>{r.days || "—"}</td>
                  <td>{r.reason || "—"}</td>
                  <td>
                    <LeaveStatusBadge request={r} />
                    {r.reviewComment && <small className="emp-muted"><br />{r.reviewComment}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------- apply form (with AI draft + explicit confirmation) ---------- */
export function LeaveApplyForm({ types, balances, requests, typesError, onSubmitted }) {
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");

  const [aiDraft, setAiDraft] = useState(""); // last text produced by the assistant
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const typeOptions = useMemo(() => {
    if (types.length) return types;
    // Fall back to the types that appear in the balance list.
    return balances.filter((b) => b.typeId).map((b) => ({ id: b.typeId, name: b.name }));
  }, [types, balances]);

  const selectedType = typeOptions.find((t) => t.id === leaveType);
  const balance = balances.find((b) => b.typeId === leaveType);
  const workingDays = estimateWorkingDays(startDate, endDate);
  const messageIsAi = Boolean(aiDraft) && message.trim() === aiDraft.trim();

  const overlapping = useMemo(
    () => requests.find(
      (r) => (r.statusKey === "PENDING" || r.statusKey === "APPROVED") && rangesOverlap(startDate, endDate, r.start, r.end),
    ),
    [requests, startDate, endDate],
  );

  function clearErrors() {
    setFieldErrors({});
    setFormError("");
    setSuccess("");
  }

  function validate() {
    const errors = {};
    if (!leaveType) errors.leave_type = "Please select a leave type.";
    if (!startDate) errors.start_date = "Please choose a start date.";
    if (!endDate) errors.end_date = "Please choose an end date.";
    if (startDate && endDate && endDate < startDate) errors.end_date = "End date cannot be before the start date.";
    if (!errors.end_date && overlapping) {
      errors.end_date = `These dates overlap your ${overlapping.status.toLowerCase()} request for ${overlapping.dates}.`;
    }
    return errors;
  }

  async function handleGenerate() {
    clearErrors();
    setDraftError("");
    const errors = {};
    if (!leaveType) errors.leave_type = "Select a leave type first.";
    if (!startDate) errors.start_date = "Choose a start date first.";
    if (!endDate) errors.end_date = "Choose an end date first.";
    if (startDate && endDate && endDate < startDate) errors.end_date = "End date cannot be before the start date.";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setDraftError("Choose the leave type and dates so the message can be written for you.");
      return;
    }
    // Never silently overwrite text the person wrote themselves.
    if (message.trim() && !messageIsAi && !window.confirm("Replace your current message with a new AI-written draft?")) {
      return;
    }

    setDrafting(true);
    try {
      const draft = await requestLeaveDraft({
        leaveType, startDate, endDate, notes: messageIsAi ? "" : message.trim(),
      });
      setAiDraft(draft);
      setMessage(draft);
    } catch (error) {
      setDraftError(getErrorMessage(error, "The leave message could not be generated. You can still write your own."));
    } finally {
      setDrafting(false);
    }
  }

  function handleReview(event) {
    event.preventDefault();
    clearErrors();
    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setConfirming(true);
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await submitLeaveRequest({ leaveType, startDate, endDate, reason: message });
      setConfirming(false);
      setLeaveType("");
      setStartDate("");
      setEndDate("");
      setMessage("");
      setAiDraft("");
      setDraftError("");
      setSuccess("Your leave request was submitted for approval.");
      if (onSubmitted) await onSubmitted();
    } catch (error) {
      setConfirming(false);
      setFieldErrors(error?.fieldErrors ? Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v.join(" ")])) : {});
      setFormError(getErrorMessage(error, "The leave request could not be submitted."));
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (key) => fieldErrors[key] && <span className="admin-field-error">{fieldErrors[key]}</span>;

  return (
    <section className="admin-panel" aria-labelledby="apply-title">
      <div className="admin-panel-heading"><div><h2 id="apply-title">Apply for Leave</h2><p>Submit a new leave request</p></div></div>

      <form onSubmit={handleReview} noValidate>
        <div className="admin-form-field">
          <label htmlFor="lv-type">Leave type</label>
          <select id="lv-type" value={leaveType} onChange={(e) => { setLeaveType(e.target.value); setFieldErrors({}); }} aria-invalid={Boolean(fieldErrors.leave_type)}>
            <option value="">Select leave type</option>
            {typeOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {fieldError("leave_type")}
          {typesError && <span className="admin-field-error">{typesError}</span>}
        </div>

        <div className="emp-field-row">
          <div className="admin-form-field">
            <label htmlFor="lv-start">Start date</label>
            <input id="lv-start" type="date" value={startDate}
              onChange={(e) => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(e.target.value); setFieldErrors({}); }}
              aria-invalid={Boolean(fieldErrors.start_date)} />
            {fieldError("start_date")}
          </div>
          <div className="admin-form-field">
            <label htmlFor="lv-end">End date</label>
            <input id="lv-end" type="date" value={endDate} min={startDate || undefined}
              onChange={(e) => { setEndDate(e.target.value); setFieldErrors({}); }}
              aria-invalid={Boolean(fieldErrors.end_date)} />
            {fieldError("end_date")}
          </div>
        </div>

        {workingDays > 0 && (
          <p className="admin-note">
            About {dayLabel(workingDays)} of leave (Mon–Fri). The final count is calculated by the server.
            {balance && balance.remaining !== null && workingDays > balance.remaining && (
              <> This is more than your remaining {dayLabel(balance.remaining)} of {balance.name}.</>
            )}
          </p>
        )}

        <div className="admin-form-field">
          <label htmlFor="lv-reason">Reason</label>
          <textarea id="lv-reason" rows={4} maxLength={1000} value={message}
            onChange={(e) => { setMessage(e.target.value); setFieldErrors({}); }}
            placeholder="Enter reason for leave (optional)…"
            aria-invalid={Boolean(fieldErrors.reason)} />
          <span className="emp-count">{message.length}/1000 characters</span>
          {fieldError("reason")}
        </div>

        <div className="emp-actions" style={{ marginBottom: 12 }}>
          <button type="button" className="admin-secondary-button" onClick={handleGenerate} disabled={drafting || submitting}>
            <Icon name="refresh" size={14} /> {drafting ? "Writing message…" : aiDraft ? "Regenerate message" : "Generate Leave Message"}
          </button>
        </div>
        {messageIsAi && (
          <p className="admin-note" role="status">
            This message was written by an AI assistant. Please read it, edit anything that is not right and then submit &mdash; nothing is sent until you confirm.
          </p>
        )}
        {draftError && <div className="admin-form-error" role="alert">{draftError}</div>}
        {formError && <div className="admin-form-error" role="alert">{formError}</div>}
        {success && <div className="admin-form-success" role="status">{success}</div>}

        <button type="submit" className="admin-primary-button" disabled={submitting || drafting}>
          Submit Leave Request
        </button>
      </form>

      {confirming && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) setConfirming(false); }}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="lv-confirm-title">
            <div className="admin-modal-heading">
              <div><h2 id="lv-confirm-title">Confirm leave request</h2><p>Please check the details before you submit.</p></div>
              <button type="button" className="admin-modal-close" onClick={() => setConfirming(false)} disabled={submitting} aria-label="Close">×</button>
            </div>
            <dl className="people-details">
              <div><dt>Leave type</dt><dd>{selectedType?.name || "—"}</dd></div>
              <div><dt>Dates</dt><dd>{formatLeaveRange(startDate, endDate)}</dd></div>
              <div><dt>Message</dt><dd style={{ whiteSpace: "pre-wrap" }}>{message.trim() || "No message added"}</dd></div>
            </dl>
            {messageIsAi && <p className="admin-note">This message was drafted by AI. Make sure it is accurate before you submit.</p>}
            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary-button" onClick={() => setConfirming(false)} disabled={submitting}>Back to edit</button>
              <button type="button" className="admin-primary-button" onClick={handleConfirm} disabled={submitting}>
                {submitting ? "Submitting…" : "Confirm & Submit"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
