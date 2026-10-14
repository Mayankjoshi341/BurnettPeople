import "./ManagerDashboard.css";

function ManagerDashboard() {
  return (
    <div className="employee-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>

        <nav>
          <a href="#dashboard" className="active">Dashboard</a>
          <a href="#team">My Team</a>
          <a href="#attendance">Team Attendance</a>
          <a href="#leaves">Leave Reviews</a>
          <a href="#profile">My Profile</a>
        </nav>
      </aside>

      <main className="employee-main">
        <header className="employee-header">
          <div>
            <p>Manager Portal</p>
            <h1>Team Dashboard</h1>
          </div>

          <div className="employee-profile">
            <span>TL</span>
            <div>
              <strong>Team Lead</strong>
              <p>Manager</p>
            </div>
          </div>
        </header>

        <section className="employee-welcome">
          <p>TEAM OVERVIEW</p>
          <h2>Welcome, Team Lead!</h2>
          <p>Review your team's attendance and leave requests in one place.</p>
        </section>

        <section className="employee-summary">
          <article className="employee-card">
            <p>Team Members</p>
            <h3>--</h3>
            <span>Demo data pending</span>
          </article>

          <article className="employee-card">
            <p>Present Today</p>
            <h3>--</h3>
            <span>Demo data pending</span>
          </article>

          <article className="employee-card">
            <p>Leave Reviews</p>
            <h3>--</h3>
            <span>Awaiting review · Demo data</span>
          </article>
        </section>

        <section className="employee-content">
          <article className="employee-card">
            <h3>Team Attendance</h3>
            <p>Your team attendance summary will appear here.</p>
          </article>

          <article className="employee-card">
            <h3>Leave Requests to Review</h3>
            <p>
              Review requests and add recommendations for HR's final decision.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}

export default ManagerDashboard;