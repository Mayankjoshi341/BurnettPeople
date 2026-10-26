import { useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { AVATAR_TONES, getErrorMessage, initialsOf } from "./dashboardUtils";
import { Icon } from "./DashboardIcons";
import GoodHabitsActivities from "./GoodHabitsActivities";
import "./Leaderboard.css"; // your existing styles (activities, personal summary) stay untouched
// import "./LeaderboardV2.css"; // new layout styles

/* Every number and name on this page comes from the API:
   GET /recognition/leaderboard/?period=&search=&page=&department=
   GET /recognition/departments/
   Nothing is sample data; when the API returns nothing the page says so. */

const SCORING_LABELS = {
  ON_TIME_CHECK_IN: "On-time check-in",
  COMPLETE_ATTENDANCE: "Completed attendance",
  LEARNING_COMPLETED: "Verified learning completion",
  TEAM_CHALLENGE: "Verified team challenge",
};
const PERIODS = [["week", "This week"], ["month", "This month"], ["all", "All time"]];
const PODIUM_TONE = { 1: "gold", 2: "silver", 3: "bronze" };

function Avatar({ name, index = 0, size = 40 }) {
  return (
    <span className="lb-av" style={{ width: size, height: size, fontSize: size * 0.34, background: AVATAR_TONES[index % AVATAR_TONES.length] }}>
      {initialsOf(name)}
    </span>
  );
}

function StatBox({ icon, tone, value, label, note }) {
  return (
    <div className="lb-stat">
      <span className={`lb-stat-icon ${tone}`}><Icon name={icon} size={22} /></span>
      <span className="lb-stat-body">
        <b>{value}</b>
        <strong>{label}</strong>
        {note && <small>{note}</small>}
      </span>
    </div>
  );
}

export default function Leaderboard({ user }) {
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState("week");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => {
      if (live) setLoading(true);
      return apiClient.get(`/recognition/leaderboard/?period=${period}&search=${encodeURIComponent(search)}&page=${page}${department ? `&department=${department}` : ""}`);
    })
      .then((response) => { if (live) { setPayload(response?.results || null); setError(""); } })
      .catch((e) => { if (live) setError(getErrorMessage(e, "Could not load the company leaderboard.")); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [period, search, department, page]);

  useEffect(() => {
    let live = true;
    apiClient.get("/recognition/departments/").then((data) => { if (live) setDepartments(Array.isArray(data) ? data : data?.results || []); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const rows = useMemo(() => payload?.results || [], [payload]);
  const scoring = payload?.scoring || [];
  const podium = rows.filter((row) => row.rank >= 1 && row.rank <= 3).sort((a, b) => a.rank - b.rank);
  const filtersActive = Boolean(search || department);
  const pageSize = 20;
  const firstRank = rows.length ? Math.min(...rows.map((r) => r.rank)) : 0;

  // Recent achievements come from the badges of the participants currently shown.
  const recentBadges = useMemo(
    () => rows
      .flatMap((row) => (row.badge_details || []).map((badge) => ({ ...badge, person: row.name })))
      .filter((badge) => badge.earned_at)
      .sort((a, b) => String(b.earned_at).localeCompare(String(a.earned_at)))
      .slice(0, 5),
    [rows],
  );

  const resetFilters = () => { setSearch(""); setDepartment(""); setPeriod("week"); setPage(1); };

  return (
    <div className="recognition-page lb-page">
      <section className="lb-hero">
        <span className="lb-hero-icon"><Icon name="flame" size={26} /></span>
        <div>
          <h2>Good Habits &amp; Leaderboard</h2>
          <p>Recognizing consistent, positive work habits across the company.</p>
        </div>
      </section>

      <div className="lb-tabs" role="tablist">
        {[["overview", "Overview"], ["activity", "Activity Wise"], ["achievements", "My Achievements"]].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {error && <div className="admin-form-error" role="alert">{error}</div>}

      {tab === "overview" && (
        <>
          <section className="lb-stats" aria-label="Leaderboard summary">
            <StatBox icon="users" tone="green" value={loading ? "…" : (payload?.count ?? rows.length)} label="Participants" note={filtersActive ? "Matching your filters" : "With eligible scores"} />
            <StatBox icon="flame" tone="amber" value={payload?.current_user?.points ?? 0} label="Your points" note="Server-verified" />
            <StatBox icon="check" tone="blue" value={rows[0]?.points ?? "—"} label="Highest score shown" note={rows[0] ? rows[0].name : "No scores yet"} />
            <StatBox icon="building" tone="purple" value={departments.length} label="Departments" note="Taking part" />
          </section>

          <div className="lb-grid">
            <div className="lb-col">
              {podium.length > 0 && (
                <section className="admin-panel" aria-labelledby="lb-top">
                  <div className="admin-panel-heading"><div><h2 id="lb-top">Top Performers</h2><p>Top 3 in the current view</p></div></div>
                  <div className="lb-podium">
                    {podium.map((row) => (
                      <article key={row.participant_id} className={`lb-podium-card ${PODIUM_TONE[row.rank]} rank-${row.rank}`}>
                        <span className="lb-medal">{row.rank}</span>
                        <Avatar name={row.name} index={row.rank} size={row.rank === 1 ? 68 : 56} />
                        <strong>{row.name}{row.is_me ? " (You)" : ""}</strong>
                        <small>{row.department || "—"}</small>
                        <span className="lb-points">{row.points} pts</span>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="admin-panel lb-filters" aria-label="Leaderboard filters">
                <label className="lb-field">
                  <span className="sr-only">Period</span>
                  <select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }}>
                    {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="lb-field">
                  <span className="sr-only">Department</span>
                  <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}>
                    <option value="">All departments</option>
                    {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="lb-search">
                  <Icon name="search" size={16} />
                  <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search participants" aria-label="Search participants" />
                </label>
                <button type="button" className="admin-secondary-button" onClick={resetFilters}><Icon name="refresh" size={14} /> Reset</button>
              </section>

              <section className="admin-panel recognition-table" aria-label="Company rankings">
                <div className="recognition-heading">
                  <h2>Company rankings</h2>
                  <span>Your score: {payload?.current_user?.points ?? 0}</span>
                </div>
                {loading ? <p className="admin-note">Loading leaderboard…</p> : !rows.length ? (
                  <p className="admin-note">No eligible scores yet. Scores appear after verified attendance events.</p>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table lb-table">
                      <thead><tr><th>RANK</th><th>PARTICIPANT</th><th>DEPARTMENT</th><th>TOTAL POINTS</th><th>BADGES</th></tr></thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={row.participant_id} className={row.is_me ? "recognition-me" : ""}>
                            <td><span className={`lb-rank ${PODIUM_TONE[row.rank] || ""}`}>{row.rank}</span></td>
                            <td>
                              <div className="lb-person">
                                <Avatar name={row.name} index={i} size={34} />
                                <strong>{row.name}{row.is_me ? " (You)" : ""}</strong>
                              </div>
                            </td>
                            <td>{row.department || "—"}</td>
                            <td><strong>{row.points}</strong></td>
                            <td>
                              {row.badge_details?.length ? (
                                <span className="recognition-badges">
                                  {row.badge_details.map((badge) => (
                                    <span key={`${badge.name}-${badge.earned_at}`} title={`${badge.description} Earned ${new Date(badge.earned_at).toLocaleDateString()}`}>{badge.name}</span>
                                  ))}
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!loading && payload?.count > pageSize && (
                  <div className="ap-pager">
                    <span>Page {page} · {payload.count} participants{firstRank ? ` · showing ranks ${firstRank}–${firstRank + rows.length - 1}` : ""}</span>
                    <div className="ap-pager-btns">
                      <button type="button" disabled={!payload.previous} onClick={() => setPage((n) => Math.max(1, n - 1))}>Previous</button>
                      <button type="button" disabled={!payload.next} onClick={() => setPage((n) => n + 1)}>Next</button>
                    </div>
                  </div>
                )}
              </section>
            </div>

            <aside className="lb-col">
              <section className="admin-panel" aria-labelledby="lb-how">
                <div className="admin-panel-heading"><div><h2 id="lb-how">How points work</h2><p>Server-verified activity only</p></div></div>
                {scoring.length ? (
                  <ul className="lb-rules">
                    {scoring.map((item) => (
                      <li key={item.activity}>
                        <span>{SCORING_LABELS[item.activity] || item.activity}</span>
                        <b>{item.points} pts</b>
                      </li>
                    ))}
                  </ul>
                ) : <p className="admin-note">Scoring rules were not returned by the server.</p>}
                <p className="admin-note">Approved leave does not reduce scores or streaks.</p>
              </section>

              <section className="admin-panel" aria-labelledby="lb-recent">
                <div className="admin-panel-heading"><div><h2 id="lb-recent">Recent Achievements</h2><p>Badges earned by the participants shown</p></div></div>
                {recentBadges.length ? (
                  <ul className="lb-recent">
                    {recentBadges.map((badge) => (
                      <li key={`${badge.person}-${badge.name}-${badge.earned_at}`}>
                        <span className="lb-recent-icon"><Icon name="gift" size={16} /></span>
                        <span><strong>{badge.person}</strong> earned “{badge.name}”<small>{new Date(badge.earned_at).toLocaleDateString()}</small></span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="admin-note">No badges earned yet.</p>}
              </section>
            </aside>
          </div>

          <GoodHabitsActivities user={user} />
        </>
      )}

      {tab === "activity" && (
        <section className="admin-panel" aria-labelledby="lb-act">
          <div className="admin-panel-heading"><div><h2 id="lb-act">Points by activity</h2><p>What each verified activity is worth</p></div></div>
          {scoring.length ? (
            <div className="lb-activity-grid">
              {scoring.map((item) => (
                <article key={item.activity}>
                  <span className="lb-stat-icon green"><Icon name="check" size={20} /></span>
                  <strong>{SCORING_LABELS[item.activity] || item.activity}</strong>
                  <b>{item.points} points</b>
                </article>
              ))}
            </div>
          ) : <p className="admin-note">Scoring rules will appear once the leaderboard loads.</p>}
        </section>
      )}

      {tab === "achievements" && <MyRecognitionSummary />}
    </div>
  );
}

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