import { useEffect, useRef, useState } from "react";
import { Icon } from "./DashboardIcons";
import { CatIcon, toneOf, useNotificationsContext, whenLabel } from "./NotificationsContext";
import "./Notifications.css";

/* Header bell: unread count + dropdown with the 5 latest notifications.
   onViewAll()  -> open the Notifications page
   onOpen(n)    -> a notification was clicked (Shell marks it read / navigates) */
export default function NotificationBell({ onViewAll, onOpen }) {
  const { rows, unread, markAllRead } = useNotificationsContext();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const latest = rows.slice(0, 5);

  return (
    <div className="admin-notification-wrap" ref={ref}>
      <button type="button" className="admin-notification-button" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} aria-haspopup="dialog">
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="admin-notification-count">{Math.min(unread, 99)}</span>}
      </button>

      {open && (
        <div className="nt-pop" role="dialog" aria-label="Notifications">
          <div className="nt-pop-head">
            <h3>Notifications</h3>
            {unread > 0 && <button type="button" className="nt-link" onClick={markAllRead}>Mark all as read</button>}
          </div>
          {latest.length ? (
            <ul className="nt-pop-list">
              {latest.map((n) => (
                <li key={n.id}>
                  <button type="button" className={n.read ? "" : "unread"} onClick={() => { setOpen(false); onOpen(n); }}>
                    <i className="nt-dot" aria-hidden="true" />
                    <CatIcon id={n.category} tone={toneOf(n)} size={40} />
                    <span className="nt-copy"><strong>{n.title}</strong><span>{n.message}</span></span>
                    <small>{whenLabel(n.createdAt)}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="nt-empty">You&rsquo;re all caught up.</p>}
          <button type="button" className="nt-pop-all" onClick={() => { setOpen(false); onViewAll(); }}>View All Notifications</button>
        </div>
      )}
    </div>
  );
}