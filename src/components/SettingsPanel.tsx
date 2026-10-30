import { useState } from "react";
import { sanitizeSettings } from "../domain/calc";
import type { Settings } from "../domain/types";

interface Props {
  settings: Settings;
  retirementSummary: string;
  onChange: (settings: Settings) => void;
}

type NumericKey = Exclude<keyof Settings, "planStartDate">;

const FIELDS: { key: NumericKey; label: string; step: number; min: number; max?: number; color: string }[] = [
  { key: "targetMonthlyPassive", label: "Бажаний дохід ($/міс)", step: 50, min: 100, color: "text-white" },
  { key: "mandatoryMonthlySave", label: "Внесок із ЗП ($/міс)", step: 50, min: 50, color: "text-emerald-400" },
  { key: "expectedGrowthRate", label: "Ріст акцій (% річних)", step: 0.5, min: 0, max: 30, color: "text-sky-400" },
  { key: "expectedDividendYield", label: "Дивіденди / SWR (%)", step: 0.2, min: 1, max: 15, color: "text-amber-400" },
  { key: "currentAge", label: "Твій поточний вік", step: 1, min: 16, max: 90, color: "text-white" },
];

const inputClass =
  "w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-sm font-bold focus:outline-none";

export function SettingsPanel({ settings, retirementSummary, onChange }: Props) {
  // Чернетки дозволяють стирати поле під час набору, не застосовуючи мінімуми
  const [drafts, setDrafts] = useState<Partial<Record<NumericKey, string>>>({});

  const onInput = (key: NumericKey, raw: string) => {
    setDrafts((d) => ({ ...d, [key]: raw }));
    const num = Number(raw);
    if (raw !== "" && Number.isFinite(num)) onChange({ ...settings, [key]: num });
  };

  const onBlur = (key: NumericKey) => {
    setDrafts((d) => {
      const { [key]: _removed, ...rest } = d;
      return rest;
    });
    onChange(sanitizeSettings(settings));
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <span>⚙️</span> Параметри розрахунку виходу на пенсію (FIRE Calculator)
          </h2>
          <p className="text-xs text-slate-400">Змінюй будь-яке поле — розрахунок оновлюється миттєво, дані зберігаються автоматично</p>
        </div>
        <span className="text-xs font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-800/70 px-3 py-1 rounded-full">
          {retirementSummary}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
            <label className="block text-[11px] text-slate-400 mb-1">{f.label}</label>
            <input
              type="number"
              step={f.step}
              min={f.min}
              max={f.max}
              value={drafts[f.key] ?? String(settings[f.key])}
              onChange={(e) => onInput(f.key, e.target.value)}
              onBlur={() => onBlur(f.key)}
              className={`${inputClass} ${f.color}`}
            />
          </div>
        ))}

        <div className="bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl">
          <label className="block text-[11px] text-slate-400 mb-1">Дата старту плану</label>
          <input
            type="date"
            value={settings.planStartDate}
            onChange={(e) => onChange({ ...settings, planStartDate: e.target.value })}
            className={`${inputClass} text-xs text-slate-200`}
          />
        </div>
      </div>
    </div>
  );
}
