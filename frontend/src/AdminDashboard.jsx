import { NavLink } from "react-router-dom";
import { roleLabel, userDisplayName, userInitials } from "./auth/userDisplay";
import "./AdminDashboard.css";

function AdminDashboard({ user, onLogout }) {
  const name = userDisplayName(user);

  return (
    <div className="employee-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>
        <nav>
          <NavLink to="/admin" end>Dashboard</NavLink>
          <NavLink to="/admin#users">User Management</NavLink>
          <NavLink to="/employees">Employees</NavLink>
          <NavLink to="/admin#roles">Roles &amp; Permissions</NavLink>
          <NavLink to="/admin#settings">Company Settings</NavLink>
        </nav>
      </aside>
      <main className="employee-main">
        <header className="employee-header">
          <div><p>Administration Portal</p><h1>Admin Dashboard</h1></div>
          <div className="employee-profile">
            <span>{userInitials(user)}</span>
            <div><strong>{name}</strong><p>{roleLabel(user?.role)}</p></div>
            <button type="button" onClick={onLogout} className="employee-logout">Log out</button>
          </div>
        </header>
        <section className="employee-welcome">
          <p>COMPANY OVERVIEW</p><h2>Welcome, {name}!</h2>
          <p>Your signed-in identity is loaded from the backend. Company-wide metrics and administration settings are not implemented as APIs yet.</p>
        </section>
        <section className="employee-summary">
          <article className="employee-card"><p>Total Users</p><h3>—</h3><span>Metrics API not implemented</span></article>
          <article className="employee-card"><p>Active Employees</p><h3>—</h3><span>Metrics API not implemented</span></article>
          <article className="employee-card"><p>System Roles</p><h3>4</h3><span>ADMIN, HR, MANAGER, EMPLOYEE</span></article>
        </section>
        <section className="employee-content">
          <article className="employee-card"><h3>User Management</h3><p>Employee management is available through the protected Employees directory. General user/role administration does not yet have an API.</p></article>
          <article className="employee-card"><h3>Company Settings</h3><p>Company-wide settings remain unavailable until a backend settings API is implemented.</p></article>
        </section>
      </main>
    </div>
  );
}

export default AdminDashboard;