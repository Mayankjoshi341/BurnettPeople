
import "./AdminDashboard.css";

function AdminDashboard() {
  return (
    <div className="employee-dashboard">
      <aside className="employee-sidebar">
        <h2>BurnettPeople</h2>

        <nav>
          <a href="#dashboard" className="active">Dashboard</a>
          <a href="#users">User Management</a>
          <a href="#employees">Employees</a>
          <a href="#roles">Roles & Permissions</a>
          <a href="#settings">Company Settings</a>
        </nav>
      </aside>

      <main className="employee-main">
        <header className="employee-header">
          <div>
            <p>Administration Portal</p>
            <h1>Admin Dashboard</h1>
          </div>

          <div className="employee-profile">
            <span>AD</span>
            <div>
              <strong>System Administrator</strong>
              <p>Admin</p>
            </div>
          </div>
        </header>

        <section className="employee-welcome">
          <p>COMPANY OVERVIEW</p>
          <h2>Welcome to BurnettPeople!</h2>
          <p>
            Manage users, roles, and company-wide HR settings from one place.
          </p>
        </section>

        <section className="employee-summary">
          <article className="employee-card">
            <p>Total Users</p>
            <h3>--</h3>
            <span>Demo data pending</span>
          </article>

          <article className="employee-card">
            <p>Active Employees</p>
            <h3>--</h3>
            <span>Demo data pending</span>
          </article>

          <article className="employee-card">
            <p>System Roles</p>
            <h3>4</h3>
            <span>Admin, HR, Manager, Employee</span>
          </article>
        </section>

        <section className="employee-content">
          <article className="employee-card">
            <h3>User Management</h3>
            <p>
              User directory, account status, and role assignment UI will
              appear here.
            </p>
          </article>

          <article className="employee-card">
            <h3>Company Settings</h3>
            <p>
              Organization-wide configuration and HR settings will appear here.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}

export default AdminDashboard;