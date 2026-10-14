import { NavLink } from "react-router-dom";
import "./HRDashboard.css";

function HRDashboard() {
  return (
    <div className="employee-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>

        
        <nav>
          <NavLink to="/hr" end>
            Dashboard
          </NavLink>
          <NavLink to="/employees">Employees</NavLink>
          <NavLink to="/hr#attendance">Attendance</NavLink>
          <NavLink to="/hr#leaves">Leave Requests</NavLink>
          <NavLink to="/hr#profile">My Profile</NavLink>
        </nav>

      </aside>

      <main className="employee-main">
        <header className="employee-header">
          <div>
            <p>HR Portal</p>
            <h1>HR Dashboard</h1>
          </div>

          <div className="employee-profile">
            <span>HR</span>
            <div>
              <strong>HR Administrator</strong>
              <p>Human Resources</p>
            </div>
          </div>
        </header>

        <section className="employee-welcome">
          <p>HR OVERVIEW</p>
          <h2>Welcome to HR Portal!</h2>
          <p>Manage employees, attendance, and leave requests from one place.</p>
        </section>

        <section className="employee-summary">
          <article className="employee-card">
            <p>Total Employees</p>
            <h3>--</h3>
            <span>Demo data pending</span>
          </article>

          <article className="employee-card">
            <p>Present Today</p>
            <h3>--</h3>
            <span>Demo data pending</span>
          </article>

          <article className="employee-card">
            <p>Pending Leave Requests</p>
            <h3>--</h3>
            <span>Demo data pending</span>
          </article>
        </section>

        <section className="employee-content">
          <article className="employee-card">
            <h3>Employee Management</h3>
            <p>Employee directory and onboarding will appear here.</p>
          </article>

          <article className="employee-card">
            <h3>Leave Requests</h3>
            <p>Review and manage leave requests here.</p>
          </article>
        </section>
      </main>
    </div>
  );
}

export default HRDashboard;