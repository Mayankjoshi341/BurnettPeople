import { useCallback, useEffect, useState } from "react";
import apiClient from "./api/client";

/* ------------------------------------------------------------------
   ONE place for the settings shared by every dashboard
   ------------------------------------------------------------------ */
// true  = sample numbers/charts where no API exists yet (design preview)
// false = real data only; unconnected cards show "—" / empty states
export const SHOW_DEMO_DATA = true;

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
  return value.name || value.title || "";
}

export function initialsOf(name = "") {
  return (
    String(name).split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?"
  );
}

export function normalizeEmployee(raw) {
  const full =
    raw.full_name ||
    raw.name ||
    [raw.first_name, raw.last_name].filter(Boolean).join(" ") ||
    "";
  return {
    id: raw.id ?? raw.employee_code ?? raw.email,
    code: raw.employee_code || raw.code || "—",
    name: full || "—",
    email: raw.email || raw.work_email || "—",
    department: pickName(raw.department_name || raw.department) || "—",
    designation: pickName(raw.designation_name || raw.designation) || "—",
    status: raw.employment_status || raw.status || "—",
  };
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