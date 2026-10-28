import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { userDisplayName, roleLabel } from "./auth/userDisplay";
import { EMPLOYEES_ENDPOINT, activationText, getArrayResponse, getErrorMessage, normalizeEmployee, statusLabel } from "./dashboardUtils";
import { MyRecognitionSummary } from "./Leaderboard";
import "./HRProfile.css";

/* ------------------------------------------------------------------
   HR "My Profile".  No demo data: anything the API does not send shows "—".
   Props: user (logged-in user), onNavigate(sectionId) optional (task rows become clickable).

   >>> BACKEND INTEGRATION: change ONLY this block if your field / URL names differ. <<<
   ------------------------------------------------------------------ */
const PROFILE_API = {
  list: EMPLOYEES_ENDPOINT, // GET  all employees (own record is found by its `user` id, then by email)
  record: (id) => `/employees/${id}/`, // PATCH own record (personal fields + photo)
  photoField: "profile_photo", // multipart file field name for the photo (send null to remove)
  exceptions: "/attendance/exceptions/", // optional: used only for the "exceptions to review" count
};

/* Personal Information rows. read = response keys (first one found), write = key sent on save. */
const PERSONAL_FIELDS = [
  { key: "dob", label: "Date of Birth", icon: "calendar", type: "date", read: ["date_of_birth", "dob"], write: "date_of_birth" },
  { key: "gender", label: "Gender", icon: "user", type: "select", read: ["gender"], write: "gender",
    options: [["MALE", "Male"], ["FEMALE", "Female"], ["OTHER", "Other"], ["PREFER_NOT_TO_SAY", "Prefer not to say"]] },
  { key: "phone", label: "Phone Number", icon: "phone", type: "tel", read: ["phone_number", "phone"], write: "phone_number" },
  { key: "personalEmail", label: "Personal Email", icon: "mail", type: "email", read: ["personal_email"], write: "personal_email" },
  { key: "address", label: "Address", icon: "pin", type: "textarea", read: ["address", "current_address"], write: "address" },
];
const HR_READ = {
  level: ["hr_level"],
  areas: ["areas_of_responsibility", "responsibilities"],
};

const TABS = ["Personal Information", "Work Information", "HR Information", "Attendance & Schedule", "Leave Information", "My Approvals", "Settings"];

/* ---------------- helpers ---------------- */
const API_BASE = (import.meta.env?.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/+$/, "");
const urlFor = (path) => `${API_BASE}/${String(path).replace(/^\/+/, "")}`;
const mediaUrl = (v) => {
  if (!v || typeof v !== "string") return "";
  if (/^(https?:|data:|blob:)/i.test(v)) return v;
  try { return `${new URL(API_BASE).origin}${v.startsWith("/") ? "" : "/"}${v}`; } catch { return v; }
};
const pick = (raw, keys) => {
  for (const k of keys) {
    const v = raw?.[k];
    if (v !== undefined && v !== null && v !== "") return Array.isArray(v) ? v.join(", ") : String(v);
  }
  return "";
};
const clean = (v) => (v && v !== "—" ? v : "");
const humanize = (s) => String(s || "").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const dateLabel = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
};
const rawUserId = (r) => (r?.user && typeof r.user === "object" ? r.user.id : r?.user);
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthOptions = () => Array.from({ length: 12 }, (_, i) => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
  return [monthKey(d), d.toLocaleDateString("en-US", { month: "long", year: "numeric" })];
});

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function Rows({ rows }) {
  return (
    <dl className="hp-rows">
      {rows.map(([icon, label, value]) => (
        <div key={label}><dt><Icon name={icon} size={16} /> {label}</dt><dd>{value || "—"}</dd></div>
      ))}
    </dl>
  );
}

function Card({ title, action, children, className = "" }) {
  return (
    <section className={`hp-card ${className}`}>
      <div className="hp-card-head"><h3>{title}</h3>{action}</div>
      {children}
    </section>
  );
}

/* ---------------- edit personal information ---------------- */
function EditModal({ me, onClose, onSaved }) {
  const [form, setForm] = useState(() => Object.fromEntries(PERSONAL_FIELDS.map((f) => [f.key, pick(me, f.read).slice(0, f.type === "date" ? 10 : 500)])));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    if (form.personalEmail && !/^\S+@\S+\.\S+$/.test(form.personalEmail.trim())) return setError("Enter a valid personal email.");
    if (form.phone && !/^\+?[\d\s()-]{7,20}$/.test(form.phone.trim())) return setError("Enter a valid phone number.");
    setBusy(true); setError("");
    const payload = Object.fromEntries(PERSONAL_FIELDS.map((f) => [f.write, f.type === "date" ? form[f.key] || null : String(form[f.key] || "").trim()]));
    try {
      await apiClient.patch(PROFILE_API.record(me.id), payload);
      await onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save your profile."));
    } finally { setBusy(false); }
  }

  return (
    <div className="hp-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="hp-modal" role="dialog" aria-modal="true" aria-labelledby="hp-edit-title" onSubmit={submit} noValidate>
        <div className="hp-modal-head">
          <div><h2 id="hp-edit-title">Edit Personal Information</h2><p>Work and HR details are managed in Employee Management.</p></div>
          <button type="button" className="hp-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="hp-form">
          {PERSONAL_FIELDS.map((f) => (
            <label key={f.key} className={f.type === "textarea" ? "wide" : ""}>
              <span>{f.label}</span>
              {f.type === "textarea" ? <textarea rows={3} maxLength={500} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                : f.type === "select" ? (
                  <select value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                    <option value="">Select</option>{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ) : <input type={f.type} value={form[f.key]} max={f.type === "date" ? new Date().toISOString().slice(0, 10) : undefined} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
            </label>
          ))}
        </div>
        {error && <div className="hp-alert error" role="alert">{error}</div>}
        <div className="hp-modal-actions">
          <button type="button" className="hp-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="hp-btn primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}

/* ================================================================== */
export default function HRProfile({ user, onNavigate }) {
  const name = userDisplayName(user);
  const email = user?.email || user?.official_email || "";

  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pendingExceptions, setPendingExceptions] = useState(null);
  const [tab, setTab] = useState(TABS[0]);
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [editing, setEditing] = useState(false);

  const [photoFile, setPhotoFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const [photoMsg, setPhotoMsg] = useState("");
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(PROFILE_API.list);
      let items = getArrayResponse(res);
      let next = res?.next;
      for (let page = 2; next && page <= 10; page += 1) {
        const more = await apiClient.get(`${PROFILE_API.list}?page=${page}`);
        items = items.concat(getArrayResponse(more));
        next = more?.next;
      }
      setAll(items);
      setLoadError("");
    } catch (e) {
      setLoadError(getErrorMessage(e, "Could not load your employee record."));
    } finally { setLoading(false); }
    try {
      const ex = getArrayResponse(await apiClient.get(PROFILE_API.exceptions));
      setPendingExceptions(ex.filter((r) => /pending/i.test(r.status_label || r.review_status || r.status || "")).length);
    } catch { setPendingExceptions(null); }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  /* own record: by linked user id first, then by email */
  const me = useMemo(() => {
    const byUser = user?.id != null ? all.find((r) => rawUserId(r) != null && String(rawUserId(r)) === String(user.id)) : null;
    if (byUser) return byUser;
    const mail = email.toLowerCase();
    return mail ? all.find((r) => [r.official_email, r.email].some((v) => String(v || "").toLowerCase() === mail)) || null : null;
  }, [all, user?.id, email]);
  const emp = useMemo(() => (me ? normalizeEmployee(me) : null), [me]);
  const people = useMemo(() => all.map(normalizeEmployee), [all]);

  /* ---------- photo ---------- */
  const savedPhoto = mediaUrl(pick(me, [PROFILE_API.photoField, "photo", "avatar"]));
  const photo = preview || savedPhoto;

  function choosePhoto(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(f.type)) return setPhotoErr("Please choose a PNG, JPG or WebP image.");
    if (f.size > 5 * 1024 * 1024) return setPhotoErr("The image must be 5 MB or smaller.");
    setPhotoErr(""); setPhotoMsg("");
    setPhotoFile(f);
    setPreview(URL.createObjectURL(f));
  }
  function cancelPhoto() { setPhotoFile(null); setPreview(""); setPhotoErr(""); }

  async function savePhoto() {
    if (!me || !photoFile) return;
    setPhotoBusy(true); setPhotoErr(""); setPhotoMsg("");
    try {
      await apiClient.get(PROFILE_API.record(me.id)); // refreshes the session first if the token expired
      const body = new FormData();
      body.append(PROFILE_API.photoField, photoFile);
      const res = await fetch(urlFor(PROFILE_API.record(me.id)), {
        method: "PATCH",
        headers: { Accept: "application/json", Authorization: `Bearer ${apiClient.getAccessToken()}` },
        body,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const first = data && typeof data === "object" ? Object.values(data).flat()[0] : "";
        throw new Error(typeof first === "string" && first ? first : `Upload failed (${res.status}).`);
      }
      setPhotoFile(null); setPreview("");
      setPhotoMsg("Profile photo updated.");
      await load();
    } catch (e) {
      setPhotoErr(getErrorMessage(e, "Could not upload the photo."));
    } finally { setPhotoBusy(false); }
  }

  async function removePhoto() {
    if (!me) return;
    setPhotoBusy(true); setPhotoErr(""); setPhotoMsg("");
    try {
      await apiClient.patch(PROFILE_API.record(me.id), { [PROFILE_API.photoField]: null });
      setPhotoMsg("Profile photo removed.");
      await load();
    } catch (e) {
      setPhotoErr(getErrorMessage(e, "Could not remove the photo."));
    } finally { setPhotoBusy(false); }
  }

  /* ---------- derived display values ---------- */
  const designation = clean(emp?.designation);
  const department = clean(emp?.department);
  const joined = dateLabel(emp?.joined);
  const phone = pick(me, PERSONAL_FIELDS.find((f) => f.key === "phone").read);

  const personalRows = [["user", "Full Name", name], ...PERSONAL_FIELDS.map((f) => {
    const v = pick(me, f.read);
    const shown = f.type === "date" ? dateLabel(v) : f.type === "select" ? (f.options.find(([o]) => o === v)?.[1] || humanize(v)) : v;
    return [f.icon, f.label, shown];
  })];
  const workRows = [
    ["tag", "Employee ID", clean(emp?.code)], ["user", "Designation", designation], ["building", "Department", department],
    ["users", "Reporting To", clean(emp?.manager)], ["calendar", "Date of Joining", joined],
    ["clock", "Employment Type", emp?.employmentType && emp.employmentType !== "—" ? humanize(emp.employmentType) : ""],
    ["pin", "Work Location", clean(emp?.location)], ["mail", "Work Email", clean(emp?.email) || email],
  ];
  const hrRows = [
    ["shield", "Portal Role", roleLabel(clean(emp?.role) || user?.role)], ["user", "HR Level", pick(me, HR_READ.level)],
    ["list", "Areas of Responsibility", pick(me, HR_READ.areas)],
    ["clock", "Employment Status", emp ? statusLabel(emp.status) : ""], ["lock", "Account", emp ? activationText(emp.activation) : ""],
  ];

  /* ---------- real-data stats ---------- */
  const inMonth = (d) => Boolean(d) && String(d).slice(0, 7) === month;
  const num = (n) => (loading ? "…" : n);
  const stats = [
    ["users", "blue", num(people.length), "Total Employees", "All active records"],
    ["userplus", "green", num(people.filter((p) => inMonth(p.joined)).length), "New Joiners", "In selected month"],
    ["logout", "red", num(people.filter((p) => inMonth(p.exitDate)).length), "Relieving", "In selected month"],
    ["file", "purple", num(people.filter((p) => p.status === "PREBOARDING").length), "Onboarding In Progress", "Preboarding"],
  ];
  const tasks = [
    ["alert", "Attendance exceptions to review", pendingExceptions, "exceptions"],
    ["mail", "Accounts awaiting activation", loading ? null : people.filter((p) => p.hasUser && p.activation && p.activation !== "ACTIVATED").length, "employees"],
    ["alert", "Invitations that failed to deliver", loading ? null : people.filter((p) => p.activation === "DELIVERY_FAILED").length, "employees"],
    ["calendar", "Expired invitations", loading ? null : people.filter((p) => p.activation === "INVITATION_EXPIRED").length, "employees"],
    ["userplus", "Employees in preboarding", loading ? null : people.filter((p) => p.status === "PREBOARDING").length, "employees"],
  ];

  const notLinked = !loading && !loadError && !me;

  return (
    <div className="hp-page">
      <div className="hp-toolbar">
        <button type="button" className="hp-btn outline" onClick={() => setEditing(true)} disabled={!me} title={me ? "" : "Your login is not linked to an employee record"}>
          <Icon name="edit" size={15} /> Edit Profile
        </button>
      </div>

      {loadError && <div className="hp-alert error" role="alert">{loadError} <button type="button" className="hp-link" onClick={load}>Try again</button></div>}
      {notLinked && (
        <div className="hp-alert warn" role="note">
          <strong>No employee record is linked to your login.</strong> Work details are empty, and profile edits and photo cannot be saved until your account is linked to an employee record (matched by user id, or by email).
        </div>
      )}

      {/* ---------------- hero ---------------- */}
      <section className="hp-hero">
        <div className="hp-avatar-col">
          <div className="hp-avatar">
            {photo ? <img src={photo} alt={`${name} profile`} /> : <Icon name="user" size={58} />}
            <button type="button" className="hp-cam" onClick={() => fileRef.current?.click()} disabled={!me || photoBusy} aria-label="Change profile photo" title={me ? "Change profile photo" : "Link an employee record to set a photo"}>
              <CameraIcon />
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={choosePhoto} />
          {photoFile ? (
            <div className="hp-photo-actions">
              <button type="button" className="hp-btn primary sm" onClick={savePhoto} disabled={photoBusy}>{photoBusy ? "Saving…" : "Save photo"}</button>
              <button type="button" className="hp-btn sm" onClick={cancelPhoto} disabled={photoBusy}>Cancel</button>
            </div>
          ) : savedPhoto && me ? (
            <button type="button" className="hp-link" onClick={removePhoto} disabled={photoBusy}>Remove photo</button>
          ) : null}
          {photoErr && <p className="hp-photo-note error" role="alert">{photoErr}</p>}
          {photoMsg && <p className="hp-photo-note" role="status">{photoMsg}</p>}
        </div>

        <div className="hp-hero-main">
          <h2>{name} <span className="hp-verified" title="Verified"><Icon name="check" size={13} /></span></h2>
          <p className="hp-role">{designation || roleLabel(user?.role)}</p>
          <p className="hp-dept">{department ? `${department} Department` : ""}</p>
          {clean(emp?.code) && <span className="hp-code"><Icon name="tag" size={13} /> {emp.code}</span>}
        </div>

        <ul className="hp-contact">
          <li><Icon name="mail" size={16} /> {clean(emp?.email) || email || "—"}</li>
          <li><Icon name="phone" size={16} /> {phone || "—"}</li>
          <li><Icon name="pin" size={16} /> {clean(emp?.location) || "—"}</li>
          <li><Icon name="calendar" size={16} /> {joined ? `Joined on ${joined}` : "—"}</li>
        </ul>

        <blockquote className="hp-quote">
          <span aria-hidden="true">&ldquo;</span>
          People are at the heart of everything we build.
          <cite>— {name}</cite>
        </blockquote>
      </section>

      <div className="hp-tabs" role="tablist">
        {TABS.map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab !== TABS[0] ? (
        <section className="hp-card hp-soon">
          <span className="hp-soon-icon"><Icon name="gear" size={26} /></span>
          <h3>{tab}</h3>
          <p>This section will appear once its backend is connected.</p>
        </section>
      ) : (
        <>
          <div className="hp-three">
            <Card title="Personal Information" action={<button type="button" className="hp-btn outline sm" onClick={() => setEditing(true)} disabled={!me}><Icon name="edit" size={13} /> Edit</button>}>
              <Rows rows={personalRows} />
            </Card>
            <Card title="Work Information"><Rows rows={workRows} /></Card>
            <Card title="HR Information"><Rows rows={hrRows} /></Card>
          </div>

          <div className="hp-three">
            <Card title="Quick Stats" action={
              <select className="hp-select" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
                {monthOptions().map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>}>
              <div className="hp-stats">
                {stats.map(([icon, tone, value, label, note]) => (
                  <div key={label} className="hp-stat">
                    <span className={`hp-stat-icon ${tone}`}><Icon name={icon} size={20} /></span>
                    <span><b>{value}</b><strong>{label}</strong><small>{note}</small></span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="My Tasks & Approvals">
              <ul className="hp-tasks">
                {tasks.map(([icon, label, n, target]) => (
                  <li key={label}>
                    <button type="button" disabled={!onNavigate} onClick={() => onNavigate?.(target)}>
                      <span className="hp-task-icon"><Icon name={icon} size={17} /></span>
                      <span className="hp-task-label">{label}</span>
                      <span className={`hp-pill ${n ? "red" : ""}`}>{n ?? "—"}</span>
                      {onNavigate && <Icon name="chevron" size={15} />}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Recent Activity">
              <p className="hp-note">Recent activity will appear here once an activity API is connected.</p>
            </Card>
          </div>
        </>
      )}

      <MyRecognitionSummary />

      {editing && me && <EditModal me={me} onClose={() => setEditing(false)} onSaved={load} />}
    </div>
  );
}