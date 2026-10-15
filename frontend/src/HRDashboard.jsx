import { NavLink } from "react-router-dom";
import { roleLabel, userDisplayName, userInitials } from "./auth/userDisplay";
import "./HRDashboard.css";

function HRDashboard({ user, onLogout }) {
  const name = userDisplayName(user);

  return (
    <div className="employee-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>
        <nav>
          <NavLink to="/hr" end>Dashboard</NavLink>
          <NavLink to="/employees">Employees</NavLink>
          <NavLink to="/hr#attendance">Attendance</NavLink>
          <NavLink to="/hr#leaves">Leave Requests</NavLink>
          <NavLink to="/hr#profile">My Profile</NavLink>
        </nav>
      </aside>

      <main className="employee-main">
        <header className="employee-header">
          <div><p>HR Portal</p><h1>HR Dashboard</h1></div>
          <div className="employee-profile">
            <span>{userInitials(user)}</span>
            <div><strong>{name}</strong><p>{roleLabel(user?.role)}</p></div>
            <button type="button" onClick={onLogout} className="employee-logout">Log out</button>
          </div>
        </header>
        <section className="employee-welcome">
          <p>HR OVERVIEW</p><h2>Welcome, {name}!</h2>
          <p>Your signed-in identity is loaded from the backend. Attendance and leave metrics are shown as unavailable until authorized APIs exist.</p>
        </section>
        <section className="employee-summary">
          <article className="employee-card"><p>Total Employees</p><h3>—</h3><span>Use the Employees directory for persisted records</span></article>
          <article className="employee-card"><p>Present Today</p><h3>—</h3><span>Attendance API not implemented</span></article>
          <article className="employee-card"><p>Pending Leave Requests</p><h3>—</h3><span>Leave API not implemented</span></article>
        </section>
        <section className="employee-content">
          <article className="employee-card"><h3>Employee Management</h3><p>The employee directory and onboarding screens use backend records.</p></article>
          <article className="employee-card"><h3>Leave Requests</h3><p>Leave review is not connected because the backend has no operational leave endpoint yet.</p></article>
        </section>
      </main>
    </div>
  );
}

export default HRDashboard;
