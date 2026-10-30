import { useCallback, useRef, useState } from "react";

export type ToastTone = "emerald" | "amber" | "indigo";
export type Notify = (message: string, tone?: ToastTone) => void;

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const TONE_CLASS: Record<ToastTone, string> = {
  emerald: "bg-emerald-950 border-emerald-700 text-emerald-200",
  amber: "bg-amber-950 border-amber-700 text-amber-200",
  indigo: "bg-indigo-950 border-indigo-700 text-indigo-200",
};

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const notify: Notify = useCallback((message, tone = "emerald") => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return { toasts, notify };
}

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`border rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xl ${TONE_CLASS[t.tone]}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
