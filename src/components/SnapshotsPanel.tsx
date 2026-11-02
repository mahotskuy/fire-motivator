import { useState } from "react";
import { compareToSnapshot, type PortfolioTotals } from "../domain/calc";
import { signed, today, usd } from "../domain/format";
import { buildSnapshot, isLegacySnapshot } from "../domain/snapshots";
import type { AppState, Snapshot } from "../domain/types";
import type { Notify } from "./Toasts";

interface Props {
  state: AppState;
  totals: PortfolioTotals;
  wealth: number | null;
  fxFresh: boolean;
  onChange: (fn: (snapshots: Snapshot[]) => Snapshot[]) => void;
  notify: Notify;
}

const inputClass =
  "bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none";

export function SnapshotsPanel({ state, totals, wealth, fxFresh, onChange, notify }: Props) {
  const { snapshots } = state;
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [baselineId, setBaselineId] = useState("");

  const baseline = snapshots.find((s) => s.id === baselineId) ?? snapshots[snapshots.length - 1];
  const cmp = baseline ? compareToSnapshot(baseline, totals) : null;
  const wealthDelta =
    baseline && !isLegacySnapshot(baseline) && wealth !== null ? wealth - (baseline.combinedWealth ?? 0) : null;

  const take = () => {
    const res = buildSnapshot(state, date || today(), note.trim() || "Місячний знімок капіталу", new Date(), fxFresh);
    if (!res.ok) {
      notify(`⚠️ Немає курсу для ${res.missingCurrencies.join(", ")} — снепшот не збережено. Онови курси!`, "amber");
      return;
    }
    const snap = res.snapshot;
    onChange((list) => [...list, snap].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    setNote("");
    notify(`📸 Снепшот статків на $${usd(snap.combinedWealth ?? snap.totalMarketValue)} успішно збережено!`);
    if (snap.usedCachedRates) notify("⚠️ Снепшот використовує збережені (не оновлені) курси валют", "amber");
  };

  const remove = (id: string) => {
    onChange((list) => list.filter((s) => s.id !== id));
    notify("🗑️ Снепшот видалено!", "amber");
  };

  const rows = snapshots.slice().reverse();

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-lg space-y-5">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>📸</span> Снепшоти статків та зміна портфеля за місяць
            </h2>
            <span className="text-[11px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 px-2.5 py-0.5 rounded-full">
              Порівняння з останнім знімком
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Фіксуй стан портфеля раз на місяць або після поповнення, щоб бачити чисту зміну ціни акцій та нових внесків
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} text-slate-200 font-semibold`} />
          <input
            type="text"
            placeholder="Коментар (напр. Жовтень ЗП +$500)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={`${inputClass} flex-1 sm:w-52 text-white`}
          />
          <button
            type="button"
            onClick={take}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-4 py-2 rounded-xl transition shadow-md shadow-emerald-950 flex items-center gap-1.5 shrink-0"
          >
            <span>📸</span> Зробити снепшот зараз
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card>
          <div className="flex justify-between items-center text-[11px] text-slate-400 mb-1">
            <span>База для порівняння:</span>
            <select
              value={baseline?.id ?? ""}
              onChange={(e) => setBaselineId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-1.5 py-0.5 text-[11px] font-semibold focus:outline-none"
            >
              {snapshots.length === 0 && <option value="">Немає знімків</option>}
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.date} — ${usd(s.totalMarketValue)}
                </option>
              ))}
            </select>
          </div>
          <div className="text-lg font-extrabold text-slate-200">${baseline ? usd(baseline.totalMarketValue) : 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {baseline ? `Знімок від ${baseline.date} (${baseline.note})` : "Зроби перший знімок вище"}
          </div>
          {baseline && (
            <div className="text-[11px] mt-1 text-slate-400">
              {isLegacySnapshot(baseline)
                ? "Старий знімок: лише акції (без інших активів)"
                : wealthDelta === null
                  ? "Зміна загальних статків недоступна (немає курсу)"
                  : `Загальні статки: ${signed(wealthDelta)}$${usd(wealthDelta)} від знімка`}
            </div>
          )}
        </Card>

        <Card>
          <span className="text-[11px] text-slate-400 block mb-1">📊 Загальна зміна портфеля</span>
          <div className={`text-lg font-extrabold ${!cmp || cmp.totalDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {cmp ? `${signed(cmp.totalDelta)}$${usd(cmp.totalDelta)} (${cmp.totalDeltaPct.toFixed(1)}%)` : "+$0 (0%)"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Ринок + нові внески</div>
        </Card>

        <Card>
          <span className="text-[11px] text-slate-400 block mb-1">📈 Чиста зміна ціни ETF (Ринок)</span>
          <div className={`text-lg font-extrabold ${!cmp || cmp.marketDelta >= 0 ? "text-sky-400" : "text-rose-400"}`}>
            {cmp ? `${signed(cmp.marketDelta)}$${usd(cmp.marketDelta)}` : "+$0"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Без урахування нових покупок</div>
        </Card>

        <Card>
          <span className="text-[11px] text-slate-400 block mb-1">💵 Додано своїх коштів та темп/міс</span>
          <div className="text-lg font-extrabold text-indigo-400">+${cmp ? usd(cmp.costBasisDelta) : 0}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {cmp
              ? `Темп за 30 дн.: ${signed(cmp.monthlyPace)}$${usd(cmp.monthlyPace)}/міс (${cmp.daysDiff} дн.)`
              : "Темп зміни за 30 дн.: $0/міс"}
          </div>
        </Card>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
              <th className="pb-2 pr-2">Дата знімка</th>
              <th className="pb-2 px-2">Ринкова вартість акцій ($)</th>
              <th className="pb-2 px-2">Загальні статки ($)</th>
              <th className="pb-2 px-2">Вкладено (Cost Basis)</th>
              <th className="pb-2 px-2">Зміна до попереднього</th>
              <th className="pb-2 px-2">Чистий рух ціни ETF</th>
              <th className="pb-2 px-2">Склад портфеля / Нотатка</th>
              <th className="pb-2 pl-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-4 text-center text-slate-500">
                  Ще не збережено жодного снепшоту статків
                </td>
              </tr>
            )}
            {rows.map((s, idx) => {
              const prev = rows[idx + 1];
              const d = prev ? s.totalMarketValue - prev.totalMarketValue : 0;
              return (
                <tr key={s.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 pr-2 font-bold text-white">{s.date}</td>
                  <td className="py-2.5 px-2 font-extrabold text-emerald-400">${usd(s.totalMarketValue)}</td>
                  <td className="py-2.5 px-2 text-sky-300 font-bold">
                    {isLegacySnapshot(s) ? (
                      <span className="text-[10px] text-slate-500 font-normal">legacy (лише акції)</span>
                    ) : (
                      <>
                        ${usd(s.combinedWealth ?? 0)}
                        {s.usedCachedRates && (
                          <span className="ml-1 text-[10px] text-amber-400 font-normal" title="Використано збережені курси">⚠️ кеш курсів</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-slate-300">${usd(s.totalCostBasis || 0)}</td>
                  <td className={`py-2.5 px-2 ${prev ? (d >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold") : "text-slate-400"}`}>
                    {prev ? `${signed(d)}$${usd(d)}` : "База"}
                  </td>
                  <td className="py-2.5 px-2 text-sky-300">активи та ціни</td>
                  <td className="py-2.5 px-2 text-slate-400 truncate max-w-[200px]" title={s.positionsSummary}>
                    {s.note} — <span className="text-[10px] text-slate-500">{s.positionsSummary}</span>
                  </td>
                  <td className="py-2.5 pl-2 text-right">
                    <button type="button" onClick={() => remove(s.id)} className="text-slate-500 hover:text-rose-400 text-xs px-1.5 py-0.5 rounded">
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl flex flex-col justify-between">{children}</div>;
}
