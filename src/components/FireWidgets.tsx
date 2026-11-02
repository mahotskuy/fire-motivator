import { useState } from "react";
import type { FireProgress, FireRules, PortfolioTotals } from "../domain/calc";
import { formatDaysAndHours, getBillCoverage, getTimeBuyer } from "../domain/calc";
import { usd } from "../domain/format";

interface Props {
  rules: FireRules;
  totals: PortfolioTotals;
  staticCapital: number;
  progress: FireProgress;
}

export function FireWidgets({ rules, totals, staticCapital, progress }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <FireGoalWidget rules={rules} progress={progress} />
      <CrossoverWidget rules={rules} progress={progress} />
      <TimeBuyerWidget rules={rules} totals={totals} staticCapital={staticCapital} />
    </div>
  );
}

function FireGoalWidget({ rules, progress }: Pick<Props, "rules" | "progress">) {
  return (
    <div className="lg:col-span-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-lg">
      <div>
        <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
          <span className="font-medium">🎯 Головна ціль FIRE (${usd(rules.targetFireCapital)})</span>
          <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
            {progress.firePct.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-2">
          <span className="text-3xl font-extrabold text-white">${progress.monthlyDividends.toFixed(1)}</span>
          <span className="text-xs text-slate-400">
            / ${rules.targetMonthlyPassive} міс (див. {+(rules.divDecimal * 100).toFixed(2)}%)
          </span>
        </div>
        <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden p-0.5">
          <div
            className="bg-gradient-to-r from-emerald-600 to-emerald-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${progress.firePct}%` }}
          />
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs">
        <Row label="⏳ Куплено свободи (Runway):" valueClass="font-bold text-amber-400">
          {progress.runwayMonths.toFixed(1)} міс. ({progress.runwayDays} дн.)
        </Row>
        <Row label="Залишилось до цілі:" valueClass="font-semibold text-slate-200">
          ${usd(progress.remainingCapital)}
        </Row>
        <Row label="Час до фінансової свободи:" valueClass="font-bold text-emerald-400">
          {progress.yearsLeft} р. {progress.remMonths} міс. (у {progress.retireAge.toFixed(1)} р.)
        </Row>
      </div>
    </div>
  );
}

function CrossoverWidget({ rules, progress }: Pick<Props, "rules" | "progress">) {
  return (
    <div className="lg:col-span-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-lg">
      <div>
        <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
          <span className="font-medium">❄️ Точка перелому (${usd(rules.crossoverCapital)})</span>
          <span className="text-sky-400 font-bold bg-sky-950/60 border border-sky-800/60 px-2 py-0.5 rounded-full">
            {progress.crossoverPct.toFixed(1)}%
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-3">Коли портфель сам генерує &gt; ${rules.mandatoryMonthlySave}/міс</p>
        <div className="space-y-3 text-xs">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-300">Твій щомісячний внесок із ЗП:</span>
              <span className="font-bold text-white">${rules.mandatoryMonthlySave} / міс</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full" style={{ width: "100%" }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-300">Робота твого капіталу зараз:</span>
              <span className="font-bold text-sky-400">${progress.monthlyTotalGrowth.toFixed(0)} / міс</span>
            </div>
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-sky-600 to-sky-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${progress.crossoverPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400">
        {progress.leftToCross > 0 ? (
          <>
            🔥 До Точки перелому залишилось накопичити <b>${usd(progress.leftToCross)}</b>
          </>
        ) : (
          <>
            🎉 <b>Точку перелому пройдено!</b> Портфель генерує більше за твій внесок!
          </>
        )}
      </div>
    </div>
  );
}

function TimeBuyerWidget({ rules, totals, staticCapital }: Pick<Props, "rules" | "totals" | "staticCapital">) {
  const [amountText, setAmountText] = useState("500");
  const simAmount = Math.max(0, Number(amountText) || 0);
  const t = getTimeBuyer(rules, totals.totalMarketValue, simAmount, staticCapital);
  const quick =
    "bg-slate-800 hover:bg-slate-700 text-[11px] px-2 py-1.5 rounded-lg font-semibold";

  return (
    <div className="lg:col-span-4 bg-slate-900 border border-amber-500/30 p-5 rounded-2xl flex flex-col justify-between shadow-lg">
      <div>
        <div className="flex justify-between items-center text-xs mb-2">
          <span className="font-bold text-amber-400">⏱️ Калькулятор купівлі часу на пенсії</span>
          <span className="text-[11px] text-slate-400">
            ${t.costPerDay.toFixed(1)}/день • ${t.costPerHour.toFixed(2)}/год
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <div className="relative flex-1 min-w-[90px]">
            <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">$</span>
            <input
              type="number"
              step={100}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl pl-6 pr-2 py-1.5 text-sm font-extrabold text-white focus:outline-none"
            />
          </div>
          <button type="button" onClick={() => setAmountText("100")} className={`${quick} text-slate-200`}>$100</button>
          <button type="button" onClick={() => setAmountText("500")} className={`${quick} text-emerald-300 font-bold`}>$500 (ЗП)</button>
          <button type="button" onClick={() => setAmountText("1000")} className={`${quick} text-slate-200`}>$1,000</button>
          <button
            type="button"
            onClick={() => setAmountText(String(Math.round(totals.totalMarketValue + staticCapital)))}
            className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] px-2 py-1.5 rounded-lg text-amber-300 font-bold"
            title="Підставити весь поточний портфель"
          >
            Весь портфель
          </button>
        </div>

        <div className="space-y-2 text-xs bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
          <Row label="♾️ Вічно щороку на пенсії:" valueClass="font-extrabold text-amber-400 text-right">
            {formatDaysAndHours(t.perpetualDaysPerYear)} / рік
          </Row>
          <Row label="🔋 Прямий запас (Runway):" valueClass="font-bold text-emerald-400 text-right">
            {formatDaysAndHours(t.directDays)}
          </Row>
          <Row label="🚀 Наближає дату FIRE на:" valueClass="font-bold text-sky-400 text-right">
            -{t.daysSavedToFire} дн. очікування
          </Row>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-800/80">
        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
          <span>Забезпечено портфелем у році:</span>
          <span className="text-amber-300 font-bold">
            {formatDaysAndHours(t.coveredDaysTotal)} із 365 дн. ({t.coveredPct.toFixed(1)}%)
          </span>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div className="bg-amber-400 h-full transition-all duration-500" style={{ width: `${t.coveredPct}%` }} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, valueClass, children }: { label: string; valueClass: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-slate-400">{label}</span>
      <span className={valueClass}>{children}</span>
    </div>
  );
}

const formatUsd = (value: number) => (Number.isFinite(value) ? `$${Math.round(value).toLocaleString("uk-UA")}` : "∞");

export function BillsPanel({ rules, investedCapital }: { rules: FireRules; investedCapital: number }) {
  const { levels, unlockedCount } = getBillCoverage(rules, investedCapital);

  return (
    <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl flex flex-col justify-between shadow-lg">
      <div>
        <div className="flex justify-between items-start mb-4 gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>🔓</span> Рівні покриття рахунків
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Бізнес-логіка: як твої дивіденди закривають щомісячні витрати</p>
          </div>
          <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-3 py-1 rounded-full font-bold shrink-0">
            {unlockedCount} / {levels.length} відкрито
          </span>
        </div>
        <div className="space-y-3">
          {levels.map((b) => (
            <div
              key={b.id}
              className={`p-3 rounded-xl border ${b.unlocked ? "bg-emerald-950/20 border-emerald-800/60" : "bg-slate-950/50 border-slate-800"}`}
            >
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className={`font-semibold ${b.unlocked ? "text-emerald-300" : "text-slate-200"}`}>
                  {b.icon} {b.name}
                </span>
                <span className={`font-bold ${b.unlocked ? "text-emerald-400" : "text-slate-400"}`}>
                  {b.unlocked ? "✅" : `${b.pct.toFixed(0)}%`} · ${b.billCost}/міс дивідендів
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`${b.unlocked ? "bg-emerald-500" : "bg-amber-400"} h-full transition-all duration-500`}
                  style={{ width: `${b.pct}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-right">
                {formatUsd(Math.floor(b.investedCapital))} із {formatUsd(b.neededCapital)}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>
          Кожні $500 у портфелі = <b>+$1.67/міс</b> пасивного доходу
        </span>
        <span className="text-emerald-400 font-semibold">Дивідендне покриття</span>
      </div>
    </div>
  );
}
