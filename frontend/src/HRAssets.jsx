import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { StatCard, Pager } from "./DashboardParts";
import {
  AVATAR_TONES,
  getArrayResponse,
  getErrorMessage,
  initialsOf,
  statusTone,
  todayISO,
  useEmployees,
} from "./dashboardUtils";
import {
  ASSET_ENDPOINTS,
  RETURN_CONDITIONS,
  assignPayload,
  fieldErrorsOf,
  formatAssetDate,
  normalizeAsset,
  registerPayload,
  returnPayload,
  useAssetHistory,
} from "./features/assets/assetApi";
import "./HRPages.css";

const TYPE_ICON = { Laptop: "laptop", Desktop: "laptop", Monitor: "laptop", Mobile: "bell", Tablet: "laptop", Accessory: "gear" };
const DEVICE_TYPES = ["Laptop", "Desktop", "Monitor", "Mobile", "Tablet", "Accessory"];

const fmt = formatAssetDate;

function Pill({ value }) {
  return <span className={`hrp-pill ${statusTone(value)}`}>{value}</span>;
}

function AssignDrawer({ device, employees, onClose, onAssigned }) {
  const [employee, setEmployee] = useState("");
  const [date, setDate] = useState(todayISO());
  const [ret, setRet] = useState("");
  const [location, setLocation] = useState(device.location === "—" ? "" : device.location);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setMsg("");
    setErr("");
    if (!employee) { setErr("Please select an employee."); return; }
    if (!date) { setErr("Please choose the assignment date."); return; }
    if (ret && ret < date) { setErr("The expected return date cannot be before the assignment date."); return; }
    setBusy(true);
    try {
      await apiClient.post(
        ASSET_ENDPOINTS.assign(device.id),
        assignPayload({ employee, date, expectedReturn: ret, location, notes }),
      );
      setMsg("Device assigned.");
      onAssigned();
    } catch (e) {
      setErr(getErrorMessage(e, "Could not assign the device."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="hrp-side">
      <div className="hrp-card">
        <div className="hrp-card-head">
          <h3>Assign Device to Employee</h3>
          <button type="button" className="hrp-x static" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </div>
        <div className="hrp-device-mini">
          <span className="hrp-device-icon"><Icon name={TYPE_ICON[device.type] || "laptop"} size={26} /></span>
          <div>
            <strong>{device.name}</strong> <Pill value={device.status} />
            <small>{device.type} · {device.brand}</small>
            <small>Serial: {device.serial}</small>
            <small>Location: {device.location}</small>
          </div>
        </div>

        <label className="hrp-label" htmlFor="as-emp">Select Employee *</label>
        <select id="as-emp" value={employee} onChange={(e) => setEmployee(e.target.value)}>
          <option value="">Search employee by name or ID…</option>
          {employees.filter((e) => e.status === "ACTIVE").map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
        </select>

        <label className="hrp-label" htmlFor="as-date">Assignment Date *</label>
        <input id="as-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label className="hrp-label" htmlFor="as-ret">Expected Return Date</label>
        <input id="as-ret" type="date" value={ret} onChange={(e) => setRet(e.target.value)} />
        <label className="hrp-label" htmlFor="as-loc">Location</label>
        <input id="as-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
        <label className="hrp-label" htmlFor="as-notes">Notes</label>
        <textarea id="as-notes" rows={3} maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes for this assignment… (optional)" />
        <small className="hrp-count">{notes.length}/200</small>

        {msg && <p className="admin-form-success" role="status">{msg}</p>}
        {err && <p className="admin-form-error" role="alert">{err}</p>}
        <div className="admin-modal-actions">
          <button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-primary-button" onClick={submit} disabled={busy}>{busy ? "Assigning…" : "Assign Device"}</button>
        </div>
      </div>
    </aside>
  );
}

function FieldError({ message }) {
  return message ? <span className="admin-field-error" role="alert">{message}</span> : null;
}

const EMPTY_DEVICE = { name: "", type: "Laptop", brand: "", model: "", serial: "", tag: "", location: "", purchased: "", notes: "" };

function RegisterDrawer({ onClose, onRegistered }) {
  const [v, setV] = useState(EMPTY_DEVICE);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const set = (key, value) => {
    setV((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  async function submit() {
    setMsg("");
    setErr("");
    const required = { name: "Device name", brand: "Brand", model: "Model", serial: "Serial number", tag: "Asset tag" };
    const found = {};
    Object.entries(required).forEach(([key, label]) => {
      if (!v[key].trim()) found[key] = `${label} is required.`;
    });
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      await apiClient.post(ASSET_ENDPOINTS.assets, registerPayload(v));
      setMsg("Device registered.");
      onRegistered();
    } catch (e) {
      // Server field names -> our form keys (serial_number -> serial, asset_tag -> tag, ...)
      const server = fieldErrorsOf(e);
      setErrors({
        name: server.name, brand: server.brand, model: server.model, serial: server.serial_number,
        tag: server.asset_tag, location: server.location, purchased: server.purchase_date, type: server.asset_type,
      });
      setErr(getErrorMessage(e, "Could not register the device."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="hrp-side">
      <div className="hrp-card">
        <div className="hrp-card-head">
          <h3>Register New Device</h3>
          <button type="button" className="hrp-x static" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </div>

        <label className="hrp-label" htmlFor="rg-name">Device Name *</label>
        <input id="rg-name" value={v.name} onChange={(e) => set("name", e.target.value)} placeholder='e.g. MacBook Pro 14"' aria-invalid={Boolean(errors.name)} />
        <FieldError message={errors.name} />

        <label className="hrp-label" htmlFor="rg-type">Device Type *</label>
        <select id="rg-type" value={v.type} onChange={(e) => set("type", e.target.value)}>
          {DEVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <label className="hrp-label" htmlFor="rg-brand">Brand *</label>
        <input id="rg-brand" value={v.brand} onChange={(e) => set("brand", e.target.value)} placeholder="e.g. Apple" aria-invalid={Boolean(errors.brand)} />
        <FieldError message={errors.brand} />

        <label className="hrp-label" htmlFor="rg-model">Model *</label>
        <input id="rg-model" value={v.model} onChange={(e) => set("model", e.target.value)} placeholder="e.g. MacBook Pro 14-inch" aria-invalid={Boolean(errors.model)} />
        <FieldError message={errors.model} />

        <label className="hrp-label" htmlFor="rg-serial">Serial Number *</label>
        <input id="rg-serial" value={v.serial} onChange={(e) => set("serial", e.target.value)} placeholder="e.g. C02XK3Q7L9" aria-invalid={Boolean(errors.serial)} />
        <FieldError message={errors.serial} />

        <label className="hrp-label" htmlFor="rg-tag">Asset Tag *</label>
        <input id="rg-tag" value={v.tag} onChange={(e) => set("tag", e.target.value)} placeholder="e.g. BP-2026-001" aria-invalid={Boolean(errors.tag)} />
        <FieldError message={errors.tag} />

        <label className="hrp-label" htmlFor="rg-date">Purchase Date</label>
        <input id="rg-date" type="date" value={v.purchased} max={todayISO()} onChange={(e) => set("purchased", e.target.value)} />
        <FieldError message={errors.purchased} />

        <label className="hrp-label" htmlFor="rg-loc">Location</label>
        <input id="rg-loc" value={v.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Indore Office" />
        <FieldError message={errors.location} />

        <label className="hrp-label" htmlFor="rg-notes">Notes</label>
        <textarea id="rg-notes" rows={3} maxLength={200} value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Add any notes about this device… (optional)" />
        <small className="hrp-count">{v.notes.length}/200</small>

        {msg && <p className="admin-form-success" role="status">{msg}</p>}
        {err && <p className="admin-form-error" role="alert">{err}</p>}
        <div className="admin-modal-actions">
          <button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-primary-button" onClick={submit} disabled={busy}>{busy ? "Registering…" : "Register Device"}</button>
        </div>
      </div>
    </aside>
  );
}

function ReturnDrawer({ device, assignment, loading, onClose, onReturned }) {
  const [date, setDate] = useState(todayISO());
  const [condition, setCondition] = useState("Good");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setMsg("");
    setErr("");
    if (!assignment) { setErr("No active assignment was found for this device."); return; }
    if (!date) { setErr("Please choose the return date."); return; }
    if (assignment.assignedDate && date < assignment.assignedDate) {
      setErr("The return date cannot be before the assignment date.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post(ASSET_ENDPOINTS.returnAsset(assignment.id), returnPayload({ date, condition, notes: notes.trim() }));
      setMsg("Device returned.");
      onReturned();
    } catch (e) {
      setErr(getErrorMessage(e, "Could not record the return."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="hrp-side">
      <div className="hrp-card">
        <div className="hrp-card-head">
          <h3>Return Device</h3>
          <button type="button" className="hrp-x static" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </div>
        <div className="hrp-device-mini">
          <span className="hrp-device-icon"><Icon name={TYPE_ICON[device.type] || "laptop"} size={26} /></span>
          <div>
            <strong>{device.name}</strong> <Pill value={device.status} />
            <small>Serial: {device.serial}</small>
            <small>{loading ? "Finding the current assignment…" : assignment ? `With ${assignment.employeeName} since ${fmt(assignment.assignedDate)}` : device.assignedTo ? `With ${device.assignedTo}` : "No active assignment found"}</small>
          </div>
        </div>

        <label className="hrp-label" htmlFor="rt-date">Return Date *</label>
        <input id="rt-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        <label className="hrp-label" htmlFor="rt-cond">Condition on Return</label>
        <select id="rt-cond" value={condition} onChange={(e) => setCondition(e.target.value)}>
          {RETURN_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="hrp-label" htmlFor="rt-notes">Notes</label>
        <textarea id="rt-notes" rows={3} maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes about the return… (optional)" />
        <small className="hrp-count">{notes.length}/200</small>

        {msg && <p className="admin-form-success" role="status">{msg}</p>}
        {err && <p className="admin-form-error" role="alert">{err}</p>}
        <div className="admin-modal-actions">
          <button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="admin-primary-button" onClick={submit} disabled={busy || loading || !assignment}>{busy ? "Saving…" : "Confirm Return"}</button>
        </div>
      </div>
    </aside>
  );
}

export default function HRAssets() {
  const { employees } = useEmployees();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [location, setLocation] = useState("ALL");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selectedId, setSelectedId] = useState(null);
  /* Only one side drawer is open at a time: { mode: "assign" | "return" | "register", deviceId? } */
  const [drawer, setDrawer] = useState(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get(ASSET_ENDPOINTS.assets);
      setDevices(getArrayResponse(res).map(normalizeAsset));
    } catch (e) {
      setDevices([]);
      setError(getErrorMessage(e, "Could not load devices."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const all = devices;

  const uniq = (key) => [...new Set(all.map((d) => d[key]).filter((v) => v && v !== "—"))].sort();
  const types = useMemo(() => uniq("type"), [all]); // eslint-disable-line react-hooks/exhaustive-deps
  const locations = useMemo(() => uniq("location"), [all]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (d) =>
        (type === "ALL" || d.type === type) &&
        (status === "ALL" || d.status === status) &&
        (location === "ALL" || d.location === location) &&
        (!q || [d.name, d.serial, d.assignedTo, d.brand, d.tag].some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [all, query, type, status, location]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);
  const selected = all.find((d) => d.id === selectedId) || visible[0] || null;

  /* Assignment history of the selected device (kept for every assignment/return). */
  const history = useAssetHistory(selected?.id);
  const activeAssignment = history.rows.find((r) => r.isActive) || null;

  const drawerDevice = drawer?.deviceId !== undefined ? all.find((d) => d.id === drawer.deviceId) : null;
  const count = (s) => all.filter((d) => d.status === s).length;

  function refreshAll(message) {
    setDrawer(null);
    setNotice(message);
    load();
    history.reload();
  }

  return (
    <div className="hrp-page">
      {error && <div className="admin-form-error" role="alert">{error}</div>}
      {notice && <div className="admin-form-success" role="status">{notice}</div>}

      <section className="admin-summary-grid" aria-label="Device summary">
        <StatCard icon="laptop" tone="blue" label="Total Devices" value={loading || error ? null : all.length} note="In inventory" />
        <StatCard icon="check" tone="green" label="Available" value={loading || error ? null : count("Available")} note="Ready to assign" />
        <StatCard icon="users" tone="blue" label="Assigned" value={loading || error ? null : count("Assigned")} note="With employees" />
        <StatCard icon="gear" tone="amber" label="In Repair" value={loading || error ? null : count("In Repair")} note="Unavailable" />
      </section>

      <div className={`hrp-split ${drawer ? "with-side" : ""}`}>
        <div className="hrp-col">
          <section className="admin-panel" aria-label="Devices">
            <div className="hrp-filters">
              <label className="people-search">
                <Icon name="search" size={16} />
                <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder="Search by device name, serial number, asset tag or employee..." aria-label="Search devices" />
              </label>
              <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Device type">
                <option value="ALL">All Types</option>{types.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
                <option value="ALL">All Status</option>
                {["Available", "Assigned", "In Repair"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <select value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }} aria-label="Location">
                <option value="ALL">All Locations</option>{locations.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              <button type="button" className="admin-link-button" onClick={() => { setQuery(""); setType("ALL"); setStatus("ALL"); setLocation("ALL"); setPage(1); }}>Clear</button>
              <button type="button" className="admin-primary-button hr-small" onClick={() => { setNotice(""); setDrawer({ mode: "register" }); }}>
                <Icon name="plus" size={14} /> Register Device
              </button>
            </div>

            {loading ? (
              <p className="admin-note">Loading devices…</p>
            ) : filtered.length === 0 ? (
              <p className="admin-note">{all.length === 0 && !error ? "No devices have been registered yet. Use Register Device to add the first one." : "No devices to show."}</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table hrp-table">
                  <thead>
                    <tr><th>#</th><th>DEVICE NAME</th><th>TYPE</th><th>BRAND</th><th>SERIAL NUMBER</th><th>LOCATION</th><th>STATUS</th><th>ASSIGNED TO</th><th>PURCHASE DATE</th><th>ACTIONS</th></tr>
                  </thead>
                  <tbody>
                    {visible.map((d, i) => (
                      <tr key={d.id} className={selected?.id === d.id ? "sel" : ""}>
                        <td>{start + i + 1}</td>
                        <td><strong>{d.name}</strong></td>
                        <td>{d.type}</td><td>{d.brand}</td><td>{d.serial}</td><td>{d.location}</td>
                        <td><Pill value={d.status} /></td>
                        <td>
                          {d.assignedTo ? (
                            <div className="admin-person">
                              <span className="admin-person-avatar" style={{ background: AVATAR_TONES[(start + i) % AVATAR_TONES.length] }}>{initialsOf(d.assignedTo)}</span>
                              <strong>{d.assignedTo}</strong>
                            </div>
                          ) : "—"}
                        </td>
                        <td>{fmt(d.purchased)}</td>
                        <td>
                          <div className="hrp-actions">
                            <button type="button" className="hrp-icon-btn" aria-label={`View ${d.name}`} onClick={() => setSelectedId(d.id)}><Icon name="search" size={15} /></button>
                            {d.status === "Assigned" ? (
                              <button type="button" className="admin-primary-button hr-small"
                                onClick={() => { setNotice(""); setSelectedId(d.id); setDrawer({ mode: "return", deviceId: d.id }); }}>
                                Return
                              </button>
                            ) : (
                              <button type="button" className="admin-primary-button hr-small" disabled={d.status !== "Available"}
                                onClick={() => { setNotice(""); setSelectedId(d.id); setDrawer({ mode: "assign", deviceId: d.id }); }}>
                                {d.status === "Available" ? "Assign" : "Unavailable"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Pager page={safePage} pages={pages} onPage={(n) => setPage(Math.min(Math.max(n, 1), pages))}
              perPage={perPage} onSize={(n) => { setPerPage(n); setPage(1); }}
              total={filtered.length} />
          </section>

          {selected && (
            <div className="admin-row hrp-details-row">
              <section className="admin-panel" aria-labelledby="dd-title">
                <div className="admin-panel-heading"><div><h2 id="dd-title">Device Details</h2></div></div>
                <div className="hrp-device-mini">
                  <span className="hrp-device-icon"><Icon name={TYPE_ICON[selected.type] || "laptop"} size={28} /></span>
                  <div><strong>{selected.name}</strong> <Pill value={selected.status} />
                    <small>{selected.type} · {selected.brand}</small></div>
                </div>
                <dl className="hrp-kv two">
                  {[["Serial Number", selected.serial], ["Asset Tag", selected.tag], ["Device Type", selected.type], ["Brand", selected.brand], ["Model", selected.model],
                    ["Location", selected.location], ["Status", selected.status], ["Purchase Date", fmt(selected.purchased)]].map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
              </section>
              <section className="admin-panel" aria-labelledby="ah-title">
                <div className="admin-panel-heading"><div><h2 id="ah-title">Assignment History</h2></div></div>
                {history.error && <div className="admin-form-error" role="alert">{history.error}</div>}
                {history.loading ? (
                  <p className="admin-note">Loading assignment history…</p>
                ) : history.rows.length === 0 ? (
                  <p className="admin-note">This device has not been assigned yet.</p>
                ) : (
                  <ol className="hrp-history">
                    {history.rows.map((r) => (
                      <li key={r.id}>
                        <span className="hrp-history-dot" />
                        <div>
                          <strong>{r.isActive ? `Assigned to ${r.employeeName}` : `Returned by ${r.employeeName}`}</strong>
                          <small>Assigned {fmt(r.assignedDate)}{r.returnedDate ? ` · Returned ${fmt(r.returnedDate)}` : r.expectedReturn ? ` · Expected back ${fmt(r.expectedReturn)}` : ""}</small>
                          {(r.condition || r.returnNotes || r.notes) && (
                            <small>{[r.condition && `Condition: ${r.condition}`, r.returnNotes || r.notes].filter(Boolean).join(" · ")}</small>
                          )}
                        </div>
                        <span className={`hrp-pill ${statusTone(r.isActive ? "Assigned" : "Returned")}`}>{r.isActive ? "Assigned" : "Returned"}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          )}
        </div>

        {drawer?.mode === "register" && (
          <RegisterDrawer
            onClose={() => setDrawer(null)}
            onRegistered={() => refreshAll("Device registered.")}
          />
        )}
        {drawer?.mode === "assign" && drawerDevice && (
          <AssignDrawer
            key={drawerDevice.id}
            device={drawerDevice}
            employees={employees}
            onClose={() => setDrawer(null)}
            onAssigned={() => refreshAll(`${drawerDevice.name} was assigned.`)}
          />
        )}
        {drawer?.mode === "return" && drawerDevice && (
          <ReturnDrawer
            key={drawerDevice.id}
            device={drawerDevice}
            assignment={activeAssignment}
            loading={history.loading}
            onClose={() => setDrawer(null)}
            onReturned={() => refreshAll(`${drawerDevice.name} was returned and is available again.`)}
          />
        )}
      </div>
    </div>
  );
}
