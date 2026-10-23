import { useCallback, useEffect, useState } from "react";
import apiClient from "./api/client.js";

/* ------------------------------------------------------------------
   ONE place for the settings shared by every dashboard
   ------------------------------------------------------------------ */
// true  = sample numbers/charts where no API exists yet (design preview)
// false = real data only; unconnected cards show "—" / empty states
// Production screens must never replace unavailable API data with plausible-looking samples.
export const SHOW_DEMO_DATA = false;

// Employee list API (used by "My People" and the HR employee table)
export const EMPLOYEES_ENDPOINT = "/employees/";

export const AVATAR_TONES = ["#dbeafe", "#fde8dc", "#dcf5ea", "#e9e3fb", "#fff0cf"];

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */
export function getArrayResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.results)) return response.results;
  return [];
}

export function getErrorMessage(error, fallback) {
  if (error?.status === 401) return "Your session has expired. Please sign in again.";
  if (error?.status === 403) return "Your account does not have permission to access this information.";
  return error?.message || fallback;
}

function pickName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.name || value.full_name || value.title || "";
}

export function initialsOf(name = "") {
  return (
    String(name).split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?"
  );
}

export function normalizeEmployee(raw) {
  const full =
    [raw.first_name, raw.last_name].filter(Boolean).join(" ") ||
    raw.full_name ||
    raw.name ||
    "";
  return {
    id: raw.id ?? raw.employee_code ?? raw.official_email,
    code: raw.employee_code || "—",
    name: full || raw.official_email || "—",
    firstName: raw.first_name || "",
    lastName: raw.last_name || "",
    email: raw.official_email || raw.email || "—",
    department: pickName(raw.department_name) || "—",
    departmentId: raw.department ?? null,
    designation: pickName(raw.designation_title) || "—",
    designationId: raw.designation ?? null,
    status: raw.employment_status || "—",
    phone: raw.phone_number || "—",
    manager: pickName(raw.manager_name) || "—",
    managerId: raw.manager ?? null,
    role: raw.portal_role || "—",
    joined: raw.date_of_joining || "",
    exitDate: raw.date_of_exit || "",
    location: pickName(raw.work_location_name) || "—",
    employmentType: raw.employment_type || "—",
    activation: raw.account_activation_status || "",
    hasUser: Boolean(raw.user),
  };
}

const STATUS_LABELS = {
  PREBOARDING: "Preboarding",
  ACTIVE: "Active",
  NOTICE_PERIOD: "Notice period",
  EXITED: "Exited",
};
export function statusLabel(status) {
  return STATUS_LABELS[status] || status || "—";
}

const ACTIVATION_LABELS = {
  EMAIL_PENDING: "Invitation email queued; delivery not yet confirmed",
  ACTIVATION_PENDING: "Invitation sent; account not activated",
  DELIVERY_FAILED: "Invitation delivery failed",
  INVITATION_EXPIRED: "Invitation expired",
  INVITATION_REVOKED: "Invitation revoked",
  ACTIVATED: "Account activated",
  NOT_INVITED: "No invitation recorded",
  NO_PORTAL_ACCOUNT: "No linked portal account",
};
export function activationText(status) {
  return ACTIVATION_LABELS[status] || status || "—";
}

export function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDate(value) {
  if (!value) return "—";
  // A date-only value must not be parsed as UTC (it would shift a day).
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/* ------------------------------------------------------------------
   useEmployees - loads and normalizes the employee list
   ------------------------------------------------------------------ */
export function useEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get(EMPLOYEES_ENDPOINT);
      setEmployees(getArrayResponse(res).map(normalizeEmployee));
    } catch (err) {
      setEmployees([]);
      setError(getErrorMessage(err, "Could not load employee records."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => reload());
  }, [reload]);

  return { employees, loading, error, reload };
}

/* Generic API call that gives a clear message if your apiClient lacks a method. */
export async function callApi(method, url, body) {
  const fn = apiClient[method];
  if (typeof fn !== "function") {
    throw new Error(`apiClient.${method}() is not available. Add it to api/client.js.`);
  }
  return body === undefined ? fn.call(apiClient, url) : fn.call(apiClient, url, body);
}

export function statusTone(status = "") {
  if (/inactive|exited|terminated|resign|repair|reject|unavailable|failed|expired/i.test(status)) return "bad";
  if (/leave|notice|pending|restricted|festival/i.test(status)) return "warn";
  if (/assigned|preboard|national/i.test(status)) return "info";
  return "ok";
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* Loads a simple list for dropdowns; returns [{id, name}] (empty if API fails). */
export function useOptions(endpoint) {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    let cancelled = false;
    apiClient
      .get(endpoint)
      .then((res) => {
        if (cancelled) return;
        setOptions(
          getArrayResponse(res).map((o) => ({
            id: o.id ?? o.code ?? o.name,
            name: o.name || o.title || o.label || String(o.id),
          })),
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [endpoint]);
  return options;
}

/* Download rows (array of arrays) as a CSV file. Guards against spreadsheet formula injection. */
export function downloadCsv(filename, rows) {
  const esc = (value) => {
    let text = String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = rows.map((row) => row.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
