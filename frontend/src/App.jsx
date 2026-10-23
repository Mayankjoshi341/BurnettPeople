import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

const TypingHeadline = lazy(() => import("./TypingHeadline"));
const AdminDashboard = lazy(() => import("./AdminDashboard"));
const HRDashboard = lazy(() => import("./HRDashboard"));
const EmployeeDashboard = lazy(() => import("./EmployeeDashboard"));
const ManagerDashboard = lazy(() => import("./ManagerDashboard"));
const EmployeeList = lazy(() => import("./EmployeeList"));
const EmployeeForm = lazy(() => import("./EmployeeForm"));
const EmployeeProfile = lazy(() => import("./EmployeeProfile"));
const EmployeeActivation = lazy(() => import("./EmployeeActivation"));
import apiClient from "./api/client";
const PasswordResetPage = lazy(() => import("./pages/PasswordResetPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const ForbiddenPage = lazy(() => import("./pages/ForbiddenPage"));
const ServerErrorPage = lazy(() => import("./pages/ServerErrorPage"));
const RouteErrorBoundary = lazy(() => import("./components/RouteErrorBoundary"));
import { ROLE_HOME, homeForUser } from "./config/roles";

import "./App.css";
import "./auth.css";
import burnettLogo from "./assets/burnettpeople-logo.png";
import loginDarkTeal from "./assets/login-dark-teal.png";
import loginSoftMint from "./assets/login-soft-mint.png";

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

/* Not signed in  -> back to login.
   Signed in, but the wrong role -> the 403 "Access Forbidden" page
   (it used to silently redirect to the user's own dashboard). */
function RequireRole({ user, roles, children }) {
  if (!user) return <Navigate to="/" replace />;
  if (!roles.includes(user.role)) {
    return <ForbiddenPage user={user} />;
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

      {/* Error pages (also reachable directly while you are designing/testing them) */}
      <Route path="/forbidden" element={<ForbiddenPage user={user} />} />
      <Route path="/server-error" element={<ServerErrorPage user={user} />} />

      {/* Any unknown address -> 404 page (it used to redirect silently) */}
      <Route path="*" element={<NotFoundPage user={user} />} />
    </Routes>
  );
}

/* Wraps the routes so a crash inside any page shows the 500 page instead of a blank screen.
   Navigating anywhere resets it (resetKey changes on every navigation). */
function GuardedRoutes(props) {
  const location = useLocation();

  return (
    <RouteErrorBoundary
      resetKey={location.key}
      fallback={(reset) => <ServerErrorPage user={props.user} onReset={reset} />}
    >
      <AppRoutes {...props} />
    </RouteErrorBoundary>
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
      <Suspense fallback={<div className="app-boot" role="status">Loading Burnett People…</div>}>
        <GuardedRoutes user={user} onLogin={handleLogin} onLogout={handleLogout} />
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
