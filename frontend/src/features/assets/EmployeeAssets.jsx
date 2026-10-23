import { Icon } from "../../DashboardIcons";
import { formatAssetDate } from "./assetApi";

/* Employee "My Assets" page: devices currently with the employee, plus the
   ones they have handed back. Read-only; HR assigns and receives devices. */
export function MyAssetsPage({ assets }) {
  const { rows, active, loading, error } = assets;
  const returned = rows.filter((r) => !r.isActive);

  return (
    <>
      <section className="admin-panel" aria-labelledby="mya-title">
        <div className="admin-panel-heading"><div><h2 id="mya-title">My Assets</h2><p>Devices and equipment assigned to you</p></div></div>
        {error && <div className="admin-form-error" role="alert">{error}</div>}
        {loading ? (
          <p className="admin-note">Loading your devices…</p>
        ) : active.length === 0 ? (
          <p className="admin-note">No devices are assigned to you right now.</p>
        ) : (
          active.map((r) => (
            <div className="emp-info-row" key={r.id}>
              <span className="emp-info-icon"><Icon name="laptop" size={18} /></span>
              <span>
                <strong>{r.assetName}</strong>
                <small>{[r.assetTag !== "—" && r.assetTag, r.serial !== "—" && `Serial ${r.serial}`, `Assigned ${formatAssetDate(r.assignedDate)}`].filter(Boolean).join(" · ")}</small>
                {r.expectedReturn && <small>Expected return {formatAssetDate(r.expectedReturn)}</small>}
              </span>
              <span className="admin-status status-completed emp-right">Assigned</span>
            </div>
          ))
        )}
      </section>

      {!loading && returned.length > 0 && (
        <section className="admin-panel" aria-labelledby="myah-title">
          <div className="admin-panel-heading"><div><h2 id="myah-title">Assignment History</h2><p>Devices you have returned</p></div></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>DEVICE</th><th>ASSET TAG</th><th>ASSIGNED</th><th>RETURNED</th><th>CONDITION</th></tr></thead>
              <tbody>
                {returned.map((r) => (
                  <tr key={r.id}>
                    <td><strong>{r.assetName}</strong></td>
                    <td>{r.assetTag}</td>
                    <td>{formatAssetDate(r.assignedDate)}</td>
                    <td>{formatAssetDate(r.returnedDate)}</td>
                    <td>{r.condition || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

/* Small list used on the employee overview. */
export function MyAssetsPreview({ assets }) {
  const { active, loading, error } = assets;
  if (loading) return <p className="admin-note">Loading your devices…</p>;
  if (error) return <div className="admin-form-error" role="alert">{error}</div>;
  if (active.length === 0) return <p className="admin-note">No devices are assigned to you right now.</p>;
  return active.slice(0, 3).map((r) => (
    <div className="emp-info-row" key={r.id}>
      <span className="emp-info-icon tone-blue"><Icon name="laptop" size={18} /></span>
      <span><strong>{r.assetName}</strong><small>{r.assetTag !== "—" ? `${r.assetTag} · ` : ""}{formatAssetDate(r.assignedDate)}</small></span>
      <span className="emp-right emp-chevron"><Icon name="arrow" size={14} /></span>
    </div>
  ));
}
