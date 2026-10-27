import { useEffect, useRef } from "react";
import { Icon } from "./DashboardIcons";
import { userDisplayName, userInitials, roleLabel } from "./auth/userDisplay";
import Notifications from "./Notifications";
import NotificationBell from "./NotificationBell";
import { CATEGORY_SECTION, NotificationsProvider, useNotificationsContext } from "./NotificationsContext";
import "./AdminDashboard.css";
import "./DashboardScale.css";
import burnettLogo from "./assets/burnettpeople-logo.png";
import loginDarkTeal from "./assets/login-dark-teal.png";
import loginSoftMint from "./assets/login-soft-mint.png";

/*
  Common layout for Admin / HR / Employee / Manager dashboards.
  Background images are the same everywhere:
    sidebar   -> login-dark-teal.png
    workspace -> login-soft-mint.png

  Notifications are handled HERE for every role:
    - sidebar badge on the item whose id is "notifications"
    - header bell + dropdown
    - the Notifications page (shown whenever section === "notifications")
  The old `unread` prop is no longer needed (it is ignored).
*/
const NOTIFICATIONS_META = ["Notifications", "Stay updated with important updates, approvals, reminders and announcements."];

function ShellInner({
  rootClass = "",
  user,
  onLogout,
  nav,
  section,
  setSection,
  title,
  subtitle,
  searchPlaceholder = "Search...",
  homePath = "/",
  footerLabel = "Workspace",
  children,
}) {
  const searchRef = useRef(null);
  const name = userDisplayName(user);
  const { unread, markRead } = useNotificationsContext();

  const hasSection = (id) => Boolean(id) && nav.some((item) => item.id === id);
  const showNotifications = () => hasSection("notifications") && setSection("notifications");

  // Click on a notification: mark as read, then open its page when this dashboard has that section.
  function openNotification(n) {
    if (!n.read) markRead(n.id);
    const target = hasSection(n.target) ? n.target : CATEGORY_SECTION[n.category];
    if (hasSection(target)) setSection(target);
  }

  // Ctrl + K focuses the search box
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onNotificationsPage = section === "notifications";
  const [pageTitle, pageSubtitle] = onNotificationsPage ? NOTIFICATIONS_META : [title, subtitle];

  return (
    <div className={`admin-dashboard ${rootClass}`}>
      <aside className="admin-sidebar" style={{ backgroundImage: `url(${loginDarkTeal})` }}>
        <a
          className="admin-brand"
          href={homePath}
          onClick={(e) => {
            e.preventDefault();
            setSection(nav[0].id);
          }}
        >
          <img src={burnettLogo} alt="BurnettPeople" />
          <span>YOUR PEOPLE. YOUR FUTURE.</span>
        </a>

        <nav className="admin-nav" aria-label="Sections">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`admin-nav-link${section === item.id ? " active" : ""}`}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              <span className="admin-nav-icon"><Icon name={item.icon} size={22} /></span>
              {item.label}
              {item.id === "notifications" && unread > 0 && <span className="admin-nav-badge">{Math.min(unread, 99)}</span>}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-sidebar-tagline">
            <span>Building better workplaces together.</span>
            <span className="admin-tagline-arrow"><Icon name="arrow" size={16} /></span>
          </div>
          <div className="admin-sidebar-profile">
            <span className="admin-profile-avatar">{userInitials(user)}</span>
            <span className="admin-profile-details">
              <strong>{name}</strong>
              <small>{roleLabel(user?.role)}</small>
            </span>
            <span className="admin-online-dot" title="Online" />
          </div>
          <button type="button" className="admin-sidebar-logout" onClick={onLogout}>
            <Icon name="logout" size={18} /> Log out
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header-heading">
            <h1>{pageTitle}</h1>
            <p>{pageSubtitle}</p>
          </div>

          <div className="admin-header-actions">
            <label className="admin-search">
              <Icon name="search" size={18} />
              <input ref={searchRef} type="search" placeholder={searchPlaceholder} aria-label="Search" />
              <kbd>Ctrl + K</kbd>
            </label>

            <NotificationBell onViewAll={showNotifications} onOpen={openNotification} />

            <div className="admin-header-profile">
              <span className="admin-topbar-avatar">{userInitials(user)}</span>
              <span className="admin-topbar-user-details">
                <strong>{name}</strong>
                <small>{roleLabel(user?.role)}</small>
              </span>
            </div>
          </div>
        </header>

        <main className="admin-workspace" style={{ backgroundImage: `url(${loginSoftMint})` }}>
          {onNotificationsPage ? <Notifications onOpen={openNotification} /> : children}
          <footer className="admin-footer">
            <span>© 2026 BurnettPeople</span>
            <span>{footerLabel}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default function DashboardShell(props) {
  return (
    <NotificationsProvider>
      <ShellInner {...props} />
    </NotificationsProvider>
  );
}