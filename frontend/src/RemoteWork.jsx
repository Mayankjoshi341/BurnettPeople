import { useEffect, useState } from "react";
import apiClient from "./api/client";
import { getErrorMessage } from "./dashboardUtils";
import { Icon } from "./DashboardIcons";
import "./RemoteWork.css";

export default function RemoteWork({ user }) {
  const [rows, setRows] = useState([]);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reviewer = ["ADMIN", "HR", "MANAGER"].includes(user?.role);
  async function load() {
    try { setRows(await apiClient.get("/remote-work/requests/")); setError(""); }
    catch (e) { setError(getErrorMessage(e, "Could not load remote-work requests.")); }
    finally { setLoading(false); }
  }
  useEffect(() => { void Promise.resolve().then(load); }, []);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await apiClient.post("/remote-work/requests/", { work_date: date, reason }); setDate(""); setReason(""); await load(); }
    catch (e) { setError(getErrorMessage(e, "Could not submit your request.")); }
    finally { setBusy(false); }
  }
  async function decide(id, status) {
    setBusy(true); setError("");
    try { await apiClient.post(`/remote-work/requests/${id}/decision/`, { status }); await load(); }
    catch (e) { setError(getErrorMessage(e, "Could not update the request.")); }
    finally { setBusy(false); }
  }
  return <div className="ap-page"><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Remote Work Requests</h2><p>Approved requests are used for the Work From Home Today count.</p></div></div>
    {error && <div role="alert" className="admin-form-error">{error}</div>}
    <div className="rw-layout"><form className="rw-form" onSubmit={submit}><h3>Request a remote work day</h3><label>Work date<input type="date" required min={new Date().toISOString().slice(0,10)} value={date} onChange={(e)=>setDate(e.target.value)} /></label><label>Reason (optional)<textarea maxLength={240} value={reason} onChange={(e)=>setReason(e.target.value)} /></label><button className="admin-primary-button" disabled={busy}><Icon name="home" size={15}/> Submit request</button></form>
      <div className="rw-list"><h3>{reviewer ? "Requests for review" : "My requests"}</h3>{loading ? <p className="admin-note">Loading…</p> : !rows.length ? <p className="admin-note">No remote-work requests yet.</p> : rows.map((row)=><article key={row.id}><div><strong>{row.employee_name || "My request"}</strong><small>{row.work_date} · {row.department || ""}</small><small>{row.status}{row.reason ? ` · ${row.reason}` : ""}</small></div>{reviewer && row.status === "PENDING" && <div className="rw-actions"><button type="button" disabled={busy} onClick={()=>decide(row.id,"APPROVED")}>Approve</button><button type="button" disabled={busy} onClick={()=>decide(row.id,"REJECTED")}>Reject</button></div>}</article>)}</div></div>
  </section></div>;
}
