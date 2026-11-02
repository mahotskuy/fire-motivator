import { useState } from "react";
import { CURRENCIES, FOREIGN_CURRENCIES, convertToUsd, isCurrency, type Currency, type FxCache } from "../domain/currency";
import { usd } from "../domain/format";
import { createGenericAsset, removeGenericAsset, updateGenericAsset } from "../domain/genericAssets";
import { FIRE_GOAL_ID } from "../domain/goals";
import type { GenericAsset, Goal } from "../domain/types";
import type { FxStatus } from "../hooks/useFxRates";
import type { Notify } from "./Toasts";

interface Props {
  genericAssets: GenericAsset[];
  goals: Goal[];
  fx: FxCache | null;
  fxStatus: FxStatus;
  onRefreshFx: () => void;
  onChange: (fn: (list: GenericAsset[]) => GenericAsset[]) => void;
  notify: Notify;
}

const cell =
  "bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-lg px-2 py-1 text-xs text-white focus:outline-none";
const field = "w-full bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none";

export function GenericAssetsPanel({ genericAssets, goals, fx, fxStatus, onRefreshFx, onChange, notify }: Props) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [amount, setAmount] = useState("");
  const [goalId, setGoalId] = useState(FIRE_GOAL_ID);

  const selectedGoal = goals.some((g) => g.id === goalId) ? goalId : FIRE_GOAL_ID;
  const hasForeign = genericAssets.some((a) => a.currency !== "USD");
  const staleWarning = hasForeign && !fxStatus.fresh && !fxStatus.loading;

  const add = () => {
    const res = createGenericAsset({ name, currency, amount: Number(amount), goalId: selectedGoal }, goals);
    if (!res.ok) {
      notify(
        res.error === "amount" ? "⚠️ Сума має бути числом не менше нуля!" : "⚠️ Вкажи назву, валюту, суму та ціль!",
        "amber",
      );
      return;
    }
    onChange((list) => [...list, res.asset]);
    notify(`🏦 Актив "${res.asset.name}" додано!`);
    setName("");
    setAmount("");
  };

  const edit = (id: string, patch: Parameters<typeof updateGenericAsset>[2]) => {
    onChange((list) => updateGenericAsset(list, id, patch, goals));
  };

  const commitAmount = (asset: GenericAsset, raw: string) => {
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value) || value < 0) {
      notify("⚠️ Сума має бути числом не менше нуля!", "amber");
      return;
    }
    if (value !== asset.amount) edit(asset.id, { amount: value });
  };

  const commitName = (asset: GenericAsset, raw: string) => {
    if (!raw.trim()) {
      notify("⚠️ Назва не може бути порожньою!", "amber");
      return;
    }
    if (raw.trim() !== asset.name) edit(asset.id, { name: raw });
  };

  const remove = (asset: GenericAsset) => {
    if (!window.confirm(`Видалити актив "${asset.name}" назавжди?`)) return;
    onChange((list) => removeGenericAsset(list, asset.id));
    notify(`🗑️ Актив "${asset.name}" видалено!`, "amber");
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-lg space-y-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>🏦</span> Інші активи (<code className="text-xs text-sky-400">Generic assets</code>)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Готівка, облігації та інші залишки без тікера. Кожен актив прив'язаний до однієї цілі; вартість у $ рахується за курсом.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <FxSummary fx={fx} />
          <button
            type="button"
            onClick={onRefreshFx}
            disabled={fxStatus.loading}
            className="bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-2.5 py-1 rounded-lg font-bold transition disabled:opacity-60"
          >
            🔄 Оновити курси
          </button>
        </div>
      </div>

      {staleWarning && (
        <div className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded-lg px-3 py-2">
          ⚠️ Не вдалося оновити курси.{" "}
          {fx ? `Використано збережені курси (останнє оновлення: ${fx.fetchedAt.slice(0, 10)}).` : "Збережених курсів немає — вартість у $ для іноземних валют недоступна."}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
              <th className="pb-2.5 pr-2">Назва</th>
              <th className="pb-2.5 px-2">Валюта</th>
              <th className="pb-2.5 px-2">Сума</th>
              <th className="pb-2.5 px-2">Ціль</th>
              <th className="pb-2.5 px-2 text-right">Вартість ($)</th>
              <th className="pb-2.5 pl-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {genericAssets.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-500 text-xs">
                  Ще немає інших активів
                </td>
              </tr>
            )}
            {genericAssets.map((asset) => {
              const value = convertToUsd(asset.amount, asset.currency, fx?.rates);
              return (
                <tr key={asset.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 pr-2">
                    <input
                      key={asset.name}
                      type="text"
                      defaultValue={asset.name}
                      onBlur={(e) => commitName(asset, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      className={`${cell} w-40 font-semibold`}
                    />
                  </td>
                  <td className="py-2.5 px-2">
                    <select
                      value={asset.currency}
                      onChange={(e) => isCurrency(e.target.value) && edit(asset.id, { currency: e.target.value })}
                      className={cell}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 px-2">
                    <input
                      key={asset.amount}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={asset.amount}
                      onBlur={(e) => {
                        commitAmount(asset, e.target.value);
                        const value = Number(e.target.value);
                        if (e.target.value === "" || !Number.isFinite(value) || value < 0) e.target.value = String(asset.amount);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      className={`${cell} w-28 text-sky-300 font-bold`}
                    />
                  </td>
                  <td className="py-2.5 px-2">
                    <select value={asset.goalId} onChange={(e) => edit(asset.id, { goalId: e.target.value })} className={`${cell} max-w-[180px]`}>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold text-white">
                    {value === null ? <span className="text-amber-400" title="Курс недоступний">—</span> : `$${usd(value)}`}
                  </td>
                  <td className="py-2.5 pl-2 text-right">
                    <button type="button" onClick={() => remove(asset)} className="text-slate-500 hover:text-rose-400 text-xs px-1.5 py-0.5 rounded" title="Видалити актив">
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pt-4 border-t border-slate-800 bg-slate-950/60 p-4 rounded-xl">
        <div className="text-xs font-bold text-slate-200 mb-2.5">➕ Додати актив:</div>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <input type="text" placeholder="Назва (напр. Готівка в банку)" value={name} onChange={(e) => setName(e.target.value)} className={`${field} sm:col-span-4`} />
          <select value={currency} onChange={(e) => isCurrency(e.target.value) && setCurrency(e.target.value)} className={`${field} sm:col-span-2`}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input type="number" step="0.01" min="0" placeholder="Сума" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} sm:col-span-2`} />
          <select value={selectedGoal} onChange={(e) => setGoalId(e.target.value)} className={`${field} sm:col-span-4`}>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={add}
          className="mt-2.5 w-full bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/40 font-bold rounded-xl py-2 text-xs transition"
        >
          + Додати актив
        </button>
      </div>
    </div>
  );
}

function FxSummary({ fx }: { fx: FxCache | null }) {
  if (!fx) return <span>Курси: не завантажено</span>;
  return (
    <span title="Курс — одиниць валюти за 1 USD">
      Курси (за $1):{" "}
      {FOREIGN_CURRENCIES.map((c) => {
        const r = fx.rates[c];
        return r ? `${c} ${+r.rate.toFixed(4)} (${r.date})` : `${c} —`;
      }).join(" • ")}
    </span>
  );
}
