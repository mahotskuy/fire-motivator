import { useEffect, useMemo, useState } from "react";
import type { FireRules } from "../domain/calc";
import { convertToUsd } from "../domain/currency";
import { parseAmount, planDeposit, type DepositLine, type PlanDepositResult } from "../domain/deposits";
import { usd } from "../domain/format";
import { FIRE_GOAL_ID } from "../domain/goals";
import type { Level } from "../domain/levels";
import type { AppState, Deposit } from "../domain/types";

type SheetState = Pick<AppState, "assets" | "genericAssets" | "fx" | "goals">;
type OkPlan = Extract<PlanDepositResult, { ok: true }>;

interface Props {
  state: SheetState;
  rules: FireRules;
  levels: Level[];
  year: number;
  yearInvested: number;
  yearGoal: number;
  onCommit: (plan: OkPlan) => void;
  onClose: () => void;
  onOpenAssets: () => void;
}

const num = (n: number) => +n.toFixed(4).replace(/\.?0+$/, "") || 0;
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// text-base (16px) на телефонах: iOS Safari збільшує сторінку при фокусі на полі менше 16px
const field =
  "bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-base sm:text-sm text-white text-center tabular-nums focus:outline-none";
const dayWord = (n: number) => {
  const r = Math.round(n);
  const t = r % 10;
  const h = r % 100;
  return t === 1 && h !== 11 ? "день" : t >= 2 && t <= 4 && (h < 12 || h > 14) ? "дні" : "днів";
};

export function DepositSheet({ state, rules, levels, year, yearInvested, yearGoal, onCommit, onClose, onOpenAssets }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [priceOpen, setPriceOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [onlyFilled, setOnlyFilled] = useState(false);
  const [saved, setSaved] = useState<{ deposit: Deposit; yearBefore: number } | null>(null);

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

  const lines = useMemo<DepositLine[]>(() => {
    const out: DepositLine[] = [];
    for (const a of state.assets) {
      const shares = parseAmount(values[`s:${a.ticker}`] ?? "");
      const price = parseAmount(prices[a.ticker] ?? "") || a.marketPrice;
      if (shares > 0 && price > 0) out.push({ kind: "stock", ticker: a.ticker, shares, price });
    }
    for (const g of state.genericAssets) {
      const amount = parseAmount(values[`g:${g.id}`] ?? "");
      if (amount > 0) out.push({ kind: "generic", assetId: g.id, amount });
    }
    return out;
  }, [values, prices, state.assets, state.genericAssets]);

  const plan = useMemo(
    () => planDeposit({ assets: state.assets, genericAssets: state.genericAssets, fx: state.fx }, rules, levels, lines),
    [state.assets, state.genericAssets, state.fx, rules, levels, lines],
  );
  const ok = plan.ok ? plan : null;
  const goalName = (id: string) => state.goals.find((g) => g.id === id)?.name ?? "—";

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));
  const step = (key: string, delta: number) => set(key, String(Math.max(0, num(parseAmount(values[key] ?? "") + delta)) || ""));
  const q = query.trim().toLowerCase();
  const visible = (key: string, text: string) => (!q || text.toLowerCase().includes(q)) && (!onlyFilled || parseAmount(values[key] ?? "") > 0);
  const stocks = state.assets.filter((a) => visible(`s:${a.ticker}`, a.ticker));
  const generics = state.genericAssets.filter((g) => visible(`g:${g.id}`, g.name));

  const save = () => {
    if (!ok) return;
    onCommit(ok);
    setSaved({ deposit: ok.deposit, yearBefore: yearInvested });
  };

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/65" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Новий внесок"
        className="w-full sm:max-w-lg h-[92vh] sm:h-auto sm:max-h-[88vh] flex flex-col bg-slate-900 border-t sm:border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  if (saved) {
    return shell(
      <Summary
        deposit={saved.deposit}
        levels={levels}
        year={year}
        yearInvested={saved.yearBefore + saved.deposit.fireUsd}
        previousYearInvested={saved.yearBefore}
        yearGoal={yearGoal}
        goalName={goalName}
        genericAssets={state.genericAssets}
        onClose={onClose}
      />,
    );
  }

  const count = lines.length;
  const reason = !plan.ok && plan.reason === "rates" ? `Немає курсу для ${plan.missingCurrencies.join(", ")}. Онови курси в блоці «Інші активи».` : null;

  return shell(
    <>
      <div className="px-4 pt-3 pb-2 space-y-2.5 border-b border-slate-800">
        <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white">Що купив сьогодні?</h2>
          <button type="button" onClick={onClose} aria-label="Закрити" className="text-slate-400 hover:text-white text-lg px-1">
            ✕
          </button>
        </div>
        <p className="text-[11px] text-slate-400">Впиши, скільки купив зараз. Кількість додасться до того, що вже є. Решту рядків лишай порожніми.</p>
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Пошук активу"
            aria-label="Пошук активу"
            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-base sm:text-sm text-white focus:outline-none"
          />
          <button
            type="button"
            aria-pressed={onlyFilled}
            onClick={() => setOnlyFilled((v) => !v)}
            className={`shrink-0 text-xs font-bold px-3 rounded-lg border transition ${
              onlyFilled ? "bg-sky-500/20 border-sky-500/60 text-sky-200" : "border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            Тільки куплене
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {stocks.length > 0 && <SectionLabel>ETF та акції · скільки штук купив</SectionLabel>}
        {stocks.map((a) => {
          const key = `s:${a.ticker}`;
          const shares = parseAmount(values[key] ?? "");
          const price = parseAmount(prices[a.ticker] ?? "") || a.marketPrice;
          const hot = shares > 0;
          return (
            <div key={a.ticker} className={`px-4 py-2 border-b border-slate-800/70 ${hot ? "bg-emerald-500/5" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-white text-sm">
                    {a.ticker} <span className="text-[11px] font-medium text-slate-500">${a.marketPrice}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {hot ? (
                      <>
                        {num(a.shares)} → <b className="text-emerald-400">{num(a.shares + shares)} шт</b> · +{money(shares * price)}
                      </>
                    ) : (
                      <>маєш {num(a.shares)} шт</>
                    )}
                  </div>
                </div>
                <Stepper
                  name={a.ticker}
                  value={values[key] ?? ""}
                  onChange={(v) => set(key, v)}
                  onStep={(d) => step(key, d)}
                />
              </div>
              {hot && (
                <div className="mt-1 text-[11px] text-slate-500">
                  {priceOpen === a.ticker || price <= 0 ? (
                    <label className="flex items-center gap-2">
                      ціна купівлі, $
                      <input
                        inputMode="decimal"
                        value={prices[a.ticker] ?? ""}
                        placeholder={String(a.marketPrice)}
                        onChange={(e) => setPrices((p) => ({ ...p, [a.ticker]: e.target.value }))}
                        className={`${field} w-24`}
                        aria-label={`${a.ticker}: ціна купівлі`}
                      />
                    </label>
                  ) : (
                    <button type="button" onClick={() => setPriceOpen(a.ticker)} className="underline decoration-dotted hover:text-slate-300">
                      по ${price} · змінити ціну
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {generics.length > 0 && <SectionLabel>Інші активи · скільки додав</SectionLabel>}
        {generics.map((g) => {
          const key = `g:${g.id}`;
          const amount = parseAmount(values[key] ?? "");
          const hot = amount > 0;
          const inUsd = convertToUsd(amount, g.currency, state.fx?.rates);
          return (
            <div key={g.id} className={`px-4 py-2 border-b border-slate-800/70 ${hot ? "bg-emerald-500/5" : ""}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-white text-sm truncate">{g.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {hot ? (
                      <>
                        {usd(g.amount)} → <b className="text-emerald-400">{usd(g.amount + amount)} {g.currency}</b>
                        {g.currency !== "USD" && inUsd !== null && <> · ≈ +${usd(inUsd)}</>}
                      </>
                    ) : (
                      <>
                        маєш {usd(g.amount)} {g.currency}
                        {g.goalId !== FIRE_GOAL_ID && <> · {goalName(g.goalId)}</>}
                      </>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 shrink-0">
                  <input
                    inputMode="decimal"
                    value={values[key] ?? ""}
                    placeholder="0"
                    onChange={(e) => set(key, e.target.value)}
                    aria-label={`${g.name}: додано ${g.currency}`}
                    className={`${field} w-28 text-right`}
                  />
                  <span className="text-[11px] text-slate-500 w-8">{g.currency}</span>
                </label>
              </div>
            </div>
          );
        })}

        {stocks.length === 0 && generics.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-slate-500">{onlyFilled ? "Ще нічого не вписано." : "Нічого не знайдено."}</p>
        )}

        <div className="px-4 py-3 text-[11px] text-slate-500">
          Немає потрібного ETF?{" "}
          <button type="button" onClick={onOpenAssets} className="underline text-slate-300 hover:text-white">
            Додай його у вкладці «Активи»
          </button>
          , і він з'явиться тут.
        </div>
      </div>

      <div className="border-t border-slate-800 px-4 pt-3 pb-4 space-y-2.5 bg-slate-900 rounded-b-2xl">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-400">
            Разом куплено · {count} поз.
          </span>
          <span className="text-2xl font-extrabold text-white tabular-nums">${usd(ok?.deposit.totalUsd ?? 0)}</span>
        </div>
        <div className="rounded-xl bg-slate-950/70 border border-slate-800 px-3 py-2 text-xs text-slate-400 min-h-[2.25rem]">
          {reason ? (
            <span className="text-amber-300">{reason}</span>
          ) : ok ? (
            ok.deposit.fireUsd > 0 ? (
              <>
                FIRE ближче на <b className="text-emerald-400">{Math.round(ok.deposit.daysCloser)} {dayWord(ok.deposit.daysCloser)}</b>
                {ok.deposit.levelAfter > ok.deposit.levelBefore && (
                  <>
                    {" "}· <b className="text-indigo-300">+{ok.deposit.levelAfter - ok.deposit.levelBefore} рівн.</b>
                  </>
                )}
              </>
            ) : (
              <>Ці гроші йдуть не у FIRE, а в окрему ціль.</>
            )
          ) : (
            <>Впиши, що купив, і тут з'явиться, що це дасть.</>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800">
            Скасувати
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!ok}
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-emerald-950 font-extrabold text-sm transition"
          >
            Зберегти внесок
          </button>
        </div>
      </div>
    </>,
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="sticky top-0 z-10 px-4 py-1.5 bg-slate-800/90 backdrop-blur text-[10px] uppercase tracking-wider font-bold text-slate-400 border-b border-slate-800">{children}</div>;
}

function Stepper({ name, value, onChange, onStep }: { name: string; value: string; onChange: (v: string) => void; onStep: (d: number) => void }) {
  const btn = "w-8 h-8 rounded-lg border border-slate-700 bg-slate-800 text-white text-lg leading-none hover:bg-slate-700";
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button type="button" className={btn} onClick={() => onStep(-1)} aria-label={`${name}: менше`}>
        −
      </button>
      <input inputMode="decimal" value={value} placeholder="0" onChange={(e) => onChange(e.target.value)} aria-label={`${name}: куплено штук`} className={`${field} w-16`} />
      <button type="button" className={btn} onClick={() => onStep(1)} aria-label={`${name}: більше`}>
        +
      </button>
    </div>
  );
}

function Summary({
  deposit,
  levels,
  year,
  yearInvested,
  previousYearInvested,
  yearGoal,
  goalName,
  genericAssets,
  onClose,
}: {
  deposit: Deposit;
  levels: Level[];
  year: number;
  yearInvested: number;
  previousYearInvested: number;
  yearGoal: number;
  goalName: (id: string) => string;
  genericAssets: AppState["genericAssets"];
  onClose: () => void;
}) {
  const gained = levels.slice(deposit.levelBefore, deposit.levelAfter);
  const yearPct = yearGoal > 0 ? Math.min(100, (yearInvested / yearGoal) * 100) : 0;
  const goalDone = yearGoal > 0 && previousYearInvested < yearGoal && yearInvested >= yearGoal;
  const cushion = deposit.items.filter((i) => !i.fire);
  const praise = gained.length
    ? `Новий рівень: ${gained[gained.length - 1].title}. Так тримати!`
    : deposit.fireUsd === 0
      ? "Подушка росте. Так тримати!"
      : "Кожен внесок купує тобі свободу.";
  const card = "rounded-xl bg-slate-950/70 border border-slate-800 p-3";

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-5 pb-3 space-y-4">
        <div className="text-center space-y-1">
          <div className="text-xs text-slate-400">Інвестовано сьогодні</div>
          <div className="text-5xl font-extrabold text-emerald-400 tabular-nums">+${usd(deposit.totalUsd)}</div>
          <div className="font-bold text-white text-sm">{praise}</div>
          {goalDone && <div className="text-amber-300 text-sm font-bold">🏆 Ціль {year} року виконано!</div>}
        </div>

        <ul className="rounded-xl bg-slate-950/70 border border-slate-800 divide-y divide-slate-800/70 text-xs">
          {deposit.items.map((i) => (
            <li key={i.kind === "stock" ? i.ticker : i.assetId} className="flex justify-between gap-3 px-3 py-2">
              <span className="text-slate-200 truncate">
                {i.kind === "stock" ? `${i.ticker} +${num(i.shares)} шт` : `${i.name} +${usd(i.amount)} ${i.currency}`}
              </span>
              <span className="text-slate-400 tabular-nums shrink-0">
                {i.kind === "stock" ? `по $${i.price} · ` : ""}${usd(i.usd)}
              </span>
            </li>
          ))}
        </ul>

        {deposit.fireUsd > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div className={card}>
              <b className="block text-lg text-emerald-400 tabular-nums">
                {Math.round(deposit.daysCloser)} {dayWord(deposit.daysCloser)}
              </b>
              <span className="text-[11px] text-slate-400">FIRE настане раніше</span>
            </div>
            <div className={card}>
              <b className="block text-lg text-sky-400 tabular-nums">${usd(deposit.projectedUsd)}</b>
              <span className="text-[11px] text-slate-400">стільки акції виростуть до FIRE</span>
            </div>
            <div className={card}>
              <b className="block text-lg text-amber-400 tabular-nums">
                {Math.round(deposit.freedomDays)} {dayWord(deposit.freedomDays)}
              </b>
              <span className="text-[11px] text-slate-400">свободи куплено вже зараз</span>
            </div>
            <div className={card}>
              <b className="block text-lg text-white tabular-nums">+${deposit.monthlyDividends.toFixed(2)}</b>
              <span className="text-[11px] text-slate-400">дивідендів щомісяця</span>
            </div>
          </div>
        )}

        {cushion.length > 0 && (
          <div className="text-xs text-slate-300 rounded-xl bg-slate-950/70 border border-slate-800 p-3">
            {cushion.map((i) => {
              if (i.kind === "stock") return null;
              const asset = genericAssets.find((g) => g.id === i.assetId);
              return (
                <div key={i.assetId}>
                  {asset ? goalName(asset.goalId) : i.name}: +${usd(i.usd)} не входить у FIRE
                </div>
              );
            })}
          </div>
        )}

        {gained.length > 0 && (
          <ul className="space-y-1.5">
            {gained.map((l) => (
              <li key={l.n} className="flex items-center gap-3 rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-sm">
                <span className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/50 flex items-center justify-center font-extrabold text-white">{l.n}</span>
                <span className="text-white">
                  {l.icon} <b>{l.title}</b>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Ціль {year}</span>
            <span>
              <b className="text-white tabular-nums">${usd(yearInvested)}</b> / ${usd(yearGoal)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-label={`Ціль ${year} року`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(yearPct)}>
            <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-300" style={{ width: `${Math.max(2, yearPct)}%` }} />
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 pt-2 border-t border-slate-800">
        <button type="button" onClick={onClose} className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold text-sm transition">
          Готово
        </button>
      </div>
    </>
  );
}
