import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { buildCapitalHistory, type CapitalPeriod, type CapitalPoint, type CapitalScope } from "../domain/capitalHistory";
import { localDateString } from "../domain/deposits";
import { signed, usd } from "../domain/format";
import type { Snapshot } from "../domain/types";
import type { Wealth } from "../domain/wealth";

// Перші два слоти категоріальної палітри для темної поверхні (перевірені на CVD)
const SERIES = {
  capital: { label: "Капітал", color: "#3987e5" },
  invested: { label: "Вкладено", color: "#d95926" },
} as const;
type SeriesKey = keyof typeof SERIES;

const PERIODS: { id: CapitalPeriod; label: string }[] = [
  { id: "3m", label: "3М" },
  { id: "6m", label: "6М" },
  { id: "1y", label: "1Р" },
  { id: "all", label: "Все" },
];
const SCOPES: { id: CapitalScope; label: string }[] = [
  { id: "wealth", label: "Усі статки" },
  { id: "stocks", label: "Лише акції" },
];

const HEIGHT = 240;
const PAD = { top: 12, right: 12, bottom: 26, left: 52 };
const DAY = 86_400_000;

const compact = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e6) return `$${+(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `$${+(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
};

const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
};

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

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

function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex bg-slate-950 border border-slate-800 rounded-xl p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${value === o.id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface Props {
  snapshots: Snapshot[];
  wealth: Wealth;
  onOpenSnapshots: () => void;
}

export function CapitalChart({ snapshots, wealth, onOpenSnapshots }: Props) {
  const [scope, setScope] = useState<CapitalScope>("wealth");
  const [period, setPeriod] = useState<CapitalPeriod>("all");
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({ capital: true, invested: true });
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [boxRef, width] = useWidth<HTMLDivElement>();

  const today = localDateString(new Date());
  const points = useMemo(
    () => buildCapitalHistory(snapshots, wealth, scope, period, today),
    [snapshots, wealth, scope, period, today],
  );
  const keys = (Object.keys(SERIES) as SeriesKey[]).filter((k) => visible[k]);

  // Вимкнути можна будь-яку лінію, але не обидві одразу
  const toggle = (k: SeriesKey) =>
    setVisible((v) => (v[k] && keys.length === 1 ? v : { ...v, [k]: !v[k] }));

  const first = points[0];
  const last = points[points.length - 1];
  const gain = last ? last.capital - last.invested : 0;
  const periodChange = first && last && points.length > 1 ? last.capital - first.capital : null;

  // Геометрія
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const times = points.map((p) => Date.parse(p.date));
  const t0 = times[0] ?? 0;
  const t1 = times[times.length - 1] ?? 0;
  const span = Math.max(t1 - t0, DAY);
  const maxY = Math.max(0, ...points.flatMap((p) => keys.map((k) => p[k])));
  const ticks = niceTicks(maxY);
  const yMax = ticks[ticks.length - 1] || 1;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : ((times[i] - t0) / span) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const linePath = (k: SeriesKey) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const areaPath =
    points.length > 1
      ? `${linePath("capital")}L${x(points.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`
      : "";
  const showMarkers = points.length <= 40;

  const xLabels = useMemo(() => {
    if (!points.length) return [];
    if (points.length === 1) return [0];
    const idx = [0, points.length - 1];
    if (innerW > 360 && points.length > 2) idx.splice(1, 0, Math.floor((points.length - 1) / 2));
    return idx;
  }, [points.length, innerW]);

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  };

  const hp: CapitalPoint | null = hover !== null ? (points[hover] ?? null) : null;
  const tipLeft = hp ? Math.min(Math.max(x(hover!) + 10, 0), width - 170) : 0;
  const tipFlip = hp && x(hover!) + 180 > width;

  return (
    <div ref={boxRef} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-white">📈 Динаміка капіталу</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            За знімками статків + поточний стан. «Вкладено» — собівартість акцій{scope === "wealth" ? " та інші активи за номіналом" : ""}.
          </p>
        </div>
        <button type="button" onClick={() => setShowTable((s) => !s)} className="text-[11px] text-slate-400 hover:text-slate-200 underline self-start">
          {showTable ? "Показати графік" : "Показати таблицею"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Активи" options={SCOPES} value={scope} onChange={(v) => { setScope(v); setHover(null); }} />
        <div role="group" aria-label="Лінії" className="inline-flex gap-1.5">
          {(Object.keys(SERIES) as SeriesKey[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={visible[k]}
              onClick={() => toggle(k)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition ${
                visible[k] ? "border-slate-600 bg-slate-800 text-slate-100" : "border-slate-800 text-slate-500 line-through"
              }`}
            >
              <span className="h-2 w-3 rounded-sm" style={{ background: visible[k] ? SERIES[k].color : "transparent", outline: `1.5px solid ${SERIES[k].color}` }} />
              {SERIES[k].label}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto">
          <Segmented label="Період" options={PERIODS} value={period} onChange={(v) => { setPeriod(v); setHover(null); }} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Капітал зараз" value={last ? `$${usd(last.capital)}` : "—"} />
        <Stat label="Вкладено своїх" value={last ? `$${usd(last.invested)}` : "—"} />
        <Stat
          label="Приріст над вкладеним"
          value={last ? `${signed(gain)}$${usd(gain)}` : "—"}
          tone={last ? (gain >= 0 ? "up" : "down") : undefined}
        />
        <Stat
          label="Зміна капіталу за період"
          value={periodChange === null ? "—" : `${signed(periodChange)}$${usd(periodChange)}`}
          tone={periodChange === null ? undefined : periodChange >= 0 ? "up" : "down"}
        />
      </div>

      {points.length === 0 ? (
        <div className="text-center text-sm text-slate-400 py-10">
          {scope === "wealth" && wealth.combinedWealth === null
            ? "Немає курсу валют для інших активів — спробуй «Лише акції»."
            : "У цьому періоді немає даних."}
        </div>
      ) : showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                <th className="pb-2 pr-2">Дата</th>
                <th className="pb-2 px-2 text-right">Капітал</th>
                <th className="pb-2 px-2 text-right">Вкладено</th>
                <th className="pb-2 pl-2 text-right">Приріст</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {[...points].reverse().map((p) => (
                <tr key={p.date}>
                  <td className="py-2 pr-2 font-bold text-white">{p.date}{p.live ? " (зараз)" : ""}</td>
                  <td className="py-2 px-2 text-right text-slate-200">${usd(p.capital)}</td>
                  <td className="py-2 px-2 text-right text-slate-200">${usd(p.invested)}</td>
                  <td className="py-2 pl-2 text-right text-slate-300">{signed(p.capital - p.invested)}${usd(p.capital - p.invested)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative select-none">
          <svg
            width={width}
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            role="img"
            aria-label={`Графік: ${keys.map((k) => SERIES[k].label).join(" і ")} з ${first.date} по ${last.date}`}
            className="block touch-pan-y"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="capital-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={SERIES.capital.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={SERIES.capital.color} stopOpacity={0} />
              </linearGradient>
            </defs>

            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#1e293b" strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 text-[10px]">
                  {compact(t)}
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
                {points[i].live ? "Зараз" : shortDate(points[i].date)}
              </text>
            ))}

            {visible.capital && areaPath && <path d={areaPath} fill="url(#capital-fill)" />}
            {keys.map((k) => (
              <path key={k} d={linePath(k)} fill="none" stroke={SERIES[k].color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {(showMarkers || points.length === 1) &&
              keys.map((k) =>
                points.map((p, i) => (
                  <circle key={`${k}-${p.date}`} cx={x(i)} cy={y(p[k])} r={points.length === 1 ? 4 : 2.5} fill={SERIES[k].color} stroke="#0f172a" strokeWidth={1.5} />
                )),
              )}

            {hp && (
              <g pointerEvents="none">
                <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + innerH} stroke="#64748b" strokeWidth={1} strokeDasharray="3 3" />
                {keys.map((k) => (
                  <circle key={k} cx={x(hover!)} cy={y(hp[k])} r={5} fill={SERIES[k].color} stroke="#0f172a" strokeWidth={2} />
                ))}
              </g>
            )}
          </svg>

          {hp && (
            <div
              className="pointer-events-none absolute top-2 w-40 bg-slate-950/95 border border-slate-700 rounded-xl px-3 py-2 text-[11px] shadow-lg"
              style={{ left: tipFlip ? Math.max(0, x(hover!) - 170) : tipLeft }}
            >
              <div className="font-bold text-white mb-1">{hp.live ? `Зараз (${hp.date})` : hp.date}</div>
              {keys.map((k) => (
                <div key={k} className="flex items-center justify-between gap-2 text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: SERIES[k].color }} />
                    {SERIES[k].label}
                  </span>
                  <span className="font-bold text-slate-100">${usd(hp[k])}</span>
                </div>
              ))}
              <div className="flex justify-between gap-2 text-slate-400 border-t border-slate-800 mt-1 pt-1">
                <span>Приріст</span>
                <span className="font-bold text-slate-200">{signed(hp.capital - hp.invested)}${usd(hp.capital - hp.invested)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {points.length > 0 && points.length < 3 && (
        <p className="text-[11px] text-slate-400">
          Точок поки мало: кожен знімок статків додає точку на графік.{" "}
          <button type="button" onClick={onOpenSnapshots} className="underline text-sky-300 hover:text-sky-200">
            Зробити знімок
          </button>
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  const color = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-slate-100";
  return (
    <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
      <span className="text-[11px] text-slate-400 block">{label}</span>
      <span className={`text-base sm:text-lg font-bold ${color}`}>
        {tone === "up" ? "▲ " : tone === "down" ? "▼ " : ""}
        {value}
      </span>
    </div>
  );
}
