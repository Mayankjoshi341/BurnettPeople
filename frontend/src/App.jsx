import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";

import TypingHeadline from "./TypingHeadline";
import AdminDashboard from "./AdminDashboard";
import HRDashboard from "./HRDashboard";
import EmployeeDashboard from "./EmployeeDashboard";
import ManagerDashboard from "./ManagerDashboard";
import EmployeeList from "./EmployeeList";
import EmployeeForm from "./EmployeeForm";
import EmployeeProfile from "./EmployeeProfile";
import EmployeeActivation from "./EmployeeActivation";
import apiClient from "./api/client";

import "./App.css";
import burnettLogo from "./assets/burnettpeople-logo.png";
import loginDarkTeal from "./assets/login-dark-teal.png";
import loginSoftMint from "./assets/login-soft-mint.png";

const ROLE_HOME = {
  ADMIN: "/admin",
  HR: "/hr",
  MANAGER: "/manager",
  EMPLOYEE: "/employee",
};

function homeForUser(user) {
  return ROLE_HOME[user?.role] || "/";
}

function ThemeToggle({ theme, onToggle }) {
  const dark = theme === "dark";

  return (
    <button
      type="button"
      className="global-theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
    </button>
  );
}

function LoginPage({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
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
      setError(
        requestError?.message || "Unable to sign in. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section
        className="brand-panel"
        style={{
          backgroundImage: `url(${loginDarkTeal})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="brand-top">
          <img
            src={burnettLogo}
            alt="BurnettPeople logo"
            className="brand-image"
          />
        </div>

        <div className="brand-content">
          <div className="eyebrow">
            <span className="live-dot" />
            YOUR PEOPLE. YOUR FUTURE.
          </div>

          <h1 className="hero-title">
            Great people
            <br />
            build <TypingHeadline />
          </h1>

          <p className="brand-description">
            A better workday starts here. Manage your people, celebrate
            progress, and bring your whole team together in one beautifully
            simple place.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon">↗</div>
              <div>
                <strong>Everything in one place</strong>
                <p>People, attendance, leave and more.</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">✳</div>
              <div>
                <strong>Made for your workday</strong>
                <p>Less admin. More meaningful work.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="brand-bottom">
          <div className="avatar-stack">
            <span>D</span>
            <span>M</span>
            <span>A</span>
            <span>R</span>
          </div>

          <p>
            <strong>People first, always.</strong>
            <br />
            A workplace that works for everyone.
          </p>
        </div>

        <div className="decor decor-one" />
        <div className="decor decor-two" />
      </section>

      <section
        className="form-panel"
        style={{
          backgroundImage: `url(${loginSoftMint})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="mobile-brand">
          <img
            src={burnettLogo}
            alt="BurnettPeople logo"
            className="brand-image"
          />
        </div>

        <div className="login-card">
          <div className="welcome-tag">WELCOME BACK</div>
          <h2>Sign in to your space</h2>
          <p className="form-subtitle">
            Your workday, all in one place.
          </p>

          <form onSubmit={handleLogin}>
            <label htmlFor="email">Work Email</label>

            <div className="input-wrap">
              <span className="input-icon">✉</span>
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

            <div className="password-label">
              <label htmlFor="password">Password</label>
            </div>

            <div className="input-wrap password-wrap">
              <span className="input-icon">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>

              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error && (
              <div role="alert" className="employee-form-error">
                {error}
              </div>
            )}

            <div className="forgot-row">
              <button
                className="text-button"
                type="button"
                onClick={() => navigate("/password-reset")}
              >
                Forgot Password?
              </button>
            </div>

            <button
              className="sign-in-button"
              type="submit"
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign in to BurnettPeople"}{" "}
              <span>→</span>
            </button>
          </form>

          <div className="security-note">
            <span>♧</span>
            Your information is protected and secure.
          </div>
        </div>

        <footer className="form-footer">
          <span>© 2026 BurnettPeople</span>
          <div>
            <a href="#privacy">Privacy</a>
            <a href="#help">Help &amp; Support</a>
          </div>
        </footer>
      </section>
    </main>
  );
}

function PasswordResetPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function requestCode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await apiClient.post(
        "/auth/password-reset/request/",
        { email: email.trim() },
        { auth: false, skipRefresh: true }
      );

      setMessage(
        result?.detail ||
          "If an active account exists, a reset code will be sent."
      );
      setStage("confirm");
    } catch (requestError) {
      setError(
        requestError?.message || "Could not request a password reset."
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    if (password !== passwordConfirm) {
      setError("The passwords do not match.");
      setBusy(false);
      return;
    }

    try {
      const result = await apiClient.post(
        "/auth/password-reset/confirm/",
        {
          email: email.trim(),
          code: code.trim(),
          password,
          password_confirm: passwordConfirm,
        },
        { auth: false, skipRefresh: true }
      );

      setMessage(
        result?.detail || "Your password has been reset successfully."
      );
      setPassword("");
      setPasswordConfirm("");
      setCode("");
      setStage("success");
    } catch (requestError) {
      const fields = requestError?.fieldErrors || {};
      const fieldMessages = Object.values(fields).flat();

      setError(
        fieldMessages.join(" ") ||
          requestError?.message ||
          "Could not reset the password."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section
        className="form-panel"
        style={{
          width: "100%",
          minHeight: "100vh",
          backgroundImage: `url(${loginSoftMint})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="mobile-brand">
          <img
            src={burnettLogo}
            alt="BurnettPeople logo"
            className="brand-image"
          />
        </div>

        <div className="login-card">
          <div className="welcome-tag">ACCOUNT RECOVERY</div>

          <h2>
            {stage === "success"
              ? "Password updated"
              : "Reset your password"}
          </h2>

          <p className="form-subtitle">
            {stage === "request"
              ? "We'll send a reset code if an active account matches your email."
              : "Enter the six-digit code from your email and choose a new password."}
          </p>

          {message && (
            <div role="status" className="activation-success">
              {message}
            </div>
          )}

          {error && (
            <div role="alert" className="employee-form-error">
              {error}
            </div>
          )}

          {stage === "request" && (
            <form onSubmit={requestCode}>
              <label htmlFor="reset-email">Work Email</label>

              <div className="input-wrap">
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                />
              </div>

              <button
                className="sign-in-button"
                type="submit"
                disabled={busy}
              >
                {busy ? "Requesting…" : "Send reset code"} <span>→</span>
              </button>
            </form>
          )}

          {stage === "confirm" && (
            <form onSubmit={confirmReset}>
              <label htmlFor="reset-code">Six-digit reset code</label>

              <div className="input-wrap">
                <input
                  id="reset-code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                  autoComplete="one-time-code"
                />
              </div>

              <label htmlFor="reset-password">New Password</label>

              <div className="input-wrap">
                <input
                  id="reset-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <label htmlFor="reset-password-confirm">
                Confirm New Password
              </label>

              <div className="input-wrap">
                <input
                  id="reset-password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button
                className="sign-in-button"
                type="submit"
                disabled={busy}
              >
                {busy ? "Updating…" : "Reset password"} <span>→</span>
              </button>

              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setStage("request");
                  setError("");
                  setMessage("");
                }}
              >
                Request another code
              </button>
            </form>
          )}

          {stage === "success" && (
            <button
              className="sign-in-button"
              type="button"
              onClick={() => navigate("/", { replace: true })}
            >
              Return to login <span>→</span>
            </button>
          )}

          {stage !== "success" && (
            <button
              type="button"
              className="text-button"
              onClick={() => navigate("/", { replace: true })}
            >
              ← Back to Login
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function RequireRole({ user, roles, children }) {
  if (!user) return <Navigate to="/" replace />;
  if (!roles.includes(user.role)) {
    return <Navigate to={homeForUser(user)} replace />;
  }
  return children;
}

function AppRoutes({ user, onLogin, onLogout }) {
  const home = homeForUser(user);
  const peopleRoles = ["ADMIN", "HR"];

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={home} replace />
          ) : (
            <LoginPage onLogin={onLogin} />
          )
        }
      />

      <Route
        path="/password-reset"
        element={
          user ? (
            <Navigate to={home} replace />
          ) : (
            <PasswordResetPage />
          )
        }
      />

      <Route path="/activate-account" element={<EmployeeActivation />} />
      <Route path="/activate" element={<EmployeeActivation />} />

      <Route
        path="/employee"
        element={
          <RequireRole user={user} roles={["EMPLOYEE"]}>
            <EmployeeDashboard user={user} onLogout={onLogout} />
          </RequireRole>
        }
      />

      <Route
        path="/hr"
        element={
          <RequireRole user={user} roles={["HR"]}>
            <HRDashboard user={user} onLogout={onLogout} />
          </RequireRole>
        }
      />

      <Route
        path="/manager"
        element={
          <RequireRole user={user} roles={["MANAGER"]}>
            <ManagerDashboard user={user} onLogout={onLogout} />
          </RequireRole>
        }
      />

      <Route
        path="/admin/*"
        element={
          <RequireRole user={user} roles={["ADMIN"]}>
            <AdminDashboard user={user} onLogout={onLogout} />
          </RequireRole>
        }
      />

      <Route
        path="/employees"
        element={
          <RequireRole user={user} roles={peopleRoles}>
            <EmployeeList />
          </RequireRole>
        }
      />

      <Route
        path="/employees/new"
        element={
          <RequireRole user={user} roles={peopleRoles}>
            <EmployeeForm />
          </RequireRole>
        }
      />

      <Route
        path="/employees/:id"
        element={
          <RequireRole user={user} roles={peopleRoles}>
            <EmployeeProfile />
          </RequireRole>
        }
      />

      <Route
        path="*"
        element={<Navigate to={user ? home : "/"} replace />}
      />
    </Routes>
  );
}

function App() {
  const [user, setUser] = useState(null);

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("burnettpeople-theme") === "dark"
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem("burnettpeople-theme", theme);
    } catch {
      // Theme still works for the current session.
    }
  }, [theme]);

  useEffect(() => {
    apiClient.setSessionExpiredHandler(() => setUser(null));
    return () => apiClient.setSessionExpiredHandler(null);
  }, []);

  async function handleLogin(email, password) {
    const tokens = await apiClient.post(
      "/auth/token/",
      { email, password },
      { auth: false, skipRefresh: true }
    );

    if (!tokens?.access || !tokens?.refresh) {
      throw new Error(
        "The login endpoint did not return both access and refresh tokens."
      );
    }

    apiClient.setSessionTokens(tokens);

    try {
      const profile = await apiClient.get("/auth/me/");

      if (!profile?.id || !profile?.role || profile.is_active !== true) {
        throw new Error("The server did not return an active user profile.");
      }

      if (!ROLE_HOME[profile.role]) {
        throw new Error(
          "Your account has an unsupported role. Please contact HR."
        );
      }

      setUser(profile);
      return profile;
    } catch (error) {
      apiClient.clearSession();
      setUser(null);
      throw error;
    }
  }

  async function handleLogout() {
    try {
      if (apiClient.getRefreshToken()) {
        await apiClient.logout();
      }
    } catch {
      // Always clear the local session.
    } finally {
      apiClient.clearSession();
      setUser(null);
    }
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  return (
    <BrowserRouter>
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      <AppRoutes user={user} onLogin={handleLogin} onLogout={handleLogout} />
    </BrowserRouter>
  );
}

export default App;
