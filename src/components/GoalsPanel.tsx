import { useState } from "react";
import { getGoalProgress } from "../domain/calc";
import { newId } from "../domain/genericAssets";
import { canDeleteGoal, canEditGoal } from "../domain/goals";
import type { Asset, GenericAsset, Goal, Transaction } from "../domain/types";
import { AddButton, DeleteConfirm, FormActions, KebabMenu, Sheet, SwipeRow, formInput, formLabel, useIsMobile } from "./rowKit";
import type { Notify } from "./Toasts";

interface Props {
  goals: Goal[];
  transactions: Transaction[];
  assets: Asset[];
  genericAssets: GenericAsset[];
  // null — вартість недоступна (немає курсу)
  balances: Record<string, number | null>;
  targetFireCapital: number;
  onGoalsChange: (fn: (goals: Goal[]) => Goal[]) => void;
  onTransactionsChange: (fn: (tx: Transaction[]) => Transaction[]) => void;
  notify: Notify;
}

export function GoalsPanel({
  goals,
  assets,
  genericAssets,
  balances,
  targetFireCapital,
  onGoalsChange,
  onTransactionsChange,
  notify,
}: Pick<Props, "goals" | "assets" | "genericAssets" | "balances" | "targetFireCapital" | "onGoalsChange" | "onTransactionsChange" | "notify">) {
  const mobile = useIsMobile();
  const [sheet, setSheet] = useState<string | "add" | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const current = goals.find((g) => g.id === sheet);
  const close = () => setSheet(null);

  const nameTaken = (name: string, exceptId?: string) => goals.some((g) => g.id !== exceptId && g.name === name);

  const saveEdit = (goal: Goal, v: GoalValues) => {
    const targetAmount = Number(v.amount);
    const newName = v.name.trim();
    if (!newName || !(targetAmount > 0)) {
      notify("⚠️ Введи назву цілі та цільову суму!", "amber");
      return;
    }
    if (nameTaken(newName, goal.id)) {
      notify("⚠️ Ціль з такою назвою вже існує!", "amber");
      return;
    }
    const targetDate = v.date || "2027-12-31";
    onGoalsChange((list) => list.map((g) => (g.id === goal.id ? { ...g, name: newName, targetAmount, targetDate } : g)));
    if (newName !== goal.name) {
      onTransactionsChange((list) => list.map((t) => (t.goalId === goal.id ? { ...t, goalName: newName } : t)));
    }
    notify(`✏️ Ціль "${newName}" оновлено!`, "indigo");
    close();
  };

  const add = (v: GoalValues) => {
    const targetAmount = Number(v.amount);
    const newName = v.name.trim();
    if (!newName || !(targetAmount > 0)) {
      notify("⚠️ Введи назву цілі та цільову суму!", "amber");
      return;
    }
    if (nameTaken(newName)) {
      notify("⚠️ Ціль з такою назвою вже існує!", "amber");
      return;
    }
    onGoalsChange((list) => [...list, { id: newId("goal"), name: newName, targetAmount, targetDate: v.date || "2027-12-31" }]);
    notify(`🎯 Ціль "${newName}" додано та збережено!`, "indigo");
    close();
  };

  // Linked goals can't be deleted: explain instead of asking for confirmation.
  const askDelete = (goal: Goal) => {
    const check = canDeleteGoal(goal.id, assets, genericAssets, goals);
    if (!check.ok) {
      notify(
        check.reason === "builtin"
          ? "⚠️ Ціль FIRE вбудована і не видаляється!"
          : `⚠️ До цілі "${goal.name}" прив'язано активів: ${check.count}. Спочатку перепризначте або видаліть їх!`,
        "amber",
      );
      return;
    }
    setConfirming(goal.id);
  };

  const dropGoal = (goal: Goal) => {
    onGoalsChange((list) => list.filter((g) => g.id !== goal.id));
    notify(`🗑️ Ціль "${goal.name}" видалено!`, "amber");
    setConfirming(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl flex flex-col justify-between shadow-lg">
      <div>
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>🎯</span> Фінансові цілі (<code className="text-xs text-indigo-400">Goals</code>)
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-1">
          Прогрес цілі = сума вартості активів, прив'язаних до неї (акції та інші активи). Транзакції — лише історія й на суми не впливають.
        </p>
        <p className="text-xs text-slate-500 mb-4">
          <span className="sm:hidden">Свайпни картку вліво (або торкнись її), щоб змінити чи видалити ціль</span>
          <span className="hidden sm:inline">Натисни ⋮, щоб змінити чи видалити ціль</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((g) => {
            const saved = balances[g.id];
            const target = g.builtIn ? targetFireCapital : g.targetAmount;
            const p = getGoalProgress({ ...g, targetAmount: target }, saved ?? 0);
            const editable = canEditGoal(g);
            const card = (
              <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-between h-full">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-bold text-sm text-white">{g.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        {g.builtIn ? "вбудована" : `до ${g.targetDate}`}
                      </span>
                      {editable && (
                        <span className="hidden sm:inline-block -my-1.5 -mr-1.5">
                          <KebabMenu onEdit={() => setSheet(g.id)} onDelete={() => askDelete(g)} />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-lg font-extrabold text-indigo-400 my-1.5">
                    {saved === null ? (
                      <span className="text-amber-400" title="Курс недоступний">—</span>
                    ) : (
                      `$${Math.round(saved).toLocaleString("en-US")}`
                    )}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      / ${Math.round(target).toLocaleString("en-US")} ({saved === null ? "—" : `${p.pct.toFixed(0)}%`})
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-2.5">
                    <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${saved === null ? 0 : p.pct}%` }} />
                  </div>
                </div>
                {g.builtIn ? (
                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">Ціль береться з налаштувань пасивного доходу</div>
                ) : (
                  <div className="flex justify-between items-center text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                    <span>Залишилось: {p.monthsRem} міс.</span>
                    <span className={`font-semibold ${p.monthlyNeed > 0 ? "text-slate-200" : "text-emerald-400"}`}>
                      {saved === null ? "—" : p.monthlyNeed > 0 ? `План: $${p.monthlyNeed}/міс` : "Ціль закрита ✅"}
                    </span>
                  </div>
                )}
              </div>
            );
            return (
              <div key={g.id}>
                {mobile && editable ? (
                  <div className="rounded-xl overflow-hidden">
                    <SwipeRow onEdit={() => setSheet(g.id)} onDelete={() => askDelete(g)}>{card}</SwipeRow>
                  </div>
                ) : (
                  card
                )}
                {confirming === g.id && <DeleteConfirm label={`"${g.name}"`} onYes={() => dropGoal(g)} onNo={() => setConfirming(null)} />}
              </div>
            );
          })}
        </div>
      </div>

      <AddButton onClick={() => setSheet("add")} className="text-indigo-300 hover:border-indigo-500">
        ＋ Додати ціль
      </AddButton>

      {sheet && (
        <Sheet title={current ? `✏️ ${current.name}` : "➕ Нова ціль"} onClose={close}>
          {current ? (
            <GoalForm
              key={current.id}
              initial={{ name: current.name, amount: String(current.targetAmount), date: current.targetDate }}
              onSubmit={(v) => saveEdit(current, v)}
              onCancel={close}
              onDelete={() => {
                close();
                askDelete(current);
              }}
            />
          ) : (
            <GoalForm initial={{ name: "", amount: "", date: "2027-12-31" }} onSubmit={add} onCancel={close} />
          )}
        </Sheet>
      )}
    </div>
  );
}

interface GoalValues {
  name: string;
  amount: string;
  date: string;
}

function GoalForm({ initial, onSubmit, onCancel, onDelete }: { initial: GoalValues; onSubmit: (v: GoalValues) => void; onCancel: () => void; onDelete?: () => void }) {
  const [v, setV] = useState(initial);
  return (
    <div className="space-y-2">
      <label className="block">
        <span className={formLabel}>Назва</span>
        <input type="text" placeholder="напр. 🚗 Авто" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={formInput} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className={formLabel}>Сума цілі ($)</span>
          <input type="number" step="50" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} className={formInput} />
        </label>
        <label>
          <span className={formLabel}>Дата</span>
          <input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className={formInput} />
        </label>
      </div>
      <FormActions onSave={() => onSubmit(v)} onCancel={onCancel} onDelete={onDelete} />
    </div>
  );
}
