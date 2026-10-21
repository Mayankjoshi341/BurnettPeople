import { useCallback, useEffect, useState } from "react";

import apiClient from "./api/client";
import { Icon } from "./DashboardIcons";
import { AVATAR_TONES, SHOW_DEMO_DATA, getArrayResponse, getErrorMessage, initialsOf } from "./dashboardUtils";

/* ---------- small display pieces ---------- */
export function Av({ name = "", i = 0, size = 34 }) {
  return (
    <span className="ap-av" style={{ width: size, height: size, fontSize: size * 0.34, background: AVATAR_TONES[i % AVATAR_TONES.length] }}>
      {initialsOf(name)}
    </span>
  );
}

const PILL_TONE = {
  active: "green", available: "green", present: "green", approved: "green",
  inactive: "red", absent: "red", rejected: "red",
  "in repair": "amber", "on leave": "amber", pending: "amber",
  assigned: "blue", "work from home": "blue",
};
export function Pill({ children }) {
  const tone = PILL_TONE[String(children).toLowerCase()] || "grey";
  return <span className={`ap-pill ${tone}`}>{children}</span>;
}

export function MiniStat({ icon, tone = "green", value, label, note }) {
  return (
    <div className="ap-mini">
      <span className={`ap-mini-icon ${tone}`}><Icon name={icon} size={22} /></span>
      <span className="ap-mini-body">
        <b>{value ?? "—"}</b>
        <strong>{label}</strong>
        {note && <small>{note}</small>}
      </span>
    </div>
  );
}

export function Pager({ page, pages, total, size, onPage, onSize, noun = "items" }) {
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const nums = [];
  for (let n = 1; n <= pages; n += 1) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) nums.push(n);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <div className="ap-pager">
      <span>Showing {from} to {to} of {total} {noun}</span>
      <div className="ap-pager-btns">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><Icon name="chevleft" size={14} /></button>
        {nums.map((n, i) =>
          n === "…" ? <span key={`e${i}`} className="ap-gap">…</span> : (
            <button key={n} type="button" className={n === page ? "on" : ""} onClick={() => onPage(n)}>{n}</button>
          ),
        )}
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page"><Icon name="chevron" size={14} /></button>
        {onSize && (
          <select value={size} onChange={(e) => onSize(Number(e.target.value))} aria-label="Rows per page">
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

/* ---------- CSV export (client side) ---------- */
export function downloadCsv(filename, header, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- generic list resource (demo = local state, otherwise REST) ----------
   GET  {endpoint}          -> list (array or {results: []})
   POST {endpoint}          -> create
   PATCH/PUT {endpoint}{id}/ -> update      DELETE {endpoint}{id}/ -> remove        */
export function useResource(endpoint, demoRows = []) {
  const demo = SHOW_DEMO_DATA;
  const [rows, setRows] = useState(demo ? demoRows : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      setRows(getArrayResponse(await apiClient.get(endpoint)));
      setError("");
    } catch (e) {
      setError(getErrorMessage(e, "Could not load data."));
    } finally {
      setLoading(false);
    }
  }, [demo, endpoint]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const send = async (method, url, body) => {
    const fn = method === "patch" ? apiClient.patch || apiClient.put : apiClient[method];
    if (typeof fn !== "function") throw new Error(`apiClient.${method} is not available yet.`);
    return fn.call(apiClient, url, body);
  };

  const create = async (item) => {
    if (demo) { setRows((p) => [...p, { ...item, id: `demo-${Date.now()}` }]); return; }
    await send("post", endpoint, item);
    await load();
  };
  const update = async (id, item) => {
    if (demo) { setRows((p) => p.map((r) => (r.id === id ? { ...r, ...item } : r))); return; }
    await send("patch", `${endpoint}${id}/`, item);
    await load();
  };
  const remove = async (id) => {
    if (demo) { setRows((p) => p.filter((r) => r.id !== id)); return; }
    await send("delete", `${endpoint}${id}/`);
    await load();
  };

  return { rows, loading, error, reload: load, create, update, remove };
}

/* ---------- generic side form ----------
   fields: [{ k, label, req, ph, type: text|textarea|select|date, options, max, half, def }] */
export function FormPanel({ title, subtitle, fields, initial = {}, submitLabel, onSubmit, onClose }) {
  const [v, setV] = useState(() => Object.fromEntries(fields.map((f) => [f.k, initial[f.k] ?? f.def ?? ""])));
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const set = (k, val) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrs((p) => ({ ...p, [k]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    const er = {};
    fields.forEach((f) => {
      if (f.req && !String(v[f.k]).trim()) er[f.k] = `${f.label} is required.`;
    });
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    setMsg("");
    try {
      await onSubmit(v);
      if (onClose) onClose();
    } catch (x) {
      setMsg(getErrorMessage(x, "Could not save. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="admin-panel ap-side" aria-label={title}>
      <div className="ap-side-head">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {onClose && <button type="button" className="ap-x" onClick={onClose} aria-label="Close panel"><Icon name="close" size={16} /></button>}
      </div>
      <form onSubmit={submit} noValidate>
        <div className="ap-form-grid">
          {fields.map((f) => (
            <div key={f.k} className={`ap-field${f.half ? " half" : ""}`}>
              <label htmlFor={`f-${f.k}`}>{f.label}{f.req && <em> *</em>}</label>
              {f.type === "textarea" ? (
                <>
                  <textarea id={`f-${f.k}`} rows={4} maxLength={f.max || 200} value={v[f.k]} placeholder={f.ph} onChange={(e) => set(f.k, e.target.value)} />
                  <span className="ap-count">{String(v[f.k]).length}/{f.max || 200}</span>
                </>
              ) : f.type === "select" ? (
                <select id={`f-${f.k}`} value={v[f.k]} onChange={(e) => set(f.k, e.target.value)} aria-invalid={Boolean(errs[f.k])}>
                  {f.ph && <option value="">{f.ph}</option>}
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input id={`f-${f.k}`} type={f.type || "text"} value={v[f.k]} placeholder={f.ph} onChange={(e) => set(f.k, e.target.value)} aria-invalid={Boolean(errs[f.k])} />
              )}
              {errs[f.k] && <span className="admin-field-error">{errs[f.k]}</span>}
            </div>
          ))}
        </div>
        {msg && <div role="alert" className="admin-form-error">{msg}</div>}
        <div className="ap-side-actions">
          {onClose && <button type="button" className="admin-secondary-button" onClick={onClose} disabled={busy}>Cancel</button>}
          <button type="submit" className="admin-primary-button" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
        </div>
      </form>
    </aside>
  );
}
