import { useMemo, useState } from "react";
import { Icon } from "./DashboardIcons";
import "./DashboardParts.css";

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