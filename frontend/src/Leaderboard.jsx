import { useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { AVATAR_TONES, formatDate, getArrayResponse, getErrorMessage, initialsOf } from "./dashboardUtils";
import { Icon } from "./DashboardIcons";
import GoodHabitsActivities from "./GoodHabitsActivities";
import "./Leaderboard.css"; // existing styles (GoodHabitsActivities, MyRecognitionSummary) - keep
import "./LeaderboardPage.css"; // new leaderboard layout

/* ------------------------------------------------------------------
   Every number and name on this page comes from the API:
     GET /recognition/leaderboard/?period=&search=&page=&department=
     GET /recognition/departments/
     GET /recognition/me/
     GET /recognition/achievements/
   Nothing is sample data. If the API does not send a value, the page
   shows "—" or an empty state instead of inventing one.

   OPTIONAL fields (page works without them, shows "—" until the backend adds them):
     leaderboard.current_user.rank, .rank_change (+2 = moved up 2 places vs last month)
     leaderboard.results[].attendance_streak, .on_time_streak
     me.points_this_month, me.next_badge {name, points_required}
     me.attendance_streak, me.on_time_streak, me.no_leave_streak
     achievements[].progress, .target
   ------------------------------------------------------------------ */

const PERIODS = [["week", "This week"], ["month", "This month"], ["all", "All time"]];
const DEFAULT_PERIOD = "month";
const PAGE_SIZE = 20;

/* Local icons that are not in DashboardIcons.jsx (falls back to Icon for everything else) */
const LB_PATHS = {
  trophy: "M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 21h8M10 18h4",
  star: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  trend: "M7 17L17 7M8 7h9v9",
};

function LbIcon({ name, size = 20 }) {
  const d = LB_PATHS[name];
  if (!d) return <Icon name={name} size={size} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function prettify(key = "") {
  return String(key).toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

const ACTIVITY_META = {
  ON_TIME_CHECK_IN: { label: "On-time check-in", desc: "Check in within your scheduled time", icon: "clock", tone: "green" },
  COMPLETE_ATTENDANCE: { label: "Completed attendance", desc: "Be present for a full working day", icon: "check", tone: "green" },
  LEARNING_COMPLETED: { label: "Verified learning completion", desc: "Complete assigned learning or training", icon: "file", tone: "blue" },
  TEAM_CHALLENGE: { label: "Verified team challenge", desc: "Take part in a verified team challenge", icon: "users", tone: "purple" },
};
function activityMeta(key) {
  return ACTIVITY_META[key] || { label: prettify(key), desc: "", icon: "star", tone: "amber" };
}

function badgeIcon(name = "") {
  const n = String(name).toLowerCase();
  if (/punctual|on[- ]?time|target/.test(n)) return "target";
  if (/streak|flame|leave/.test(n)) return "flame";
  if (/consist|shield|performer/.test(n)) return "shield";
  if (/top|contribut|trophy|champion/.test(n)) return "trophy";
  return "star";
}

const has = (value) => value !== null && value !== undefined && value !== "";
const daysText = (value) => (has(value) ? `${value} ${Number(value) === 1 ? "day" : "days"}` : "—");

function Avatar({ name, index = 0, size = 34 }) {
  return (
    <span className="lbx-av" style={{ width: size, height: size, fontSize: Math.round(size * 0.34), background: AVATAR_TONES[index % AVATAR_TONES.length] }}>
      {initialsOf(name)}
    </span>
  );
}

function Plant() {
  return (
    <svg className="lbx-plant" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 58V30" stroke="#2f9e6e" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 34c-10 0-16-6-16-16 10 0 16 6 16 16z" fill="#35b37e" />
      <path d="M32 28c0-10 6-16 16-16 0 10-6 16-16 16z" fill="#1f8f63" />
      <path d="M18 58h28l-3-8H21z" fill="#b8734a" />
    </svg>
  );
}

export default function Leaderboard({ user }) {
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [me, setMe] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState("");

  /* leaderboard (re-fetches when a filter changes) */
  useEffect(() => {
    let live = true;
    Promise.resolve()
      .then(() => {
        if (live) setLoading(true);
        const qs = new URLSearchParams({ period, page: String(page) });
        if (search) qs.set("search", search);
        if (department) qs.set("department", department);
        return apiClient.get(`/recognition/leaderboard/?${qs.toString()}`);
      })
      .then((response) => { if (live) { setPayload(response?.results || null); setError(""); } })
      .catch((e) => { if (live) setError(getErrorMessage(e, "Could not load the company leaderboard.")); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [period, search, department, page]);

  /* departments dropdown */
  useEffect(() => {
    let live = true;
    apiClient.get("/recognition/departments/")
      .then((data) => { if (live) setDepartments(getArrayResponse(data)); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  /* my stats + achievements catalog */
  useEffect(() => {
    let live = true;
    Promise.allSettled([apiClient.get("/recognition/me/"), apiClient.get("/recognition/achievements/")]).then(([stats, badges]) => {
      if (!live) return;
      if (stats.status === "fulfilled") { setMe(stats.value || null); setMeError(""); }
      else setMeError(getErrorMessage(stats.reason, "Your recognition stats could not be loaded."));
      if (badges.status === "fulfilled") setCatalog(getArrayResponse(badges.value));
      setMeLoading(false);
    });
    return () => { live = false; };
  }, []);

  /* debounce the search box so we do not call the API on every key press */
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch((prev) => {
        const next = searchInput.trim();
        if (prev !== next) setPage(1);
        return next;
      });
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const rows = useMemo(() => payload?.results || [], [payload]);
  const scoring = useMemo(() => payload?.scoring || [], [payload]);
  const current = payload?.current_user || null;
  const filtersActive = Boolean(search || department);
  const firstRank = rows.length ? Math.min(...rows.map((r) => r.rank)) : 0;

  const myRank = current?.rank ?? rows.find((r) => r.is_me)?.rank ?? null;
  const rankChange = has(current?.rank_change) && Number.isFinite(Number(current.rank_change)) ? Number(current.rank_change) : null;
  const myPoints = me?.points ?? current?.points;

  const nextBadge = me?.next_badge || null;
  const nextTarget = Number(nextBadge?.points_required ?? nextBadge?.target);
  const showProgress = Number.isFinite(nextTarget) && nextTarget > 0 && Number.isFinite(Number(myPoints));
  const progressPct = showProgress ? Math.max(0, Math.min(100, (Number(myPoints) / nextTarget) * 100)) : 0;

  const earnedMap = useMemo(
    () => new Map((Array.isArray(me?.achievements) ? me.achievements : []).map((a) => [a.key, a.earned_at])),
    [me],
  );
  const history = Array.isArray(me?.history) ? me.history.slice(0, 5) : [];

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setDepartment("");
    setPeriod(DEFAULT_PERIOD);
    setPage(1);
  };

  return (
    <div className="recognition-page lbx">
      {error && <div className="admin-form-error" role="alert">{error}</div>}
      {meError && <div className="admin-form-error" role="alert">{meError}</div>}

      {/* ---------- page heading (the dashboard header's own title is hidden for this page in LeaderboardPage.css) ---------- */}
      <header className="lbx-hero">
        <span className="lbx-hero-ic"><LbIcon name="trophy" size={34} /></span>
        <div>
          <h2>Employee Leaderboard</h2>
          <p>Track your progress, build good habits and grow together.</p>
        </div>
      </header>

      {/* ---------- top summary cards ---------- */}
      <section className="lbx-top" aria-label="Your summary">
        <article className="lbx-card">
          <span className="lbx-medal">{myRank ?? "–"}</span>
          <div className="lbx-card-body">
            <small>Your Rank</small>
            <strong className="lbx-big">{loading && !myRank ? "…" : myRank ? `#${myRank}` : "—"}</strong>
            {rankChange !== null && (
              <span className={`lbx-delta ${rankChange > 0 ? "up" : rankChange < 0 ? "down" : ""}`}>
                {rankChange !== 0 && <span className={rankChange < 0 ? "flip" : ""}><LbIcon name="trend" size={14} /></span>}
                {rankChange === 0 ? "No change" : `${Math.abs(rankChange)} from last month`}
              </span>
            )}
          </div>
        </article>

        <article className="lbx-card">
          <span className="lbx-ic amber"><LbIcon name="star" size={26} /></span>
          <div className="lbx-card-body">
            <small>Your Points</small>
            <strong className="lbx-big">{meLoading && !has(myPoints) ? "…" : has(myPoints) ? myPoints : "—"}</strong>
            {has(me?.points_this_month) && <em className="lbx-up">+{me.points_this_month} this month</em>}
            {showProgress && (
              <div className="lbx-progress" title={nextBadge?.name || ""}>
                <div className="lbx-bar"><span style={{ width: `${progressPct}%` }} /></div>
                <div className="lbx-progress-text"><span>Next badge at {nextTarget} points</span><span>{myPoints} / {nextTarget}</span></div>
              </div>
            )}
          </div>
        </article>

        <article className="lbx-card lbx-streaks">
          <span className="lbx-ic red"><Icon name="flame" size={26} /></span>
          <div className="lbx-card-body">
            <small>Your Streaks</small>
            <div className="lbx-streak-row">
              <span><b>{has(me?.attendance_streak) ? me.attendance_streak : "—"}</b><small>Days<br />Attendance</small></span>
              <span><b>{has(me?.on_time_streak) ? me.on_time_streak : "—"}</b><small>Days<br />On-Time</small></span>
              <span><b>{has(me?.no_leave_streak) ? me.no_leave_streak : "—"}</b><small>Days<br />No Leave</small></span>
            </div>
          </div>
        </article>

        <article className="lbx-card lbx-motivate">
          <Plant />
          <p>Small habits<br />make big careers.<strong>Keep going!</strong></p>
        </article>
      </section>

      {/* ---------- main two columns ---------- */}
      <div className="lbx-layout">
        <div className="lbx-col">
          <section className="admin-panel" aria-labelledby="lbx-top-title">
            <div className="admin-panel-heading lbx-heading">
              <div><h2 id="lbx-top-title">Top Employees</h2></div>
              <div className="lbx-filters">
                <label className="lbx-search">
                  <Icon name="search" size={15} />
                  <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search employee" aria-label="Search employee" />
                </label>
                <select className="admin-select" aria-label="Department" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}>
                  <option value="">All departments</option>
                  {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select className="admin-select" aria-label="Period" value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }}>
                  {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {(filtersActive || period !== DEFAULT_PERIOD) && (
                  <button type="button" className="admin-link-button" onClick={resetFilters}><Icon name="refresh" size={13} /> Reset</button>
                )}
              </div>
            </div>

            {loading && !rows.length ? (
              <p className="admin-note">Loading leaderboard…</p>
            ) : !rows.length ? (
              <p className="admin-note">{filtersActive ? "No participants match your filters." : "No eligible scores yet. Scores appear after verified attendance events."}</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table lbx-table">
                  <thead>
                    <tr><th>#</th><th>EMPLOYEE</th><th>DEPARTMENT</th><th>POINTS</th><th>ATTENDANCE STREAK</th><th>ON-TIME STREAK</th><th>BADGES</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const badges = row.badge_details || [];
                      return (
                        <tr key={row.participant_id} className={row.is_me ? "lbx-me" : ""}>
                          <td><span className={`lbx-rank r${row.rank <= 3 ? row.rank : ""}`}>{row.rank}</span></td>
                          <td>
                            <div className="lbx-person">
                              <Avatar name={row.name} index={i} />
                              <strong>{row.name}{row.is_me ? " (You)" : ""}</strong>
                            </div>
                          </td>
                          <td className="lbx-muted">{row.department || "—"}</td>
                          <td><span className="lbx-pts">{row.points}</span></td>
                          <td>{daysText(row.attendance_streak)}</td>
                          <td>{daysText(row.on_time_streak)}</td>
                          <td>
                            {badges.length ? (
                              <span className="lbx-badges">
                                {badges.slice(0, 3).map((badge) => (
                                  <span key={`${badge.name}-${badge.earned_at}`} className={`lbx-badge ${badgeIcon(badge.name)}`} title={`${badge.name}${badge.description ? ` - ${badge.description}` : ""}${badge.earned_at ? ` (Earned ${formatDate(badge.earned_at)})` : ""}`}>
                                    <LbIcon name={badgeIcon(badge.name)} size={14} />
                                  </span>
                                ))}
                                {badges.length > 3 && <small className="lbx-more">+{badges.length - 3}</small>}
                              </span>
                            ) : "—"}
                            {row.is_me && <span className="lbx-you">You</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && payload?.count > PAGE_SIZE && (
              <div className="lbx-pager">
                <span>Page {page} · {payload.count} participants{firstRank ? ` · ranks ${firstRank}–${firstRank + rows.length - 1}` : ""}</span>
                <div>
                  <button type="button" disabled={!payload.previous} onClick={() => setPage((n) => Math.max(1, n - 1))}>Previous</button>
                  <button type="button" disabled={!payload.next} onClick={() => setPage((n) => n + 1)}>Next</button>
                </div>
              </div>
            )}
          </section>

          <section className="admin-panel" aria-labelledby="lbx-ach-title">
            <div className="admin-panel-heading"><div><h2 id="lbx-ach-title">Your Achievements</h2></div></div>
            {meLoading ? (
              <p className="admin-note">Loading achievements…</p>
            ) : !catalog.length ? (
              <p className="admin-note">No achievements are available yet.</p>
            ) : (
              <div className="lbx-ach-grid">
                {catalog.map((item) => {
                  const earned = Boolean(item.earned);
                  const earnedAt = earnedMap.get(item.key);
                  const hasProgress = !earned && item.active !== false && has(item.progress) && has(item.target) && Number(item.target) > 0;
                  const pct = hasProgress ? Math.max(0, Math.min(100, (Number(item.progress) / Number(item.target)) * 100)) : 0;
                  return (
                    <article key={item.key} className={`lbx-ach ${earned ? "earned" : "locked"}`} title={item.description}>
                      <span className={`lbx-ach-ic ${badgeIcon(item.name)}`}><LbIcon name={earned ? badgeIcon(item.name) : "lock"} size={26} /></span>
                      <strong>{item.name}</strong>
                      <small>{item.description}</small>
                      {hasProgress && (
                        <div className="lbx-progress">
                          <div className="lbx-bar"><span style={{ width: `${pct}%` }} /></div>
                          <div className="lbx-progress-text"><span /><span>{item.progress} / {item.target}</span></div>
                        </div>
                      )}
                      <span className={`lbx-pill ${earned ? "ok" : ""}`}>
                        {earned ? (earnedAt ? `Earned ${formatDate(earnedAt)}` : "Earned") : item.active === false ? "Unavailable" : hasProgress ? "In progress" : "Not yet earned"}
                      </span>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="lbx-col">
          <section className="admin-panel" aria-labelledby="lbx-how">
            <div className="admin-panel-heading"><div><h2 id="lbx-how">How to Earn Points</h2></div></div>
            {scoring.length ? (
              <ul className="lbx-feed">
                {scoring.map((item) => {
                  const meta = activityMeta(item.activity);
                  return (
                    <li key={item.activity}>
                      <span className={`lbx-ic sm ${meta.tone}`}><Icon name={meta.icon} size={18} /></span>
                      <span className="lbx-feed-text"><strong>{meta.label}</strong>{meta.desc && <small>{meta.desc}</small>}</span>
                      <b className="lbx-plus">+{item.points} pts</b>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="admin-note">Scoring rules were not returned by the server.</p>}
            <p className="admin-note">Approved leave does not reduce scores or streaks.</p>
          </section>

          <section className="admin-panel" aria-labelledby="lbx-recent">
            <div className="admin-panel-heading"><div><h2 id="lbx-recent">Your Recent Activity</h2></div></div>
            {meLoading ? (
              <p className="admin-note">Loading activity…</p>
            ) : history.length ? (
              <ul className="lbx-feed">
                {history.map((item, index) => {
                  const meta = activityMeta(item.activity);
                  return (
                    <li key={`${item.activity}-${item.event_date}-${index}`}>
                      <span className={`lbx-ic sm ${meta.tone}`}><Icon name={meta.icon} size={18} /></span>
                      <span className="lbx-feed-text"><strong>{item.description || meta.label}</strong><small>{formatDate(item.event_date)}</small></span>
                      <b className="lbx-plus">+{item.points} pts</b>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="admin-note">Points history appears after verified activity.</p>}
          </section>
        </aside>
      </div>

      <GoodHabitsActivities user={user} />
    </div>
  );
}

/* Kept so any other page that imports it (e.g. admin / HR views) keeps working. */
export function MyRecognitionSummary() {
  const [summary, setSummary] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    Promise.allSettled([apiClient.get("/recognition/me/"), apiClient.get("/recognition/achievements/")]).then(([stats, badges]) => {
      if (!live) return;
      if (stats.status === "fulfilled") setSummary(stats.value);
      else setError(getErrorMessage(stats.reason, "Recognition stats could not be loaded."));
      if (badges.status === "fulfilled") setCatalog(badges.value);
    });
    return () => { live = false; };
  }, []);
  return <section className="admin-panel recognition-personal"><div className="admin-panel-heading"><div><h2>My Stats &amp; Achievements</h2><p>Your verified recognition history.</p></div></div>{error ? <p className="admin-note">{error}</p> : !summary ? <p className="admin-note">Loading achievements…</p> : <div className="recognition-personal-body"><div className="recognition-personal-stats"><strong>{summary.points} points</strong><span>{summary.on_time_streak}-day on-time streak</span><span>10-day consistency: {Math.min(summary.on_time_streak, 10)}/10</span></div><div className="recognition-personal-badges"><h3>Achievement progress</h3>{catalog.map((item) => <article key={item.key} className={item.earned ? "earned" : ""}><b>{item.name}</b><small>{item.description}</small><small>{item.earned ? (summary.achievements.find((achievement) => achievement.key === item.key)?.earned_at ? `Earned ${new Date(summary.achievements.find((achievement) => achievement.key === item.key).earned_at).toLocaleDateString()}` : "Earned") : item.active ? "Not yet earned" : "Unavailable"}</small></article>)}</div><details className="recognition-personal-history"><summary>Recent points history</summary>{summary.history.length ? summary.history.slice(0, 10).map((item, index) => <div key={`${item.activity}-${item.event_date}-${index}`}><span>{item.description}<small>{item.event_date}</small></span><b>+{item.points}</b></div>) : <p className="admin-note">Points history appears after verified activity.</p>}</details></div>}</section>;
}