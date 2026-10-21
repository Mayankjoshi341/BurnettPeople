import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { StatCard, NotConnected, Pager } from "./DashboardParts";
import {
  AVATAR_TONES,
  SHOW_DEMO_DATA,
  callApi,
  getArrayResponse,
  getErrorMessage,
  initialsOf,
  statusTone,
  todayISO,
  useEmployees,
} from "./dashboardUtils";
import "./HRPages.css";

/* Set this to your assets list endpoint when the backend is ready, e.g. "/assets/devices/".
   While it is null, sample devices are shown (when SHOW_DEMO_DATA is true). */
const ASSETS_ENDPOINT = null;

const DEMO_DEVICES = [
  ["MacBook Pro 14\"", "Laptop", "Apple", "C02XK3Q7L9", "Indore Office", "Available", "", "2024-01-12"],
  ["Dell XPS 13", "Laptop", "Dell", "DELL9987A1", "Indore Office", "Assigned", "Rohan Thakur", "2024-02-05"],
  ["iPhone 15", "Mobile", "Apple", "F4G9H2L3K1", "Bangalore Office", "Available", "", "2024-03-18"],
  ["Lenovo ThinkPad", "Laptop", "Lenovo", "LEN567BPD4", "Bangalore Office", "In Repair", "", "2024-01-22"],
  ["Samsung Galaxy S24", "Mobile", "Samsung", "SAM9L2K8P1", "Indore Office", "Assigned", "Neha Gupta", "2024-04-11"],
  ["iPad Air", "Tablet", "Apple", "IPD9K3L2M4", "Delhi Office", "Available", "", "2024-05-01"],
  ["HP ProBook 450", "Laptop", "HP", "HP45K7L9M2", "Indore Office", "Assigned", "Vikram Kapoor", "2024-03-10"],
  ["Dell Monitor 24\"", "Monitor", "Dell", "DELL24MK81", "Bangalore Office", "Available", "", "2024-02-15"],
  ["Logitech Keyboard", "Accessory", "Logitech", "LOG9K2L5P4", "Indore Office", "Available", "", "2024-06-02"],
  ["Mac Mini", "Desktop", "Apple", "MM9L3K1P0", "Delhi Office", "Assigned", "Priya Nair", "2024-04-20"],
].map(([name, type, brand, serial, location, status, assignedTo, purchased], i) => ({
  id: `demo-${i}`, name, type, brand, serial, location, status, assignedTo, purchased, demo: true,
}));

const DEMO_HISTORY = [
  ["Returned by Neha Gupta", "10 Oct 2026, 05:30 PM", "Device returned in good condition.", "Returned"],
  ["Assigned to Neha Gupta", "12 Jan 2025, 10:00 AM", "Initial assignment.", "Assigned"],
  ["Device added to inventory", "12 Jan 2024, 09:15 AM", "Added by Admin", "Created"],
];

const TYPE_ICON = { Laptop: "laptop", Desktop: "laptop", Monitor: "laptop", Mobile: "bell", Tablet: "laptop", Accessory: "gear" };

function normalizeDevice(raw, i) {
  const assigned = raw.assigned_to_name || raw.assigned_to?.name || raw.employee_name || "";
  return {
    id: raw.id ?? i,
    name: raw.name || raw.device_name || "—",
    type: raw.device_type || raw.type || "—",
    brand: raw.brand || "—",
    serial: raw.serial_number || raw.serial || "—",
    location: raw.location_name || raw.location || "—",
    status: raw.status_label || raw.status || "—",
    assignedTo: assigned,
    purchased: raw.purchase_date || "",
  };
}

const fmt = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

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
    if (device.demo || !ASSETS_ENDPOINT) { setErr("This is sample data. Set ASSETS_ENDPOINT in HRAssets.jsx to save assignments."); return; }
    setBusy(true);
    try {
      await callApi("post", `${ASSETS_ENDPOINT}${device.id}/assign/`, {
        employee: Number(employee),
        assigned_date: date,
        expected_return_date: ret || null,
        location,
        notes,
      });
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
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
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

export default function HRAssets() {
  const { employees } = useEmployees();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(Boolean(ASSETS_ENDPOINT));
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [location, setLocation] = useState("ALL");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selectedId, setSelectedId] = useState(null);
  const [assignFor, setAssignFor] = useState(null);

  const load = useCallback(async () => {
    if (!ASSETS_ENDPOINT) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.get(ASSETS_ENDPOINT);
      setDevices(getArrayResponse(res).map(normalizeDevice));
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

  const demoMode = !ASSETS_ENDPOINT && SHOW_DEMO_DATA;
  const all = demoMode ? DEMO_DEVICES : devices;

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
        (!q || [d.name, d.serial, d.assignedTo, d.brand].some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [all, query, type, status, location]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);
  const selected = all.find((d) => d.id === selectedId) || visible[0] || null;

  const count = (s) => all.filter((d) => d.status === s).length;

  return (
    <div className="hrp-page">
      {!ASSETS_ENDPOINT && (
        <NotConnected
          title="Assets API is not connected yet."
          text={demoMode
            ? "These devices are sample data for the design. Set ASSETS_ENDPOINT in HRAssets.jsx once the backend provides it."
            : "Set ASSETS_ENDPOINT in HRAssets.jsx once the backend provides a devices API."}
        />
      )}
      {error && <div className="admin-form-error" role="alert">{error}</div>}

      <section className="admin-summary-grid" aria-label="Device summary">
        <StatCard icon="laptop" tone="blue" label="Total Devices" value={all.length || null} note="In inventory" />
        <StatCard icon="check" tone="green" label="Available" value={count("Available")} note="Ready to assign" />
        <StatCard icon="users" tone="blue" label="Assigned" value={count("Assigned")} note="With employees" />
        <StatCard icon="gear" tone="amber" label="In Repair" value={count("In Repair")} note="Unavailable" />
      </section>

      <div className={`hrp-split ${assignFor ? "with-side" : ""}`}>
        <div className="hrp-col">
          <section className="admin-panel" aria-label="Devices">
            <div className="hrp-filters">
              <label className="people-search">
                <Icon name="search" size={16} />
                <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder="Search by device name, serial number, or employee..." aria-label="Search devices" />
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
            </div>

            {loading ? (
              <p className="admin-note">Loading devices…</p>
            ) : filtered.length === 0 ? (
              <p className="admin-note">No devices to show.</p>
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
                            <button type="button" className="admin-primary-button hr-small" disabled={d.status !== "Available"}
                              onClick={() => { setSelectedId(d.id); setAssignFor(d); }}>
                              {d.status === "Available" ? "Assign" : d.status === "In Repair" ? "Unavailable" : "Assigned"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Pager page={safePage} pages={pages} onPage={(n) => setPage(Math.min(Math.max(n, 1), pages))}
              perPage={perPage} onPerPage={(n) => { setPerPage(n); setPage(1); }}
              total={filtered.length} shown={{ from: start + 1, to: Math.min(start + perPage, filtered.length) }} />
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
                  {[["Serial Number", selected.serial], ["Device Type", selected.type], ["Brand", selected.brand],
                    ["Location", selected.location], ["Status", selected.status], ["Purchase Date", fmt(selected.purchased)]].map(([k, v]) => (
                    <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
              </section>
              <section className="admin-panel" aria-labelledby="ah-title">
                <div className="admin-panel-heading"><div><h2 id="ah-title">Assignment History</h2></div></div>
                {demoMode ? (
                  <ol className="hrp-history">
                    {DEMO_HISTORY.map(([title, when, note, tag]) => (
                      <li key={title}>
                        <span className="hrp-history-dot" />
                        <div><strong>{title}</strong><small>{when}</small><small>{note}</small></div>
                        <span className={`hrp-pill ${statusTone(tag)}`}>{tag}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="admin-note">Assignment history will appear once the assets API provides it.</p>
                )}
              </section>
            </div>
          )}
        </div>

        {assignFor && (
          <AssignDrawer
            key={assignFor.id}
            device={assignFor}
            employees={employees}
            onClose={() => setAssignFor(null)}
            onAssigned={() => { setAssignFor(null); load(); }}
          />
        )}
      </div>
    </div>
  );
}
