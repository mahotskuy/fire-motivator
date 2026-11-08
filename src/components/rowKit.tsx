import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/** Shared row-action UI: swipe (mobile), ⋮ menu (desktop), modal sheet, delete confirmation, add button. */

export const formInput =
  "w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none";
export const formLabel = "block text-[10px] uppercase text-slate-500 mb-0.5";

const MOBILE_QUERY = "(max-width: 639px)";

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

const ACTION_WIDTH = 64;

/** Swipe left to reveal Edit / Delete; tap toggles too. Pass only the actions that are allowed. */
export function SwipeRow({ children, onEdit, onDelete, className = "" }: { children: ReactNode; onEdit?: () => void; onDelete?: () => void; className?: string }) {
  const width = ACTION_WIDTH * ((onEdit ? 1 : 0) + (onDelete ? 1 : 0));
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState<{ px: number; x0: number } | null>(null);
  if (!width) return <div className={className}>{children}</div>;

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width }}>
        {onEdit && (
          <button type="button" onClick={() => { setX(0); onEdit(); }} className="flex-1 bg-sky-700 text-white text-xs font-bold">✏️<br />Змінити</button>
        )}
        {onDelete && (
          <button type="button" onClick={() => { setX(0); onDelete(); }} className="flex-1 bg-rose-700 text-white text-xs font-bold">🗑<br />Видалити</button>
        )}
      </div>
      <div
        className={`relative bg-slate-900 select-none ${className}`}
        style={{ transform: `translateX(${x}px)`, transition: drag ? "none" : "transform .2s", touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button, input, select")) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag({ px: e.clientX, x0: x });
        }}
        onPointerMove={(e) => drag && setX(Math.max(-width, Math.min(0, drag.x0 + e.clientX - drag.px)))}
        onPointerUp={(e) => {
          const tap = drag !== null && Math.abs(e.clientX - drag.px) < 4;
          setX(tap ? (drag!.x0 === 0 ? -width : 0) : x < -width / 2 ? -width : 0);
          setDrag(null);
        }}
        onPointerCancel={() => { setDrag(null); setX(0); }}
      >
        {children}
      </div>
    </div>
  );
}

export const SwipeHint = () => <span aria-hidden className="ml-2 text-slate-600 text-lg leading-none">‹</span>;

/** ⋮ button with a small popover. */
export function KebabMenu({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  if (!onEdit && !onDelete) return null;
  return (
    <span className="relative inline-block">
      <button type="button" aria-label="Дії" onClick={() => setOpen(true)} className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 text-lg leading-none">⋮</button>
      {open && (
        <>
          <span className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <span className="absolute right-0 top-9 z-50 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden text-left block">
            {onEdit && (
              <button type="button" className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-slate-700" onClick={() => { setOpen(false); onEdit(); }}>✏️ Редагувати</button>
            )}
            {onDelete && (
              <button type="button" className="w-full text-left px-4 py-2.5 text-sm text-rose-300 hover:bg-slate-700" onClick={() => { setOpen(false); onDelete(); }}>🗑 Видалити</button>
            )}
          </span>
        </>
      )}
    </span>
  );
}

export function DeleteConfirm({ label, onYes, onNo }: { label: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="flex items-center justify-between bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2 my-2 text-xs">
      <span className="text-rose-200">Видалити {label}?</span>
      <span className="flex gap-2">
        <button type="button" onClick={onYes} className="bg-rose-600 text-white font-bold rounded px-2.5 py-1">Так</button>
        <button type="button" onClick={onNo} className="bg-slate-800 text-slate-300 rounded px-2.5 py-1">Ні</button>
      </span>
    </div>
  );
}

export function AddButton({ onClick, children, className = "text-emerald-300 hover:border-emerald-600" }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={`mt-3 w-full border border-dashed border-slate-600 rounded-xl py-2.5 text-sm font-bold transition ${className}`}>
      {children}
    </button>
  );
}

/** Bottom sheet on mobile, centred modal on desktop. Closes on backdrop click and Escape. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/60" onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-slate-900 border-t sm:border border-slate-700 rounded-t-2xl sm:rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <span className="font-bold text-white">{title}</span>
          <button type="button" onClick={onClose} aria-label="Закрити" className="text-slate-400">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FormActions({ onSave, onCancel, onDelete, saveDisabled }: { onSave: () => void; onCancel: () => void; onDelete?: () => void; saveDisabled?: boolean }) {
  return (
    <div className="flex gap-2 pt-1">
      <button type="button" disabled={saveDisabled} onClick={onSave} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg py-2 text-xs">Зберегти</button>
      <button type="button" onClick={onCancel} className="flex-1 bg-slate-800 text-slate-300 rounded-lg py-2 text-xs">Скасувати</button>
      {onDelete && (
        <button type="button" onClick={onDelete} aria-label="Видалити" className="px-3 bg-rose-950/60 text-rose-300 border border-rose-900 rounded-lg text-xs">🗑</button>
      )}
    </div>
  );
}

/** In-flow custom select: the options expand inside the form instead of a native popup (which mis-positions inside sheets). */
export function Select({ value, options, onChange, className = "" }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <div className={className}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className={`${formInput} flex items-center justify-between text-left`}>
        <span className="truncate">{selected?.label ?? "—"}</span>
        <span className="text-slate-500 text-xs ml-2">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul role="listbox" className="mt-1 bg-slate-950 border border-slate-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 ${o.value === value ? "text-emerald-300 font-bold" : "text-slate-200"}`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
