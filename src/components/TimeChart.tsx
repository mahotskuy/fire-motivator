import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { buildAxis, type ScaleMode } from "../domain/chartScale";
import { signedUsd, usd } from "../domain/format";

export interface TimeSeries<K extends string> {
  key: K;
  label: string;
  short: string;
  color: string;
  dash?: boolean;
}

// "base" — нижній край області графіка (0 або початок наближеної шкали)
export interface TimeFill<K extends string> {
  from: K | "base";
  to: K;
  color: string;
  opacity: number;
}

export type TimePoint<K extends string> = { date: string; live: boolean } & Record<K, number>;

interface Props<K extends string> {
  points: TimePoint<K>[];
  series: TimeSeries<K>[];
  fills?: TimeFill<K>[];
  scale: ScaleMode;
  ariaLabel: string;
  // Підсумковий рядок підказки, напр. «Приріст»
  footer?: (p: TimePoint<K>) => { label: string; value: number };
}

const HEIGHT = 240;
const PAD = { top: 12, right: 64, bottom: 26, left: 52 };
const DAY = 86_400_000;

export const compactUsd = (n: number): string => {
  const a = Math.abs(n);
  const s = n < 0 ? "−" : "";
  if (a >= 1e6) return `${s}$${+(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `${s}$${+(a / 1e3).toFixed(a >= 1e5 ? 0 : 1)}k`;
  return `${s}$${Math.round(a)}`;
};

const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Лінійний графік по датах з наближеною або нульовою шкалою, перехрестям і підказкою. */
export function TimeChart<K extends string>({ points, series, fills = [], scale, ariaLabel, footer }: Props<K>) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const hp = hover !== null ? points[hover] : undefined;

  const axis = buildAxis(points.flatMap((p) => series.map((s) => p[s.key])), scale);
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const times = points.map((p) => Date.parse(p.date));
  const t0 = times[0] ?? 0;
  const span = Math.max((times[times.length - 1] ?? 0) - t0, DAY);
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : ((times[i] - t0) / span) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - axis.min) / (axis.max - axis.min)) * innerH;
  const yOf = (p: TimePoint<K>, k: K | "base") => (k === "base" ? PAD.top + innerH : y(p[k]));

  const line = (k: K) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const area = (f: TimeFill<K>) => {
    if (points.length < 2) return "";
    const top = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yOf(p, f.to).toFixed(1)}`).join("");
    const bottom = points
      .map((p, i) => `L${x(i).toFixed(1)},${yOf(p, f.from).toFixed(1)}`)
      .reverse()
      .join("");
    return `${top}${bottom}Z`;
  };

  const xLabels =
    points.length <= 1 ? [0] : innerW > 360 && points.length > 2 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0, points.length - 1];

  // Підписи серій біля останньої точки; розсуваємо, щоб не налазили
  const lastIdx = points.length - 1;
  const endLabels = points.length
    ? series
        .map((s) => ({ s, yy: y(points[lastIdx][s.key]) }))
        .sort((a, b) => a.yy - b.yy)
        .reduce<{ s: TimeSeries<K>; yy: number }[]>((acc, l) => {
          const prev = acc[acc.length - 1];
          acc.push(prev && l.yy - prev.yy < 14 ? { ...l, yy: prev.yy + 14 } : l);
          return acc;
        }, [])
    : [];

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  };

  const tipX = hover !== null ? x(hover) : 0;
  const tipLeft = tipX + 180 > width ? Math.max(0, tipX - 176) : tipX + 12;
  const foot = hp && footer ? footer(hp) : null;

  return (
    <div ref={ref} className="relative select-none">
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={ariaLabel}
        className="block touch-pan-y"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {axis.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#1e293b" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[10px] tabular-nums">
              {compactUsd(t)}
            </text>
          </g>
        ))}
        {xLabels.map((i, n) => (
          <text
            key={i}
            x={x(i)}
            y={HEIGHT - 6}
            textAnchor={points.length === 1 ? "middle" : n === 0 ? "start" : n === xLabels.length - 1 ? "end" : "middle"}
            className="fill-slate-500 text-[10px]"
          >
            {points[i]?.live ? "Зараз" : points[i] ? shortDate(points[i].date) : ""}
          </text>
        ))}

        {fills.map((f) => (
          <path key={`${f.from}-${f.to}`} d={area(f)} fill={f.color} fillOpacity={f.opacity} />
        ))}
        {series.map((s) => (
          <path
            key={s.key}
            d={line(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={s.dash ? "5 4" : undefined}
          />
        ))}
        {points.length <= 40 &&
          series.map((s) =>
            points.map((p, i) => (
              <circle key={`${s.key}-${p.date}`} cx={x(i)} cy={y(p[s.key])} r={i === lastIdx ? 4 : 2.5} fill={s.color} stroke="#0f172a" strokeWidth={1.5} />
            )),
          )}
        {endLabels.map(({ s, yy }) => (
          <text key={s.key} x={x(lastIdx) + 8} y={yy} dy="0.32em" className="fill-slate-300 text-[11px] font-semibold">
            {s.short}
          </text>
        ))}

        {hp && (
          <g pointerEvents="none">
            <line x1={tipX} x2={tipX} y1={PAD.top} y2={PAD.top + innerH} stroke="#64748b" strokeWidth={1} strokeDasharray="3 3" />
            {series.map((s) => (
              <circle key={s.key} cx={tipX} cy={y(hp[s.key])} r={5} fill={s.color} stroke="#0f172a" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>

      {hp && (
        <div
          className="pointer-events-none absolute top-2 w-[168px] bg-slate-950/95 border border-slate-700 rounded-xl px-3 py-2 text-[11px] shadow-lg tabular-nums"
          style={{ left: tipLeft }}
        >
          <div className="font-bold text-white mb-1">{hp.live ? `Зараз (${hp.date})` : hp.date}</div>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-2 text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="font-bold text-slate-100">${usd(hp[s.key])}</span>
            </div>
          ))}
          {foot && (
            <div className="flex justify-between gap-2 text-slate-400 border-t border-slate-800 mt-1 pt-1">
              <span>{foot.label}</span>
              <span className={`font-bold ${foot.value >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {signedUsd(foot.value)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
