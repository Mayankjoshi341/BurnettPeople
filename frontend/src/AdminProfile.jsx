import { useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { formatDate, getArrayResponse, statusLabel, useEmployees } from "./dashboardUtils";
import "./AdminPages.css";
import "./AdminProfile.css";

/* ------------------------------------------------------------------
   Real data only:
     - the signed-in user      -> the `user` prop (from GET /auth/me/)
     - your employee record    -> GET /employees/  (matched by your email, if one exists)
     - recent account activity -> GET /audit/logs/ (rows that belong to you)
   Fields your backend does not store (date of birth, gender, address, 2-factor,
   active sessions, language ...) are NOT shown, so nothing here is made up.

   Set CHANGE_PASSWORD_ENDPOINT when the backend has one (expects { old_password, new_password }).
   Until then the page points to the existing "Forgot Password" flow.
   ------------------------------------------------------------------ */
const CHANGE_PASSWORD_ENDPOINT = null;

const ROLE_LABEL = { ADMIN: "Administrator", HR: "HR", MANAGER: "Manager", EMPLOYEE: "Employee" };

function fullNameOf(user) {
  return user?.full_name || user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "Admin";
}
const initials = (name) => String(name).split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "AD";
const dash = (v) => (v === undefined || v === null || v === "" || v === "—" ? "—" : v);

function Rows({ rows }) {
  return (
    <dl className="apf-kv">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{dash(v)}</dd></div>
      ))}
    </dl>
  );
}

function PasswordBox() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ old_password: "", new_password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  async function submit(e) {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    if (form.new_password !== form.confirm) { setMsg({ type: "err", text: "The new passwords do not match." }); return; }
    setBusy(true);
    try {
      await apiClient.post(CHANGE_PASSWORD_ENDPOINT, { old_password: form.old_password, new_password: form.new_password });
      setMsg({ type: "ok", text: "Password changed." });
      setForm({ old_password: "", new_password: "", confirm: "" });
    } catch (err) {
      const fields = Object.values(err?.fieldErrors || {}).flat().join(" ");
      setMsg({ type: "err", text: fields || err?.message || "Could not change the password." });
    } finally {
      setBusy(false);
    }
  }

  if (!CHANGE_PASSWORD_ENDPOINT) {
    return (
      <p className="admin-note">
        To change your password, sign out and use <strong>Forgot Password?</strong> on the login page. A 6-digit code is emailed to you.
      </p>
    );
  }
  return (
    <>
      {!open ? (
        <button type="button" className="admin-secondary-button" onClick={() => setOpen(true)}>Change Password</button>
      ) : (
        <form className="apf-pw" onSubmit={submit}>
          {[["old_password", "Current password", "current-password"], ["new_password", "New password", "new-password"], ["confirm", "Confirm new password", "new-password"]].map(([k, label, ac]) => (
            <label key={k}>{label}
              <input type="password" autoComplete={ac} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} required />
            </label>
          ))}
          {msg.text && <div role={msg.type === "err" ? "alert" : "status"} className={msg.type === "err" ? "admin-form-error" : "admin-form-success"}>{msg.text}</div>}
          <div className="apf-pw-actions">
            <button type="button" className="admin-secondary-button" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="admin-primary-button" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
          </div>
        </form>
      )}
    </>
  );
}

export default function AdminProfile({ user }) {
  const { employees } = useEmployees();
  const [tab, setTab] = useState("personal");
  const [activity, setActivity] = useState(null);

  const name = fullNameOf(user);
  const email = user?.email || user?.official_email || "";
  const me = useMemo(
    () => employees.find((e) => email && String(e.email).toLowerCase() === email.toLowerCase()) || null,
    [employees, email],
  );

  useEffect(() => {
    let live = true;
    apiClient
      .get("/audit/logs/?page_size=100")
      .then((res) => {
        if (!live) return;
        const mine = getArrayResponse(res)
          .map((r) => ({
            id: r.id,
            at: r.at || r.timestamp || r.created_at || "",
            email: String(r.email || r.user_email || r.user?.email || "").toLowerCase(),
            action: r.action || "Activity",
            module: r.module || "",
            details: r.details || r.description || "",
          }))
          .filter((r) => email && r.email === email.toLowerCase())
          .slice(0, 5);
        setActivity(mine);
      })
      .catch(() => live && setActivity([]));
    return () => { live = false; };
  }, [email]);

  const roleText = ROLE_LABEL[String(user?.role || "").toUpperCase()] || user?.role || "Administrator";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const theme = document.documentElement.dataset.theme === "dark" ? "Dark" : "Light";

  const tabs = [["personal", "Personal Information"], ["work", "Work Information"], ["security", "Account & Security"], ["prefs", "Preferences"]];

  return (
    <div className="apf-page">
      <section className="admin-panel apf-hero">
        <span className="apf-avatar">{initials(name)}</span>
        <div className="apf-hero-main">
          <h2>{name} <span className="apf-role">{roleText}</span></h2>
          <ul>
            {email && <li><Icon name="mail" size={16} /> {email}</li>}
            {me?.phone && me.phone !== "—" && <li><Icon name="user" size={16} /> {me.phone}</li>}
            {me?.location && me.location !== "—" && <li><Icon name="building" size={16} /> {me.location}</li>}
            {me?.joined && <li><Icon name="calendar" size={16} /> Joined {formatDate(me.joined)}</li>}
          </ul>
        </div>
      </section>

      <div className="ap-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      <div className="apf-grid">
        <div className="apf-col">
          {tab === "personal" && (
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>Personal Information</h2><p>Your account details. Personal records are managed by HR.</p></div></div>
              <Rows rows={[
                ["Full name", name],
                ["Email address", email],
                ["Phone number", me?.phone],
                ["Role", roleText],
                ["Account status", user?.is_active === false ? "Inactive" : "Active"],
                ["Employee ID", me?.code],
              ]} />
            </section>
          )}

          {tab === "work" && (
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>Work Information</h2><p>Your organization and role details.</p></div></div>
              {me ? (
                <Rows rows={[
                  ["Employee ID", me.code],
                  ["Role", roleText],
                  ["Department", me.department],
                  ["Designation", me.designation],
                  ["Reporting manager", me.manager],
                  ["Work location", me.location],
                  ["Join date", me.joined ? formatDate(me.joined) : "—"],
                  ["Employment type", me.employmentType],
                  ["Employment status", statusLabel(me.status)],
                ]} />
              ) : (
                <p className="admin-note">No employee record is linked to your login email, so there are no work details to show.</p>
              )}
            </section>
          )}

          {tab === "security" && (
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>Account &amp; Security</h2><p>Manage your account security settings.</p></div></div>
              <div className="apf-sec">
                <span className="apf-sec-icon"><Icon name="lock" size={20} /></span>
                <div><strong>Password</strong>{user?.last_login && <small>Last sign-in {new Date(user.last_login).toLocaleString()}</small>}</div>
              </div>
              <PasswordBox />
            </section>
          )}

          {tab === "prefs" && (
            <section className="admin-panel">
              <div className="admin-panel-heading"><div><h2>Preferences</h2><p>How this browser shows the portal.</p></div></div>
              <Rows rows={[
                ["Theme", theme],
                ["Time zone", timeZone],
                ["Date format", new Date().toLocaleDateString()],
              ]} />
              <p className="admin-note">Use the ☾ / ☀ button at the bottom-right of the screen to switch the theme.</p>
            </section>
          )}
        </div>

        <aside className="apf-col">
          <section className="admin-panel" aria-labelledby="apf-act">
            <div className="admin-panel-heading"><div><h2 id="apf-act">Recent Activity</h2><p>Your latest account activity</p></div></div>
            {activity === null ? (
              <p className="admin-note">Loading activity…</p>
            ) : activity.length === 0 ? (
              <p className="admin-note">No activity of yours was found in the audit log.</p>
            ) : (
              <ul className="apf-feed">
                {activity.map((a) => (
                  <li key={a.id ?? a.at + a.details}>
                    <span className="apf-feed-icon"><Icon name="clock" size={16} /></span>
                    <span><strong>{a.action}{a.module ? ` · ${a.module}` : ""}</strong><small>{a.details}</small></span>
                    <time>{a.at ? new Date(a.at).toLocaleString() : ""}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}