import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./EmployeeForm.css";
import { addDemoEmployee } from "./data/employees";

const initialForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  employeeId: "",
  department: "",
  role: "Employee",
  designation: "",
  joiningDate: "",
  employmentType: "Full-time",
  manager: "",
};

function EmployeeForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: "" }));
    setSuccess(false);
  }

  function handleSubmit(event) {
    event.preventDefault();

    const newErrors = {};

    if (!form.firstName.trim()) newErrors.firstName = "First name is required.";
    if (!form.lastName.trim()) newErrors.lastName = "Last name is required.";

    if (!form.email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (form.phone.trim() && !/^[+\d\s()-]{7,20}$/.test(form.phone.trim())) {
      newErrors.phone = "Please enter a valid phone number.";
    }

    if (!form.employeeId.trim()) newErrors.employeeId = "Employee ID is required.";
    if (!form.department) newErrors.department = "Please select a department.";
    if (!form.designation.trim()) newErrors.designation = "Designation is required.";
    if (!form.joiningDate) newErrors.joiningDate = "Joining date is required.";

    if (
      form.joiningDate &&
      form.joiningDate > new Date().toISOString().slice(0, 10)
    ) {
      newErrors.joiningDate = "Joining date cannot be in the future.";
    }

    setErrors(newErrors);
    setSuccess(false);

    if (Object.keys(newErrors).length > 0) return;

    try {
      addDemoEmployee({
        id: form.employeeId.trim(),
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        email: form.email.trim(),
        department: form.department,
        role: form.role,
        designation: form.designation.trim(),
        phone: form.phone.trim(),
        joiningDate: form.joiningDate,
        employmentType: form.employmentType,
        manager: form.manager.trim(),
        status: "Active",
      });

      setSuccess(true);
      setErrors({});
    } catch (error) {
      const message = error.message || "Could not add this employee.";

      if (message.includes("Employee ID")) {
        setErrors((previous) => ({ ...previous, employeeId: message }));
      } else if (message.toLowerCase().includes("email")) {
        setErrors((previous) => ({ ...previous, email: message }));
      } else {
        setErrors({ general: message });
      }
    }
  }

  function handleReset() {
    setForm(initialForm);
    setErrors({});
    setSuccess(false);
  }

  function renderFieldError(name) {
    return errors[name] ? (
      <span className="employee-form-error">{errors[name]}</span>
    ) : null;
  }

  return (
    <main className="employee-form-page">
      <header className="employee-form-header">
        <div>
          <p className="employee-form-eyebrow">PEOPLE MANAGEMENT</p>
          <h1>Add New Employee</h1>
          <p>Enter the details below to prepare a new employee profile.</p>
        </div>

        <button
          type="button"
          className="employee-form-back"
          onClick={() => navigate("/employees")}
        >
          ← Back to Employees
        </button>
      </header>

      {success && (
        <div className="employee-form-success" role="status">
          <strong>Employee added successfully!</strong>
          <p>
            Invitation status is Pending. This is a frontend demo; no invitation
            email has been sent and the employee has not been saved to a backend
            database.
          </p>
          <button type="button" onClick={() => navigate("/employees")}>
            View Employee Directory
          </button>
        </div>
      )}

      {errors.general && (
        <div className="employee-form-error" role="alert">
          {errors.general}
        </div>
      )}

      <form className="employee-form-card" onSubmit={handleSubmit} noValidate>
        <section className="employee-form-section">
          <div className="employee-form-section-heading">
            <span className="employee-form-section-number">01</span>
            <div>
              <h2>Personal Information</h2>
              <p>Basic details to identify the employee.</p>
            </div>
          </div>

          <div className="employee-form-grid">
            <label className="employee-form-field">
              First Name *
              <input name="firstName" value={form.firstName} onChange={handleChange}
                placeholder="e.g. Aarav" autoComplete="given-name"
                aria-invalid={Boolean(errors.firstName)} />
              {renderFieldError("firstName")}
            </label>

            <label className="employee-form-field">
              Last Name *
              <input name="lastName" value={form.lastName} onChange={handleChange}
                placeholder="e.g. Sharma" autoComplete="family-name"
                aria-invalid={Boolean(errors.lastName)} />
              {renderFieldError("lastName")}
            </label>

            <label className="employee-form-field">
              Work Email *
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="name@company.com" autoComplete="email"
                aria-invalid={Boolean(errors.email)} />
              {renderFieldError("email")}
            </label>

            <label className="employee-form-field">
              Phone Number
              <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                placeholder="Enter phone number" autoComplete="tel"
                aria-invalid={Boolean(errors.phone)} />
              {renderFieldError("phone")}
            </label>
          </div>
        </section>

        <section className="employee-form-section">
          <div className="employee-form-section-heading">
            <span className="employee-form-section-number">02</span>
            <div>
              <h2>Employment Details</h2>
              <p>Assign the employee's ID, team and position.</p>
            </div>
          </div>

          <div className="employee-form-grid">
            <label className="employee-form-field">
              Employee ID *
              <input name="employeeId" value={form.employeeId} onChange={handleChange}
                placeholder="e.g. BP005" aria-invalid={Boolean(errors.employeeId)} />
              {renderFieldError("employeeId")}
            </label>

            <label className="employee-form-field">
              Department *
              <select name="department" value={form.department} onChange={handleChange}
                aria-invalid={Boolean(errors.department)}>
                <option value="">Select department</option>
                <option value="Engineering">Engineering</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Design">Design</option>
                <option value="Sales">Sales</option>
                <option value="Finance">Finance</option>
                <option value="Marketing">Marketing</option>
                <option value="Operations">Operations</option>
              </select>
              {renderFieldError("department")}
            </label>

            <label className="employee-form-field">
              System Role *
              <select name="role" value={form.role} onChange={handleChange}>
                <option value="Employee">Employee</option>
                <option value="Manager">Manager / Team Lead</option>
                <option value="HR">HR</option>
                <option value="Admin">Admin</option>
              </select>
            </label>

            <label className="employee-form-field">
              Designation *
              <input name="designation" value={form.designation} onChange={handleChange}
                placeholder="e.g. Software Engineer"
                aria-invalid={Boolean(errors.designation)} />
              {renderFieldError("designation")}
            </label>

            <label className="employee-form-field">
              Joining Date *
              <input type="date" name="joiningDate" value={form.joiningDate}
                onChange={handleChange} max={new Date().toISOString().slice(0, 10)}
                aria-invalid={Boolean(errors.joiningDate)} />
              {renderFieldError("joiningDate")}
            </label>

            <label className="employee-form-field">
              Employment Type
              <select name="employmentType" value={form.employmentType} onChange={handleChange}>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Intern">Intern</option>
              </select>
            </label>

            <label className="employee-form-field employee-form-field-full">
              Reporting Manager
              <input name="manager" value={form.manager} onChange={handleChange}
                placeholder="Enter manager's name (optional)" />
            </label>
          </div>
        </section>

        <div className="employee-form-footer">
          <p>* Required fields</p>
          <div className="employee-form-actions">
            <button type="button" className="employee-form-cancel" onClick={handleReset}>
              Clear Form
            </button>
            <button type="submit" className="employee-form-submit">
              Add Employee →
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}

export default EmployeeForm;