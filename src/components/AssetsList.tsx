import { useState } from "react";
import type { ReactNode } from "react";
import type { Asset, Goal } from "../domain/types";
import { findCatalogItem } from "../services/catalog";
import { AddButton, DeleteConfirm, FormActions, KebabMenu, Sheet, SwipeHint, SwipeRow, Select, formInput as input, formLabel as label } from "./rowKit";

interface Props {
  assets: Asset[];
  goals: Goal[];
  onSave: (ticker: string, shares: number, price: number, goalId: string) => void;
  onRemove: (ticker: string) => void;
  /** Renders the add-position form; call `close` when a position was added. */
  renderAddForm: (close: () => void) => ReactNode;
}

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const valueOf = (a: Asset) => (Number(a.shares) || 0) * (Number(a.marketPrice) || 0);
const goalName = (goals: Goal[], id: string) => goals.find((g) => g.id === id)?.name ?? "—";

/** Portfolio positions: read-only list on mobile (swipe or ⋮), read-only table on desktop; edit/add in a sheet. */
export function AssetsList({ assets, goals, onSave, onRemove, renderAddForm }: Props) {
  const [sheet, setSheet] = useState<string | "add" | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const total = assets.reduce((s, a) => s + valueOf(a), 0);
  const current = assets.find((a) => a.ticker === sheet);
  const close = () => setSheet(null);

  const actions = (a: Asset) => ({ edit: () => setSheet(a.ticker), askDelete: () => setConfirming(a.ticker) });
  const confirmStrip = (a: Asset) =>
    confirming === a.ticker && (
      <DeleteConfirm label={a.ticker} onYes={() => { onRemove(a.ticker); setConfirming(null); }} onNo={() => setConfirming(null)} />
    );

  return (
    <div>
      {/* Mobile: dense list */}
      <div className="sm:hidden">
        <div className="flex justify-between text-[10px] uppercase text-slate-500 pb-1.5 border-b border-slate-800">
          <span>Тікер</span>
          <span>Вартість · частка</span>
        </div>
        {assets.map((a) => (
          <div key={a.ticker} className="border-b border-slate-800/60">
            <MobileRow asset={a} goals={goals} pct={total ? (valueOf(a) / total) * 100 : 0} {...actions(a)} />
            {confirmStrip(a)}
          </div>
        ))}
        <div className="flex justify-between py-2.5 text-xs">
          <span className="text-slate-400">Разом</span>
          <span className="font-extrabold text-white">{usd(total)}</span>
        </div>
      </div>

      {/* Desktop: table */}
      <table className="hidden sm:table w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
            <th className="pb-2.5 pr-2">Інструмент</th>
            <th className="pb-2.5 px-2">Позиція (Shares)</th>
            <th className="pb-2.5 px-2">Поточна ціна акції ($)</th>
            <th className="pb-2.5 px-2">Ціль</th>
            <th className="pb-2.5 px-2 text-right">Вартість позиції ($)</th>
            <th className="pb-2.5 pl-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {assets.map((a) => (
            <TableRow key={a.ticker} asset={a} goals={goals} confirming={confirmStrip(a)} {...actions(a)} />
          ))}
        </tbody>
      </table>

      <AddButton onClick={() => setSheet("add")}>＋ Додати позицію</AddButton>

      {sheet && (
        <Sheet title={current ? `✏️ ${current.ticker}` : "➕ Нова позиція"} onClose={close}>
          {current ? <EditForm asset={current} goals={goals} onSave={onSave} onRemove={onRemove} onClose={close} /> : renderAddForm(close)}
        </Sheet>
      )}
    </div>
  );
}

interface RowActions {
  edit: () => void;
  askDelete: () => void;
}

function Exchange({ ticker }: { ticker: string }) {
  return <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-semibold">{findCatalogItem(ticker)?.exchange ?? "IBKR"}</span>;
}

function MobileRow({ asset, goals, pct, edit, askDelete }: { asset: Asset; goals: Goal[]; pct: number } & RowActions) {
  return (
    <SwipeRow onEdit={edit} onDelete={askDelete} className="py-2.5 flex items-center">
      <span className="flex-1 flex items-center justify-between min-w-0">
        <span>
          <span className="flex items-center gap-1.5"><span className="font-extrabold text-white">{asset.ticker}</span><Exchange ticker={asset.ticker} /></span>
          <span className="block text-[10px] text-slate-500">{asset.shares} шт × ${asset.marketPrice} · {goalName(goals, asset.goalId)}</span>
        </span>
        <span className="text-right">
          <span className="font-bold text-white text-sm">{usd(valueOf(asset))}</span>
          <span className="block text-[10px] text-emerald-400">{pct.toFixed(1)}%</span>
        </span>
      </span>
      <SwipeHint />
    </SwipeRow>
  );
}

function TableRow({ asset, goals, confirming, edit, askDelete }: { asset: Asset; goals: Goal[]; confirming: ReactNode } & RowActions) {
  return (
    <>
      <tr className="hover:bg-slate-800/30 transition">
        <td className="py-2.5 pr-2">
          <div className="flex items-center gap-1.5"><span className="font-extrabold text-white">{asset.ticker}</span><Exchange ticker={asset.ticker} /></div>
        </td>
        <td className="py-2.5 px-2 text-white font-semibold">{asset.shares}</td>
        <td className="py-2.5 px-2 text-emerald-400 font-bold">${asset.marketPrice}</td>
        <td className="py-2.5 px-2 text-slate-300">{goalName(goals, asset.goalId)}</td>
        <td className="py-2.5 px-2 text-right font-bold text-white">{usd(valueOf(asset))}</td>
        <td className="py-2.5 pl-2 text-right"><KebabMenu onEdit={edit} onDelete={askDelete} /></td>
      </tr>
      {confirming && (
        <tr>
          <td colSpan={6}>{confirming}</td>
        </tr>
      )}
    </>
  );
}

function EditForm({ asset, goals, onSave, onRemove, onClose }: { asset: Asset; goals: Goal[]; onClose: () => void } & Pick<Props, "onSave" | "onRemove">) {
  const [shares, setShares] = useState(String(asset.shares));
  const [price, setPrice] = useState(String(asset.marketPrice));
  const [goalId, setGoalId] = useState(asset.goalId);
  const s = Number(shares);
  const p = Number(price);
  const valid = shares !== "" && price !== "" && Number.isFinite(s) && s >= 0 && Number.isFinite(p) && p >= 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label><span className={label}>Shares</span><input type="number" step="0.01" min="0" value={shares} onChange={(e) => setShares(e.target.value)} className={`${input} text-white font-semibold`} /></label>
        <label><span className={label}>Ціна ($)</span><input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={`${input} text-emerald-400 font-bold`} /></label>
      </div>
      <label className="block">
        <span className={label}>Ціль</span>
        <Select value={goalId} onChange={setGoalId} options={goals.map((g) => ({ value: g.id, label: g.name }))} />
      </label>
      <div className="text-xs text-slate-400">Вартість: <span className="text-white font-bold">{usd(valid ? s * p : 0)}</span></div>
      <FormActions saveDisabled={!valid} onSave={() => { onSave(asset.ticker, s, p, goalId); onClose(); }} onCancel={onClose} onDelete={() => { onRemove(asset.ticker); onClose(); }} />
    </div>
  );
}
