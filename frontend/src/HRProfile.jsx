import { useMemo, useState } from "react";
import { Icon } from "./DashboardIcons";
import { NotConnected } from "./DashboardParts";
import { userDisplayName, userInitials, roleLabel } from "./auth/userDisplay";
import {
  SHOW_DEMO_DATA,
  activationText,
  formatDate,
  statusLabel,
  useEmployees,
} from "./dashboardUtils";
import "./HRPages.css";

const TABS = [
  "Personal Information", "Work Information", "HR Information",
  "Attendance & Schedule", "Leave Information", "My Approvals", "Settings",
];

const DEMO_ACTIVITY = [
  ["check", "Approved leave request", "Rahul Jain · 2 hours ago"],
  ["user", "Added new employee", "Neha Gupta · 4 hours ago"],
  ["laptop", "Assigned device", "Laptop to Karan Mehta · 1 day ago"],
  ["file", "Updated employee records", "Ananya Singh · 1 day ago"],
];

function KV({ rows }) {
  return (
    <dl className="hrp-kv">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>
      ))}
    </dl>
  );
}

export default function HRProfile({ user }) {
  const { employees } = useEmployees();
  const [tab, setTab] = useState(TABS[0]);

  const name = userDisplayName(user);
  const email = user?.email || user?.official_email || "";
  // Your own employee record (matched by email), if you have one.
  const me = useMemo(
    () => employees.find((e) => email && e.email.toLowerCase() === email.toLowerCase()) || null,
    [employees, email],
  );

  const now = new Date();
  const count = (fn) => employees.filter(fn).length;
  const joinedThisMonth = count((e) => {
    if (!e.joined) return false;
    const d = new Date(`${e.joined}T00:00:00`);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const pendingActivation = count((e) => e.hasUser && e.activation && e.activation !== "ACTIVATED");
  const failed = count((e) => e.activation === "DELIVERY_FAILED");
  const expired = count((e) => e.activation === "INVITATION_EXPIRED");
  const preboarding = count((e) => e.status === "PREBOARDING");
  const notice = count((e) => e.status === "NOTICE_PERIOD");

  const quickStats = [
    ["users", "blue", employees.length, "Total Employees"],
    ["userplus", "green", joinedThisMonth, "New Joiners This Month"],
    ["alert", "amber", pendingActivation, "Pending Account Activations"],
    ["file", "blue", preboarding, "In Preboarding"],
    ["plane", "red", notice, "On Notice Period"],
  ];

  const tasks = [
    ["mail", "Accounts awaiting activation", pendingActivation],
    ["alert", "Invitations that failed to deliver", failed],
    ["calendar", "Expired invitations", expired],
    ["userplus", "Employees in preboarding", preboarding],
  ];

  const person = me
    ? {
        title: me.designation,
        dept: me.department,
        code: me.code,
        phone: me.phone,
        joined: me.joined ? formatDate(me.joined) : "",
        location: me.location,
        manager: me.manager,
        type: me.employmentType,
        status: statusLabel(me.status),
        activation: activationText(me.activation),
        role: me.role,
      }
    : {};

  return (
    <div className="hrp-page">
      <section className="hrp-hero">
        <span className="hrp-hero-avatar">{userInitials(user)}</span>
        <div className="hrp-hero-main">
          <h2>{name} <Icon name="check" size={18} /></h2>
          <p className="hrp-hero-role">{person.title || roleLabel(user?.role)}</p>
          <p className="hrp-hero-dept">{person.dept ? `${person.dept} Department` : "—"}</p>
          {person.code && <span className="hrp-code">{person.code}</span>}
        </div>
        <ul className="hrp-hero-contact">
          <li><Icon name="mail" size={16} /> {email || "—"}</li>
          <li><Icon name="user" size={16} /> {person.phone || "—"}</li>
          <li><Icon name="building" size={16} /> {person.location || "—"}</li>
          <li><Icon name="calendar" size={16} /> {person.joined ? `Joined on ${person.joined}` : "—"}</li>
        </ul>
        <blockquote className="hrp-quote">
          &ldquo;People are at the heart of everything we build.&rdquo;
          <cite>— {name}</cite>
        </blockquote>
      </section>

      {!me && employees.length > 0 && (
        <NotConnected
          title="No employee record is linked to your login email."
          text="Work details below are empty because no employee record matches your account email."
        />
      )}

      <div className="hrp-tabbar" role="tablist">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab !== "Personal Information" ? (
        <section className="admin-panel admin-settings-placeholder">
          <span className="admin-settings-icon"><Icon name="gear" size={26} /></span>
          <h2>{tab}</h2>
          <p>This section will appear once its backend is connected.</p>
        </section>
      ) : (
        <>
          <div className="hrp-three">
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>Personal Information</h2></div></div>
              <KV rows={[["Full Name", name], ["Work Email", email], ["Phone Number", person.phone]]} />
            </section>
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>Work Information</h2></div></div>
              <KV rows={[
                ["Employee ID", person.code], ["Designation", person.title], ["Department", person.dept],
                ["Reporting To", person.manager], ["Date of Joining", person.joined],
                ["Employment Type", person.type], ["Work Location", person.location],
              ]} />
            </section>
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>HR Information</h2></div></div>
              <KV rows={[
                ["Portal Role", person.role || roleLabel(user?.role)],
                ["Employment Status", person.status],
                ["Account", person.activation],
              ]} />
            </section>
          </div>

          <div className="hrp-three">
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>Quick Stats</h2></div></div>
              <div className="hrp-quick">
                {quickStats.map(([icon, tone, value, label]) => (
                  <div key={label} className="hrp-quick-item">
                    <span className={`admin-stat-icon ${tone}`}><Icon name={icon} size={20} /></span>
                    <span><strong>{value}</strong><small>{label}</small></span>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>My Tasks &amp; Approvals</h2></div></div>
              <div className="admin-attention-list">
                {tasks.map(([icon, label, n]) => (
                  <div className="admin-attention-item" key={label}>
                    <span className="admin-attention-icon tone-blue"><Icon name={icon} size={18} /></span>
                    <span className="admin-attention-copy"><strong>{label}</strong></span>
                    <span className={`admin-count-pill ${n ? "tone-red" : "tone-blue"}`}>{n}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>Recent Activity</h2>{SHOW_DEMO_DATA && <p>Sample data</p>}</div></div>
              {SHOW_DEMO_DATA ? (
                DEMO_ACTIVITY.map(([icon, title, sub]) => (
                  <div className="emp-info-row" key={title}>
                    <span className="emp-info-icon"><Icon name={icon} size={18} /></span>
                    <span><strong>{title}</strong><small>{sub}</small></span>
                  </div>
                ))
              ) : (
                <p className="admin-note">Recent activity will appear once an activity API is connected.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
