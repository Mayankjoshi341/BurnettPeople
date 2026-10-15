import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "./api/client";
import "./EmployeeActivation.css";
import burnettLogo from "./assets/burnettpeople-logo.png";

function readInvitationToken() {
  try {
    return new URL(window.location.href).searchParams.get("token") || "";
  } catch {
    return "";
  }
}

function removeInvitationTokenFromUrl() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("token")) return;
    url.searchParams.delete("token");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // If URL cleanup fails, never log or persist the token.
  }
}

function messagesFrom(error) {
  const fieldErrors = error?.fieldErrors || {};
  const values = Object.values(fieldErrors).flat();
  return values.length ? values.join(" ") : error?.message || "Account activation failed. Please request a new invitation from HR.";
}

function EmployeeActivation() {
  const navigate = useNavigate();
  // Capture the bearer-like invitation token once, then remove it from the URL.
  const [invitationToken] = useState(readInvitationToken);
  useEffect(() => { removeInvitationTokenFromUrl(); }, []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState(!invitationToken ? "This activation link is missing its invitation token. Please ask HR to resend the invitation." : "");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const newErrors = {};

    if (!invitationToken) newErrors.token = "This activation link is missing its invitation token.";
    if (!password) newErrors.password = "Please create a password.";
    else if (password.length < 8) newErrors.password = "Use at least 8 characters.";
    else if (!/[A-Z]/.test(password)) newErrors.password = "Include at least one uppercase letter.";
    else if (!/[a-z]/.test(password)) newErrors.password = "Include at least one lowercase letter.";
    else if (!/[0-9]/.test(password)) newErrors.password = "Include at least one number.";

    if (!confirmPassword) newErrors.confirmPassword = "Please confirm your password.";
    else if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match.";

    setErrors(newErrors);
    setGeneralError("");
    if (Object.keys(newErrors).length) return;

    setBusy(true);
    try {
      await apiClient.post("/auth/activate/", {
        token: invitationToken,
        password,
        password_confirm: confirmPassword,
      }, { auth: false, skipRefresh: true });
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
      setErrors({});
    } catch (requestError) {
      const fieldErrors = requestError?.fieldErrors || {};
      const mapped = {};
      if (fieldErrors.password) mapped.password = fieldErrors.password.join(" ");
      if (fieldErrors.password_confirm) mapped.confirmPassword = fieldErrors.password_confirm.join(" ");
      if (fieldErrors.token) mapped.token = fieldErrors.token.join(" ");
      setErrors(mapped);
      setGeneralError(messagesFrom(requestError));
    } finally {
      setBusy(false);
    }
  }

  function handlePasswordChange(event) {
    setPassword(event.target.value);
    setErrors((previous) => ({ ...previous, password: "", confirmPassword: "" }));
    setGeneralError("");
    setSuccess(false);
  }

  function handleConfirmPasswordChange(event) {
    setConfirmPassword(event.target.value);
    setErrors((previous) => ({ ...previous, confirmPassword: "" }));
    setGeneralError("");
    setSuccess(false);
  }

  function renderFieldError(name, id) {
    return errors[name] ? <span id={id} className="activation-error">{errors[name]}</span> : null;
  }

  return (
    <main className="activation-page">
      <section className="activation-card">
        <div className="activation-card-logo"><img src={burnettLogo} alt="BurnettPeople" /></div>
        <div className="activation-welcome-tag">EMPLOYEE ACCOUNT SETUP</div>
        <h1 className="activation-title">Set your password</h1>
        <p className="activation-description">Create a secure password to get started with your employee account.</p>

        {generalError && <div className="activation-error" role="alert">{generalError}</div>}

        {success ? (
          <div className="activation-success" role="status">
            <div className="activation-success-icon" aria-hidden="true">✓</div>
            <h2>Account activated successfully!</h2>
            <p>Your account is now active. You can sign in using your work email and the password you created.</p>
            <button type="button" className="activation-submit" onClick={() => navigate("/", { replace: true })}>
              Return to Login <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="activation-field">
              <label htmlFor="activation-password">New Password</label>
              <div className={`activation-input-wrap ${errors.password ? "has-error" : ""}`}>
                <span className="activation-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <input
                  id="activation-password" type={showPassword ? "text" : "password"} value={password}
                  onChange={handlePasswordChange} placeholder="Create a password" autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "activation-password-error" : "activation-password-help"} required
                />
                <button type="button" className="activation-toggle" onClick={() => setShowPassword((previous) => !previous)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {renderFieldError("password", "activation-password-error")}
            </div>
            <p id="activation-password-help" className="activation-hint">At least 8 characters, with uppercase, lowercase and a number. Django will also apply its password rules.</p>

            <div className="activation-field">
              <label htmlFor="activation-confirm-password">Confirm Password</label>
              <div className={`activation-input-wrap ${errors.confirmPassword ? "has-error" : ""}`}>
                <span className="activation-input-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <input
                  id="activation-confirm-password" type={showConfirmPassword ? "text" : "password"} value={confirmPassword}
                  onChange={handleConfirmPasswordChange} placeholder="Enter your password again" autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? "activation-confirm-error" : undefined} required
                />
                <button type="button" className="activation-toggle" onClick={() => setShowConfirmPassword((previous) => !previous)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {renderFieldError("confirmPassword", "activation-confirm-error")}
            </div>

            <button type="submit" className="activation-submit" disabled={busy || !invitationToken}>
              {busy ? "Activating…" : "Set Password"} <span aria-hidden="true">→</span>
            </button>
          </form>
        )}

        <button type="button" className="activation-back" onClick={() => navigate("/", { replace: true })}>← Back to Login</button>
        <div className="activation-security-note"><span aria-hidden="true">◇</span>Your information matters. Keep your password secure.</div>
        <footer className="activation-footer"><span>© 2026 BurnettPeople</span><span>People first, always.</span></footer>
      </section>
    </main>
  );
}

export default EmployeeActivation;