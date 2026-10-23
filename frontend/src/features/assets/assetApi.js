import { useCallback, useEffect, useState } from "react";

import apiClient from "../../api/client.js";
import { getArrayResponse, getErrorMessage } from "../../dashboardUtils.js";

/* ------------------------------------------------------------------
   Asset API contract (Day 4)
   Based on the "Initial API Contract" in the 6-day plan. If the backend
   uses different URLs or field names, change ONLY this file.

   GET/POST /assets/                         list / register a laptop
   POST     /assets/{id}/assign/             { employee, assigned_date, expected_return_date, location, notes }
   GET      /asset-assignments/              assignment rows, scoped by the server to the caller's role
                                             (employee: own; HR: all). Filter with ?asset=<id>
   POST     /asset-assignments/{id}/return/  { returned_date, condition, notes }
   ------------------------------------------------------------------ */
export const ASSET_ENDPOINTS = {
  assets: "/assets/",
  assign: () => "/assets/assignments/",
  assignments: "/assets/assignments/",
  returnAsset: (assignmentId) => `/assets/assignments/${assignmentId}/return/`,
};

export const RETURN_CONDITIONS = ["Good", "Fair", "Damaged"];

const pretty = (value = "") =>
  String(value).toLowerCase().replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const STATUS_LABELS = {
  AVAILABLE: "Available",
  ASSIGNED: "Assigned",
  IN_REPAIR: "In Repair",
  REPAIR: "In Repair",
  RETIRED: "Retired",
};
export const assetStatusLabel = (status) => STATUS_LABELS[String(status || "").toUpperCase()] || pretty(status) || "—";

const text = (value) => (value === null || value === undefined || value === "" ? "—" : String(value));

export function normalizeAsset(raw, index = 0) {
  const current = raw.current_assignment && typeof raw.current_assignment === "object" ? raw.current_assignment : null;
  const name = raw.name || raw.device_name || [raw.brand, raw.model].filter(Boolean).join(" ") || "—";
  return {
    id: raw.id ?? index,
    name,
    type: pretty(raw.category || raw.asset_type || raw.device_type || raw.type) || "Laptop",
    brand: text(raw.manufacturer || raw.brand),
    model: text(raw.model),
    serial: text(raw.serial_number || raw.serial),
    tag: text(raw.asset_tag || raw.tag),
    location: text(raw.location_name || raw.location),
    status: assetStatusLabel(raw.status_label || raw.status),
    assignedTo: current?.employee_name || raw.assigned_to_name || raw.employee_name || "",
    assignmentId: current?.id ?? raw.active_assignment_id ?? null,
    purchased: raw.purchase_date || "",
    notes: raw.notes || "",
  };
}

export function normalizeAssignment(raw, index = 0) {
  const asset = raw.asset && typeof raw.asset === "object" ? raw.asset : {};
  const returnedDate = raw.returned_date || raw.returned_at || "";
  return {
    id: raw.id ?? `assignment-${index}`,
    assetId: String(asset.id ?? raw.asset ?? ""),
    assetName: raw.asset_name || asset.name || [asset.brand, asset.model].filter(Boolean).join(" ") || "Device",
    assetTag: text(raw.asset_tag || asset.asset_tag),
    serial: text(raw.serial_number || asset.serial_number),
    employeeName: raw.employee_name || raw.employee?.full_name || raw.employee?.name || "—",
    employeeCode: raw.employee_code || raw.employee?.employee_code || "",
    assignedDate: raw.assigned_date || raw.assigned_at || "",
    expectedReturn: raw.expected_return_date || "",
    returnedDate,
    isActive: typeof raw.is_active === "boolean" ? raw.is_active : !returnedDate,
    condition: raw.condition_on_return || raw.return_condition || raw.condition || "",
    notes: raw.notes || "",
    returnNotes: raw.return_notes || "",
  };
}

export function formatAssetDate(value) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(...value.split("-").map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))))
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/* ---------- payload builders (the only place field names are decided) ---------- */
export function registerPayload(values) {
  const payload = {
    name: values.name.trim(),
    category: ["LAPTOP", "DESKTOP", "PHONE", "TABLET", "ACCESSORY", "OTHER"].includes(values.type.trim().toUpperCase())
      ? values.type.trim().toUpperCase()
      : "OTHER",
    manufacturer: values.brand.trim(),
    model: values.model.trim(),
    serial_number: values.serial.trim(),
    asset_tag: values.tag.trim(),
    purchase_date: values.purchased || null,
    location: values.location.trim(),
    notes: values.notes.trim(),
  };
  return payload;
}

export function assignPayload({ assetId, employee, notes }) {
  return {
    asset_id: Number(assetId),
    employee_id: Number(employee),
    notes,
  };
}

export function returnPayload({ condition, notes }) {
  return { condition_on_return: condition, notes };
}

/* Server field errors ({ field: [messages] }) -> { field: "message" } for the forms. */
export function fieldErrorsOf(error) {
  return Object.fromEntries(Object.entries(error?.fieldErrors || {}).map(([key, messages]) => [key, messages.join(" ")]));
}

/* ---------- hooks ---------- */
/* Assignment rows for one asset (history), newest first. */
export function useAssetHistory(assetId) {
  const [state, setState] = useState({ rows: [], loading: Boolean(assetId), error: "" });

  const load = useCallback(async () => {
    if (!assetId) {
      setState({ rows: [], loading: false, error: "" });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const res = await apiClient.get(`${ASSET_ENDPOINTS.assignments}?asset_id=${encodeURIComponent(assetId)}`);
      const rows = getArrayResponse(res)
        .map(normalizeAssignment)
        // Some backends ignore the filter; keep only this asset's rows when the id is known.
        .filter((r) => !r.assetId || r.assetId === String(assetId))
        .sort((a, b) => String(b.assignedDate).localeCompare(String(a.assignedDate)));
      setState({ rows, loading: false, error: "" });
    } catch (error) {
      setState({ rows: [], loading: false, error: getErrorMessage(error, "Could not load assignment history.") });
    }
  }, [assetId]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  return { ...state, reload: load };
}

/* The signed-in employee's own assignments (current + returned). */
export function useMyAssets() {
  const [state, setState] = useState({ rows: [], loading: true, error: "" });

  const load = useCallback(async () => {
    try {
      const res = await apiClient.get("/assets/me/");
      const rows = getArrayResponse(res)
        .map(normalizeAssignment)
        .sort((a, b) => String(b.assignedDate).localeCompare(String(a.assignedDate)));
      setState({ rows, loading: false, error: "" });
    } catch (error) {
      setState({ rows: [], loading: false, error: getErrorMessage(error, "Could not load your assigned devices.") });
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  return { ...state, active: state.rows.filter((r) => r.isActive), reload: load };
}
