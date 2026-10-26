import { useEffect, useState } from "react";

import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { MyAssetsPreview } from "./features/assets/EmployeeAssets";
import { dayLabel } from "./features/leave/leaveApi";
import { MyRecognitionSummary } from "./Leaderboard";
import { roleLabel, userInitials } from "./auth/userDisplay";
import { formatDate, getArrayResponse, initialsOf, normalizeEmployee, statusLabel } from "./dashboardUtils";
import softMint from "./assets/login-soft-mint.png";
import "./EmployeeMyProfile.css";

/* ------------------------------------------------------------------
   My Profile (employee dashboard)
   Real data only:
   - the signed-in user (/auth/me/, passed in as `user`)
   - this employee's row from the people directory (/employees/directory/, already used by My People)
   - attendance / schedule / leave / assets that EmployeeDashboard already loads
   Anything the API does not return is shown as "—" or the section is hidden.
   ------------------------------------------------------------------ */

const text = (v) => (typeof v === "string" ? v : v?.name || v?.title || "");
const pick = (...values) => values.map(text).find((v) => v && v !== "—") || "";
const MS_DAY = 86400000;

function useMyDirectoryEntry(user) {
  const [entry, setEntry] = useState(null);
  const email = String(user?.email || "").toLowerCase();
  const code = user?.employee_code || "";

  useEffect(() => {
    let off = false;
    apiClient
      .get("/employees/directory/")
      .then((res) => {
        if (off) return;
        const rows = getArrayResponse(res).map(normalizeEmployee);
        setEntry(rows.find((r) => (email && String(r.email).toLowerCase() === email) || (code && r.code === code)) || null);
      })
      .catch(() => { if (!off) setEntry(null); });
    return () => { off = true; };
  }, [email, code]);

  return entry;
}

function parseDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function tenureOf(joined) {
  const start = parseDate(joined);
  if (!start) return null;
  const days = Math.max(0, (Date.now() - start.getTime()) / MS_DAY);
  if (days >= 365) return { value: (days / 365.25).toFixed(1), label: "Years With Us" };
  return { value: String(Math.floor(days / 30.4)), label: "Months With Us" };
}

function nextAnniversary(joined) {
  const start = parseDate(joined);
  if (!start) return null;
  const today = new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
  if (next < midnight) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
  const days = Math.round((next - midnight) / MS_DAY);
  const years = next.getFullYear() - start.getFullYear();
  return { next, days, years };
}

function Row({ icon, label, value }) {
  const empty = !value || value === "—";
  return (
    <div className="mp-row">
      <Icon name={icon} size={16} />
      <span>{label}</span>
      <strong className={empty ? "empty" : ""}>{empty ? "—" : value}</strong>
    </div>
  );
}

export default function EmployeeMyProfile({
  user,
  name,
  hasOpenAttendance,
  attendanceStatus,
  workSchedule,
  leaveRemaining,
  leaveLoading,
  myAssets,
  onNavigate,
}) {
  const entry = useMyDirectoryEntry(user);

  const email = pick(user?.email, entry?.email);
  const code = pick(user?.employee_code, entry?.code);
  const department = pick(user?.department_name, user?.department, entry?.department);
  const designation = pick(user?.designation_name, user?.designation, entry?.designation);
  const manager = pick(entry?.manager);
  const joined = entry?.joined || "";
  const phone = pick(entry?.phone);
  const location = pick(entry?.location);
  const employmentType = pick(entry?.employmentType);
  const role = roleLabel(user?.role);

  const tenure = tenureOf(joined);
  const anniversary = nextAnniversary(joined);
  const status = entry?.status && entry.status !== "—" ? statusLabel(entry.status) : "";

  const rules = (workSchedule?.break_policy?.rules || []).filter((r) => r.is_active);

  return (
    <div className="mp-page">
      {/* ---------- hero ---------- */}
      <section className="mp-hero" style={{ backgroundImage: `url(${softMint})` }}>
        <span className="mp-avatar" aria-hidden="true">{userInitials(user) || initialsOf(name)}</span>

        <div className="mp-hero-main">
          <span className={`emp-state ${hasOpenAttendance ? "on" : ""}`}><i /> {hasOpenAttendance ? "On Work" : "Off Duty"}</span>
          <h2>{name}</h2>
          <p className="mp-title">{designation || role}</p>
          <p className="mp-sub">
            {[department, code].filter(Boolean).join("  |  ") || "Profile details are being set up by HR"}
          </p>
          <div className="mp-chips">
            <span className="mp-chip"><Icon name="shield" size={13} /> {role}</span>
            {employmentType && <span className="mp-chip"><Icon name="clock" size={13} /> {employmentType}</span>}
            {status && <span className="mp-chip ok"><Icon name="check" size={13} /> {status}</span>}
          </div>
        </div>

        <div className="mp-hero-stats" aria-label="Highlights">
          <div>
            <span className="mp-stat-icon blue"><Icon name="calendar" size={20} /></span>
            <b>{tenure ? tenure.value : "—"}</b>
            <small>{tenure ? tenure.label : "Years With Us"}</small>
          </div>
          <div>
            <span className="mp-stat-icon amber"><Icon name="plane" size={20} /></span>
            <b>{leaveLoading ? "…" : leaveRemaining === null || leaveRemaining === undefined ? "—" : dayLabel(leaveRemaining)}</b>
            <small>Leave Remaining</small>
          </div>
          <div>
            <span className="mp-stat-icon green"><Icon name="clock" size={20} /></span>
            <b>{attendanceStatus || "—"}</b>
            <small>Today</small>
          </div>
        </div>
      </section>

      <div className="mp-layout">
        {/* ---------- left column ---------- */}
        <div className="mp-col">
          <div className="mp-two">
            <section className="admin-panel" aria-labelledby="mp-basic">
              <div className="admin-panel-heading"><div><h2 id="mp-basic">Basic Information</h2></div></div>
              <Row icon="user" label="Full Name" value={name} />
              <Row icon="file" label="Employee ID" value={code} />
              <Row icon="calendar" label="Date of Joining" value={joined ? formatDate(joined) : ""} />
              <Row icon="clock" label="Employment Type" value={employmentType} />
              <Row icon="pin" label="Work Location" value={location} />
              <Row icon="users" label="Reporting Manager" value={manager} />
              <Row icon="building" label="Department" value={department} />
              <Row icon="tag" label="Designation" value={designation} />
              <Row icon="shield" label="Role" value={role} />
            </section>

            <section className="admin-panel" aria-labelledby="mp-contact">
              <div className="admin-panel-heading"><div><h2 id="mp-contact">Contact Information</h2></div></div>
              <Row icon="mail" label="Work Email" value={email} />
              <Row icon="phone" label="Work Phone" value={phone} />
              <Row icon="pin" label="Office Location" value={location} />
              {email && (
                <a className="mp-mail" href={`mailto:${email}`}><Icon name="mail" size={15} /> Email me</a>
              )}
            </section>
          </div>

          {anniversary && (
            <section className="admin-panel" aria-labelledby="mp-dates">
              <div className="admin-panel-heading"><div><h2 id="mp-dates">Work Anniversary &amp; Important Dates</h2></div></div>
              <div className="mp-dates">
                <div className="mp-date green">
                  <span className="mp-date-icon"><Icon name="calendar" size={20} /></span>
                  <span>
                    <small>Work Anniversary</small>
                    <b>{anniversary.next.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</b>
                    <em>{anniversary.days === 0 ? "Today" : `In ${anniversary.days} ${anniversary.days === 1 ? "day" : "days"}`} · {anniversary.years} {anniversary.years === 1 ? "year" : "years"}</em>
                  </span>
                </div>
                <div className="mp-date amber">
                  <span className="mp-date-icon"><Icon name="gift" size={20} /></span>
                  <span>
                    <small>Joined BurnettPeople</small>
                    <b>{formatDate(joined)}</b>
                    <em>{tenure ? `${tenure.value} ${tenure.label.replace(" With Us", "").toLowerCase()}` : ""}</em>
                  </span>
                </div>
              </div>
            </section>
          )}

          <section className="admin-panel mp-recognition" aria-label="Recognition">
            <MyRecognitionSummary />
          </section>
        </div>

        {/* ---------- right column ---------- */}
        <div className="mp-col">
          <section className="admin-panel" aria-labelledby="mp-sched">
            <div className="admin-panel-heading">
              <div><h2 id="mp-sched">Work Schedule</h2></div>
              <button type="button" className="admin-link-button" onClick={() => onNavigate("attendance")}>View full schedule <Icon name="arrow" size={13} /></button>
            </div>
            {workSchedule ? (
              <>
                <div className="emp-info-row"><span className="emp-info-icon"><Icon name="clock" size={18} /></span><span><strong>Work Hours</strong><small>{workSchedule.start_time?.slice(0, 5) || "—"} – {workSchedule.end_time?.slice(0, 5) || "—"}</small></span></div>
                <div className="emp-info-row"><span className="emp-info-icon tone-green"><Icon name="calendar" size={18} /></span><span><strong>Work Days</strong><small>{(workSchedule.workdays || []).join(", ") || "—"}</small></span></div>
                {workSchedule.timezone && <div className="emp-info-row"><span className="emp-info-icon tone-orange"><Icon name="pin" size={18} /></span><span><strong>Time Zone</strong><small>{workSchedule.timezone}</small></span></div>}
                {rules.length > 0 && (
                  <div className="emp-info-row"><span className="emp-info-icon tone-blue"><Icon name="coffee" size={18} /></span>
                    <span><strong>Break Policy</strong><small>{rules.map((r) => `${r.duration_minutes}m`).join(" + ")}</small></span></div>
                )}
              </>
            ) : (
              <p className="admin-note">No schedule assigned yet. Contact HR if you need your shift confirmed.</p>
            )}
          </section>

          <section className="admin-panel" aria-labelledby="mp-manager">
            <div className="admin-panel-heading"><div><h2 id="mp-manager">Manager</h2></div></div>
            {manager ? (
              <div className="mp-manager">
                <span className="mp-mini-avatar">{initialsOf(manager)}</span>
                <span><strong>{manager}</strong><small>Reporting Manager</small></span>
              </div>
            ) : (
              <p className="admin-note">No reporting manager is recorded yet.</p>
            )}
          </section>

          <section className="admin-panel" aria-labelledby="mp-assets">
            <div className="admin-panel-heading">
              <div><h2 id="mp-assets">My Assets</h2></div>
              <button type="button" className="admin-link-button" onClick={() => onNavigate("assets")}>View all <Icon name="arrow" size={13} /></button>
            </div>
            <MyAssetsPreview assets={myAssets} />
          </section>

          <section className="admin-panel" aria-labelledby="mp-links">
            <div className="admin-panel-heading"><div><h2 id="mp-links">Quick Links</h2></div></div>
            <div className="mp-links">
              <button type="button" className="green" onClick={() => onNavigate("attendance")}><Icon name="clock" size={18} /> My Attendance</button>
              <button type="button" className="orange" onClick={() => onNavigate("leave")}><Icon name="plane" size={18} /> Apply Leave</button>
              <button type="button" className="blue" onClick={() => onNavigate("assets")}><Icon name="laptop" size={18} /> My Assets</button>
              <button type="button" className="purple" onClick={() => onNavigate("requests")}><Icon name="file" size={18} /> My Requests</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}