import type { ReactNode } from "react";

/** Ring chart drawn as SVG on the server. Slices start at 12 o'clock and go clockwise; an all-zero ring shows the track only. */
export function Donut({ slices, size = 140, thickness = 16, label, children }: { slices: { value: number; color: string; label: string }[]; size?: number; thickness?: number; label: string; children?: ReactNode }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + x.value, 0);
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7e5e4" strokeWidth={thickness} />
        {total > 0 &&
          slices
            .filter((s) => s.value > 0)
            .map((s) => {
              const len = (s.value / total) * c;
              const el = (
                <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}>
                  <title>{`${s.label}: ${s.value}`}</title>
                </circle>
              );
              offset += len;
              return el;
            })}
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}
