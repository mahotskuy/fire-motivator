import { useEffect } from "react";
import type { FireRules } from "../domain/calc";
import { usd } from "../domain/format";
import { LEVEL_KIND_LABEL, describeLevel, type Level, type LevelProgress } from "../domain/levels";

interface Props {
  levels: Level[];
  progress: LevelProgress;
  capital: number;
  rules: FireRules;
  // Через скільки місяців капітал дійде до суми при поточному плані внесків
  monthsTo: (capital: number) => number;
  onClose: () => void;
  onOpenAll: () => void;
}

const MONTHS_UK = ["січні", "лютому", "березні", "квітні", "травні", "червні", "липні", "серпні", "вересні", "жовтні", "листопаді", "грудні"];

function formatEta(months: number, now: Date = new Date()): string {
  if (months <= 0) return "вже зараз";
  if (months >= 1200) return "поза межами прогнозу";
  const d = new Date(now.getFullYear(), now.getMonth() + Math.ceil(months), 1);
  const span = months < 1 ? "менше місяця" : months < 24 ? `≈ ${Math.ceil(months)} міс` : `≈ ${(months / 12).toFixed(1)} р.`;
  return `${span} (у ${MONTHS_UK[d.getMonth()]} ${d.getFullYear()})`;
}

// Вікно рівня: що за віха, скільки лишилось, коли настане і що далі
export function LevelDialog({ levels, progress, capital, rules, monthsTo, onClose, onOpenAll }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const finished = progress.next === null;
  const target = progress.next ?? levels[levels.length - 1];
  const passed = progress.level > 0 ? levels[progress.level - 1] : null;
  const after = finished ? [] : levels.slice(progress.level + 1, progress.level + 4);
  const eta = finished ? null : formatEta(monthsTo(target.capital));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/65" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Рівень ${target.n}: ${target.title}`}
        className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-slate-900 border-t sm:border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 shrink-0 rounded-2xl bg-indigo-500/15 border border-indigo-400/50 flex flex-col items-center justify-center leading-none">
            <span className="text-[9px] tracking-widest text-indigo-300 font-bold mb-0.5">РІВЕНЬ</span>
            <span className="text-2xl font-extrabold text-white">{target.n}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">{finished ? "Остання віха" : "Твоя наступна ціль"}</div>
            <h2 className="text-lg font-extrabold text-white leading-snug">
              {target.icon} {target.title}
            </h2>
            <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">{LEVEL_KIND_LABEL[target.kind]}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрити" className="text-slate-400 hover:text-white text-lg px-1">
            ✕
          </button>
        </div>

        {finished ? (
          <p className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 p-3 text-sm text-emerald-300 font-bold">🏁 Ти пройшов усі рівні. Це і є FIRE.</p>
        ) : (
          <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-3 space-y-2">
            <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-label="Прогрес до цього рівня" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.pct)}>
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-300" style={{ width: `${Math.max(2, progress.pct)}%` }} />
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-[10px] text-slate-500 uppercase">Є</dt>
                <dd className="font-bold text-white tabular-nums text-sm">${usd(capital)}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-slate-500 uppercase">Треба</dt>
                <dd className="font-bold text-white tabular-nums text-sm">${usd(target.capital)}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-slate-500 uppercase">Лишилось</dt>
                <dd className="font-bold text-indigo-300 tabular-nums text-sm">${usd(progress.toNext)}</dd>
              </div>
            </dl>
            <p className="text-xs text-slate-400">
              Прогноз: <b className="text-slate-200">{eta}</b> при внесках ${usd(rules.mandatoryMonthlySave)}/міс
            </p>
          </div>
        )}

        <div className="space-y-2 text-sm text-slate-300">
          <h3 className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Що це означає</h3>
          {describeLevel(target, rules).map((line) => (
            <p key={line}>{line}</p>
          ))}
          {target.also.length > 0 && (
            <p className="text-xs text-slate-400">
              На цьому ж рівні також: {target.also.join(" · ")}
            </p>
          )}
        </div>

        {(passed || after.length > 0) && (
          <div className="space-y-1.5">
            <h3 className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Поруч</h3>
            <ul className="text-xs divide-y divide-slate-800/70">
              {passed && (
                <li className="flex justify-between gap-3 py-1.5 text-slate-500">
                  <span className="truncate">✓ Рівень {passed.n}: {passed.icon} {passed.title}</span>
                  <span className="shrink-0 tabular-nums">${usd(passed.capital)}</span>
                </li>
              )}
              {after.map((l) => (
                <li key={l.n} className="flex justify-between gap-3 py-1.5 text-slate-300">
                  <span className="truncate">Рівень {l.n}: {l.icon} {l.title}</span>
                  <span className="shrink-0 tabular-nums text-slate-400">${usd(l.capital)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800">
            Закрити
          </button>
          <button type="button" onClick={onOpenAll} className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm transition">
            Усі рівні
          </button>
        </div>
      </div>
    </div>
  );
}
