import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Icon } from "./DashboardIcons";
import { StatCard } from "./DashboardParts";
import {
  AVATAR_TONES,
  SHOW_DEMO_DATA,
  initialsOf,
  useEmployees,
} from "./dashboardUtils";
import "./MyPeople.css";

const PAGE_SIZE = 12;

const DEMO_STREAK = [
  ["Sneha Joshi", "Product Designer", 31],
  ["Aarav Sharma", "Software Engineer", 28],
  ["Neha Gupta", "Finance Analyst", 26],
  ["Rohan Thakur", "Marketing Manager", 24],
  ["Vikram Kapoor", "Operations Executive", 21],
];

const DEMO_DATES = [
  ["gift", "Kavya Mehta", "Birthday", "18 Oct 2026", "in 2 days"],
  ["building", "Rahul Verma", "Work Anniversary (2 years)", "20 Oct 2026", "in 4 days"],
  ["gift", "Priya Nair", "Birthday", "25 Oct 2026", "in 9 days"],
];

function Avatar({ name, index = 0, size = 56 }) {
  return (
    <span
      className="people-avatar"
      style={{ width: size, height: size, fontSize: size * 0.34, background: AVATAR_TONES[index % AVATAR_TONES.length] }}
    >
      {initialsOf(name)}
    </span>
  );
}

function PersonModal({ person, index, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = [
    ["Employee code", person.code],
    ["Email", person.email],
    ["Department", person.department],
    ["Designation", person.designation],
    ["Employment status", person.status],
  ];

  return (
    <div className="admin-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal people-modal" role="dialog" aria-modal="true" aria-labelledby="person-title">
        <div className="people-modal-head">
          <Avatar name={person.name} index={index} size={72} />
          <div>
            <h2 id="person-title">{person.name}</h2>
            <p>{person.designation}</p>
            <span className="admin-status status-ontime">{person.status}</span>
          </div>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <dl className="people-details">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {person.email !== "—" && (
          <div className="admin-modal-actions">
            <a className="admin-primary-button people-link" href={`mailto:${person.email}`}>
              <Icon name="mail" size={16} /> Send email
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyPeople({ canAdd = false }) {
  const navigate = useNavigate();
  const { employees, loading, error, reload } = useEmployees();

  const [tab, setTab] = useState("all");
  const [view, setView] = useState("grid");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter((d) => d && d !== "—"))].sort(),
    [employees],
  );
  const statuses = useMemo(
    () => [...new Set(employees.map((e) => e.status).filter((s) => s && s !== "—"))].sort(),
    [employees],
  );

  const deptCounts = useMemo(() => {
    const counts = {};
    employees.forEach((e) => {
      if (e.department !== "—") counts[e.department] = (counts[e.department] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter(
      (e) =>
        (department === "ALL" || e.department === department) &&
        (status === "ALL" || e.status === status) &&
        (!q || [e.name, e.code, e.email, e.department, e.designation].some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [employees, query, department, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const clear = () => {
    setQuery("");
    setDepartment("ALL");
    setStatus("ALL");
    setPage(1);
  };

  const groups = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      (map[e.department] = map[e.department] || []).push(e);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const demo = SHOW_DEMO_DATA;

  const renderCard = (e, i) => (
    <button
      type="button"
      key={e.id}
      className={`people-card ${view === "list" ? "list" : ""}`}
      onClick={() => setSelected({ person: e, index: i })}
    >
      <Avatar name={e.name} index={i} size={view === "list" ? 44 : 56} />
      <span className="people-card-copy">
        <strong>{e.name}</strong>
        <small>{e.designation}</small>
        <small>{e.department}</small>
      </span>
      <span className="admin-status status-ontime people-chip">{e.status}</span>
    </button>
  );

  return (
    <div className="people-page">
      <section className="admin-summary-grid" aria-label="People summary">
        <StatCard
          icon="users" tone="green" label="Total Employees"
          value={employees.length || (demo ? 128 : null)}
          note={employees.length ? "From employee records" : demo ? "+8 this month" : "No records yet"}
          noteClass={!employees.length && demo ? "up" : ""}
        />
        <StatCard
          icon="building" tone="blue" label="Departments"
          value={departments.length || (demo ? 8 : null)}
          note="Across the company"
        />
        <StatCard
          icon="userplus" tone="green" label="New Joiners"
          value={demo ? 4 : null}
          note={demo ? "This month" : "Not connected"}
        />
        <StatCard
          icon="calendar" tone="green" label="Work From Office"
          value={demo ? 92 : null}
          note={demo ? "72% of total" : "Not connected"}
        />
        <StatCard
          icon="plane" tone="blue" label="On Leave Today"
          value={demo ? 8 : null}
          note={demo ? "6% of total" : "Not connected"}
        />
      </section>

      <div className="people-layout">
        <section className="admin-panel people-main" aria-label="People directory">
          <div className="people-toolbar">
            <div className="people-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === "all"} className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>
                All People
              </button>
              <button type="button" role="tab" aria-selected={tab === "dept"} className={tab === "dept" ? "on" : ""} onClick={() => setTab("dept")}>
                By Department
              </button>
            </div>

            <div className="people-toolbar-right">
              <div className="people-view-toggle">
                <button type="button" className={view === "grid" ? "on" : ""} onClick={() => setView("grid")} aria-label="Grid view">
                  <Icon name="grid" size={16} />
                </button>
                <button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")} aria-label="List view">
                  <Icon name="list" size={16} />
                </button>
              </div>
              {canAdd && (
                <button type="button" className="admin-primary-button" onClick={() => navigate("/employees/new")}>
                  <Icon name="userplus" size={16} /> Add Employee
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
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
              <option value="ALL">Status</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" className="admin-link-button" onClick={clear}>Clear</button>
            <button type="button" className="admin-link-button" onClick={reload} disabled={loading}>
              <Icon name="refresh" size={14} /> {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {error && <div role="alert" className="admin-form-error">{error}</div>}

          {loading ? (
            <p className="admin-note">Loading people…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-note">{error ? "People could not be loaded." : "No people match your filters."}</p>
          ) : tab === "all" ? (
            <>
              <div className={`people-grid ${view}`}>{visible.map(renderCard)}</div>
              {pages > 1 && (
                <div className="people-pagination">
                  <button type="button" onClick={() => setPage(safePage - 1)} disabled={safePage === 1} aria-label="Previous page">‹</button>
                  {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 7).map((n) => (
                    <button key={n} type="button" className={n === safePage ? "on" : ""} onClick={() => setPage(n)}>{n}</button>
                  ))}
                  <button type="button" onClick={() => setPage(safePage + 1)} disabled={safePage === pages} aria-label="Next page">›</button>
                </div>
              )}
            </>
          ) : (
            groups.map(([dept, list]) => (
              <div className="people-group" key={dept}>
                <h3>{dept} <small>{list.length}</small></h3>
                <div className={`people-grid ${view}`}>{list.map(renderCard)}</div>
              </div>
            ))
          )}
        </section>

        <aside className="people-side">
          {demo && (
            <section className="admin-panel" aria-labelledby="streak-title">
              <div className="admin-panel-heading">
                <div><h2 id="streak-title">Streak Leaderboard</h2><p>Attendance streak (sample data)</p></div>
              </div>
              <ol className="people-streak">
                {DEMO_STREAK.map(([n, role, days], i) => (
                  <li key={n}>
                    <b className={`rank r${i + 1}`}>{i + 1}</b>
                    <Avatar name={n} index={i} size={36} />
                    <span><strong>{n}</strong><small>{role}</small></span>
                    <span className="people-days"><Icon name="flame" size={16} /> {days} days</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

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

          {demo && (
            <section className="admin-panel" aria-labelledby="bday-title">
              <div className="admin-panel-heading">
                <div><h2 id="bday-title">Birthdays &amp; Anniversaries</h2><p>Sample data</p></div>
              </div>
              <ul className="people-dates">
                {DEMO_DATES.map(([icon, n, what, date, soon]) => (
                  <li key={n + what}>
                    <span className={`people-date-icon ${icon}`}><Icon name={icon} size={18} /></span>
                    <span><strong>{n}</strong><small>{what}</small></span>
                    <span className="people-date-when"><small>{date}</small><b>{soon}</b></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {selected && (
        <PersonModal person={selected.person} index={selected.index} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}