import { useEffect, useRef, useState } from "react";
import { getBillCoverage, type FireRules } from "../domain/calc";
import { usd } from "../domain/format";
import type { Level, LevelProgress } from "../domain/levels";
import { BillsList } from "./FireWidgets";

interface Props {
  levels: Level[];
  capital: number;
  progress: LevelProgress;
  rules: FireRules;
  billOrder: number[];
  onMoveBill: (id: number, toIndex: number) => void;
}

const UPCOMING_SHOWN = 5;

// Усі рівні до FIRE в одному списку: пройдені, поточна ціль і те, що попереду. Рівні-рахунки (що оплачують дивіденди) — його частина;
// їхній порядок налаштовується у згорнутому блоці внизу.
export function LevelsPanel({ levels, capital, progress, rules, billOrder, onMoveBill }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [showBills, setShowBills] = useState(false);
  const { unlockedCount, levels: bills } = getBillCoverage(rules, capital, billOrder);
  const currentRef = useRef<HTMLLIElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { level, next, pct, toNext } = progress;

  // Відкритий повний список одразу показує поточну ціль, а не початок
  useEffect(() => {
    if (!showAll || !currentRef.current || !listRef.current) return;
    listRef.current.scrollTop = Math.max(0, currentRef.current.offsetTop - listRef.current.offsetTop - 56);
  }, [showAll]);

  // Згорнутий список починається після поточної цілі: вона вже в картці зверху
  const rows = showAll ? levels : levels.slice(level + 1, level + 1 + UPCOMING_SHOWN);

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-lg space-y-4">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>🪜</span> Рівні до FIRE
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Віхи на шляху: дні свободи, круглий капітал, рахунки, які вже платять дивіденди, і % цілі. Капітал у FIRE: <b className="text-slate-200">${usd(capital)}</b>
          </p>
        </div>
        <span className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-3 py-1 rounded-full font-bold shrink-0">
          {level} / {levels.length} пройдено
        </span>
      </div>

      {next ? (
        <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-3 space-y-2">
          <div className="flex justify-between items-baseline gap-3 text-sm">
            <span className="text-white min-w-0">
              Рівень {next.n}: {next.icon} <b>{next.title}</b>
            </span>
            <span className="shrink-0 text-xs text-slate-300 tabular-nums">ще ${usd(toNext)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-label="Прогрес до наступного рівня" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-300 transition-[width] duration-700" style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 text-right tabular-nums">
            ${usd(capital)} із ${usd(next.capital)}
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-3 text-sm text-emerald-300 font-bold">🏁 Усі рівні пройдено</p>
      )}

      <ul ref={listRef} className={`divide-y divide-slate-800/70 text-sm ${showAll ? "max-h-96 overflow-y-auto pr-1" : ""}`}>
        {rows.map((l) => {
          const done = l.n <= level;
          const current = l.n === level + 1;
          return (
            <li
              key={l.n}
              ref={current ? currentRef : undefined}
              aria-current={current ? "step" : undefined}
              className={`flex items-center gap-3 py-2 px-2 rounded-lg ${current ? "bg-indigo-500/10" : ""} ${done ? "text-slate-500" : "text-slate-200"}`}
            >
              <span
                className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-extrabold border ${
                  done ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-400" : current ? "bg-indigo-500/20 border-indigo-400/50 text-white" : "border-slate-700 text-slate-400"
                }`}
              >
                {done ? "✓" : l.n}
              </span>
              <span className="flex-1 min-w-0 break-words leading-snug">
                {l.icon} {l.title}
                {l.billCost !== undefined && <span className="text-slate-500"> · ${l.billCost}/міс</span>}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-slate-400">${usd(l.capital)}</span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setShowAll((v) => !v)}
        aria-expanded={showAll}
        className="w-full border border-dashed border-slate-600 rounded-xl py-2 text-xs font-bold text-indigo-300 hover:border-indigo-500 transition"
      >
        {showAll ? "Згорнути" : `Показати всі ${levels.length} рівнів`}
      </button>

      <div className="border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={() => setShowBills((v) => !v)}
          aria-expanded={showBills}
          className="w-full flex items-center justify-between gap-2 text-left text-sm font-bold text-slate-200 hover:text-white"
        >
          <span>🔓 Рахунки, які платять дивіденди</span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-0.5 rounded-full">
              {unlockedCount} / {bills.length}
            </span>
            <span className="text-slate-500 text-xs" aria-hidden="true">{showBills ? "▲" : "▼"}</span>
          </span>
        </button>
        {!showBills && (
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {bills.map((b) => (
              <span key={b.id} title={b.name} className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm ${b.unlocked ? "bg-emerald-950/40 border-emerald-700/70" : "bg-slate-950/60 border-slate-800 opacity-60"}`}>
                {b.icon}
              </span>
            ))}
          </div>
        )}
        {showBills && (
          <div className="mt-3">
            <BillsList rules={rules} investedCapital={capital} order={billOrder} onMove={onMoveBill} />
          </div>
        )}
      </div>
    </div>
  );
}
