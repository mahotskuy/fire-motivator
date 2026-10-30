import { useState } from "react";
import { getGoalProgress } from "../domain/calc";
import { today } from "../domain/format";
import type { Goal, Transaction } from "../domain/types";
import type { Notify } from "./Toasts";

interface Props {
  goals: Goal[];
  transactions: Transaction[];
  onGoalsChange: (fn: (goals: Goal[]) => Goal[]) => void;
  onTransactionsChange: (fn: (tx: Transaction[]) => Transaction[]) => void;
  notify: Notify;
}

const field = "bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none";

export function GoalsPanel({ goals, transactions, onGoalsChange, notify }: Pick<Props, "goals" | "transactions" | "onGoalsChange" | "notify">) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("2027-12-31");

  const add = () => {
    const targetAmount = Number(amount);
    if (!name.trim() || !(targetAmount > 0)) {
      notify("⚠️ Введи назву цілі та цільову суму!", "amber");
      return;
    }
    if (goals.some((g) => g.name === name.trim())) {
      notify("⚠️ Ціль з такою назвою вже існує!", "amber");
      return;
    }
    onGoalsChange((list) => [...list, { name: name.trim(), targetAmount, targetDate: date || "2027-12-31" }]);
    notify(`🎯 Ціль "${name.trim()}" додано та збережено!`, "indigo");
    setName("");
    setAmount("");
  };

  const remove = (goalName: string) => {
    onGoalsChange((list) => list.filter((g) => g.name !== goalName));
    notify(`🗑️ Ціль "${goalName}" видалено!`, "amber");
  };

  return (
    <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl flex flex-col justify-between shadow-lg">
      <div>
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>🎯</span> Інші фінансові цілі (<code className="text-xs text-indigo-400">Goals</code>)
          </h2>
          <span className="text-xs text-slate-400">Автозбереження</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Структура: <code className="text-slate-300">Name | TargetAmount | TargetDate</code>. Прогрес рахується із транзакцій праворуч.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((g) => {
            const p = getGoalProgress(g, transactions);
            return (
              <div key={g.name} className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-bold text-sm text-white">{g.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">до {g.targetDate}</span>
                      <button type="button" onClick={() => remove(g.name)} className="text-slate-500 hover:text-rose-400 text-xs">
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="text-lg font-extrabold text-indigo-400 my-1.5">
                    ${p.saved.toLocaleString("en-US")}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      / ${Number(g.targetAmount).toLocaleString("en-US")} ({p.pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-2.5">
                    <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                  <span>Залишилось: {p.monthsRem} міс.</span>
                  <span className={`font-semibold ${p.monthlyNeed > 0 ? "text-slate-200" : "text-emerald-400"}`}>
                    {p.monthlyNeed > 0 ? `План: $${p.monthlyNeed}/міс` : "Ціль закрита ✅"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-800 bg-slate-950/60 p-4 rounded-xl">
        <div className="text-xs font-bold text-slate-200 mb-2.5">➕ Додати нову ціль:</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          <input type="text" placeholder="Назва (напр. 🚗 Авто)" value={name} onChange={(e) => setName(e.target.value)} className={`${field} sm:col-span-2 focus:border-indigo-500`} />
          <input type="number" step="50" placeholder="Сума цілі ($)" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} focus:border-indigo-500`} />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} focus:border-indigo-500`} />
        </div>
        <button
          type="button"
          onClick={add}
          className="mt-2.5 w-full bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 font-bold rounded-xl py-2 text-xs transition"
        >
          + Зберегти ціль
        </button>
      </div>
    </div>
  );
}

export function TransactionsPanel({ goals, transactions, onTransactionsChange, notify }: Pick<Props, "goals" | "transactions" | "onTransactionsChange" | "notify">) {
  const [goalName, setGoalName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const selected = goals.some((g) => g.name === goalName) ? goalName : (goals[0]?.name ?? "");

  const add = () => {
    const value = Number(amount);
    if (!selected || !(value > 0)) {
      notify("⚠️ Вкажи суму поповнення цілі!", "amber");
      return;
    }
    onTransactionsChange((list) => [...list, { date: today(), goalName: selected, amount: value, note: note.trim() }]);
    notify(`💳 Додано +$${value} до "${selected}"!`);
    setAmount("");
    setNote("");
  };

  return (
    <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl flex flex-col justify-between shadow-lg">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 mb-1">
          <span>💳</span> Транзакції по цілях (<code className="text-xs text-indigo-400">Transactions</code>)
        </h2>
        <p className="text-xs text-slate-400 mb-4">Поповнення коротко- та середньострокових бюджетів</p>

        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2.5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={selected} onChange={(e) => setGoalName(e.target.value)} className={field}>
              {goals.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
            <input type="number" step="10" placeholder="Сума поповнення ($)" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
          </div>
          <div className="flex gap-2">
            <input type="text" placeholder="Коментар (необов'язково)" value={note} onChange={(e) => setNote(e.target.value)} className={`${field} flex-1`} />
            <button type="button" onClick={add} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl px-4 py-2 text-xs transition shrink-0">
              + Внести
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {transactions
            .slice()
            .reverse()
            .map((t, i) => (
              <div key={i} className="flex justify-between items-center bg-slate-950/60 border border-slate-800/80 px-3 py-2 rounded-xl text-xs">
                <div>
                  <span className="font-semibold text-slate-200">{t.goalName}</span>
                  <span className="text-[10px] text-slate-500 block">
                    {t.date}
                    {t.note ? ` • ${t.note}` : ""}
                  </span>
                </div>
                <span className="font-bold text-emerald-400">+${Number(t.amount).toLocaleString("en-US")}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
