import { useMemo, useState } from "react";

import { Icon } from "./DashboardIcons";
import { SHOW_DEMO_DATA, formatDate } from "./dashboardUtils";
import { Av, FormPanel, MiniStat, Pager, Pill, useResource } from "./AdminUi";

/* Backend: GET/POST /assets/, PATCH/DELETE /assets/<id>/
   Row keys: name,type,brand,model,serial,tag,location,status,assignedTo,assignedCode,purchaseDate,notes */
const ASSETS_ENDPOINT = "/assets/";
const TYPES = ["Laptop", "Mobile", "Tablet", "Monitor", "Accessory"];
const LOCATIONS = ["Indore Office", "Bangalore Office", "Pune Office"];
const STATUSES = ["Available", "Assigned", "In Repair"];
const TYPE_ICON = { Laptop: "laptop", Monitor: "laptop", Mobile: "phone", Tablet: "phone", Accessory: "tag" };

const DEMO_ASSETS = [
  ["MacBook Pro 14\"", "Laptop", "Apple", "MacBook Pro 14\"", "C02XK3Q7L9", "BP-2024-001", "Indore Office", "Available", "", "", "2024-01-12"],
  ["Dell XPS 13", "Laptop", "Dell", "XPS 13", "DELL9987A1", "BP-2024-002", "Indore Office", "Assigned", "Rohan Thakur", "EMP001", "2024-02-05"],
  ["iPhone 15", "Mobile", "Apple", "iPhone 15", "F4G9H2L3K1", "BP-2024-003", "Indore Office", "Available", "", "", "2024-03-18"],
  ["Lenovo ThinkPad", "Laptop", "Lenovo", "T14", "LEN5678D4", "BP-2024-004", "Bangalore Office", "In Repair", "", "", "2024-01-22"],
  ["Samsung Galaxy S24", "Mobile", "Samsung", "S24", "SAM9L2K8P1", "BP-2024-005", "Indore Office", "Assigned", "Neha Gupta", "EMP002", "2024-04-11"],
  ["HP EliteBook", "Laptop", "HP", "840 G9", "HP88K3L2M1", "BP-2024-006", "Pune Office", "Available", "", "", "2024-03-01"],
  ["iPad Air", "Tablet", "Apple", "iPad Air", "IPD9K2L3M4", "BP-2024-007", "Indore Office", "Available", "", "", "2024-03-14"],
  ["Dell Monitor 27\"", "Monitor", "Dell", "U2723QE", "DL27M4N8P7", "BP-2024-008", "Bangalore Office", "Assigned", "Aarav Sharma", "EMP005", "2024-02-10"],
  ["Logitech Keyboard", "Accessory", "Logitech", "MX Keys", "LOGK1B2C3", "BP-2024-009", "Indore Office", "Available", "", "", "2024-01-08"],
  ["Logitech Mouse", "Accessory", "Logitech", "MX Master 3", "LOGM4N5P6", "BP-2024-010", "Indore Office", "Available", "", "", "2024-01-08"],
].map(([name, type, brand, model, serial, tag, location, status, assignedTo, assignedCode, purchaseDate], i) => ({
  id: `demo-${i + 1}`, name, type, brand, model, serial, tag, location, status, assignedTo, assignedCode, purchaseDate, notes: "",
}));

const FIELDS = [
  { k: "name", label: "Device Name", req: true, ph: "e.g. MacBook Pro 14\"" },
  { k: "type", label: "Device Type", req: true, type: "select", ph: "Select type", options: TYPES },
  { k: "brand", label: "Brand", req: true, ph: "e.g. Apple", half: true },
  { k: "model", label: "Model", req: true, ph: "e.g. MacBook Pro 14\"", half: true },
  { k: "serial", label: "Serial Number", req: true, ph: "e.g. C02XK3Q7L9", half: true },
  { k: "tag", label: "Asset Tag", req: true, ph: "e.g. BP-2024-001", half: true },
  { k: "purchaseDate", label: "Purchase Date", req: true, type: "date", half: true },
  { k: "location", label: "Location", req: true, type: "select", ph: "Select location", options: LOCATIONS, half: true },
  { k: "status", label: "Status", req: true, type: "select", options: STATUSES, def: "Available" },
  { k: "notes", label: "Notes (Optional)", type: "textarea", ph: "Add any additional notes about this device..." },
];

function DevicePanel({ device, onEdit, onClose }) {
  const rows = [
    ["Asset Tag", device.tag], ["Type", device.type], ["Brand", device.brand], ["Model", device.model],
    ["Serial Number", device.serial], ["Location", device.location],
    ["Assigned To", device.assignedTo ? `${device.assignedTo} (${device.assignedCode})` : "—"],
    ["Purchase Date", formatDate(device.purchaseDate)], ["Notes", device.notes || "—"],
  ];
  return (
    <aside className="admin-panel ap-side" aria-label="Device details">
      <div className="ap-side-head">
        <div className="ap-person big">
          <span className="ap-dev-icon big"><Icon name={TYPE_ICON[device.type] || "laptop"} size={24} /></span>
          <div><Pill>{device.status}</Pill><h2>{device.name}</h2><p>{device.brand} · {device.type}</p></div>
        </div>
        <button type="button" className="ap-x" onClick={onClose} aria-label="Close panel"><Icon name="close" size={16} /></button>
      </div>
      <dl className="ap-kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}</dl>
      <button type="button" className="admin-primary-button ap-mailbtn" onClick={onEdit}><Icon name="edit" size={16} /> Edit device</button>
    </aside>
  );
}

export default function AdminAssets() {
  const { rows, loading, error, create, update } = useResource(ASSETS_ENDPOINT, DEMO_ASSETS);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [loc, setLoc] = useState("ALL");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [panel, setPanel] = useState({ mode: "add" });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (type === "ALL" || r.type === type) && (status === "ALL" || r.status === status) && (loc === "ALL" || r.location === loc) &&
        (!q || [r.name, r.serial, r.brand, r.tag].some((v) => String(v ?? "").toLowerCase().includes(q))),
    );
  }, [rows, query, type, status, loc]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * size, safePage * size);
  const count = (s) => rows.filter((r) => r.status === s).length;
  const reset = (setter) => (e) => { setter(e.target.value); setPage(1); };
  const clear = () => { setQuery(""); setType("ALL"); setStatus("ALL"); setLoc("ALL"); setPage(1); };

  const submit = (v) => (panel.mode === "edit" ? update(panel.row.id, v) : create(v));

  return (
    <div className="ap-page">
      <section className="ap-stats" aria-label="Asset summary">
        <MiniStat icon="laptop" tone="blue" value={rows.length} label="Total Devices" note={SHOW_DEMO_DATA ? "Sample data" : ""} />
        <MiniStat icon="check" tone="green" value={count("Available")} label="Available" />
        <MiniStat icon="users" tone="blue" value={count("Assigned")} label="Assigned" />
        <MiniStat icon="gear" tone="amber" value={count("In Repair")} label="In Repair" />
        <button type="button" className="ap-cta" onClick={() => setPanel({ mode: "add" })}>
          <Icon name="plus" size={22} /><span><strong>Add New Device</strong></span>
        </button>
      </section>

      <div className={`ap-split${panel ? " has-side" : ""}`}>
        <section className="admin-panel ap-main" aria-label="Devices">
          <div className="ap-toolbar">
            <label className="ap-search">
              <Icon name="search" size={16} />
              <input type="search" value={query} onChange={reset(setQuery)} placeholder="Search by device name, serial number, or brand..." aria-label="Search devices" />
            </label>
            <label className="ap-filter"><small>Device Type</small>
              <select value={type} onChange={reset(setType)}><option value="ALL">All Types</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="ap-filter"><small>Status</small>
              <select value={status} onChange={reset(setStatus)}><option value="ALL">All Status</option>{STATUSES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="ap-filter"><small>Location</small>
              <select value={loc} onChange={reset(setLoc)}><option value="ALL">All Locations</option>{LOCATIONS.map((t) => <option key={t}>{t}</option>)}</select></label>
            <button type="button" className="admin-link-button" onClick={clear}>Clear</button>
          </div>

          {error && <div role="alert" className="admin-form-error">{error}</div>}

          {loading ? <p className="admin-note">Loading devices…</p> : filtered.length === 0 ? (
            <p className="admin-note">No devices found.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table ap-table">
                <thead><tr><th>#</th><th>DEVICE NAME</th><th>TYPE</th><th>BRAND</th><th>SERIAL NUMBER</th><th>LOCATION</th><th>STATUS</th><th>ASSIGNED TO</th><th>PURCHASE DATE</th><th>ACTIONS</th></tr></thead>
                <tbody>
                  {visible.map((r, i) => (
                    <tr key={r.id}>
                      <td>{(safePage - 1) * size + i + 1}</td>
                      <td><div className="ap-person"><span className="ap-dev-icon"><Icon name={TYPE_ICON[r.type] || "laptop"} size={16} /></span><strong>{r.name}</strong></div></td>
                      <td>{r.type}</td><td>{r.brand}</td><td>{r.serial}</td><td>{r.location}</td>
                      <td><Pill>{r.status}</Pill></td>
                      <td>{r.assignedTo ? <div className="ap-person"><Av name={r.assignedTo} i={i} size={28} /><span><strong>{r.assignedTo}</strong><small>{r.assignedCode}</small></span></div> : "—"}</td>
                      <td>{formatDate(r.purchaseDate)}</td>
                      <td><div className="ap-actions">
                        <button type="button" className="ap-icon-btn" onClick={() => setPanel({ mode: "view", row: r })} aria-label={`View ${r.name}`}><Icon name="eye" size={15} /></button>
                        <button type="button" className="ap-icon-btn" onClick={() => setPanel({ mode: "edit", row: r })} aria-label={`Edit ${r.name}`}><Icon name="edit" size={15} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <Pager page={safePage} pages={pages} total={filtered.length} size={size} onPage={(n) => setPage(Math.min(Math.max(1, n), pages))} onSize={(n) => { setSize(n); setPage(1); }} noun="devices" />
          )}
        </section>

        {panel?.mode === "view" && <DevicePanel key={panel.row.id} device={panel.row} onEdit={() => setPanel({ mode: "edit", row: panel.row })} onClose={() => setPanel(null)} />}
        {(panel?.mode === "add" || panel?.mode === "edit") && (
          <FormPanel
            key={panel.row?.id || "new"}
            title={panel.mode === "edit" ? "Edit Device" : "Add New Device"}
            fields={FIELDS}
            initial={panel.row || {}}
            submitLabel={panel.mode === "edit" ? "Save Changes" : "Add Device"}
            onSubmit={submit}
            onClose={() => setPanel(null)}
          />
        )}
      </div>
    </div>
  );
}
