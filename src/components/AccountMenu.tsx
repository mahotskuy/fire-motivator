import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { SaveStatus } from "../hooks/useFireState";
import type { PriceStatus } from "../hooks/useStockPrices";

interface Props {
  email?: string;
  status: SaveStatus;
  priceStatus: PriceStatus;
  onExport: () => void;
  onImport: (file: File) => void;
  onSignOut?: () => void;
}

const timeFmt = (d: Date, withSeconds: boolean) =>
  d.toLocaleTimeString("uk-UA", withSeconds ? undefined : { hour: "2-digit", minute: "2-digit" });

function syncInfo(status: SaveStatus): { dot: string; text: string } {
  if (status.kind === "saving") return { dot: "bg-amber-400 animate-pulse", text: "Збереження…" };
  if (status.kind === "error") return { dot: "bg-rose-400", text: "Помилка збереження" };
  if (status.kind === "saved") return { dot: "bg-emerald-400", text: `Остання синхронізація • ${timeFmt(status.at, true)}` };
  return { dot: "bg-emerald-400", text: "Дані завантажено" };
}

// Аватар у куті з крапкою стану. Дотик відкриває картку: пошта, остання синхронізація, резервна копія і вихід.
// Технічні подробиці (UID, назва сховища) тут навмисно не показуємо.
export function AccountMenu({ email, status, priceStatus, onExport, onImport, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sync = syncInfo(status);
  const initial = (email?.trim()[0] ?? "💾").toUpperCase();
  const prices = !priceStatus.loading && priceStatus.updatedAt ? `Ціни на ${timeFmt(priceStatus.updatedAt, false)}` : null;
  const item =
    "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-200 hover:bg-slate-800 transition cursor-pointer text-left";

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    e.target.value = "";
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Акаунт і дані"
        className="relative w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 text-white text-sm font-bold flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
      >
        {initial}
        <span className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${sync.dot}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-40 w-72 max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="px-3 py-3 border-b border-slate-800 space-y-1">
            {email && <div className="text-sm font-semibold text-white break-all">{email}</div>}
            <div className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${sync.dot}`} />
              {sync.text}
            </div>
            {prices && <div className="text-xs text-slate-500">🌐 {prices}</div>}
          </div>
          <button type="button" role="menuitem" onClick={() => { onExport(); setOpen(false); }} className={item}>
            <span>📥</span> Експорт JSON
          </button>
          <label role="menuitem" className={item}>
            <span>📤</span> Імпорт JSON
            <input type="file" accept=".json" onChange={onFile} className="hidden" />
          </label>
          {onSignOut && (
            <button type="button" role="menuitem" onClick={onSignOut} className={`${item} text-rose-300 border-t border-slate-800`}>
              <span>🚪</span> Вийти
            </button>
          )}
        </div>
      )}
    </div>
  );
}
