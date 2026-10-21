import { useState } from "react";
import { useNavigate } from "react-router-dom";

import TypingHeadline from "../TypingHeadline";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import { ArrowRightIcon, MailIcon, ShieldCheckIcon } from "../components/icons";

export default function LoginPage({ onLogin, homeForUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const user = await onLogin(email.trim(), password);
      navigate(homeForUser(user), { replace: true });
    } catch (requestError) {
      setError(requestError?.message || "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      headline={
        <>
          Great people
          <br />
          build <TypingHeadline />
        </>
      }
      text="A better workday starts here. Manage your people, celebrate progress, and bring your whole team together in one beautifully simple place."
    >
      <div className="bp-card">
        <span className="bp-eyebrow">Welcome back</span>
        <h2 className="bp-card-title">Sign in to your space</h2>
        <p className="bp-card-subtitle">Your workday, all in one place.</p>

        {error && (
          <div role="alert" className="bp-alert">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="bp-field">
            <label htmlFor="email">Work Email</label>
            <div className="bp-input">
              <MailIcon className="bp-input-icon" />
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <PasswordField
            id="password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          <div className="bp-forgot">
            <button
              type="button"
              className="bp-link"
              onClick={() => navigate("/password-reset")}
            >
              Forgot Password?
            </button>
          </div>

          <button type="submit" className="bp-button" disabled={busy}>
            {busy ? "Signing in…" : "Sign in to BurnettPeople"}
            {!busy && <ArrowRightIcon width={19} height={19} />}
          </button>
        </form>

        <p className="bp-secure">
          <ShieldCheckIcon width={18} height={18} />
          Your information is protected and secure.
        </p>
      </div>

      <footer className="bp-footer">
        <span>© 2026 BurnettPeople</span>
        <div>
          <a href="#privacy">Privacy</a>
          <a href="#help">Help &amp; Support</a>
        </div>
      </footer>
    </AuthLayout>
  );
}
