import { Fragment, useState } from "react";
import { CURRENCIES, FOREIGN_CURRENCIES, convertToUsd, isCurrency, type Currency, type FxCache } from "../domain/currency";
import { usd } from "../domain/format";
import { createGenericAsset, removeGenericAsset, updateGenericAsset } from "../domain/genericAssets";
import { FIRE_GOAL_ID } from "../domain/goals";
import type { GenericAsset, Goal } from "../domain/types";
import type { FxStatus } from "../hooks/useFxRates";
import { AddButton, DeleteConfirm, FormActions, KebabMenu, Select, Sheet, SwipeHint, SwipeRow, formInput, formLabel } from "./rowKit";
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

type Patch = Parameters<typeof updateGenericAsset>[2];

export function GenericAssetsPanel({ genericAssets, goals, fx, fxStatus, onRefreshFx, onChange, notify }: Props) {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [amount, setAmount] = useState("");
  const [goalId, setGoalId] = useState(FIRE_GOAL_ID);
  const [sheet, setSheet] = useState<string | "add" | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const selectedGoal = goals.some((g) => g.id === goalId) ? goalId : FIRE_GOAL_ID;
  const hasForeign = genericAssets.some((a) => a.currency !== "USD");
  const staleWarning = hasForeign && !fxStatus.fresh && !fxStatus.loading;
  const current = genericAssets.find((a) => a.id === sheet);
  const close = () => setSheet(null);
  const goalName = (id: string) => goals.find((g) => g.id === id)?.name ?? "—";

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
    close();
  };

  const save = (id: string, patch: Patch) => {
    onChange((list) => updateGenericAsset(list, id, patch, goals));
    notify("☁️ Актив збережено");
  };

  const remove = (asset: GenericAsset) => {
    onChange((list) => removeGenericAsset(list, asset.id));
    notify(`🗑️ Актив "${asset.name}" видалено!`, "amber");
    setConfirming(null);
  };

  const valueText = (asset: GenericAsset) => {
    const v = convertToUsd(asset.amount, asset.currency, fx?.rates);
    return v === null ? (
      <span className="text-amber-400" title="Курс недоступний">
        —
      </span>
    ) : (
      `$${usd(v)}`
    );
  };

  const confirmStrip = (a: GenericAsset) =>
    confirming === a.id && <DeleteConfirm label={`"${a.name}"`} onYes={() => remove(a)} onNo={() => setConfirming(null)} />;

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
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="sm:hidden">Свайпни рядок вліво (або торкнись його), щоб змінити чи видалити</span>
            <span className="hidden sm:inline">Натисни ⋮, щоб змінити чи видалити актив</span>
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

      {/* Mobile: dense list */}
      <div className="sm:hidden">
        {genericAssets.length === 0 && <div className="py-4 text-center text-slate-500 text-xs">Ще немає інших активів</div>}
        {genericAssets.map((asset) => (
          <div key={asset.id} className="border-b border-slate-800/60">
            <SwipeRow onEdit={() => setSheet(asset.id)} onDelete={() => setConfirming(asset.id)} className="py-2.5 flex items-center">
              <span className="flex-1 flex items-center justify-between min-w-0 gap-2">
                <span className="min-w-0">
                  <span className="block font-extrabold text-white truncate">{asset.name}</span>
                  <span className="block text-[10px] text-slate-500">
                    {asset.amount.toLocaleString("en-US")} {asset.currency} · {goalName(asset.goalId)}
                  </span>
                </span>
                <span className="font-bold text-white text-sm">{valueText(asset)}</span>
              </span>
              <SwipeHint />
            </SwipeRow>
            {confirmStrip(asset)}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <table className="hidden sm:table w-full text-left border-collapse text-sm">
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
          {genericAssets.map((asset) => (
            <Fragment key={asset.id}>
              <tr className="hover:bg-slate-800/30 transition">
                <td className="py-2.5 pr-2 font-semibold text-white">{asset.name}</td>
                <td className="py-2.5 px-2 text-slate-300">{asset.currency}</td>
                <td className="py-2.5 px-2 text-sky-300 font-bold">{asset.amount.toLocaleString("en-US")}</td>
                <td className="py-2.5 px-2 text-slate-300">{goalName(asset.goalId)}</td>
                <td className="py-2.5 px-2 text-right font-bold text-white">{valueText(asset)}</td>
                <td className="py-2.5 pl-2 text-right">
                  <KebabMenu onEdit={() => setSheet(asset.id)} onDelete={() => setConfirming(asset.id)} />
                </td>
              </tr>
              {confirming === asset.id && (
                <tr>
                  <td colSpan={6}>{confirmStrip(asset)}</td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      <AddButton onClick={() => setSheet("add")} className="text-sky-300 hover:border-sky-500">
        ＋ Додати актив
      </AddButton>

      {sheet && (
        <Sheet title={current ? `✏️ ${current.name}` : "➕ Новий актив"} onClose={close}>
          {current ? (
            <AssetForm
              key={current.id}
              initial={{ name: current.name, currency: current.currency, amount: String(current.amount), goalId: current.goalId }}
              goals={goals}
              onSubmit={(v) => {
                save(current.id, { name: v.name, currency: v.currency, amount: Number(v.amount), goalId: v.goalId });
                close();
              }}
              onCancel={close}
              onDelete={() => {
                close();
                setConfirming(current.id);
              }}
            />
          ) : (
            <div className="space-y-2">
              <Fields
                goals={goals}
                values={{ name, currency, amount, goalId: selectedGoal }}
                onName={setName}
                onCurrency={setCurrency}
                onAmount={setAmount}
                onGoal={setGoalId}
              />
              <FormActions onSave={add} onCancel={close} />
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

interface Values {
  name: string;
  currency: Currency;
  amount: string;
  goalId: string;
}

function Fields({ goals, values, onName, onCurrency, onAmount, onGoal }: {
  goals: Goal[];
  values: Values;
  onName: (v: string) => void;
  onCurrency: (v: Currency) => void;
  onAmount: (v: string) => void;
  onGoal: (v: string) => void;
}) {
  return (
    <>
      <label className="block">
        <span className={formLabel}>Назва</span>
        <input type="text" placeholder="напр. Готівка в банку" value={values.name} onChange={(e) => onName(e.target.value)} className={formInput} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className={formLabel}>Валюта</span>
          <Select value={values.currency} onChange={(v) => isCurrency(v) && onCurrency(v)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </label>
        <label>
          <span className={formLabel}>Сума</span>
          <input type="number" step="0.01" min="0" value={values.amount} onChange={(e) => onAmount(e.target.value)} className={formInput} />
        </label>
      </div>
      <label className="block">
        <span className={formLabel}>Ціль</span>
        <Select value={values.goalId} onChange={onGoal} options={goals.map((g) => ({ value: g.id, label: g.name }))} />
      </label>
    </>
  );
}

function AssetForm({ initial, goals, onSubmit, onCancel, onDelete }: { initial: Values; goals: Goal[]; onSubmit: (v: Values) => void; onCancel: () => void; onDelete: () => void }) {
  const [v, setV] = useState(initial);
  const n = Number(v.amount);
  const valid = v.name.trim() !== "" && v.amount !== "" && Number.isFinite(n) && n >= 0;
  return (
    <div className="space-y-2">
      <Fields
        goals={goals}
        values={v}
        onName={(name) => setV({ ...v, name })}
        onCurrency={(currency) => setV({ ...v, currency })}
        onAmount={(amount) => setV({ ...v, amount })}
        onGoal={(goalId) => setV({ ...v, goalId })}
      />
      <FormActions saveDisabled={!valid} onSave={() => onSubmit(v)} onCancel={onCancel} onDelete={onDelete} />
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
