import { useEffect, useState } from "react";
import type { LevelProgress } from "../domain/levels";
import { usd } from "../domain/format";

interface Props {
  progress: LevelProgress;
  year: number;
  yearInvested: number;
  yearGoal: number;
  retireAge: number;
  onAdd: () => void;
  onOpenLevel: () => void;
}

// Стискається, коли сторінку прокрутили нижче COLLAPSE_AT, і розтискається лише біля самого верху: різні пороги не дають смузі смикатися на межі
const COLLAPSE_AT_PX = 56;
const EXPAND_AT_PX = 12;

// Липка смуга над усіма вкладками: наступний рівень, ціль року і кнопка внеску. Під час скролу стискається до одного рядка.
export function FocusBar(props: Props) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setCompact((was) => (was ? y > EXPAND_AT_PX : y > COLLAPSE_AT_PX));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Зовнішня обгортка завжди має висоту розгорнутої смуги, тож стискання не зсуває контент під нею і не викликає цикл прокрутки.
  // Невидима розгорнута копія лише задає цю висоту; справжня смуга лежить у тій самій клітинці сітки.
  return (
    <div className="sticky top-2 z-30 grid pointer-events-none">
      <div className="col-start-1 row-start-1 invisible" aria-hidden="true" inert>
        <BarCard {...props} compact={false} />
      </div>
      <div className="col-start-1 row-start-1 self-start pointer-events-auto">
        <BarCard {...props} compact={compact} />
      </div>
    </div>
  );
}

function BarCard({ progress, year, yearInvested, yearGoal, retireAge, onAdd, onOpenLevel, compact }: Props & { compact: boolean }) {
  const { level, next, pct, toNext } = progress;
  const yearPct = yearGoal > 0 ? Math.min(100, (yearInvested / yearGoal) * 100) : 0;
  const badge = compact ? "w-9 h-9 rounded-[10px] text-base" : "w-12 h-12 rounded-xl text-xl";

  return (
    <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-2xl shadow-xl px-3 py-2.5 sm:px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenLevel}
          aria-haspopup="dialog"
          aria-label={`Рівень ${level}${next ? `, далі ${next.title}` : ""}: показати деталі`}
          className="flex-1 min-w-0 flex items-center gap-3 text-left rounded-xl -m-1 p-1 hover:bg-slate-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 transition-colors"
        >
          <span
            className={`${badge} shrink-0 flex flex-col items-center justify-center bg-indigo-500/15 border border-indigo-400/50 text-white font-extrabold leading-none transition-all duration-300 motion-reduce:transition-none`}
          >
            <span
              className={`text-[8px] tracking-widest text-indigo-300 font-bold overflow-hidden transition-all duration-300 motion-reduce:transition-none ${
                compact ? "max-h-0 opacity-0" : "max-h-3 opacity-100 mb-0.5"
              }`}
            >
              РІВЕНЬ
            </span>
            <span>{level}</span>
          </span>
          <span className="flex-1 min-w-0 block space-y-1.5">
            <span className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-slate-300">
                {next ? (
                  <>
                    {next.icon} <b className="text-white">{next.title}</b>
                  </>
                ) : (
                  <b className="text-emerald-400">🏁 Усі рівні пройдено</b>
                )}
              </span>
              {next && <span className="shrink-0 tabular-nums text-slate-400">−${usd(toNext)}</span>}
            </span>
            <span className="block h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <span className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-300 transition-[width] duration-700" style={{ width: `${Math.max(2, pct)}%` }} />
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onAdd}
          aria-label="Додати внесок"
          className="shrink-0 h-10 w-10 sm:w-auto sm:px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold text-xl sm:text-sm shadow-lg shadow-emerald-950/50 transition"
        >
          <span className="sm:hidden" aria-hidden="true">+</span>
          <span className="hidden sm:inline">+ Внесок</span>
        </button>
      </div>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none ${
          compact ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-2.5 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>
                {year}: <b className="text-white tabular-nums">${usd(yearInvested)}</b> з ${usd(yearGoal)}
              </span>
              <span className="shrink-0">🎯 FIRE у <b className="text-white tabular-nums">{retireAge.toFixed(1)} р.</b></span>
            </div>
            <div
              className="h-1.5 rounded-full bg-slate-800 overflow-hidden"
              role="progressbar"
              aria-label={`Ціль ${year} року`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(yearPct)}
            >
              <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-300 transition-[width] duration-700" style={{ width: `${Math.max(2, yearPct)}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
