import { NavLink } from "react-router-dom";
import { roleLabel, userDisplayName, userInitials } from "./auth/userDisplay";
import "./ManagerDashboard.css";

function ManagerDashboard({ user, onLogout }) {
  const name = userDisplayName(user);

  return (
    <div className="employee-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>
        <nav>
          <NavLink to="/manager" end>Dashboard</NavLink>
          <NavLink to="/manager#team">My Team</NavLink>
          <NavLink to="/manager#attendance">Team Attendance</NavLink>
          <NavLink to="/manager#leaves">Leave Reviews</NavLink>
          <NavLink to="/manager#profile">My Profile</NavLink>
        </nav>
      </aside>
      <main className="employee-main">
        <header className="employee-header">
          <div><p>Manager Portal</p><h1>Team Dashboard</h1></div>
          <div className="employee-profile">
            <span>{userInitials(user)}</span>
            <div><strong>{name}</strong><p>{roleLabel(user?.role)}</p></div>
            <button type="button" onClick={onLogout} className="employee-logout">Log out</button>
          </div>
        </header>
        <section className="employee-welcome">
          <p>TEAM OVERVIEW</p><h2>Welcome, {name}!</h2>
          <p>Your identity comes from the authenticated backend session. Team, attendance, and leave data are not available through authorized APIs yet.</p>
        </section>
        <section className="employee-summary">
          <article className="employee-card"><p>Team Members</p><h3>—</h3><span>Team membership API not implemented</span></article>
          <article className="employee-card"><p>Present Today</p><h3>—</h3><span>Attendance API not implemented</span></article>
          <article className="employee-card"><p>Leave Reviews</p><h3>—</h3><span>Leave API not implemented</span></article>
        </section>
        <section className="employee-content">
          <article className="employee-card"><h3>Team Attendance</h3><p>Team attendance will be shown when the backend defines and authorizes this endpoint.</p></article>
          <article className="employee-card"><h3>Leave Requests to Review</h3><p>Manager review workflows are unavailable until a backend leave API is implemented.</p></article>
        </section>
      </main>
    </div>
  );
}

export default ManagerDashboard;
