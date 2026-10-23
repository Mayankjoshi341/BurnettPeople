import { useCallback, useEffect, useState } from "react";
import apiClient from "./api/client";
import { getErrorMessage } from "./dashboardUtils";
import { Icon } from "./DashboardIcons";

const REVIEWERS = new Set(["ADMIN", "HR", "MANAGER"]);
const CREATORS = new Set(["ADMIN", "HR"]);
const statusText = (status) => ({ ASSIGNED: "Enrolled", JOINED: "Joined", REVIEW: "Waiting for review", COMPLETED: "Verified", REJECTED: "Please resubmit" })[status] || "Available";

function ActivityCard({ kind, item, notes, onNoteChange, onAction, busy }) {
  const key = `${kind}-${item.id}`;
  const canSubmit = kind === "learning" ? ["ASSIGNED", "REJECTED"].includes(item.status) : ["JOINED", "REJECTED"].includes(item.status);
  return <article className="recognition-activity-card"><header><strong>{item.title}</strong><span className={`recognition-activity-status ${item.status || "available"}`}>{statusText(item.status)}</span></header>
    <p>{item.description || "Build a positive habit with your team."}</p>
    {kind === "challenge" && <small>{item.starts_on} to {item.ends_on}</small>}
    {canSubmit && item.status && <label className="recognition-activity-note">What did you complete?<textarea maxLength={500} value={notes[key] || ""} onChange={(event) => onNoteChange(key, event.target.value)} /></label>}
    {!item.status || canSubmit ? <button className="admin-primary-button" type="button" disabled={Boolean(busy) || (canSubmit && !(notes[key] || "").trim())} onClick={() => onAction(kind, item)}>{busy === key ? "Saving…" : !item.status ? (kind === "learning" ? "Enroll" : "Join challenge") : "Submit for review"}</button> : null}
  </article>;
}

export default function GoodHabitsActivities({ user }) {
  const [learning, setLearning] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [queue, setQueue] = useState({ learning: [], challenges: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [learningForm, setLearningForm] = useState({ title: "", description: "" });
  const [challengeForm, setChallengeForm] = useState({ title: "", description: "", starts_on: "", ends_on: "" });
  const [notes, setNotes] = useState({});

  const reload = useCallback(async () => {
    const requests = [apiClient.get("/recognition/learning/"), apiClient.get("/recognition/challenges/")];
    if (REVIEWERS.has(user?.role)) requests.push(apiClient.get("/recognition/review-queue/"));
    const result = await Promise.allSettled(requests);
    if (result[0].status === "fulfilled") setLearning(result[0].value);
    if (result[1].status === "fulfilled") setChallenges(result[1].value);
    if (REVIEWERS.has(user?.role) && result[2]?.status === "fulfilled") setQueue(result[2].value);
    const failure = result.find((item) => item.status === "rejected");
    setError(failure ? getErrorMessage(failure.reason, "Some recognition activities could not be loaded.") : "");
    setLoading(false);
  }, [user?.role]);

  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);

  async function run(key, work) {
    setBusy(key);
    setError("");
    try { await work(); await reload(); }
    catch (e) { setError(getErrorMessage(e, "Could not update this activity.")); }
    finally { setBusy(""); }
  }

  async function createLearning(event) {
    event.preventDefault();
    await run("create-learning", async () => {
      await apiClient.post("/recognition/learning/", learningForm);
      setLearningForm({ title: "", description: "" });
    });
  }

  async function createChallenge(event) {
    event.preventDefault();
    await run("create-challenge", async () => {
      await apiClient.post("/recognition/challenges/", challengeForm);
      setChallengeForm({ title: "", description: "", starts_on: "", ends_on: "" });
    });
  }

  async function participate(kind, item) {
    const key = `${kind}-${item.id}`;
    if (!item.status) {
      const path = kind === "learning" ? `/recognition/learning/${item.id}/enroll/` : `/recognition/challenges/${item.id}/join/`;
      await run(key, () => apiClient.post(path, {}));
      return;
    }
    const id = kind === "learning" ? item.completion_id : item.participation_id;
    const path = kind === "learning" ? `/recognition/learning/completions/${id}/submit/` : `/recognition/challenges/participations/${id}/submit/`;
    const note = notes[key] || "";
    await run(key, () => apiClient.post(path, { submission_note: note }));
    setNotes((current) => ({ ...current, [key]: "" }));
  }

  async function decide(kind, item, decision) {
    const base = kind === "learning" ? "/recognition/learning/completions/" : "/recognition/challenges/participations/";
    await run(`${kind}-review-${item.id}`, () => apiClient.post(`${base}${item.id}/verify/`, { decision }));
  }

  return <section className="admin-panel recognition-activities">
    <div className="admin-panel-heading"><div><h2>Learning &amp; Team Challenges</h2><p>Points are added after a manager or HR verifies a submitted activity.</p></div><Icon name="users" size={19} /></div>
    {error && <div className="admin-form-error" role="alert">{error}</div>}
    {CREATORS.has(user?.role) && <div className="recognition-activity-create">
      <form onSubmit={createLearning}><h3>Create learning activity</h3><label>Title<input required maxLength={120} value={learningForm.title} onChange={(e) => setLearningForm({ ...learningForm, title: e.target.value })} /></label><label>Description<textarea maxLength={5000} value={learningForm.description} onChange={(e) => setLearningForm({ ...learningForm, description: e.target.value })} /></label><button className="admin-primary-button" disabled={Boolean(busy)}>Publish activity</button></form>
      <form onSubmit={createChallenge}><h3>Create team challenge</h3><label>Title<input required maxLength={120} value={challengeForm.title} onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })} /></label><label>Description<textarea maxLength={5000} value={challengeForm.description} onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })} /></label><div className="recognition-date-fields"><label>Starts<input type="date" required value={challengeForm.starts_on} onChange={(e) => setChallengeForm({ ...challengeForm, starts_on: e.target.value })} /></label><label>Ends<input type="date" required value={challengeForm.ends_on} onChange={(e) => setChallengeForm({ ...challengeForm, ends_on: e.target.value })} /></label></div><button className="admin-primary-button" disabled={Boolean(busy)}>Publish challenge</button></form>
    </div>}
    {loading ? <p className="admin-note">Loading activities…</p> : <div className="recognition-activity-columns"><div><h3>Learning</h3>{learning.length ? learning.map((item) => <ActivityCard key={item.id} kind="learning" item={item} notes={notes} busy={busy} onNoteChange={(key, value) => setNotes((current) => ({ ...current, [key]: value }))} onAction={participate} />) : <p className="admin-note">No learning activities are available.</p>}</div><div><h3>Team challenges</h3>{challenges.length ? challenges.map((item) => <ActivityCard key={item.id} kind="challenge" item={item} notes={notes} busy={busy} onNoteChange={(key, value) => setNotes((current) => ({ ...current, [key]: value }))} onAction={participate} />) : <p className="admin-note">No active team challenges.</p>}</div></div>}
    {REVIEWERS.has(user?.role) && <div className="recognition-review"><h3>Submissions to verify</h3>{![...queue.learning, ...queue.challenges].length ? <p className="admin-note">No submissions are waiting for review.</p> : <ul>{queue.learning.map((item) => <li key={`l-${item.id}`}><span><strong>{item.participant} · {item.title}</strong><small>{item.submission_note}</small></span><div><button type="button" disabled={Boolean(busy)} onClick={() => decide("learning", item, "COMPLETED")}>Verify</button><button type="button" disabled={Boolean(busy)} onClick={() => decide("learning", item, "REJECTED")}>Request update</button></div></li>)}{queue.challenges.map((item) => <li key={`c-${item.id}`}><span><strong>{item.participant} · {item.title}</strong><small>{item.submission_note}</small></span><div><button type="button" disabled={Boolean(busy)} onClick={() => decide("challenge", item, "COMPLETED")}>Verify</button><button type="button" disabled={Boolean(busy)} onClick={() => decide("challenge", item, "REJECTED")}>Request update</button></div></li>)}</ul>}</div>}
  </section>;
}
