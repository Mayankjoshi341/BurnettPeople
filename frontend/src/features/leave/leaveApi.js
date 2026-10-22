import { useCallback, useEffect, useState } from "react";

import apiClient from "../../api/client.js";
import { getArrayResponse, getErrorMessage } from "../../dashboardUtils.js";

/* ------------------------------------------------------------------
   Leave API contract (Day 4)
   Based on the "Initial API Contract" in the 6-day plan. If the backend
   uses different URLs or field names, change ONLY this file.

   GET  /leave-requests/              own requests (employee) / team (manager) / all (HR)
   POST /leave-requests/              { leave_type, start_date, end_date, reason }
   POST /leave-requests/{id}/approve/
   POST /leave-requests/{id}/reject/
   GET  /leave-balances/              balances of the signed-in employee
   GET  /leave-types/                 leave types for the apply form
   POST /leave-messages/draft/        { leave_type, start_date, end_date, notes } -> { draft }
                                      (the AI draft NEVER submits or approves a request)
   ------------------------------------------------------------------ */
export const LEAVE_ENDPOINTS = {
  requests: "/leave-requests/",
  approve: (id) => `/leave-requests/${id}/approve/`,
  reject: (id) => `/leave-requests/${id}/reject/`,
  balances: "/leave-balances/",
  types: "/leave-types/",
  draft: "/leave-messages/draft/",
};

const AI_DRAFT_TIMEOUT_MS = 25000;

/* ---------- small helpers ---------- */
const firstNumber = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
};

const parseDay = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

const toIso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const pretty = (value = "") =>
  String(value).toLowerCase().replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function formatLeaveRange(start, end) {
  const a = parseDay(start);
  const b = parseDay(end || start);
  if (!a) return "—";
  const full = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  if (!b || toIso(a) === toIso(b)) return full(a);
  const short = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return a.getFullYear() === b.getFullYear() ? `${short(a)} – ${full(b)}` : `${full(a)} – ${full(b)}`;
}

/* Inclusive number of Mon–Fri days between two ISO dates. This is only an
   estimate for the form; the server decides the real working-day count. */
export function estimateWorkingDays(start, end) {
  const a = parseDay(start);
  const b = parseDay(end);
  if (!a || !b || b < a) return 0;
  let count = 0;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

export function dayLabel(count) {
  if (count === null || count === undefined) return "—";
  return `${count} ${Number(count) === 1 ? "day" : "days"}`;
}

/* True when two inclusive ISO date ranges share at least one day. */
export function rangesOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return startA <= endB && startB <= endA;
}

/* ---------- normalizers ---------- */
const STATUS_LABELS = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled", CANCELED: "Cancelled" };

export function normalizeLeaveType(raw, index = 0) {
  return {
    id: String(raw.id ?? raw.code ?? raw.name ?? index),
    name: raw.name || raw.title || raw.label || `Leave type ${index + 1}`,
  };
}

export function normalizeLeaveBalance(raw, index = 0, typeNames = {}) {
  const typeId = raw.leave_type?.id ?? raw.leave_type;
  const name =
    raw.leave_type_name ||
    raw.leave_type?.name ||
    typeNames[String(typeId)] ||
    raw.name ||
    `Leave type ${index + 1}`;
  const total = firstNumber(raw.total_days, raw.allocated_days, raw.allocated, raw.entitled, raw.total, raw.opening_balance);
  const used = firstNumber(raw.used_days, raw.used, raw.taken_days, raw.taken) ?? 0;
  const remaining = firstNumber(raw.remaining_days, raw.remaining, raw.available_days, raw.available, raw.balance)
    ?? (total !== null ? total - used : null);
  return {
    id: String(raw.id ?? `${typeId}-${index}`),
    typeId: typeId === undefined ? "" : String(typeId),
    name,
    total: total ?? (remaining !== null ? remaining + used : null),
    used,
    remaining,
  };
}

export function normalizeLeaveRequest(raw, index = 0, typeNames = {}) {
  const typeId = raw.leave_type?.id ?? raw.leave_type;
  const type =
    raw.leave_type_name ||
    raw.leave_type?.name ||
    typeNames[String(typeId)] ||
    (typeof raw.leave_type === "string" ? raw.leave_type : "") ||
    "Leave";
  const start = raw.start_date || "";
  const end = raw.end_date || start;
  const daysCount = firstNumber(raw.total_days, raw.days, raw.duration_days, raw.working_days);
  const statusKey = String(raw.status || "PENDING").toUpperCase();
  const employee = raw.employee && typeof raw.employee === "object" ? raw.employee : {};

  return {
    id: raw.id ?? `leave-${index}`,
    name: raw.employee_name || employee.full_name || employee.name || "—",
    code: raw.employee_code || employee.employee_code || "—",
    department: raw.department_name || employee.department_name || "—",
    type,
    typeId: typeId === undefined ? "" : String(typeId),
    start,
    end,
    dates: formatLeaveRange(start, end),
    daysCount,
    days: daysCount === null ? "" : dayLabel(daysCount),
    reason: raw.reason || raw.message || "",
    statusKey,
    status: STATUS_LABELS[statusKey] || pretty(statusKey),
    reviewer: raw.reviewed_by_name || raw.approver_name || "",
    reviewComment: raw.review_comment || raw.reviewer_comment || raw.decision_note || "",
    submittedAt: raw.created_at || raw.submitted_at || "",
  };
}

/* Calendar marks for the approved leave days (MonthCalendar "leave" dot). */
export function leaveMarks(requests) {
  const marks = {};
  requests
    .filter((r) => r.statusKey === "APPROVED")
    .forEach((r) => {
      const a = parseDay(r.start);
      const b = parseDay(r.end);
      if (!a || !b) return;
      for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) marks[toIso(d)] = "leave";
    });
  return marks;
}

/* Requests whose end date is today or later, soonest first. */
export function upcomingLeave(requests, today = toIso(new Date())) {
  return requests
    .filter((r) => (r.statusKey === "APPROVED" || r.statusKey === "PENDING") && r.end && r.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start));
}

/* ---------- data hook ---------- */
/* Loads requests (+ optional balances and leave types). Each part fails on its own. */
export function useLeaveData({ balances: withBalances = false, types: withTypes = false } = {}) {
  const [state, setState] = useState({
    requests: [],
    balances: [],
    types: [],
    errors: { requests: "", balances: "", types: "" },
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [requestsResult, balancesResult, typesResult] = await Promise.allSettled([
      apiClient.get(LEAVE_ENDPOINTS.requests),
      withBalances ? apiClient.get(LEAVE_ENDPOINTS.balances) : Promise.resolve(null),
      withTypes ? apiClient.get(LEAVE_ENDPOINTS.types) : Promise.resolve(null),
    ]);

    const types = typesResult.status === "fulfilled" && typesResult.value
      ? getArrayResponse(typesResult.value).map(normalizeLeaveType)
      : [];
    const typeNames = Object.fromEntries(types.map((t) => [t.id, t.name]));

    setState({
      requests: requestsResult.status === "fulfilled"
        ? getArrayResponse(requestsResult.value).map((r, i) => normalizeLeaveRequest(r, i, typeNames))
        : [],
      balances: balancesResult.status === "fulfilled" && balancesResult.value
        ? getArrayResponse(balancesResult.value).map((r, i) => normalizeLeaveBalance(r, i, typeNames))
        : [],
      types,
      errors: {
        requests: requestsResult.status === "rejected"
          ? getErrorMessage(requestsResult.reason, "Could not load leave requests.") : "",
        balances: balancesResult.status === "rejected"
          ? getErrorMessage(balancesResult.reason, "Could not load your leave balance.") : "",
        types: typesResult.status === "rejected"
          ? getErrorMessage(typesResult.reason, "Could not load leave types.") : "",
      },
    });
    setLoading(false);
  }, [withBalances, withTypes]);

  useEffect(() => {
    void Promise.resolve().then(() => reload());
  }, [reload]);

  return { ...state, loading, reload };
}

/* ---------- actions ---------- */
export function submitLeaveRequest({ leaveType, startDate, endDate, reason }) {
  return apiClient.post(LEAVE_ENDPOINTS.requests, {
    leave_type: /^\d+$/.test(String(leaveType)) ? Number(leaveType) : leaveType,
    start_date: startDate,
    end_date: endDate,
    reason: reason.trim(),
  });
}

export function decideLeaveRequest(id, action) {
  if (action !== "approve" && action !== "reject") {
    return Promise.reject(new Error("Unknown leave decision."));
  }
  return apiClient.post(LEAVE_ENDPOINTS[action](id), {});
}

/* Asks the server for an AI-written message. It only returns text: the request
   is never submitted from here. Resolves to the draft string. */
export async function requestLeaveDraft({ leaveType, startDate, endDate, notes }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_DRAFT_TIMEOUT_MS);
  try {
    const response = await apiClient.post(
      LEAVE_ENDPOINTS.draft,
      {
        leave_type: /^\d+$/.test(String(leaveType)) ? Number(leaveType) : leaveType,
        start_date: startDate,
        end_date: endDate,
        notes: notes || "",
      },
      { signal: controller.signal },
    );
    const draft = response?.draft ?? response?.message ?? response?.text ?? response?.content ?? "";
    if (typeof draft !== "string" || !draft.trim()) {
      throw new Error("The assistant did not return a message. Please try again or write your own.");
    }
    return draft.trim();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The assistant took too long to respond. Please try again or write your own message.", { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
