import { useMemo, useState } from "react";
import { Icon } from "./DashboardIcons";
import "./DashboardParts.css";
import "./AdminPages.css"; /* styles for <Pager /> (ap-pager) */

export function StatCard({ icon, tone = "green", label, value, note, noteClass = "", onClick }) {
  return (
    <button type="button" className="admin-stat-card" onClick={onClick}>
      <span className={`admin-stat-icon ${tone}`}><Icon name={icon} size={24} /></span>
      <span className="admin-stat-body">
        <p>{label}</p>
        <h3>{value ?? "—"}</h3>
        <small className={noteClass}>{note}</small>
      </span>
      {onClick && <span className="admin-stat-arrow"><Icon name="chevron" size={18} /></span>}
    </button>
  );
}

export function NotConnected({ title, text }) {
  return (
    <div className="dash-notice" role="status">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export function WelcomeBanner({ name, text }) {
  const first = (name || "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date();
  return (
    <section className="admin-welcome-banner">
      <span className="admin-welcome-icon"><Icon name="sun" size={26} /></span>
      <div className="admin-welcome-copy">
        <h2>{greeting}, {first}</h2>
        <p>{text}</p>
      </div>
      <div className="admin-welcome-date">
        <span>{today.toLocaleDateString("en-GB", { weekday: "long" })}</span>
        <strong>{today.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</strong>
        <small>Have a productive day!</small>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   Pager - pagination bar used by the HR / table pages.
   Flexible on purpose: it accepts the common prop names, so existing
   <Pager ... /> calls keep working.
     current page   : page | current
     total pages    : pages | totalPages        (or computed from total / pageSize)
     total items    : total | totalItems | count
     rows per page  : pageSize | size | perPage (default 10)
     on page change : onPage | onPageChange | onChange | setPage
     label          : noun | label  (e.g. "employees")
     rows selector  : onSize | onPageSizeChange  (optional, shows "10 / page")
   ------------------------------------------------------------------ */
export function Pager(props) {
  const {
    page: pageProp, current, pages, totalPages, total: totalProp, totalItems, count,
    pageSize, size, perPage, onPage, onPageChange, onChange, setPage,
    noun, label = "items", onSize, onPageSizeChange,
  } = props;

  const per = Number(pageSize || size || perPage || 10);
  const total = Number(totalProp ?? totalItems ?? count ?? 0);
  const lastPage = Math.max(1, Number(pages || totalPages || Math.ceil(total / per) || 1));
  const page = Math.min(Math.max(1, Number(pageProp ?? current ?? 1)), lastPage);
  const change = onPage || onPageChange || onChange || setPage;
  const sizeChange = onSize || onPageSizeChange;
  const go = (n) => change?.(Math.min(Math.max(1, n), lastPage));

  const from = total ? (page - 1) * per + 1 : 0;
  const to = Math.min(total, page * per);

  const nums = [];
  for (let n = 1; n <= lastPage; n += 1) {
    if (n === 1 || n === lastPage || Math.abs(n - page) <= 1) nums.push(n);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }

  return (
    <div className="ap-pager">
      <span>{total ? `Showing ${from} to ${to} of ${total} ${noun || label}` : `Page ${page} of ${lastPage}`}</span>
      <div className="ap-pager-btns">
        <button type="button" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <Icon name="chevleft" size={14} />
        </button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`gap${i}`} className="ap-gap">…</span>
          ) : (
            <button key={n} type="button" className={n === page ? "on" : ""} aria-current={n === page ? "page" : undefined} onClick={() => go(n)}>
              {n}
            </button>
          ),
        )}
        <button type="button" onClick={() => go(page + 1)} disabled={page >= lastPage} aria-label="Next page">
          <Icon name="chevron" size={14} />
        </button>
        {sizeChange && (
          <select value={per} onChange={(e) => sizeChange(Number(e.target.value))} aria-label="Rows per page">
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LEGEND = [
  ["present", "Present"],
  ["late", "Late"],
  ["absent", "Absent"],
  ["leave", "On Leave"],
];

const keyOf = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/* marks: { "YYYY-MM-DD": "present" | "late" | "absent" | "leave" } */
export function MonthCalendar({ marks = {}, title = true }) {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1).getDay();
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const out = Array(first).fill(null);
    for (let d = 1; d <= days; d += 1) out.push(d);
    return out;
  }, [cursor]);

  const shift = (delta) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const isToday = (d) =>
    d === now.getDate() && cursor.m === now.getMonth() && cursor.y === now.getFullYear();

  return (
    <div className="dash-calendar">
      <div className="dash-calendar-head">
        {title && (
          <h3>{new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h3>
        )}
        <div className="dash-calendar-nav">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <button type="button" onClick={() => shift(1)} aria-label="Next month">›</button>
          <button type="button" className="dash-today" onClick={() => setCursor({ y: now.getFullYear(), m: now.getMonth() })}>
            Today
          </button>
        </div>
      </div>

      <div className="dash-calendar-grid" role="grid">
        {WEEKDAYS.map((w) => <span key={w} className="dash-weekday">{w}</span>)}
        {cells.map((d, i) =>
          d === null ? (
            <span key={`e${i}`} />
          ) : (
            <span key={d} className={`dash-day${isToday(d) ? " today" : ""}`}>
              {d}
              {marks[keyOf(cursor.y, cursor.m, d)] && (
                <i className={`dash-mark ${marks[keyOf(cursor.y, cursor.m, d)]}`} />
              )}
            </span>
          ),
        )}
      </div>

      <div className="dash-legend">
        {LEGEND.map(([k, label]) => (
          <span key={k}><i className={`dash-mark ${k}`} /> {label}</span>
        ))}
      </div>
    </div>
  );
}
