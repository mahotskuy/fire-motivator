import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getEtfAllocation } from "../domain/allocation";
import type { FireRules } from "../domain/calc";
import { buildCapitalHistory, buildPlanHistory, type CapitalPeriod, type CapitalScope } from "../domain/capitalHistory";
import type { ScaleMode } from "../domain/chartScale";
import { localDateString } from "../domain/deposits";
import { signedUsd, usd } from "../domain/format";
import type { Asset, Snapshot } from "../domain/types";
import type { Wealth } from "../domain/wealth";
import { TimeChart } from "./TimeChart";

// Категоріальна палітра для темної поверхні, перевірена на CVD; порядок фіксований
const PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"];
const CAPITAL = PALETTE[0];
const INVESTED = PALETTE[1];
const PLAN = PALETTE[2];
const MAX_SLICES = 6;

const PERIODS: { id: CapitalPeriod; label: string }[] = [
  { id: "3m", label: "3М" },
  { id: "6m", label: "6М" },
  { id: "1y", label: "1Р" },
  { id: "all", label: "Все" },
];
const SCALES: { id: ScaleMode; label: string }[] = [
  { id: "auto", label: "Наближено" },
  { id: "zero", label: "Від $0" },
];
const SCOPES: { id: CapitalScope; label: string }[] = [
  { id: "wealth", label: "Усі статки" },
  { id: "stocks", label: "Лише акції" },
];

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

function Card({ title, subtitle, children, actions }: { title: string; subtitle: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-extrabold text-white">{title}</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  const color = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-slate-100";
  return (
    <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl min-w-0">
      <span className="text-[11px] text-slate-400 block">{label}</span>
      <span className={`block text-sm sm:text-lg font-bold tabular-nums ${color}`}>
        {tone === "up" ? "▲ " : tone === "down" ? "▼ " : ""}
        {value}
      </span>
    </div>
  );
}

const money = (n: number) => `$${usd(n)}`;
const delta = signedUsd;
const tone = (n: number): "up" | "down" => (n >= 0 ? "up" : "down");

function Empty({ children }: { children: ReactNode }) {
  return <div className="text-center text-sm text-slate-400 py-10">{children}</div>;
}

interface Props {
  snapshots: Snapshot[];
  wealth: Wealth;
  assets: Asset[];
  rules: FireRules;
  onOpenSnapshots: () => void;
}

/** Графіки вкладки Analytics: капітал і вкладене, FIRE-капітал проти плану, розподіл ETF. Період і шкала спільні. */
export function CapitalCharts({ snapshots, wealth, assets, rules, onOpenSnapshots }: Props) {
  const [period, setPeriod] = useState<CapitalPeriod>("all");
  const [scale, setScale] = useState<ScaleMode>("auto");
  const [scope, setScope] = useState<CapitalScope>("wealth");
  const today = localDateString(new Date());

  const capital = useMemo(() => buildCapitalHistory(snapshots, wealth, scope, period, today), [snapshots, wealth, scope, period, today]);
  const plan = useMemo(() => buildPlanHistory(snapshots, wealth, rules, period, today), [snapshots, wealth, rules, period, today]);
  const allocation = useMemo(() => getEtfAllocation(assets), [assets]);

  const cLast = capital[capital.length - 1];
  const gain = cLast ? cLast.capital - cLast.invested : 0;
  const pLast = plan[plan.length - 1];
  const fewPoints = capital.length < 3;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Фільтри графіків">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Період</span>
        <Segmented label="Період" options={PERIODS} value={period} onChange={setPeriod} />
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold sm:ml-3">Шкала</span>
        <Segmented label="Шкала" options={SCALES} value={scale} onChange={setScale} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card
          title="📈 Капітал: своє + ринок"
          subtitle={
            <>
              <span style={{ color: INVESTED }}>■</span> вкладено своїх, <span style={{ color: CAPITAL }}>■</span> що додав ринок; верхній край — капітал
              {scope === "wealth" ? ". Інші активи враховано за номіналом" : ""}.
            </>
          }
          actions={<Segmented label="Активи" options={SCOPES} value={scope} onChange={setScope} />}
        >
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label="Капітал" value={cLast ? money(cLast.capital) : "—"} />
            <Stat label="Вкладено своїх" value={cLast ? money(cLast.invested) : "—"} />
            <Stat label="Приріст ринку" value={cLast ? delta(gain) : "—"} tone={cLast ? tone(gain) : undefined} />
          </div>
          {capital.length === 0 ? (
            <Empty>
              {scope === "wealth" && wealth.combinedWealth === null ? "Немає курсу валют для інших активів — спробуй «Лише акції»." : "У цьому періоді немає даних."}
            </Empty>
          ) : (
            <TimeChart
              points={capital}
              scale={scale}
              ariaLabel="Капітал і вкладені кошти за періодом"
              series={[
                { key: "capital", label: "Капітал", short: "Капітал", color: CAPITAL },
                { key: "invested", label: "Вкладено", short: "Своє", color: INVESTED },
              ]}
              fills={[
                { from: "base", to: "invested", color: INVESTED, opacity: 0.25 },
                { from: "invested", to: "capital", color: CAPITAL, opacity: 0.45 },
              ]}
              footer={(p) => ({ label: "Приріст ринку", value: p.capital - p.invested })}
            />
          )}
        </Card>

        <Card
          title="🎯 FIRE-капітал проти плану"
          subtitle={`Суцільна — твій FIRE-капітал, пунктир — де план каже бути ($${usd(rules.mandatoryMonthlySave)}/міс під ${(rules.totalAnnualReturn * 100).toFixed(1)}%).`}
        >
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label="FIRE-капітал" value={pLast ? money(pLast.capital) : "—"} />
            <Stat label="План на сьогодні" value={pLast ? money(pLast.plan) : "—"} />
            <Stat
              label={!pLast || pLast.capital >= pLast.plan ? "Випереджаєш" : "Відстаєш"}
              value={pLast ? delta(pLast.capital - pLast.plan) : "—"}
              tone={pLast ? tone(pLast.capital - pLast.plan) : undefined}
            />
          </div>
          {plan.length === 0 ? (
            <Empty>Немає даних FIRE для цього періоду (потрібен курс валют або повні знімки).</Empty>
          ) : (
            <TimeChart
              points={plan}
              scale={scale}
              ariaLabel="FIRE-капітал проти плану"
              series={[
                { key: "capital", label: "FIRE-капітал", short: "Капітал", color: CAPITAL },
                { key: "plan", label: "План", short: "План", color: PLAN, dash: true },
              ]}
              fills={[{ from: "base", to: "capital", color: CAPITAL, opacity: 0.12 }]}
              footer={(p) => ({ label: "Від плану", value: p.capital - p.plan })}
            />
          )}
        </Card>
      </div>

      {fewPoints && (
        <p className="text-[11px] text-slate-400">
          Точок поки мало: кожен знімок статків додає точку на графіки.{" "}
          <button type="button" onClick={onOpenSnapshots} className="underline text-sky-300 hover:text-sky-200">
            Зробити знімок
          </button>
        </p>
      )}

      <EtfAllocation slices={allocation} />
    </div>
  );
}

function EtfAllocation({ slices }: { slices: ReturnType<typeof getEtfAllocation> }) {
  // Понад MAX_SLICES позицій складаються в «Інші», щоб кольори лишались розрізненими
  const shown = slices.length > MAX_SLICES ? slices.slice(0, MAX_SLICES - 1) : slices;
  const rest = slices.slice(shown.length);
  const rows = [
    ...shown.map((s, i) => ({ name: s.ticker, value: s.value, share: s.share, color: PALETTE[i] })),
    ...(rest.length
      ? [{ name: `Інші (${rest.length})`, value: rest.reduce((a, s) => a + s.value, 0), share: rest.reduce((a, s) => a + s.share, 0), color: "#64748b" }]
      : []),
  ];
  const total = slices.reduce((a, s) => a + s.value, 0);

  return (
    <Card title="🧩 Розподіл ETF" subtitle={`Частки позицій за ринковою вартістю · разом ${money(total)}`}>
      {rows.length === 0 ? (
        <Empty>Ще немає позицій в акціях.</Empty>
      ) : (
        <>
          <div className="flex gap-0.5 h-8 rounded-lg overflow-hidden" role="img" aria-label={rows.map((r) => `${r.name} ${Math.round(r.share * 100)}%`).join(", ")}>
            {rows.map((r) => (
              <div
                key={r.name}
                title={`${r.name}: ${money(r.value)} (${Math.round(r.share * 100)}%)`}
                className="flex items-center pl-2 text-[11px] font-bold text-white whitespace-nowrap overflow-hidden"
                style={{ flex: `${r.share} 1 0`, background: r.color, minWidth: 3 }}
              >
                {r.share >= 0.1 ? `${Math.round(r.share * 100)}%` : ""}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-xs tabular-nums">
            {rows.map((r) => (
              <div key={r.name} className="grid grid-cols-[10px_1fr_auto_3rem] items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                <span className="text-slate-200 font-semibold truncate">{r.name}</span>
                <span className="text-slate-100">{money(r.value)}</span>
                <span className="text-slate-400 text-right">{Math.round(r.share * 100)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
