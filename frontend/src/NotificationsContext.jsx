/* eslint react-refresh/only-export-components: off */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { getArrayResponse, getErrorMessage } from "./dashboardUtils";

/* ------------------------------------------------------------------
   Notifications - ONE shared data layer for every dashboard.
   DashboardShell wraps itself in <NotificationsProvider>, so the sidebar
   badge, the bell dropdown and the Notifications page all read the same list.

   >>> BACKEND URLS: change ONLY this block if your Django URLs differ. <<<
   Each action is a list of requests tried in order; the next one is tried
   only when the server answers 404/405 (endpoint not found / method not allowed).
   List response may be an array or { results: [...], next }.
   ------------------------------------------------------------------ */
export const NOTIFICATION_API = {
  list: "/notifications/",
  read: (id) => [
    ["post", `/notifications/${id}/read/`],
    ["patch", `/notifications/${id}/`, { is_read: true }],
  ],
  readAll: [
    ["post", "/notifications/read-all/"],
    ["post", "/notifications/mark-all-read/"],
  ],
  remove: (id) => [["delete", `/notifications/${id}/`]],
};
const POLL_MS = 60000;

/* Categories shown as tabs / checkboxes (same order as the design) */
export const CATEGORIES = [
  { id: "announcements", label: "Announcements", icon: "plane", tone: "blue" },
  { id: "leave", label: "Leave", icon: "file", tone: "red" },
  { id: "attendance", label: "Attendance", icon: "clock", tone: "teal" },
  { id: "tasks", label: "Tasks", icon: "file", tone: "indigo" },
  { id: "mentions", label: "Mentions", icon: "@", tone: "red" },
  { id: "system", label: "System", icon: "gear", tone: "amber" },
];
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

/* Where a click should go when the notification has no explicit target (only if the dashboard has that section) */
export const CATEGORY_SECTION = { leave: "leave", attendance: "attendance" };

/* ---------------- normalizer: tolerant of different backend field names ---------------- */
function categoryOf(raw) {
  const text = [raw.category, raw.notification_type, raw.type, raw.kind, raw.event_type].filter(Boolean).join(" ").toLowerCase();
  if (/announce/.test(text)) return "announcements";
  if (/leave/.test(text)) return "leave";
  if (/attend|check|break|exception/.test(text)) return "attendance";
  if (/task/.test(text)) return "tasks";
  if (/mention/.test(text)) return "mentions";
  return "system";
}

export function normalizeNotification(raw = {}) {
  const target = String(raw.target_section ?? raw.section ?? raw.target ?? "");
  return {
    id: raw.id ?? raw.pk,
    category: categoryOf(raw),
    title: raw.title ?? raw.subject ?? raw.heading ?? "Notification",
    message: raw.message ?? raw.body ?? raw.description ?? raw.text ?? "",
    createdAt: raw.created_at ?? raw.created ?? raw.timestamp ?? raw.sent_at ?? "",
    read: Boolean(raw.read_at) || raw.is_read === true || raw.read === true,
    target: /^[a-z][a-z0-9-]*$/i.test(target) ? target : "",
  };
}

export function whenLabel(value) {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, ${time}`;
}

/* ---------------- icons ---------------- */
export function toneOf(n) {
  if (n.category === "leave") return /approv|accept|grant/i.test(n.title) ? "green" : "red";
  return CATEGORY_BY_ID[n.category]?.tone || "grey";
}
export function CatIcon({ id, tone, size = 44 }) {
  const cat = CATEGORY_BY_ID[id] || CATEGORY_BY_ID.system;
  return (
    <span className={`nt-ico ${tone || cat.tone}`} style={{ width: size, height: size }}>
      {cat.icon === "@" ? <b style={{ fontSize: size * 0.48 }}>@</b> : <Icon name={cat.icon} size={Math.round(size * 0.46)} />}
    </span>
  );
}

/* ---------------- provider ---------------- */
async function run(candidates) {
  let last;
  for (const [method, url, body] of candidates) {
    try {
      return await apiClient[method](url, body);
    } catch (e) {
      last = e;
      if (![404, 405].includes(e?.status)) throw e;
    }
  }
  throw last;
}

const Ctx = createContext(null);
const FALLBACK = {
  rows: [], loading: false, error: "", actionError: "", unread: 0,
  clearActionError() {}, reload() {}, markRead() {}, markAllRead() {}, remove() {},
};

export function NotificationsProvider({ children }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get(NOTIFICATION_API.list);
      let items = getArrayResponse(res);
      let next = res?.next;
      for (let page = 2; next && page <= 10; page += 1) {
        const more = await apiClient.get(`${NOTIFICATION_API.list}?page=${page}`);
        items = items.concat(getArrayResponse(more));
        next = more?.next;
      }
      setRows(items.map(normalizeNotification).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setError("");
    } catch (e) {
      setError(getErrorMessage(e, "Could not load notifications."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
    const timer = setInterval(load, POLL_MS);
    window.addEventListener("focus", load);
    return () => { clearInterval(timer); window.removeEventListener("focus", load); };
  }, [load]);

  const markRead = useCallback(async (id) => {
    setRows((r) => r.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try { await run(NOTIFICATION_API.read(id)); } catch (e) {
      setRows((r) => r.map((n) => (n.id === id ? { ...n, read: false } : n)));
      setActionError(getErrorMessage(e, "Could not mark this notification as read."));
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const ids = rows.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    setRows((r) => r.map((n) => ({ ...n, read: true })));
    try {
      try { await run(NOTIFICATION_API.readAll); } catch (e) {
        if (![404, 405].includes(e?.status)) throw e;
        await Promise.all(ids.map((id) => run(NOTIFICATION_API.read(id)))); // no bulk endpoint: mark one by one
      }
    } catch (e) {
      setActionError(getErrorMessage(e, "Could not mark all notifications as read."));
      load();
    }
  }, [rows, load]);

  const remove = useCallback(async (id) => {
    setRows((r) => r.filter((n) => n.id !== id));
    try { await run(NOTIFICATION_API.remove(id)); } catch (e) {
      setActionError(getErrorMessage(e, "Could not delete this notification."));
      load();
    }
  }, [load]);

  const value = useMemo(() => ({
    rows, loading, error, actionError, unread: rows.filter((n) => !n.read).length,
    clearActionError: () => setActionError(""), reload: load, markRead, markAllRead, remove,
  }), [rows, loading, error, actionError, load, markRead, markAllRead, remove]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useNotificationsContext = () => useContext(Ctx) || FALLBACK;