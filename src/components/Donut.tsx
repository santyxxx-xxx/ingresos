export interface Slice {
  key: string;
  value: number;
  color: string;
}

export function Donut({ slices, center, sub }: { slices: Slice[]; center: string; sub: string }) {
  const r = 48;
  const C = 2 * Math.PI * r;
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const gap = slices.length > 1 ? 3.2 : 0;
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} style={{ stroke: 'var(--hair)', strokeWidth: 14 }} />
        {slices.map((s) => {
          const len = (s.value / total) * C;
          const visible = Math.max(0.01, len - gap);
          const el = (
            <circle
              key={s.key}
              cx="60"
              cy="60"
              r={r}
              style={{
                stroke: s.color,
                strokeWidth: 14,
                strokeDasharray: `${visible} ${C - visible}`,
                strokeDashoffset: -offset,
                strokeLinecap: slices.length > 1 ? 'butt' : 'round'
              }}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="center">
        <div>
          <b>{center}</b>
          <span>{sub}</span>
        </div>
      </div>
    </div>
  );
}
