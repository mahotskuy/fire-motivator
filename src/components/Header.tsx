import type { FireProgress, FireRules, PortfolioTotals } from "../domain/calc";
import { signed, usd } from "../domain/format";
import type { PriceStatus } from "../hooks/useStockPrices";

interface Props {
  rules: FireRules;
  totals: PortfolioTotals;
  wealth: number | null;
  fireAvailable: boolean;
  progress: FireProgress;
  priceStatus: PriceStatus;
}

export function Header({ rules, totals, wealth, fireAvailable, progress, priceStatus }: Props) {
  const onTrack = progress.deltaToPlan >= 0;
  const stockPnl = totals.totalMarketValue - totals.totalCostBasis;
  const stockPnlPct = totals.totalCostBasis > 0 ? (stockPnl / totals.totalCostBasis) * 100 : 0;

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
            <PriceBadge status={priceStatus} />
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

function PriceBadge({ status }: { status: PriceStatus }) {
  const base = "text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5";
  if (status.loading) {
    return <span className={`${base} bg-indigo-950 text-indigo-300 border-indigo-800 animate-pulse`}>🌐 Оновлюю ціни…</span>;
  }
  if (status.failed.length) {
    return (
      <span className={`${base} bg-amber-950 text-amber-300 border-amber-800`} title={status.failReason}>
        ⚠️ Старі ціни: {status.failed.join(", ")}
      </span>
    );
  }
  // Звичайний час оновлення цін показує меню акаунта; тут лишаються лише стани, що потребують уваги.
  return null;
}

function Kpi({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl">
      <span className="text-[11px] text-slate-400 block">{label}</span>
      <span className={`text-base sm:text-lg font-bold ${className}`}>{value}</span>
    </div>
  );
}
