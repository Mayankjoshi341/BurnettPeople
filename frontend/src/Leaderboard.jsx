import { useEffect, useState } from "react";
import apiClient from "./api/client";
import { getErrorMessage } from "./dashboardUtils";
import { Icon } from "./DashboardIcons";
import GoodHabitsActivities from "./GoodHabitsActivities";
import "./Leaderboard.css";

export default function Leaderboard({ user }) {
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
  const rows = payload?.results || [];
  const scoringLabels = { ON_TIME_CHECK_IN: "On-time check-in", COMPLETE_ATTENDANCE: "Completed attendance", LEARNING_COMPLETED: "Verified learning completion", TEAM_CHALLENGE: "Verified team challenge" };
  return (
    <div className="recognition-page">
      <section className="recognition-intro"><span><Icon name="flame" size={24} /></span><div><h2>Good Habits &amp; Leaderboard</h2><p>Recognizing consistent, positive work habits across the company.</p></div></section>
      <section className="admin-panel recognition-rules"><strong>How points work</strong>{(payload?.scoring || []).map((item) => <span key={item.activity}>{scoringLabels[item.activity] || item.activity}: {item.points} points</span>)}<small>Points use server-verified attendance and reviewed activities. Approved leave does not reduce scores or streaks.</small></section>
      <section className="recognition-toolbar">
        <label><span className="sr-only">Period</span><select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="week">This week</option><option value="month">This month</option><option value="all">All time</option></select></label>
        <label><span className="sr-only">Department</span><select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}><option value="">All departments</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="recognition-search"><Icon name="search" size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search participants" aria-label="Search participants" /></label>
      </section>
      {error && <div className="admin-form-error" role="alert">{error}</div>}
      <section className="admin-panel recognition-table" aria-label="Company rankings">
        <div className="recognition-heading"><h2>Company rankings</h2><span>Your score: {payload?.current_user?.points ?? 0}</span></div>
        {loading ? <p className="admin-note">Loading leaderboard…</p> : !rows.length ? <p className="admin-note">No eligible scores yet. Scores appear after verified attendance events.</p> : (
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>RANK</th><th>PARTICIPANT</th><th>DEPARTMENT</th><th>POINTS</th><th>BADGES</th></tr></thead><tbody>
            {rows.map((row) => <tr key={row.participant_id} className={row.is_me ? "recognition-me" : ""}><td>#{row.rank}</td><td>{row.name}{row.is_me ? " (You)" : ""}</td><td>{row.department || "—"}</td><td><strong>{row.points}</strong></td><td>{row.badge_details?.length ? <span className="recognition-badges">{row.badge_details.map((badge) => <span key={`${badge.name}-${badge.earned_at}`} title={`${badge.description} Earned ${new Date(badge.earned_at).toLocaleDateString()}`}>{badge.name}</span>)}</span> : "—"}</td></tr>)}
          </tbody></table></div>
        )}
        {!loading && payload?.count > 20 && <div className="ap-pager"><span>Page {page} · {payload.count} participants</span><div className="ap-pager-btns"><button type="button" disabled={!payload.previous} onClick={() => setPage((n) => Math.max(1, n-1))}>Previous</button><button type="button" disabled={!payload.next} onClick={() => setPage((n) => n+1)}>Next</button></div></div>}
      </section>
      <GoodHabitsActivities user={user} />
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
