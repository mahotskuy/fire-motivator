import { useEffect, useRef, useState } from "react";
import { buyOrUpdateAsset } from "../domain/calc";
import { FIRE_GOAL_ID } from "../domain/goals";
import type { Asset, Goal } from "../domain/types";
import { ETF_CATALOG, QUICK_PICKS_IBKR, QUICK_PICKS_OTHER } from "../services/catalog";
import { fetchTickerPrice, getKnownPrice, getLiveQuote } from "../services/quotes";
import type { Notify } from "./Toasts";
import { AssetsList } from "./AssetsList";
import { Select } from "./rowKit";

interface Props {
  assets: Asset[];
  goals: Goal[];
  monthlySave: number;
  onChange: (fn: (assets: Asset[]) => Asset[]) => void;
  notify: Notify;
}

// text-base (16px) on phones: iOS Safari zooms the page on focus for any input under 16px.
const field =
  "w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none";

export function AssetsPanel({ assets, goals, monthlySave, onChange, notify }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  const refreshAll = async () => {
    if (!assets.length) return;
    setRefreshing(true);
    notify("🌐 Оновлюю ринкові котирування всіх ETF...", "indigo");
    const prices = new Map<string, number>();
    const failed: string[] = [];
    for (const a of assets) {
      const res = await fetchTickerPrice(a.ticker);
      if (res && res.price > 0) prices.set(a.ticker, res.price);
      else failed.push(a.ticker);
    }
    if (prices.size) {
      onChange((list) => list.map((a) => (prices.has(a.ticker) ? { ...a, marketPrice: prices.get(a.ticker)! } : a)));
    }
    setRefreshing(false);
    if (failed.length) {
      notify(`⚠️ Не вдалося оновити: ${failed.join(", ")}. Збережені ціни не змінено.`, "amber");
    } else {
      notify("✅ Ціни ETF оновлено та збережено!");
    }
  };

  const saveAsset = (ticker: string, shares: number, marketPrice: number, goalId: string) => {
    const current = assets.find((x) => x.ticker === ticker);
    if (!current || !goals.some((g) => g.id === goalId)) return;
    if (current.shares === shares && current.marketPrice === marketPrice && current.goalId === goalId) return;
    onChange((list) => list.map((x) => (x.ticker === ticker ? { ...x, shares, marketPrice, goalId } : x)));
    notify(`☁️ Збережено ${ticker}`);
  };

  const remove = (ticker: string) => {
    onChange((list) => list.filter((a) => a.ticker !== ticker));
    notify(`🗑️ ${ticker} видалено з портфеля!`, "amber");
  };

  return (
    <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl flex flex-col justify-between shadow-lg">
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>📈</span> Портфель Interactive Brokers (<code className="text-xs text-emerald-400">Assets</code>)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              <span className="sm:hidden">Свайпни рядок вліво (або торкнись його), щоб змінити чи видалити позицію</span>
              <span className="hidden sm:inline">Натисни ⋮, щоб змінити чи видалити позицію</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              className="text-xs bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/80 px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 disabled:opacity-60"
            >
              <span className={refreshing ? "animate-spin" : ""}>🌐</span> Оновити ціни
            </button>
          </div>
        </div>

        <AssetsList
          assets={assets}
          goals={goals}
          onSave={saveAsset}
          onRemove={remove}
          renderAddForm={(close) => (
            <AddAssetForm assets={assets} goals={goals} monthlySave={monthlySave} onChange={onChange} notify={notify} onDone={close} />
          )}
        />
      </div>
    </div>
  );
}

function AddAssetForm({ assets, goals, monthlySave, onChange, notify, onDone }: Props & { onDone?: () => void }) {
  const [ticker, setTicker] = useState("");
  const [goalId, setGoalId] = useState(FIRE_GOAL_ID);
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState("Готово до вводу");
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  const tickerRef = useRef("");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sharesRef = useRef<HTMLInputElement>(null);
  const selectSharesAfterRender = useRef(false);

  // After a ticker is picked, the quantity field gets selected once React has applied its "1" default.
  useEffect(() => {
    if (!selectSharesAfterRender.current) return;
    selectSharesAfterRender.current = false;
    sharesRef.current?.select();
  });

  const preview = (Number(shares) || 0) * (Number(price) || 0);
  const query = ticker.trim().toUpperCase();

  const changeTicker = (value: string) => {
    if (tickerRef.current.trim().toUpperCase() !== value.trim().toUpperCase()) setPrice("");
    tickerRef.current = value;
    setTicker(value);
  };

  const applySelection = async (raw: string, force: boolean) => {
    const clean = raw.trim().toUpperCase();
    if (!clean) {
      setStatus("Готово до вводу");
      return;
    }
    if (!shares || Number(shares) <= 0) setShares("1");

    if (!force) {
      const known = getKnownPrice(clean) ?? assets.find((a) => a.ticker === clean)?.marketPrice;
      if (known) setPrice(String(known));
    }
    setStatus(`⏳ Запитую актуальну ціну ${clean} з біржі...`);

    if (force) {
      const res = await fetchTickerPrice(clean);
      if (tickerRef.current.trim().toUpperCase() !== clean) return;
      if (res && res.price > 0) {
        setPrice(String(res.price));
        setStatus(`🟢 ${clean}: $${res.price} (${res.source})`);
        bump((n) => n + 1);
      } else {
        setStatus(`⚠️ ${clean}: ціну не отримано. Перевір або введи її вручну.`);
      }
    }
  };

  const select = (value: string) => {
    const clean = value.trim().toUpperCase();
    changeTicker(clean);
    const known = getKnownPrice(clean) ?? assets.find((a) => a.ticker === clean)?.marketPrice;
    if (known) setPrice(String(known));
    setOpen(false);
    // Focus synchronously inside the tap handler so mobile browsers open the keyboard.
    sharesRef.current?.focus();
    selectSharesAfterRender.current = true;
    void applySelection(clean, true);
  };

  const onTyping = (raw: string) => {
    changeTicker(raw);
    setOpen(true);
    void applySelection(raw, false);

    clearTimeout(debounce.current);
    const clean = raw.trim().toUpperCase();
    if (clean.length < 2) return;
    debounce.current = setTimeout(async () => {
      const res = await fetchTickerPrice(clean);
      if (!res || res.price <= 0) {
        if (tickerRef.current.trim().toUpperCase() === clean) {
          setStatus(`⚠️ ${clean}: ціну не отримано. Перевір або введи її вручну.`);
        }
        return;
      }
      bump((n) => n + 1);
      if (tickerRef.current.trim().toUpperCase() === clean) {
        setPrice(String(res.price));
        setStatus(`🟢 ${clean}: $${res.price} (${res.source})`);
      }
    }, 350);
  };

  const openDropdown = () => {
    setOpen(true);
    const targets = filterCatalog(query).slice(0, 6).filter((i) => getLiveQuote(i.ticker) === undefined);
    void Promise.allSettled(targets.map((i) => fetchTickerPrice(i.ticker))).then(() => bump((n) => n + 1));
  };

  const fillMonthlySave = () => {
    let p = Number(price);
    if (!p || p <= 0) {
      const known = query ? getKnownPrice(query) : undefined;
      if (known) {
        p = known;
        setPrice(String(known));
      }
    }
    if (!p || p <= 0) {
      notify("Спочатку обери ETF або вкажи його ціну!", "amber");
      return;
    }
    setShares((monthlySave / p).toFixed(2));
  };

  const submit = () => {
    if (!query) {
      notify("⚠️ Введи тікер ETF або клікни на кнопку (напр. IXUS)!", "amber");
      return;
    }
    const qty = Number(shares) > 0 ? Number(shares) : 1;
    const unit = Number(price);
    if (!Number.isFinite(unit) || unit <= 0) {
      notify("⚠️ Вкажи актуальну ціну ETF перед додаванням!", "amber");
      return;
    }

    const selectedGoal = goals.some((g) => g.id === goalId) ? goalId : FIRE_GOAL_ID;
    onChange((list) => buyOrUpdateAsset(list, query, qty, unit, selectedGoal));
    changeTicker("");
    setShares("");
    setPrice("");
    setOpen(false);
    setStatus(`✅ Додано ${query}!`);
    onDone?.();
    notify(`🚀 Додано ${qty} шт. ${query} по $${unit}!`);
  };

  return (
    <div className="bg-slate-950/70 p-4 rounded-xl space-y-3">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <span className="text-xs font-bold text-slate-200">➕ Додати ETF / акцію в портфель (обери зі списку або введи тікер):</span>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-emerald-400 font-medium">{status}</span>
          <span className="text-xs text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-lg">
            Сума: ${preview.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-slate-400 mr-1">Твої ETF (IBKR):</span>
        {QUICK_PICKS_IBKR.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => select(t)}
            className="text-[11px] bg-slate-800 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-700/60 px-2.5 py-1 rounded-lg font-bold transition"
          >
            {t}
          </button>
        ))}
        {QUICK_PICKS_OTHER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => select(t)}
            className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 py-1 rounded-lg font-semibold transition"
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center relative">
        <div className="sm:col-span-4 relative">
          <input
            type="text"
            autoComplete="off"
            placeholder="🔍 Пошук ETF (IXUS, VOO...)"
            value={ticker}
            onFocus={openDropdown}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => onTyping(e.target.value)}
            className={`${field} text-white font-bold uppercase`}
          />
          {open && <EtfDropdown query={query} onSelect={select} />}
        </div>

        <div className="sm:col-span-2">
          <input ref={sharesRef} type="number" step="0.01" min="0.0001" placeholder="К-сть (1)" value={shares} onChange={(e) => setShares(e.target.value)} className={`${field} text-white font-semibold`} />
        </div>

        <div className="sm:col-span-3 relative flex items-center">
          <input type="number" step="0.01" min="0.01" placeholder="Ціна ($)" value={price} onChange={(e) => setPrice(e.target.value)} className={`${field} pr-8 text-emerald-300 font-bold`} />
          <button type="button" onClick={() => query && void applySelection(query, true)} title="Підтягнути свіжу ціну з ринку" className="absolute right-2 text-slate-400 hover:text-emerald-400 text-xs">
            🔄
          </button>
        </div>

        <div className="sm:col-span-1">
          <button
            type="button"
            onClick={fillMonthlySave}
            className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-xl px-2 py-2 text-[11px] font-bold transition"
            title="Розрахувати кількість акцій на суму місячного внеску"
          >
            ${monthlySave}
          </button>
        </div>

        <div className="sm:col-span-12 flex items-center gap-2 text-[11px] text-slate-400">
          <span>🎯 Ціль нової позиції (для вже наявного тікера ціль зберігається):</span>
          <Select className="w-44" value={goals.some((g) => g.id === goalId) ? goalId : FIRE_GOAL_ID} onChange={setGoalId} options={goals.map((g) => ({ value: g.id, label: g.name }))} />
        </div>

        <div className="sm:col-span-2">
          <button type="button" onClick={submit} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl px-3 py-2 text-xs transition shadow-md shadow-emerald-950">
            + Додати
          </button>
        </div>
      </div>
    </div>
  );
}

function filterCatalog(q: string) {
  return ETF_CATALOG.filter((i) => !q || i.ticker.includes(q) || i.name.toUpperCase().includes(q) || i.exchange.includes(q));
}

function EtfDropdown({ query, onSelect }: { query: string; onSelect: (ticker: string) => void }) {
  const items = filterCatalog(query);
  const customPrice = query ? getKnownPrice(query) : undefined;

  return (
    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-30 divide-y divide-slate-800/70">
      {items.map((item) => (
        <button
          key={item.ticker}
          type="button"
          onMouseDown={() => onSelect(item.ticker)}
          className="w-full text-left px-3 py-2 hover:bg-slate-800 flex justify-between items-center gap-2 transition"
        >
          <div>
            <span className="font-extrabold text-white text-xs">{item.ticker}</span>
            <span className="text-[10px] bg-slate-800 text-emerald-300 px-1.5 py-0.5 rounded ml-1">{item.exchange}</span>
            {getLiveQuote(item.ticker) !== undefined && (
              <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1 py-0.5 rounded ml-1">Yahoo</span>
            )}
            <span className="block text-[11px] text-slate-400 truncate max-w-[220px]">{item.name}</span>
          </div>
          {getKnownPrice(item.ticker) !== undefined && (
            <span className="text-xs font-bold text-emerald-400 shrink-0">${getKnownPrice(item.ticker)!.toFixed(2)}</span>
          )}
        </button>
      ))}
      {query && !items.some((i) => i.ticker === query) && (
        <button
          type="button"
          onMouseDown={() => onSelect(query)}
          className="w-full text-left px-3 py-2 hover:bg-slate-800 flex justify-between items-center text-xs text-amber-300 font-bold"
        >
          <span>➕ Обрати тікер "{query}" (живий запит з біржі)</span>
          <span>{customPrice ? `$${customPrice.toFixed(2)} 🟢` : "⏳ Пошук ціни..."}</span>
        </button>
      )}
    </div>
  );
}

