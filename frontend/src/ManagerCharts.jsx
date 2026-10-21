/* Chart components only (keeps React Fast Refresh happy) */
export function BarChart({ data }) {
  const totals = data.map((d) => d.present + d.leave + d.absent);
  const max = Math.max(5, Math.ceil(Math.max(...totals, 1) / 5) * 5);
  const W = 640, H = 230, L = 34, R = 8, T = 10, B = 46;
  const step = (W - L - R) / Math.max(data.length, 1);
  const bw = Math.min(38, step * 0.55);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const ticks = [];
  for (let v = 0; v <= max; v += 5) ticks.push(v);

  return (
    <svg className="mgr-bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Team attendance for the last 7 days">
      {ticks.map((v) => (
        <g key={v}>
          <line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end">{v}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = L + i * step + (step - bw) / 2;
        let base = 0;
        const seg = [["present", "#1f9d73", d.present], ["leave", "#a9cdf5", d.leave], ["absent", "#d5dbe0", d.absent]];
        return (
          <g key={d.date || i}>
            {seg.map(([k, color, v]) => {
              const h = y(base) - y(base + v);
              const rect = v > 0 ? <rect key={k} x={x} y={y(base + v)} width={bw} height={h} fill={color} rx={k === "absent" ? 3 : 0} /> : null;
              base += v;
              return rect;
            })}
            <text x={x + bw / 2} y={H - 24} textAnchor="middle">{d.label}</text>
            <text x={x + bw / 2} y={H - 10} textAnchor="middle">{d.sub}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ parts, total, label = "Members" }) {
  const sum = parts.reduce((n, p) => n + p[1], 0) || 1;
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="mgr-donut" role="img" aria-label={`${label} breakdown`}>
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--ad-border)" strokeWidth="16" />
      {parts.map(([name, n, color]) => {
        const len = (n / sum) * C;
        const el = n > 0 ? <circle key={name} cx="70" cy="70" r={R} fill="none" stroke={color} strokeWidth="16" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" /> : null;
        offset += len;
        return el;
      })}
      <text x="70" y="68" textAnchor="middle" className="n">{total}</text>
      <text x="70" y="85" textAnchor="middle" className="l">{label}</text>
    </svg>
  );
}
