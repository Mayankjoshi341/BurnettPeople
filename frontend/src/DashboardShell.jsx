import { useEffect, useRef, useState } from "react";
import { Icon } from "./DashboardIcons";
import { userDisplayName, userInitials, roleLabel } from "./auth/userDisplay";
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
*/
export default function DashboardShell({
  rootClass = "",
  user,
  onLogout,
  nav,
  section,
  setSection,
  title,
  subtitle,
  searchPlaceholder = "Search...",
  unread = 0,
  homePath = "/",
  footerLabel = "Workspace",
  children,
}) {
  const [bellOpen, setBellOpen] = useState(false);
  const searchRef = useRef(null);
  const name = userDisplayName(user);

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
              {item.badge && unread > 0 && <span className="admin-nav-badge">{Math.min(unread, 99)}</span>}
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
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="admin-header-actions">
            <label className="admin-search">
              <Icon name="search" size={18} />
              <input ref={searchRef} type="search" placeholder={searchPlaceholder} aria-label="Search" />
              <kbd>Ctrl + K</kbd>
            </label>

            <div className="admin-notification-wrap">
              <button
                type="button"
                className="admin-notification-button"
                onClick={() => setBellOpen((o) => !o)}
                aria-label="Notifications"
                aria-expanded={bellOpen}
              >
                <Icon name="bell" size={20} />
                {unread > 0 && <span className="admin-notification-count">{Math.min(unread, 99)}</span>}
              </button>
              {bellOpen && (
                <div className="admin-notification-popover" role="status">
                  {unread > 0 ? `You have ${unread} items waiting for your action.` : "You're all caught up."}
                </div>
              )}
            </div>

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
          {children}
          <footer className="admin-footer">
            <span>© 2026 BurnettPeople</span>
            <span>{footerLabel}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
