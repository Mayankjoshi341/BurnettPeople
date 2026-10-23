import { useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";

import { Icon } from "./DashboardIcons";
import { StatCard } from "./DashboardParts";
import {
  AVATAR_TONES,
  getArrayResponse,
  initialsOf,
  normalizeEmployee,
} from "./dashboardUtils";
import "./MyPeople.css";

const PAGE_SIZE = 12;

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
    ["Reports to", person.manager],
    ["Date joined", person.joined || "—"],
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

export default function MyPeople({ canAdd = false, onAdd, onLeaderboard, onRemoteWork, onLeave }) {
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
  const [status, setStatus] = useState("ALL");
  const [newJoinersOnly, setNewJoinersOnly] = useState(false);
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
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    return employees.filter(
      (e) =>
        (!newJoinersOnly || (e.status === "ACTIVE" && e.joined?.slice(0, 7) === currentMonth)) &&
        (department === "ALL" || e.department === department) &&
        (status === "ALL" || e.status === status) &&
        (!q || [e.name, e.code, e.email, e.department, e.designation].some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [employees, query, department, status, newJoinersOnly]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const clear = () => {
    setQuery("");
    setDepartment("ALL");
    setStatus("ALL");
    setNewJoinersOnly(false);
    setPage(1);
  };

  const groups = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      (map[e.department] = map[e.department] || []).push(e);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

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
          note={overviewError || (overview?.work_from_home_available ? "Approved remote work" : "Remote work is not tracked yet")}
          onClick={onRemoteWork}
        />
        <StatCard
          icon="plane" tone="blue" label="On Leave Today"
          value={overview?.on_leave_today ?? "—"}
          note="Approved leave today"
          onClick={onLeave}
        />
      </section>

      {directoryError && <div role="alert" className="admin-form-error">{directoryError}</div>}
      <section className="admin-panel people-leaderboard-preview">
        <div className="admin-panel-heading"><div><h2>Good Habits Leaderboard</h2><p>Verified positive habits, updated from attendance records.</p></div><button type="button" className="admin-link-button" onClick={onLeaderboard}>View leaderboard <Icon name="arrow" size={14} /></button></div>
        {loading ? <p className="admin-note">Loading scores…</p> : leaderboardError ? <p className="admin-note" role="status">{leaderboardError}</p> : leaderboardRows.length ? <ol>{leaderboardRows.map((row) => <li key={row.participant_id}><span>#{row.rank} {row.name}</span><strong>{row.points} pts</strong></li>)}</ol> : <p className="admin-note">No eligible scores yet.</p>}
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
              {canAdd && onAdd && (
                <button type="button" className="admin-primary-button" onClick={onAdd}>
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

          {loading ? (
            <p className="admin-note">Loading people…</p>
          ) : filtered.length === 0 ? (
            <p className="admin-note">{directoryError ? "People could not be loaded." : "No people match your filters."}</p>
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

        </aside>
      </div>

      {selected && (
        <PersonModal person={selected.person} index={selected.index} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
