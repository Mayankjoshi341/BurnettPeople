import { useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import {
  activationText,
  getArrayResponse,
  getErrorMessage,
} from "./dashboardUtils";
import "./HRPages.css";

const DRAFT_KEY = "burnettpeople-onboarding-draft";

const EMPTY = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  employeeId: "",
  department: "",
  designation: "",
  joiningDate: "",
  employmentType: "FULL_TIME",
  manager: "",
  workLocation: "",
};

/* backend field name -> form field name (same mapping as your EmployeeForm) */
const API_FIELD_TO_FORM_FIELD = {
  first_name: "firstName",
  last_name: "lastName",
  official_email: "email",
  employee_code: "employeeId",
  department: "department",
  designation: "designation",
  date_of_joining: "joiningDate",
  employment_type: "employmentType",
  manager: "manager",
  work_location: "workLocation",
  phone_number: "phone",
};

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function Field({ label, required, error, hint, icon, children }) {
  return (
    <label className="hrp-field">
      <span className="hrp-field-label">{label}{required && <b> *</b>}</span>
      <span className="hrp-control">
        {icon && <Icon name={icon} size={16} />}
        {children}
      </span>
      {hint && <small className="hrp-hint">{hint}</small>}
      {error && <small className="hrp-error">{error}</small>}
    </label>
  );
}

export default function HREmployeeOnboarding({ onBack, onDone }) {
  const [form, setForm] = useState(loadDraft);
  const [errors, setErrors] = useState({});
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [lookupError, setLookupError] = useState("");
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [managers, setManagers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [created, setCreated] = useState(null);
  const [draftMsg, setDraftMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadLookups() {
      try {
        const [d, g, m, l] = await Promise.all([
          apiClient.get("/organization/departments/"),
          apiClient.get("/organization/designations/"),
          apiClient.get("/employees/?employment_status=ACTIVE"),
          apiClient.get("/organization/work-locations/"),
        ]);
        if (!active) return;
        setDepartments(getArrayResponse(d));
        setDesignations(getArrayResponse(g));
        setManagers(getArrayResponse(m).filter((e) => e.employment_status === "ACTIVE" && e.portal_role === "MANAGER"));
        setLocations(getArrayResponse(l));
      } catch (error) {
        if (active) setLookupError(getErrorMessage(error, "Could not load organization options. Please retry."));
      } finally {
        if (active) setLoadingLookups(false);
      }
    }
    loadLookups();
    return () => { active = false; };
  }, []);

  const lookupsOff = loadingLookups || Boolean(lookupError);

  function change(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "", general: "" }));
    setCreated(null);
    setDraftMsg("");
  }

  // Progress for the 4-step indicator (visual only)
  const steps = useMemo(() => {
    const personal = form.firstName && form.lastName && form.email;
    const employment = form.employeeId && form.department && form.designation;
    const work = form.joiningDate && form.employmentType;
    return [
      { n: 1, title: "Personal Information", sub: "Basic details about the employee", done: Boolean(personal) },
      { n: 2, title: "Employment Details", sub: "Job and role information", done: Boolean(employment) },
      { n: 3, title: "Work Setup", sub: "Location and manager", done: Boolean(work) },
      { n: 4, title: "Review & Send Invite", sub: "Confirm details and send invitation", done: Boolean(created) },
    ];
  }, [form, created]);
  const activeStep = (steps.find((s) => !s.done) || steps[3]).n;

  function mapBackendErrors(error) {
    const fieldErrors = error?.fieldErrors || {};
    const mapped = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const formField = API_FIELD_TO_FORM_FIELD[field];
      const text = Array.isArray(messages) ? messages.join(" ") : String(messages);
      if (formField) mapped[formField] = text;
      else mapped.general = [mapped.general, `${field}: ${text}`].filter(Boolean).join(" ");
    }
    if (!Object.keys(mapped).length) mapped.general = error?.message || "Could not create this employee.";
    else if (error?.message && !Object.keys(fieldErrors).length) mapped.general = error.message;
    setErrors(mapped);
  }

  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!form.firstName.trim()) next.firstName = "First name is required.";
    if (!form.lastName.trim()) next.lastName = "Last name is required.";
    if (!form.email.trim()) next.email = "Official email is required.";
    if (!form.employeeId.trim()) next.employeeId = "Employee code is required.";
    if (!form.department) next.department = "Please select a department.";
    if (!form.designation) next.designation = "Please select a designation.";
    if (!form.joiningDate) next.joiningDate = "Joining date is required.";
    if (form.phone.trim() && !/^[+\d\s()-]{7,30}$/.test(form.phone.trim())) next.phone = "Please enter a valid phone number.";
    if (Object.keys(next).length || lookupError || loadingLookups) {
      if (lookupError) next.general = `Organization options are unavailable: ${lookupError}`;
      setErrors(next);
      return;
    }

    setSubmitting(true);
    setErrors({});
    setCreated(null);
    const payload = {
      employee_code: form.employeeId.trim().toUpperCase(),
      official_email: form.email.trim().toLowerCase(),
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      department: Number(form.department),
      designation: Number(form.designation),
      manager: form.manager ? Number(form.manager) : null,
      work_location: form.workLocation ? Number(form.workLocation) : null,
      employment_type: form.employmentType,
      date_of_joining: form.joiningDate,
      phone_number: form.phone.trim(),
    };

    try {
      // Backend creates a PREBOARDING record + inactive user; the client sets no status.
      const employee = await apiClient.post("/employees/", payload);
      setCreated(employee);
      setForm(EMPTY);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    } catch (error) {
      mapBackendErrors(error);
    } finally {
      setSubmitting(false);
    }
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setDraftMsg("Draft saved on this device.");
    } catch {
      setDraftMsg("Could not save the draft in this browser.");
    }
  }

  function clearForm() {
    setForm(EMPTY);
    setErrors({});
    setCreated(null);
    setDraftMsg("");
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  return (
    <form className="hrp-page" onSubmit={submit} noValidate>
      <div className="hrp-onb-top">
        <p className="admin-note">Add a new employee to your organization. Complete the form below to create the record and send an invitation.</p>
        {onBack && (
          <button type="button" className="admin-secondary-button" onClick={onBack}>
            <Icon name="arrow" size={14} /> Back to Employees
          </button>
        )}
      </div>

      <ol className="hrp-stepper" aria-label="Onboarding progress">
        {steps.map((s) => (
          <li key={s.n} className={`${s.done ? "done" : ""} ${s.n === activeStep ? "active" : ""}`}>
            <span className="hrp-step-dot">{s.done ? <Icon name="check" size={16} /> : s.n}</span>
            <span><strong>{s.title}</strong><small>{s.sub}</small></span>
          </li>
        ))}
      </ol>

      {created && (
        <div className="admin-form-success" role="status">
          <strong>Employee created: {created.employee_code}</strong>
          <p>
            {created.first_name} {created.last_name} was saved as {created.employment_status || "PREBOARDING"}.{" "}
            {activationText(created.account_activation_status)}. The account is not considered activated unless the server reports ACTIVATED.
          </p>
          {onDone && <button type="button" className="admin-link-button" onClick={onDone}>View employees <Icon name="arrow" size={14} /></button>}
        </div>
      )}
      {lookupError && <div className="admin-form-error" role="alert">Could not load department, designation, manager or location options: {lookupError}</div>}
      {errors.general && <div className="admin-form-error" role="alert">{errors.general}</div>}

      <section className="admin-panel">
        <div className="hrp-section-head">
          <span className="hrp-section-icon"><Icon name="user" size={22} /></span>
          <div><h2>Personal &amp; Employment Information</h2><p>Enter the employee&rsquo;s basic and job details.</p></div>
        </div>
        <div className="hrp-form-grid">
          <Field label="First Name" required error={errors.firstName} icon="user">
            <input name="firstName" value={form.firstName} onChange={change} placeholder="Enter first name" autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} />
          </Field>
          <Field label="Last Name" required error={errors.lastName} icon="user">
            <input name="lastName" value={form.lastName} onChange={change} placeholder="Enter last name" autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} />
          </Field>
          <Field label="Work Email" required error={errors.email} icon="mail">
            <input type="email" name="email" value={form.email} onChange={change} placeholder="name@company.com" autoComplete="email" aria-invalid={Boolean(errors.email)} />
          </Field>
          <Field label="Phone Number" error={errors.phone} icon="user">
            <input type="tel" name="phone" value={form.phone} onChange={change} placeholder="Enter phone number" autoComplete="tel" aria-invalid={Boolean(errors.phone)} />
          </Field>
          <Field label="Employee ID" required error={errors.employeeId} icon="file">
            <input name="employeeId" value={form.employeeId} onChange={change} placeholder="e.g. BP005" aria-invalid={Boolean(errors.employeeId)} />
          </Field>
          <Field label="Department" required error={errors.department} icon="building">
            <select name="department" value={form.department} onChange={change} disabled={lookupsOff} aria-invalid={Boolean(errors.department)}>
              <option value="">{loadingLookups ? "Loading departments…" : "Select department"}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="System Role" icon="shield" hint="Employee creation cannot assign HR, Manager or Admin privileges.">
            <select value="EMPLOYEE" disabled aria-label="System role assigned by backend">
              <option value="EMPLOYEE">Employee (assigned by system)</option>
            </select>
          </Field>
          <Field label="Designation" required error={errors.designation} icon="people">
            <select name="designation" value={form.designation} onChange={change} disabled={lookupsOff} aria-invalid={Boolean(errors.designation)}>
              <option value="">{loadingLookups ? "Loading designations…" : "Select designation"}</option>
              {designations.map((d) => <option key={d.id} value={d.id}>{d.title}{d.grade ? ` — ${d.grade}` : ""}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section className="admin-panel">
        <div className="hrp-section-head">
          <span className="hrp-section-icon"><Icon name="calendar" size={22} /></span>
          <div><h2>Work Setup</h2><p>Configure joining date, location and reporting structure.</p></div>
        </div>
        <div className="hrp-form-grid">
          <Field label="Joining Date" required error={errors.joiningDate} icon="calendar">
            <input type="date" name="joiningDate" value={form.joiningDate} onChange={change} aria-invalid={Boolean(errors.joiningDate)} />
          </Field>
          <Field label="Employment Type" error={errors.employmentType} icon="file">
            <select name="employmentType" value={form.employmentType} onChange={change}>
              <option value="FULL_TIME">Full-time</option>
              <option value="PART_TIME">Part-time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERN">Intern</option>
            </select>
          </Field>
          <Field label="Reporting Manager" error={errors.manager} icon="user">
            <select name="manager" value={form.manager} onChange={change} disabled={lookupsOff}>
              <option value="">No manager selected</option>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name} ({m.employee_code})</option>)}
            </select>
          </Field>
          <Field label="Work Location" error={errors.workLocation} icon="building">
            <select name="workLocation" value={form.workLocation} onChange={change} disabled={lookupsOff}>
              <option value="">No work location selected</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Working Schedule" icon="clock" hint="Shift, workdays and break policy are assigned after onboarding (schedule API not connected to this form).">
            <select disabled value=""><option value="">Assigned after onboarding</option></select>
          </Field>
        </div>
      </section>

      <div className="hrp-footer">
        {draftMsg && <span className="admin-note" role="status">{draftMsg}</span>}
        <button type="button" className="admin-secondary-button" onClick={saveDraft}>Save Draft</button>
        <button type="button" className="admin-secondary-button" onClick={clearForm}><Icon name="refresh" size={14} /> Clear Form</button>
        <button type="submit" className="admin-primary-button" disabled={submitting || lookupsOff}>
          <Icon name="plane" size={16} /> {submitting ? "Saving…" : "Create Employee & Send Invite"}
        </button>
      </div>
    </form>
  );
}
