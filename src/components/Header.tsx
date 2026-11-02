import type { ChangeEvent } from "react";
import type { FireProgress, FireRules, PortfolioTotals } from "../domain/calc";
import { signed, usd } from "../domain/format";
import type { SaveStatus } from "../hooks/useFireState";

interface Props {
  rules: FireRules;
  totals: PortfolioTotals;
  wealth: number | null;
  fireAvailable: boolean;
  progress: FireProgress;
  status: SaveStatus;
  storageLabel: string;
  onExport: () => void;
  onImport: (file: File) => void;
}

function StatusBadge({ status, label }: { status: SaveStatus; label: string }) {
  const base = "text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5";
  if (status.kind === "saving") {
    return <span className={`${base} bg-amber-950 text-amber-300 border-amber-700 animate-pulse`}>⏳ Збереження...</span>;
  }
  if (status.kind === "error") {
    return <span className={`${base} bg-rose-950 text-rose-300 border-rose-700`}>⚠️ Помилка збереження</span>;
  }
  const time = status.kind === "saved" ? ` • ${status.at.toLocaleTimeString("uk-UA")}` : "";
  return <span className={`${base} bg-slate-800 text-slate-300 border-slate-700`}>💾 {label}{time}</span>;
}

export function Header({ rules, totals, wealth, fireAvailable, progress, status, storageLabel, onExport, onImport }: Props) {
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    e.target.value = "";
  };
  const onTrack = progress.deltaToPlan >= 0;
  const stockPnl = totals.totalMarketValue - totals.totalCostBasis;
  const stockPnlPct = totals.totalCostBasis > 0 ? (stockPnl / totals.totalCostBasis) * 100 : 0;
  const btn =
    "flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl transition";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>🚀</span> FIRE & IBKR Капітал
            </h1>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                !fireAvailable
                  ? "bg-slate-800 text-amber-300 border-amber-800"
                  : onTrack
                    ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                    : "bg-amber-950 text-amber-400 border-amber-800"
              }`}
            >
              {!fireAvailable
                ? "⚠️ FIRE недоступний (немає курсу)"
                : onTrack
                  ? `🟢 ON TRACK (+$${usd(progress.deltaToPlan)} до плану)`
                  : `🟡 ВІДСТАВАННЯ (-$${usd(Math.abs(progress.deltaToPlan))} від плану)`}
            </span>
            <StatusBadge status={status} label={storageLabel} />
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            План: <b className="text-slate-200">${rules.mandatoryMonthlySave}/міс</b> • Модель:{" "}
            <b className="text-emerald-400">
              {+(rules.growthDecimal * 100).toFixed(2)}% ріст + {+(rules.divDecimal * 100).toFixed(2)}% див ({(rules.totalAnnualReturn * 100).toFixed(1)}%)
            </b>{" "}
            • Ціль:{" "}
            <b className="text-white">
              ${rules.targetMonthlyPassive}/міс (${usd(rules.targetFireCapital)})
            </b>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button type="button" onClick={onExport} className={btn} title="Завантажити резервну копію JSON">
            <span>📥</span> Експорт JSON
          </button>
          <label className={`${btn} cursor-pointer`} title="Відновити дані з JSON файлу">
            <span>📤</span> Імпорт JSON
            <input type="file" accept=".json" onChange={onFile} className="hidden" />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Kpi label="Вкладено своїх (Cost Basis)" value={`$${usd(totals.totalCostBasis)}`} className="text-slate-200" />
        <Kpi label="Ринкова вартість IBKR" value={`$${usd(totals.totalMarketValue)}`} className="text-emerald-400" />
        <Kpi
          label="Чистий приріст ринку (P&L)"
          value={`${signed(stockPnl)}$${usd(stockPnl)} (${stockPnlPct.toFixed(1)}%)`}
          className={stockPnl >= 0 ? "text-emerald-400" : "text-rose-400"}
        />
        <Kpi label="План на сьогодні (On-Track)" value={`$${usd(progress.plannedCapital)}`} className="text-indigo-400" />
        <Kpi label="Загальні статки (всі активи)" value={wealth === null ? "— (немає курсу)" : `$${usd(wealth)}`} className="text-sky-400" />
      </div>
    </div>
  );
}

function Kpi({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
      <span className="text-[11px] text-slate-400 block">{label}</span>
      <span className={`text-base sm:text-lg font-bold ${className}`}>{value}</span>
    </div>
  );
}
