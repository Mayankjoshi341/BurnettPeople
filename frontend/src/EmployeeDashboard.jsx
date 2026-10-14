import { NavLink } from "react-router-dom";
import "./EmployeeDashboard.css";

function EmployeeDashboard({ onLogout }) {
  return (
    <div className="employee-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>

        
        <nav>
          <NavLink to="/employee" end>
            Dashboard
          </NavLink>
          <NavLink to="/employee#attendance">My Attendance</NavLink>
          <NavLink to="/employee#leaves">Leave Management</NavLink>
          <NavLink to="/employee#profile">My Profile</NavLink>
        </nav>

      </aside>

      <main className="employee-main">
        <header className="employee-header">
          <div>
            <p>Employee Portal</p>
            <h1>My Dashboard</h1>
          </div>

          
          <div className="employee-profile">
            <span>JD</span>
            <div>
                <strong>John Doe</strong>
                <p>Employee</p>
            </div>

            <button
                type="button"
                onClick={onLogout}
                className="employee-logout"
            >
                Log out
            </button>
          </div>
        </header>

        <section className="employee-welcome">
          <p>WELCOME BACK</p>
          <h2>Hello, John!</h2>
          <p>
            Here's an overview of your attendance and leave activity.
          </p>
        </section>

        <section className="employee-summary">
          <article className="employee-card">
            <p>Today's Attendance</p>
            <h3>Not Checked In</h3>
            <span>Demo status</span>
          </article>

          <article className="employee-card">
            <p>Days Present</p>
            <h3>18 Days</h3>
            <span>This month · Demo data</span>
          </article>

          <article className="employee-card">
            <p>Leave Balance</p>
            <h3>12 Days</h3>
            <span>Demo balance</span>
          </article>
        </section>

        <section className="employee-content">
          <article className="employee-card">
            <h3>Attendance Overview</h3>
            <p>Your attendance summary will appear here.</p>
          </article>

          <article className="employee-card">
            <h3>My Leave Requests</h3>
            <p>Your leave requests and their status will appear here.</p>
          </article>
        </section>
      </main>
    </div>
  );
}

export default EmployeeDashboard;