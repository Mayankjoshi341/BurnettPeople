
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./EmployeeActivation.css";
import burnettLogo from "./assets/burnettpeople-logo.png";

function EmployeeActivation() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();

    const newErrors = {};

    if (!password) {
      newErrors.password = "Please create a password.";
    } else if (password.length < 8) {
      newErrors.password = "Use at least 8 characters.";
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password = "Include at least one uppercase letter.";
    } else if (!/[a-z]/.test(password)) {
      newErrors.password = "Include at least one lowercase letter.";
    } else if (!/[0-9]/.test(password)) {
      newErrors.password = "Include at least one number.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setSuccess(false);
      return;
    }

    // Frontend demo only. Password is not saved to a backend.
    setSuccess(true);
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value);

    setErrors((previous) => ({
      ...previous,
      password: "",
      confirmPassword: "",
    }));

    setSuccess(false);
  }

  function handleConfirmPasswordChange(event) {
    setConfirmPassword(event.target.value);

    setErrors((previous) => ({
      ...previous,
      confirmPassword: "",
    }));

    setSuccess(false);
  }

  return (
    <main className="activation-page">
      <section className="activation-card">
        <div className="activation-card-logo">
          <img
            src={burnettLogo}
            alt="BurnettPeople"
          />
        </div>

        <div className="activation-welcome-tag">
          EMPLOYEE ACCOUNT SETUP
        </div>

        <h1 className="activation-title">Set your password</h1>

        <p className="activation-description">
          Create a secure password to get started with your employee account.
        </p>

        {success ? (
          <div className="activation-success" role="status">
            <div className="activation-success-icon" aria-hidden="true">
              ✓
            </div>

            <h2>Details validated successfully!</h2>

            <p>
              Your password passed the frontend checks. Actual account
              activation requires backend verification and is not yet
              connected.
            </p>

            <button
              type="button"
              className="activation-submit"
              onClick={() => navigate("/")}
            >
              Return to Login <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="activation-field">
              <label htmlFor="activation-password">
                New Password
              </label>

              <div
                className={`activation-input-wrap ${
                  errors.password ? "has-error" : ""
                }`}
              >
                <span className="activation-input-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="5" y="10" width="14" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>

                <input
                  id="activation-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Create a password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password
                      ? "activation-password-error"
                      : "activation-password-help"
                  }
                />

                <button
                  type="button"
                  className="activation-toggle"
                  onClick={() =>
                    setShowPassword((previous) => !previous)
                  }
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {errors.password && (
                <span
                  id="activation-password-error"
                  className="activation-error"
                >
                  {errors.password}
                </span>
              )}
            </div>

            <p id="activation-password-help" className="activation-hint">
              At least 8 characters, with uppercase, lowercase and a number.
            </p>

            <div className="activation-field">
              <label htmlFor="activation-confirm-password">
                Confirm Password
              </label>

              <div
                className={`activation-input-wrap ${
                  errors.confirmPassword ? "has-error" : ""
                }`}
              >
                <span className="activation-input-icon" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="5" y="10" width="14" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>

                <input
                  id="activation-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={
                    errors.confirmPassword
                      ? "activation-confirm-error"
                      : undefined
                  }
                />

                <button
                  type="button"
                  className="activation-toggle"
                  onClick={() =>
                    setShowConfirmPassword((previous) => !previous)
                  }
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>

              {errors.confirmPassword && (
                <span
                  id="activation-confirm-error"
                  className="activation-error"
                >
                  {errors.confirmPassword}
                </span>
              )}
            </div>

            <button type="submit" className="activation-submit">
              Set Password <span aria-hidden="true">→</span>
            </button>
          </form>
        )}

        <button
          type="button"
          className="activation-back"
          onClick={() => navigate("/")}
        >
          ← Back to Login
        </button>

        <div className="activation-security-note">
          <span aria-hidden="true">◇</span>
          Your information matters. Keep your password secure.
        </div>

        <footer className="activation-footer">
          <span>© 2026 BurnettPeople</span>
          <span>People first, always.</span>
        </footer>
      </section>
    </main>
  );
}

export default EmployeeActivation;
