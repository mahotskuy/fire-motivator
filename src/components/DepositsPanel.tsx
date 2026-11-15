import { useState } from "react";
import { usd } from "../domain/format";
import type { Deposit } from "../domain/types";

interface Props {
  deposits: Deposit[];
  year: number;
  yearInvested: number;
  yearGoal: number;
  priorInvested: number;
  onPriorChange: (amount: number) => void;
  onAdd: () => void;
}

const dateLabel = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
};
const dayWord = (n: number) => {
  const r = Math.round(n);
  const t = r % 10;
  const h = r % 100;
  return t === 1 && h !== 11 ? "день" : t >= 2 && t <= 4 && (h < 12 || h > 14) ? "дні" : "днів";
};
const itemsLabel = (d: Deposit) =>
  d.items.map((i) => (i.kind === "stock" ? `${i.ticker} +${+i.shares.toFixed(4)}` : `${i.name} +${usd(i.amount)} ${i.currency}`)).join(", ");

// Картка в Analytics: ціль року, останній внесок і історія. Малюється з тих самих записів, що й підсумок після збереження.
export function DepositsPanel({ deposits, year, yearInvested, yearGoal, priorInvested, onPriorChange, onAdd }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const yearPct = yearGoal > 0 ? Math.min(100, (yearInvested / yearGoal) * 100) : 0;
  const [last, ...older] = deposits;

  const commitPrior = () => {
    if (draft === null) return;
    const n = Number(draft.replace(",", "."));
    onPriorChange(Number.isFinite(n) && n > 0 ? n : 0);
    setDraft(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
          <span>💸</span> Внески
        </h2>
        <button type="button" onClick={onAdd} className="text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-3.5 py-2 rounded-xl transition">
          + Додати внесок
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-slate-300">Ціль {year}</span>
          <span className="text-slate-400">
            <b className="text-white tabular-nums">${usd(yearInvested)}</b> з ${usd(yearGoal)}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-label={`Ціль ${year} року`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(yearPct)}>
          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-300" style={{ width: `${Math.max(2, yearPct)}%` }} />
        </div>
        <label className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          Вже вкладено у {year} до першого внеску тут, $
          <input
            inputMode="decimal"
            value={draft ?? (priorInvested ? String(priorInvested) : "")}
            placeholder="0"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitPrior}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label={`Вже вкладено у ${year} році до першого внеску`}
            className="w-24 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2 py-1 text-base sm:text-xs text-white text-right tabular-nums focus:outline-none"
          />
        </label>
      </div>

      {last ? (
        <div className="rounded-2xl border border-emerald-700/50 bg-gradient-to-br from-emerald-500/10 to-slate-900 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <b className="text-white">🎉 Останній внесок</b>
            <span className="text-xs text-slate-400">{dateLabel(last.date)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-3xl font-extrabold text-emerald-400 tabular-nums">+${usd(last.totalUsd)}</span>
            <span className="text-xs text-slate-400 text-right">
              {last.items.length} поз.
              {last.levelAfter > last.levelBefore && <b className="text-indigo-300"> · +{last.levelAfter - last.levelBefore} рівн.</b>}
            </span>
          </div>
          {last.fireUsd > 0 ? (
            <p className="text-xs text-slate-300">
              FIRE раніше на <b className="text-emerald-400">{Math.round(last.daysCloser)} {dayWord(last.daysCloser)}</b> · акції виростуть до{" "}
              <b className="text-sky-400">${usd(last.projectedUsd)}</b> · +${last.monthlyDividends.toFixed(2)}/міс дивідендів
            </p>
          ) : (
            <p className="text-xs text-slate-300">Цей внесок пішов в окрему ціль, не у FIRE.</p>
          )}
          <p className="text-[11px] text-slate-500 truncate">{itemsLabel(last)}</p>
        </div>
      ) : (
        <p className="text-xs text-slate-500 border border-dashed border-slate-700 rounded-xl p-4">
          Після першого внеску тут з'явиться його підсумок та історія. Натисни «+ Додати внесок» у день зарплати.
        </p>
      )}

      {older.length > 0 && (
        <ul className="divide-y divide-slate-800 text-xs">
          {older.slice(0, 8).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <span className="text-slate-400 shrink-0">{dateLabel(d.date)}</span>
              <span className="text-slate-500 truncate flex-1 min-w-0">{itemsLabel(d)}</span>
              <span className="text-right shrink-0 tabular-nums">
                <b className="text-white">+${usd(d.totalUsd)}</b>
                {d.fireUsd > 0 && <span className="text-emerald-400"> · {Math.round(d.daysCloser)} дн.</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
