import { useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";

import { Icon } from "./DashboardIcons";
import { StatCard } from "./DashboardParts";
import {
  AVATAR_TONES,
  getArrayResponse,
  initialsOf,
  normalizeEmployee,
  statusLabel,
  statusTone,
} from "./dashboardUtils";
import "./MyPeople.css";

const PAGE_SIZE = 12;
const MS_DAY = 86400000;

/* ------------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------------ */
const uniqueValues = (list) => [...new Set(list.filter((v) => v && v !== "—"))].sort();
const roleLabel = (role) =>
  ({ ADMIN: "Admin", HR: "HR", MANAGER: "Manager", EMPLOYEE: "Employee" }[role] || role);
const toneFor = (name = "") =>
  [...String(name)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % AVATAR_TONES.length;

function parseDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLong(value) {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function tenureText(joined, today) {
  const date = parseDate(joined);
  if (!date || date > today) return "—";
  let months =
    (today.getFullYear() - date.getFullYear()) * 12 + today.getMonth() - date.getMonth();
  if (today.getDate() < date.getDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} yr${years > 1 ? "s" : ""}`);
  if (rest) parts.push(`${rest} mo`);
  return parts.length ? parts.join(" ") : "Under a month";
}

const percentOf = (part, total) =>
  Number.isFinite(Number(part)) && Number(total) > 0
    ? `${Math.round((Number(part) / Number(total)) * 100)}% of total`
    : null;

/* Work anniversaries (from the joining date) and, when the directory provides
   a `birthday` (YYYY-MM-DD) field, birthdays too. Nothing is invented. */
function buildEvents(employees, today) {
  const events = [];
  employees.forEach((person) => {
    if (person.status === "EXITED") return;
    [
      ["anniversary", person.joined],
      ["birthday", person.birthday],
    ].forEach(([type, value]) => {
      const origin = parseDate(value);
      if (!origin) return;
      const at = (year) => new Date(year, origin.getMonth(), origin.getDate());
      let next = at(today.getFullYear());
      if (next < today) next = at(today.getFullYear() + 1);
      const thisYear = at(today.getFullYear());
      const entry = (date) => ({
        key: `${type}-${person.id}`,
        type,
        person,
        date,
        years: date.getFullYear() - origin.getFullYear(),
        days: Math.round((date - today) / MS_DAY),
      });
      const upcoming = entry(next);
      const current = entry(thisYear);
      if (type === "anniversary" && upcoming.years < 1) return;
      events.push({
        ...upcoming,
        upcoming: upcoming.days <= 30,
        thisMonth: thisYear.getMonth() === today.getMonth() && current.years >= (type === "anniversary" ? 1 : 0),
        current,
      });
    });
  });
  return events;
}

function whenText(days) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `in ${days} days`;
  return `${Math.abs(days)} day${days === -1 ? "" : "s"} ago`;
}

/* ------------------------------------------------------------------
   Pieces
   ------------------------------------------------------------------ */
function Avatar({ name, size = 56, photo }) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      className="people-avatar"
      style={{ width: size, height: size, fontSize: size * 0.34, background: AVATAR_TONES[toneFor(name)] }}
    >
      {photo && !broken ? <img src={photo} alt="" onError={() => setBroken(true)} /> : initialsOf(name)}
    </span>
  );
}

function StatusChip({ status }) {
  return (
    <span className={`people-chip tone-${statusTone(status)}`}>
      <i /> {statusLabel(status)}
    </span>
  );
}

function Pager({ page, pages, onPage }) {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4, 5].forEach((n) => wanted.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3, pages - 4].forEach((n) => wanted.add(n));
  const numbers = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const items = [];
  numbers.forEach((n, i) => {
    if (i && n - numbers[i - 1] > 1) items.push("…");
    items.push(n);
  });

  return (
    <div className="people-pager-buttons">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page">
        <Icon name="chevleft" size={14} />
      </button>
      {items.map((n, i) =>
        n === "…" ? (
          <span key={`gap${i}`} className="people-gap">…</span>
        ) : (
          <button
            key={n}
            type="button"
            className={n === page ? "on" : ""}
            aria-current={n === page ? "page" : undefined}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ),
      )}
      <button type="button" onClick={() => onPage(page + 1)} disabled={page === pages} aria-label="Next page">
        <Icon name="chevron" size={14} />
      </button>
    </div>
  );
}

function InfoTile({ icon, label, value, wide = false }) {
  return (
    <div className={`people-info${wide ? " wide" : ""}`}>
      <span className="people-info-icon"><Icon name={icon} size={17} /></span>
      <span>
        <small>{label}</small>
        <strong>{value || "—"}</strong>
      </span>
    </div>
  );
}

function PersonModal({ person, directReports, today, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="admin-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal people-modal" role="dialog" aria-modal="true" aria-labelledby="person-title">
        <button type="button" className="admin-modal-close people-modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={16} />
        </button>

        <div className="people-modal-head">
          <Avatar name={person.name} size={92} photo={person.photo} />
          <div className="people-modal-id">
            <StatusChip status={person.status} />
            <h2 id="person-title">{person.name}</h2>
            <p className="people-modal-role">
              <span>{person.designation}</span>
              {person.code !== "—" && <b className="people-code">{person.code}</b>}
            </p>
            {person.department !== "—" && (
              <p className="people-modal-dept"><Icon name="building" size={14} /> {person.department}</p>
            )}
            {person.manager !== "—" && (
              <div className="people-reports">
                <Avatar name={person.manager} size={30} />
                <span>
                  <small>Reports to</small>
                  <strong>{person.manager}</strong>
                </span>
              </div>
            )}
          </div>
          {person.email !== "—" && (
            <a className="admin-primary-button people-link" href={`mailto:${person.email}`}>
              <Icon name="mail" size={16} /> Send email
            </a>
          )}
        </div>

        <div className="people-modal-body">
          <div className="people-info-grid">
            <InfoTile icon="calendar" label="Date of joining" value={formatLong(person.joined)} />
            <InfoTile icon="laptop" label="Employment type" value={person.employmentType} />
            <InfoTile icon="pin" label="Work location" value={person.location} />
            <InfoTile icon="user" label="Portal role" value={roleLabel(person.role)} />
            <InfoTile icon="mail" label="Email" value={person.email} wide />
            <InfoTile icon="phone" label="Phone" value={person.phone} wide />
          </div>

          <aside className="people-modal-side" aria-label="Quick facts">
            <div className="people-fact">
              <span className="people-info-icon"><Icon name="clock" size={18} /></span>
              <span>
                <small>Time with company</small>
                <strong>{tenureText(person.joined, today)}</strong>
              </span>
            </div>
            <div className="people-fact">
              <span className="people-info-icon"><Icon name="users" size={18} /></span>
              <span>
                <small>Team members</small>
                <strong>{directReports}</strong>
                <em>Direct reports</em>
              </span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Page
   `myEmployeeId` is optional: pass the signed-in user's employee id to
   show the "My Team" tab (people who report to them).
   ------------------------------------------------------------------ */
export default function MyPeople({
  canAdd = false,
  onAdd,
  onLeaderboard,
  onRemoteWork,
  onLeave,
  myEmployeeId = null,
}) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState("");
  const [overviewError, setOverviewError] = useState("");
  const [leaderboardError, setLeaderboardError] = useState("");
  const [overview, setOverview] = useState(null);
  const [leaderboardRows, setLeaderboardRows] = useState([]);

  const reload = async () => {
    setLoading(true);
    const [directory, summary, board] = await Promise.allSettled([
      apiClient.get("/employees/directory/"),
      apiClient.get("/employees/directory/overview/"),
      apiClient.get("/recognition/leaderboard/?period=week&page_size=5"),
    ]);
    if (directory.status === "fulfilled") {
      setEmployees(getArrayResponse(directory.value).map(normalizeEmployee));
      setDirectoryError("");
    } else {
      setEmployees([]);
      setDirectoryError(directory.reason?.message || "Could not load the people directory.");
    }
    if (summary.status === "fulfilled") {
      setOverview(summary.value);
      setOverviewError("");
    } else {
      setOverview(null);
      setOverviewError(summary.reason?.message || "People summary is unavailable.");
    }
    if (board.status === "fulfilled") {
      setLeaderboardRows(board.value?.results?.results || []);
      setLeaderboardError("");
    } else {
      setLeaderboardRows([]);
      setLeaderboardError(board.reason?.message || "Leaderboard preview is unavailable.");
    }
    setLoading(false);
  };
  useEffect(() => { void Promise.resolve().then(reload); }, []);

  const [tab, setTab] = useState("all");
  const [view, setView] = useState("grid");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [role, setRole] = useState("ALL");
  const [workLocation, setWorkLocation] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [newJoinersOnly, setNewJoinersOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [celebrationTab, setCelebrationTab] = useState("upcoming");

  const today = useMemo(startOfToday, []);
  const hasTeamTab = myEmployeeId !== null && myEmployeeId !== undefined && myEmployeeId !== "";

  const departments = useMemo(() => uniqueValues(employees.map((e) => e.department)), [employees]);
  const roles = useMemo(() => uniqueValues(employees.map((e) => e.role)), [employees]);
  const locations = useMemo(() => uniqueValues(employees.map((e) => e.location)), [employees]);
  const statuses = useMemo(() => uniqueValues(employees.map((e) => e.status)), [employees]);

  const deptCounts = useMemo(() => {
    const counts = {};
    employees.forEach((e) => {
      if (e.department !== "—") counts[e.department] = (counts[e.department] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    return employees.filter(
      (e) =>
        (!newJoinersOnly || (e.status === "ACTIVE" && e.joined?.slice(0, 7) === currentMonth)) &&
        (department === "ALL" || e.department === department) &&
        (role === "ALL" || e.role === role) &&
        (workLocation === "ALL" || e.location === workLocation) &&
        (status === "ALL" || e.status === status) &&
        (!q || [e.name, e.code, e.email, e.department, e.designation].some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [employees, query, department, role, workLocation, status, newJoinersOnly, today]);

  const scoped = useMemo(
    () => (tab === "team" ? filtered.filter((e) => String(e.managerId) === String(myEmployeeId)) : filtered),
    [filtered, tab, myEmployeeId],
  );

  const pages = Math.max(1, Math.ceil(scoped.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = scoped.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = scoped.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(scoped.length, safePage * PAGE_SIZE);

  const clear = () => {
    setQuery("");
    setDepartment("ALL");
    setRole("ALL");
    setWorkLocation("ALL");
    setStatus("ALL");
    setNewJoinersOnly(false);
    setPage(1);
  };

  const changeTab = (id) => { setTab(id); setPage(1); };

  /* "By Department" and "By Location" tabs group the same filtered list */
  const groupKey = tab === "location" ? "location" : "department";
  const groups = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      const key = e[groupKey] && e[groupKey] !== "—" ? e[groupKey] : "Not specified";
      (map[key] = map[key] || []).push(e);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupKey]);

  /* Anniversaries / birthdays */
  const events = useMemo(() => buildEvents(employees, today), [employees, today]);
  const hasBirthdays = employees.some((e) => e.birthday);
  const upcomingEvents = useMemo(
    () => events.filter((ev) => ev.upcoming).sort((a, b) => a.days - b.days || a.person.name.localeCompare(b.person.name)),
    [events],
  );
  const monthEvents = useMemo(
    () => events.filter((ev) => ev.thisMonth).sort((a, b) => a.current.date - b.current.date || a.person.name.localeCompare(b.person.name)),
    [events],
  );
  const shownEvents = celebrationTab === "upcoming" ? upcomingEvents : monthEvents;

  const directReportsOf = (person) =>
    employees.filter((e) => e.managerId !== null && e.managerId !== undefined && String(e.managerId) === String(person.id)).length;

  const renderCard = (e) => (
    <article
      key={e.id}
      className={`people-card ${view === "list" ? "list" : ""}${selected?.id === e.id ? " selected" : ""}`}
    >
      <button type="button" className="people-card-main" onClick={() => setSelected(e)}>
        <Avatar name={e.name} size={view === "list" ? 46 : 60} photo={e.photo} />
        <span className="people-card-copy">
          <strong>{e.name}</strong>
          <small>{e.designation}</small>
          <small>{e.department}</small>
          {view === "list" && e.location !== "—" && (
            <small className="people-loc"><Icon name="pin" size={11} /> {e.location}</small>
          )}
        </span>
      </button>
      <div className="people-card-foot">
        <StatusChip status={e.status} />
        <span className="people-card-actions">
          {e.email !== "—" && (
            <a href={`mailto:${e.email}`} aria-label={`Email ${e.name}`} title="Send email">
              <Icon name="mail" size={15} />
            </a>
          )}
          {e.phone !== "—" && (
            <a href={`tel:${e.phone}`} aria-label={`Call ${e.name}`} title="Call">
              <Icon name="phone" size={15} />
            </a>
          )}
        </span>
      </div>
    </article>
  );

  const TABS = [
    ["all", "All People"],
    ...(hasTeamTab ? [["team", "My Team"]] : []),
    ["dept", "By Department"],
    ["location", "By Location"],
  ];

  const total = overview?.total_employees ?? (directoryError ? null : employees.length);

  return (
    <div className="people-page">
      <section className="admin-summary-grid" aria-label="People summary">
        <StatCard
          icon="users" tone="green" label="Total Employees"
          value={overview?.total_employees ?? (directoryError ? "—" : employees.length)}
          note={loading ? "Loading…" : "Active employee records"}
        />
        <StatCard
          icon="building" tone="blue" label="Departments"
          value={overview?.departments ?? (directoryError ? "—" : departments.length)}
          note="Across the company"
        />
        <StatCard
          icon="userplus" tone="green" label="New Joiners"
          value={overview?.new_joiners_this_month ?? "—"}
          note={newJoinersOnly ? "Showing this month" : "Joined this month · view"}
          onClick={() => { setNewJoinersOnly(true); setTab("all"); setPage(1); setQuery(""); }}
        />
        <StatCard
          icon="home" tone="green" label="Work From Home Today"
          value={overview?.work_from_home_today ?? "—"}
          note={
            overviewError ||
            (overview?.work_from_home_available
              ? percentOf(overview?.work_from_home_today, total) || "Approved remote work"
              : "Remote work is not tracked yet")
          }
          onClick={onRemoteWork}
        />
        <StatCard
          icon="plane" tone="blue" label="On Leave Today"
          value={overview?.on_leave_today ?? "—"}
          note={percentOf(overview?.on_leave_today, total) || "Approved leave today"}
          onClick={onLeave}
        />
      </section>

      {directoryError && <div role="alert" className="admin-form-error">{directoryError}</div>}

      <div className="people-layout">
        <section className="admin-panel people-main" aria-label="People directory">
          <div className="people-toolbar">
            <div className="people-tabs" role="tablist">
              <span className="people-tabs-icon" aria-hidden="true"><Icon name="user" size={17} /></span>
              {TABS.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => changeTab(id)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="people-toolbar-right">
              <div className="people-view-toggle">
                <button type="button" className={view === "grid" ? "on" : ""} onClick={() => setView("grid")} aria-label="Grid view" aria-pressed={view === "grid"}>
                  <Icon name="grid" size={16} />
                </button>
                <button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")} aria-label="List view" aria-pressed={view === "list"}>
                  <Icon name="list" size={16} />
                </button>
              </div>
              {canAdd && onAdd && (
                <button type="button" className="admin-primary-button" onClick={onAdd}>
                  <Icon name="plus" size={16} /> Add Employee
                </button>
              )}
            </div>
          </div>

          <div className="people-filters">
            <label className="people-search">
              <Icon name="search" size={16} />
              <input
                type="search"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                placeholder="Search employees..."
                aria-label="Search employees"
              />
            </label>
            <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} aria-label="Department">
              <option value="ALL">Department</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            {roles.length > 0 && (
              <select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role">
                <option value="ALL">Role</option>
                {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            )}
            {locations.length > 0 && (
              <select value={workLocation} onChange={(e) => { setWorkLocation(e.target.value); setPage(1); }} aria-label="Location">
                <option value="ALL">Location</option>
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
              <option value="ALL">Status</option>
              {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
            <button type="button" className="admin-link-button" onClick={clear}>Clear</button>
            <button type="button" className="admin-link-button" onClick={reload} disabled={loading}>
              <Icon name="refresh" size={14} /> {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {loading ? (
            <p className="admin-note">Loading people…</p>
          ) : scoped.length === 0 ? (
            <p className="people-empty">
              {directoryError
                ? "People could not be loaded."
                : tab === "team"
                  ? "Nobody reports to you yet."
                  : "No people match your filters."}
            </p>
          ) : tab === "all" || tab === "team" ? (
            <>
              <div className={`people-grid ${view}`}>{visible.map(renderCard)}</div>
              <div className="people-pager">
                <span>Showing {from}–{to} of {scoped.length} {scoped.length === 1 ? "person" : "people"}</span>
                {pages > 1 && <Pager page={safePage} pages={pages} onPage={(n) => setPage(Math.min(Math.max(1, n), pages))} />}
              </div>
            </>
          ) : (
            groups.map(([name, list]) => (
              <div className="people-group" key={name}>
                <h3>{name} <small>{list.length}</small></h3>
                <div className={`people-grid ${view}`}>{list.map(renderCard)}</div>
              </div>
            ))
          )}
        </section>

        <aside className="people-side">
          <section className="admin-panel people-leaderboard-preview" aria-labelledby="lb-title">
            <div className="admin-panel-heading">
              <div><h2 id="lb-title">Good Habits Leaderboard</h2><p>This week · verified from attendance</p></div>
              {onLeaderboard && (
                <button type="button" className="admin-link-button" onClick={onLeaderboard}>
                  View all <Icon name="arrow" size={13} />
                </button>
              )}
            </div>
            {loading ? (
              <p className="admin-note">Loading scores…</p>
            ) : leaderboardError ? (
              <p className="admin-note" role="status">{leaderboardError}</p>
            ) : leaderboardRows.length ? (
              <ol className="people-streak">
                {leaderboardRows.map((row, i) => (
                  <li key={row.participant_id ?? i}>
                    <b className={`rank r${row.rank ?? i + 1}`}>{row.rank ?? i + 1}</b>
                    <Avatar name={row.name} size={38} />
                    <span className="people-lb-copy">
                      <strong>{row.name}</strong>
                      {(row.designation || row.department) && <small>{row.designation || row.department}</small>}
                    </span>
                    <span className="people-days"><Icon name="flame" size={16} /> {row.points} pts</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="admin-note">No eligible scores yet.</p>
            )}
          </section>

          <section className="admin-panel" aria-labelledby="dept-ov-title">
            <div className="admin-panel-heading">
              <div><h2 id="dept-ov-title">Department Overview</h2></div>
            </div>
            {deptCounts.length ? (
              <div className="admin-dept-list">
                {deptCounts.slice(0, 8).map(([d, c]) => (
                  <div className="admin-dept-row" key={d}>
                    <span>{d}</span>
                    <div className="admin-dept-bar"><span style={{ width: `${(c / deptCounts[0][1]) * 100}%` }} /></div>
                    <b>{c}</b>
                  </div>
                ))}
              </div>
            ) : (
              <p className="admin-note">Department counts appear once employee records load.</p>
            )}
          </section>

          <section className="admin-panel" aria-labelledby="celebrations-title">
            <div className="admin-panel-heading">
              <div><h2 id="celebrations-title">{hasBirthdays ? "Birthdays & Anniversaries" : "Work Anniversaries"}</h2></div>
            </div>
            <div className="people-seg" role="tablist">
              <button type="button" role="tab" aria-selected={celebrationTab === "upcoming"} className={celebrationTab === "upcoming" ? "on" : ""} onClick={() => setCelebrationTab("upcoming")}>
                Upcoming ({upcomingEvents.length})
              </button>
              <button type="button" role="tab" aria-selected={celebrationTab === "month"} className={celebrationTab === "month" ? "on" : ""} onClick={() => setCelebrationTab("month")}>
                This Month ({monthEvents.length})
              </button>
            </div>
            {loading ? (
              <p className="admin-note">Loading…</p>
            ) : shownEvents.length ? (
              <ul className="people-dates">
                {shownEvents.map((ev) => {
                  const days = celebrationTab === "upcoming" ? ev.days : ev.current.days;
                  const date = celebrationTab === "upcoming" ? ev.date : ev.current.date;
                  const years = celebrationTab === "upcoming" ? ev.years : ev.current.years;
                  return (
                    <li key={`${ev.key}-${celebrationTab}`}>
                      <span className={`people-date-icon ${ev.type === "birthday" ? "gift" : "building"}`}>
                        <Icon name={ev.type === "birthday" ? "gift" : "building"} size={17} />
                      </span>
                      <Avatar name={ev.person.name} size={34} photo={ev.person.photo} />
                      <span className="people-date-copy">
                        <strong>{ev.person.name}</strong>
                        <small>{ev.type === "birthday" ? "Birthday" : `Work anniversary · ${years} ${years === 1 ? "year" : "years"}`}</small>
                      </span>
                      <span className="people-date-when">
                        <small>{date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</small>
                        <b className={days < 0 ? "past" : ""}>{whenText(days)}</b>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="admin-note">
                {celebrationTab === "upcoming" ? "Nothing coming up in the next 30 days." : "Nothing to celebrate this month yet."}
              </p>
            )}
          </section>
        </aside>
      </div>

      {selected && (
        <PersonModal
          person={selected}
          directReports={directReportsOf(selected)}
          today={today}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}