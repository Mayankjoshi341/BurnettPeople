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

import "./App.css";
import burnettLogo from "./assets/burnettpeople-logo.png";

function ThemeToggle({ theme, onToggle }) {
  const dark = theme === "dark";

  return (
    <button
      type="button"
      className="global-theme-toggle"
      onClick={onToggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
      <span>{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  function handleLogin(event) {
    event.preventDefault();
    navigate("/employee");
  }

  return (
    <main className="login-page">
      <section className="brand-panel">
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
            A better workday starts here. Manage your people,
            celebrate progress, and bring your whole team together
            in one beautifully simple place.
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
            <span>J</span>
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

      <section className="form-panel">
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
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <div className="forgot-row">
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  alert("Password reset will be connected later.")
                }
              >
                Forgot Password?
              </button>
            </div>

            <label className="remember-row">
              <input type="checkbox" />
              <span>Keep me signed in</span>
            </label>

            <button className="sign-in-button" type="submit">
              Sign in to BurnettPeople <span>→</span>
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

function EmployeePage() {
  const navigate = useNavigate();

  return (
    <EmployeeDashboard
      onLogout={() => navigate("/", { replace: true })}
    />
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/activate" element={<EmployeeActivation />} />
      <Route path="/employee" element={<EmployeePage />} />
      <Route path="/employees" element={<EmployeeList />} />
      <Route path="/employees/new" element={<EmployeeForm />} />
      <Route path="/employees/:id" element={<EmployeeProfile />} />
      <Route path="/hr" element={<HRDashboard />} />
      <Route path="/manager" element={<ManagerDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
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
      // Theme still works during the current session.
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((current) =>
      current === "dark" ? "light" : "dark"
    );
  }

  return (
    <BrowserRouter>
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;