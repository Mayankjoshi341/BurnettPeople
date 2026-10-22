import { useMemo, useState } from "react";

import { Icon } from "../../DashboardIcons";
import { StatCard, Pager } from "../../DashboardParts";
import { AVATAR_TONES, initialsOf } from "../../dashboardUtils";
import { LeaveStatusBadge } from "./LeaveComponents";
import { useLeaveData } from "./leaveApi";
import "../../HRPages.css";

/* HR view of leave: every request with its status. Approval stays with the
   employee's manager (one-level approval), so this page is read-only. */
export default function HRLeave() {
  const { requests, loading, errors, reload } = useLeaveData({ types: true });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);

  const count = (key) => requests.filter((r) => r.statusKey === key).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter(
      (r) =>
        (status === "ALL" || r.statusKey === status) &&
        (!q || [r.name, r.code, r.type, r.department].some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [requests, query, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);

  return (
    <div className="hrp-page">
      {errors.requests && <div className="admin-form-error" role="alert">{errors.requests}</div>}

      <section className="admin-summary-grid" aria-label="Leave summary">
        <StatCard icon="plane" tone="amber" label="Pending" value={loading || errors.requests ? null : count("PENDING")} note="Waiting for manager" />
        <StatCard icon="check" tone="green" label="Approved" value={loading || errors.requests ? null : count("APPROVED")} note="All time" />
        <StatCard icon="alert" tone="red" label="Rejected" value={loading || errors.requests ? null : count("REJECTED")} note="All time" />
        <StatCard icon="file" tone="blue" label="Total Requests" value={loading || errors.requests ? null : requests.length} note="Visible to HR" />
      </section>

      <section className="admin-panel" aria-label="Leave requests">
        <div className="hrp-filters">
          <label className="people-search">
            <Icon name="search" size={16} />
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search by employee, ID, department or leave type..." aria-label="Search leave requests" />
          </label>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button type="button" className="admin-link-button" onClick={() => { setQuery(""); setStatus("ALL"); setPage(1); }}>Clear</button>
          <button type="button" className="admin-link-button" onClick={reload}><Icon name="refresh" size={14} /> Refresh</button>
        </div>

        {loading ? (
          <p className="admin-note">Loading leave requests…</p>
        ) : filtered.length === 0 ? (
          <p className="admin-note">{requests.length === 0 ? "No leave requests have been submitted yet." : "No leave requests match these filters."}</p>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table hrp-table">
                <thead><tr><th>EMPLOYEE</th><th>LEAVE TYPE</th><th>DATES</th><th>DURATION</th><th>REASON</th><th>STATUS</th><th>REVIEWED BY</th></tr></thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={r.id}>
                      <td>
                        <div className="admin-person">
                          <span className="admin-person-avatar" style={{ background: AVATAR_TONES[(start + i) % AVATAR_TONES.length] }}>{initialsOf(r.name)}</span>
                          <span><strong>{r.name}</strong><small>{r.code} · {r.department}</small></span>
                        </div>
                      </td>
                      <td>{r.type}</td>
                      <td>{r.dates}</td>
                      <td>{r.days || "—"}</td>
                      <td>{r.reason || "—"}</td>
                      <td><LeaveStatusBadge request={r} /></td>
                      <td>{r.reviewer || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={safePage} pages={pages} onPage={(n) => setPage(Math.min(Math.max(n, 1), pages))}
              perPage={perPage} total={filtered.length} noun="requests" />
          </>
        )}
      </section>
    </div>
  );
}
