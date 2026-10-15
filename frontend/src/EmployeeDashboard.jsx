import { NavLink } from "react-router-dom";
import { roleLabel, userDisplayName, userInitials } from "./auth/userDisplay";
import "./EmployeeDashboard.css";

function EmployeeDashboard({ user, onLogout }) {
  const name = userDisplayName(user);
  const firstName = name.split(/\s+/)[0];

  return (
    <div className="employee-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>
        <nav>
          <NavLink to="/employee" end>Dashboard</NavLink>
          <NavLink to="/employee#attendance">My Attendance</NavLink>
          <NavLink to="/employee#leaves">Leave Management</NavLink>
          <NavLink to="/employee#profile">My Profile</NavLink>
        </nav>
      </aside>

      <main className="employee-main">
        <header className="employee-header">
          <div><p>Employee Portal</p><h1>My Dashboard</h1></div>
          <div className="employee-profile">
            <span>{userInitials(user)}</span>
            <div><strong>{name}</strong><p>{roleLabel(user?.role)}</p></div>
            <button type="button" onClick={onLogout} className="employee-logout">Log out</button>
          </div>
        </header>

        <section className="employee-welcome">
          <p>WELCOME BACK</p>
          <h2>Hello, {firstName}!</h2>
          <p>Your account identity is loaded from the authenticated backend session. Attendance and leave summaries are not yet available through the backend API.</p>
        </section>

        <section className="employee-summary">
          <article className="employee-card"><p>Today's Attendance</p><h3>—</h3><span>Attendance API not implemented</span></article>
          <article className="employee-card"><p>Days Present</p><h3>—</h3><span>Attendance summary unavailable</span></article>
          <article className="employee-card"><p>Leave Balance</p><h3>—</h3><span>Leave API not implemented</span></article>
        </section>
        <section className="employee-content">
          <article className="employee-card"><h3>Attendance Overview</h3><p>Attendance data will appear here when a server-authorized attendance endpoint is implemented.</p></article>
          <article className="employee-card"><h3>My Leave Requests</h3><p>Leave requests are not yet connected to a backend endpoint. No demo values are shown.</p></article>
        </section>
      </main>
    </div>
  );
}

export default EmployeeDashboard;
