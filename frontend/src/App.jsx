import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";

import AdminDashboard from "./AdminDashboard";
import HRDashboard from "./HRDashboard";
import EmployeeDashboard from "./EmployeeDashboard";
import ManagerDashboard from "./ManagerDashboard";
import "./App.css";
import burnettLogo from "./assets/burnettpeople-logo.png";

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();

    // Temporary demo navigation; real authentication comes later.
    navigate("/employee");
  };

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

          <h1>
            Great people
            <br />
            build <span>great things.</span>
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
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="password-label">
              <label htmlFor="password">Password</label>
            </div>

            <div className="input-wrap password-wrap">
              <span className="input-icon">⌑</span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
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
      <Route path="/employee" element={<EmployeePage />} />
      <Route path="/hr" element={<HRDashboard />} />
      <Route path="/manager" element={<ManagerDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}



function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;