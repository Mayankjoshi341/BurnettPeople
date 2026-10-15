import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "./api/client";
import "./EmployeeForm.css";

const initialForm = {
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

function listFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}


function activationLabel(status) {
  const labels = {
    EMAIL_PENDING: "Invitation email is queued; delivery is not yet confirmed",
    ACTIVATION_PENDING: "Invitation email sent; employee has not activated the account",
    DELIVERY_FAILED: "Invitation email delivery failed; resend may be needed",
    INVITATION_EXPIRED: "Invitation expired; a new invitation is required",
    INVITATION_REVOKED: "Invitation was revoked",
    ACTIVATED: "Account activated",
    NOT_INVITED: "Portal account exists but no invitation is recorded",
    NO_PORTAL_ACCOUNT: "No portal account is linked",
  };
  return labels[status] || status || "Not reported by the server";
}

function EmployeeForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [lookupError, setLookupError] = useState("");
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [managers, setManagers] = useState([]);
  const [workLocations, setWorkLocations] = useState([]);
  const [createdEmployee, setCreatedEmployee] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadLookups() {
      try {
        const [departmentData, designationData, managerData, locationData] = await Promise.all([
          apiClient.get("/organization/departments/"),
          apiClient.get("/organization/designations/"),
          apiClient.get("/employees/?employment_status=ACTIVE"),
          apiClient.get("/organization/work-locations/"),
        ]);
        if (!active) return;
        setDepartments(listFromResponse(departmentData));
        setDesignations(listFromResponse(designationData));
        setManagers(listFromResponse(managerData).filter((employee) => employee.employment_status === "ACTIVE" && employee.portal_role === "MANAGER"));
        setWorkLocations(listFromResponse(locationData));
      } catch (error) {
        if (!active) return;
        setLookupError(error?.message || "Could not load organization options. Please retry.");
      } finally {
        if (active) setLoadingLookups(false);
      }
    }
    loadLookups();
    return () => { active = false; };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: "", general: "" }));
    setCreatedEmployee(null);
  }

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

  async function handleSubmit(event) {
    event.preventDefault();
    const newErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = "First name is required.";
    if (!form.lastName.trim()) newErrors.lastName = "Last name is required.";
    if (!form.email.trim()) newErrors.email = "Official email is required.";
    if (!form.employeeId.trim()) newErrors.employeeId = "Employee code is required.";
    if (!form.department) newErrors.department = "Please select a department.";
    if (!form.designation) newErrors.designation = "Please select a designation.";
    if (!form.joiningDate) newErrors.joiningDate = "Joining date is required.";
    if (form.phone.trim() && !/^[+\d\s()-]{7,30}$/.test(form.phone.trim())) newErrors.phone = "Please enter a valid phone number.";
    if (Object.keys(newErrors).length || lookupError || loadingLookups) {
      if (lookupError) newErrors.general = `Organization options are unavailable: ${lookupError}`;
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    setCreatedEmployee(null);
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
      // The backend service creates a PREBOARDING record and an inactive user.
      // Do not set employment/account status on the client.
      const employee = await apiClient.post("/employees/", payload);
      setCreatedEmployee(employee);
      setForm(initialForm);
    } catch (error) {
      mapBackendErrors(error);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setForm(initialForm);
    setErrors({});
    setCreatedEmployee(null);
  }

  function renderFieldError(name) {
    return errors[name] ? <span className="employee-form-error">{errors[name]}</span> : null;
  }

  return (
    <main className="employee-form-page">
      <header className="employee-form-header">
        <div>
          <p className="employee-form-eyebrow">PEOPLE MANAGEMENT</p>
          <h1>Add New Employee</h1>
          <p>Enter the details below to prepare a new employee profile.</p>
        </div>
        <button type="button" className="employee-form-back" onClick={() => navigate("/employees")}>← Back to Employees</button>
      </header>

      {createdEmployee && (
        <div className="employee-form-success" role="status">
          <strong>Employee created successfully: {createdEmployee.employee_code}</strong>
          <p>
            {createdEmployee.first_name} {createdEmployee.last_name} was saved as {createdEmployee.employment_status || "PREBOARDING"}.
            Account activation: {activationLabel(createdEmployee.account_activation_status)}.
            The account is not considered activated unless the server reports ACTIVATED.
          </p>
          <button type="button" onClick={() => navigate("/employees")}>View Employee Directory</button>
        </div>
      )}

      {lookupError && <div className="employee-form-error" role="alert">Could not load department, designation, manager, or work-location options: {lookupError}</div>}
      {errors.general && <div className="employee-form-error" role="alert">{errors.general}</div>}

      <form className="employee-form-card" onSubmit={handleSubmit} noValidate>
        <section className="employee-form-section">
          <div className="employee-form-section-heading">
            <span className="employee-form-section-number">01</span>
            <div><h2>Personal Information</h2><p>Basic details to identify the employee.</p></div>
          </div>
          <div className="employee-form-grid">
            <label className="employee-form-field">First Name *
              <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="e.g. Aarav" autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} />
              {renderFieldError("firstName")}
            </label>
            <label className="employee-form-field">Last Name *
              <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="e.g. Sharma" autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} />
              {renderFieldError("lastName")}
            </label>
            <label className="employee-form-field">Work Email *
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@company.com" autoComplete="email" aria-invalid={Boolean(errors.email)} />
              {renderFieldError("email")}
            </label>
            <label className="employee-form-field">Phone Number
              <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="Enter phone number" autoComplete="tel" aria-invalid={Boolean(errors.phone)} />
              {renderFieldError("phone")}
            </label>
          </div>
        </section>

        <section className="employee-form-section">
          <div className="employee-form-section-heading">
            <span className="employee-form-section-number">02</span>
            <div><h2>Employment Details</h2><p>Assign the employee's ID, team and position.</p></div>
          </div>
          <div className="employee-form-grid">
            <label className="employee-form-field">Employee ID *
              <input name="employeeId" value={form.employeeId} onChange={handleChange} placeholder="e.g. BP005" aria-invalid={Boolean(errors.employeeId)} />
              {renderFieldError("employeeId")}
            </label>
            <label className="employee-form-field">Department *
              <select name="department" value={form.department} onChange={handleChange} disabled={loadingLookups || Boolean(lookupError)} aria-invalid={Boolean(errors.department)}>
                <option value="">{loadingLookups ? "Loading departments…" : "Select department"}</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              {renderFieldError("department")}
            </label>
            <label className="employee-form-field">System Role
              <select value="EMPLOYEE" disabled aria-label="System role assigned by backend"><option value="EMPLOYEE">Employee (assigned by system)</option></select>
              <span className="employee-form-hint">Public employee creation cannot assign HR, Manager, or Admin privileges.</span>
            </label>
            <label className="employee-form-field">Designation *
              <select name="designation" value={form.designation} onChange={handleChange} disabled={loadingLookups || Boolean(lookupError)} aria-invalid={Boolean(errors.designation)}>
                <option value="">{loadingLookups ? "Loading designations…" : "Select designation"}</option>
                {designations.map((designation) => <option key={designation.id} value={designation.id}>{designation.title}{designation.grade ? ` — ${designation.grade}` : ""}</option>)}
              </select>
              {renderFieldError("designation")}
            </label>
            <label className="employee-form-field">Joining Date *
              <input type="date" name="joiningDate" value={form.joiningDate} onChange={handleChange} aria-invalid={Boolean(errors.joiningDate)} />
              {renderFieldError("joiningDate")}
            </label>
            <label className="employee-form-field">Employment Type
              <select name="employmentType" value={form.employmentType} onChange={handleChange}>
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
              </select>
              {renderFieldError("employmentType")}
            </label>
            <label className="employee-form-field">Reporting Manager
              <select name="manager" value={form.manager} onChange={handleChange} disabled={loadingLookups || Boolean(lookupError)} aria-invalid={Boolean(errors.manager)}>
                <option value="">No manager selected</option>
                {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.first_name} {manager.last_name} ({manager.employee_code})</option>)}
              </select>
              {renderFieldError("manager")}
            </label>
            <label className="employee-form-field">Work Location
              <select name="workLocation" value={form.workLocation} onChange={handleChange} disabled={loadingLookups || Boolean(lookupError)} aria-invalid={Boolean(errors.workLocation)}>
                <option value="">No work location selected</option>
                {workLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
              {renderFieldError("workLocation")}
            </label>
          </div>
        </section>

        <div className="employee-form-footer">
          <p>* Required fields</p>
          <div className="employee-form-actions">
            <button type="button" className="employee-form-cancel" onClick={handleReset}>Clear Form</button>
            <button type="submit" className="employee-form-submit" disabled={submitting || loadingLookups || Boolean(lookupError)}>
              {submitting ? "Saving…" : "Add Employee →"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}

export default EmployeeForm;
