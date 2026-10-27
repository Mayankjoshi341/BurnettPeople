import { useEffect, useMemo, useState } from "react";
import { Icon } from "./DashboardIcons";
import { CATEGORIES, CatIcon, toneOf, useNotificationsContext, whenLabel } from "./NotificationsContext";
import "./Notifications.css";

/* Notifications page - the SAME component for Admin / HR / Manager / Employee.
   Rendered by DashboardShell when section === "notifications".
   onOpen(n): called when a row is clicked (Shell marks it read and navigates if a target exists). */

const dayKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const isNew = (n) => !n.read && Date.now() - new Date(n.createdAt).getTime() < 2 * 3600 * 1000;

function Pager({ page, pages, total, size, onPage, onSize }) {
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const nums = [];
  for (let n = 1; n <= pages; n += 1) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) nums.push(n);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <div className="nt-pager">
      <span>Showing {from} to {to} of {total}</span>
      <div>
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><Icon name="chevleft" size={14} /></button>
        {nums.map((n, i) => (n === "…" ? <span key={`e${i}`}>…</span> : <button key={n} type="button" className={n === page ? "on" : ""} onClick={() => onPage(n)}>{n}</button>))}
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page"><Icon name="chevron" size={14} /></button>
        <select value={size} onChange={(e) => onSize(Number(e.target.value))} aria-label="Rows per page">
          {[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>
    </div>
  );
}

export default function Notifications({ onOpen }) {
  const { rows, loading, error, actionError, clearActionError, unread, reload, markRead, markAllRead, remove } = useNotificationsContext();
  const [types, setTypes] = useState([]); // selected category ids ([] = all)
  const [view, setView] = useState("all"); // all | unread
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [menu, setMenu] = useState(null);

  useEffect(() => {
    if (menu === null) return undefined;
    const close = (e) => { if (!e.target.closest?.(".nt-kebab-wrap")) setMenu(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const counts = useMemo(() => {
    const c = {};
    rows.forEach((n) => { c[n.category] = (c[n.category] || 0) + 1; });
    return c;
  }, [rows]);

  const filtered = useMemo(() => rows.filter((n) => {
    const day = dayKey(n.createdAt);
    return (view !== "unread" || !n.read)
      && (!types.length || types.includes(n.category))
      && (!from || (day && day >= from))
      && (!to || (day && day <= to));
  }), [rows, view, types, from, to]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * size, safePage * size);

  const tabs = [
    { id: "all", label: "All", count: rows.length },
    { id: "unread", label: "Unread", count: unread },
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: counts[c.id] || 0 })),
  ];
  const activeTab = types.length === 0 ? view : types.length === 1 ? types[0] : "";

  function selectTab(id) {
    setPage(1);
    if (id === "all" || id === "unread") { setView(id); setTypes([]); } else { setView("all"); setTypes([id]); }
  }
  const toggleType = (id) => { setPage(1); setTypes((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id])); };
  const clearFilters = () => { setPage(1); setView("all"); setTypes([]); setFrom(""); setTo(""); };

  return (
    <div className="nt-page">
      {error && <div className="nt-alert" role="alert">{error} <button type="button" className="nt-link" onClick={reload}>Try again</button></div>}
      {actionError && <div className="nt-alert" role="alert">{actionError} <button type="button" className="nt-link" onClick={clearActionError}>Dismiss</button></div>}

      <div className="nt-layout">
        <section className="nt-card nt-main" aria-label="Notifications list">
          <div className="nt-tabs-row">
            <div className="nt-tabs" role="tablist">
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={activeTab === t.id} className={activeTab === t.id ? "on" : ""} onClick={() => selectTab(t.id)}>
                  {t.label} <span className="nt-count">{t.count}</span>
                </button>
              ))}
            </div>
            {unread > 0 && <button type="button" className="nt-link nt-markall" onClick={markAllRead}>Mark all as read</button>}
          </div>

          {loading ? <p className="nt-empty">Loading notifications…</p> : visible.length ? (
            <ul className="nt-list">
              {visible.map((n) => (
                <li key={n.id} className={`nt-row${n.read ? "" : " unread"}`}>
                  <i className="nt-dot" aria-hidden="true" />
                  <button type="button" className="nt-open" onClick={() => onOpen?.(n)}>
                    <CatIcon id={n.category} tone={toneOf(n)} size={46} />
                    <span className="nt-copy"><strong>{n.title}</strong><span>{n.message}</span></span>
                  </button>
                  <span className="nt-when">{whenLabel(n.createdAt)}</span>
                  <span className="nt-flag">{isNew(n) && <em>New</em>}</span>
                  <span className="nt-kebab-wrap">
                    <button type="button" className="nt-kebab" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu === n.id} onClick={() => setMenu(menu === n.id ? null : n.id)}>
                      <Icon name="more" size={18} />
                    </button>
                    {menu === n.id && (
                      <div className="nt-menu" role="menu">
                        {!n.read && <button type="button" role="menuitem" onClick={() => { markRead(n.id); setMenu(null); }}>Mark as read</button>}
                        <button type="button" role="menuitem" className="danger" onClick={() => { remove(n.id); setMenu(null); }}>Delete</button>
                      </div>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="nt-empty">{rows.length ? "No notifications match these filters." : "You’re all caught up. Updates about leave, attendance, tasks and announcements will appear here."}</p>
          )}

          {!loading && filtered.length > 0 && (
            <Pager page={safePage} pages={pages} total={filtered.length} size={size} onPage={(n) => setPage(Math.min(Math.max(1, n), pages))} onSize={(n) => { setSize(n); setPage(1); }} />
          )}
        </section>

        <aside className="nt-card nt-side" aria-label="Filters">
          <h3>Notification Type</h3>
          <ul className="nt-types">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <label>
                  <input type="checkbox" checked={types.includes(c.id)} onChange={() => toggleType(c.id)} />
                  <CatIcon id={c.id} size={32} />
                  <span>{c.label}</span>
                  <span className="nt-count">{counts[c.id] || 0}</span>
                </label>
              </li>
            ))}
          </ul>

          <h3>Date Range</h3>
          <div className="nt-dates">
            <label><span>From</span><input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></label>
            <label><span>To</span><input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></label>
          </div>

          <button type="button" className="nt-clear" onClick={clearFilters}><Icon name="refresh" size={16} /> Clear Filters</button>
        </aside>
      </div>
    </div>
  );
}