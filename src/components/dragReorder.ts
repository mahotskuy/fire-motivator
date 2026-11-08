import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";

export interface Slot {
  top: number;
  height: number;
}

// Слот, найближчий за центром до перетягуваного елемента, зміщеного на dy
export function getDropIndex(slots: Slot[], from: number, dy: number): number {
  const center = slots[from].top + slots[from].height / 2 + dy;
  let best = from;
  let bestDistance = Infinity;
  slots.forEach((slot, index) => {
    const distance = Math.abs(slot.top + slot.height / 2 - center);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

// Зсув (px) решти елементів, щоб звільнити місце для перетягуваного
export function getShift(slots: Slot[], from: number, to: number, index: number): number {
  if (index === from) return 0;
  const gap = slots.length > 1 ? slots[1].top - slots[0].top - slots[0].height : 0;
  const size = slots[from].height + gap;
  if (from < to && index > from && index <= to) return -size;
  if (from > to && index >= to && index < from) return size;
  return 0;
}

// Перетягуваний елемент не виходить за межі списку
export function clampOffset(slots: Slot[], from: number, dy: number): number {
  const min = slots[0].top - slots[from].top;
  const max = slots[slots.length - 1].top - slots[from].top;
  return Math.min(max, Math.max(min, dy));
}

interface DragState {
  from: number;
  to: number;
  dy: number;
}

interface Session {
  slots: Slot[];
  startY: number;
  from: number;
  to: number;
}

// Порядок елементів у DOM під час перетягування не змінюється: рядки лише зсуваються через transform,
// тож pointer capture не губиться. Новий порядок застосовується один раз при відпусканні (onDrop).
export function useDragReorder(count: number, onDrop: (from: number, to: number) => void) {
  const rowRefs = useRef<(HTMLElement | null)[]>([]);
  const session = useRef<Session | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const finish = (commit: boolean) => {
    const current = session.current;
    session.current = null;
    setDrag(null);
    if (commit && current && current.to !== current.from) onDrop(current.from, current.to);
  };

  const handleProps = (from: number) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const slots: Slot[] = [];
      for (let i = 0; i < count; i++) {
        const el = rowRefs.current[i];
        if (!el) return;
        const rect = el.getBoundingClientRect();
        slots.push({ top: rect.top + window.scrollY, height: rect.height });
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      session.current = { slots, startY: e.pageY, from, to: from };
      setDrag({ from, to: from, dy: 0 });
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const current = session.current;
      if (!current) return;
      const dy = clampOffset(current.slots, current.from, e.pageY - current.startY);
      current.to = getDropIndex(current.slots, current.from, dy);
      setDrag({ from: current.from, to: current.to, dy });
    },
    onPointerUp: () => finish(true),
    onPointerCancel: () => finish(false),
  });

  const rowStyle = (index: number): CSSProperties | undefined => {
    if (!drag || !session.current) return undefined;
    if (index === drag.from) {
      return { transform: `translateY(${drag.dy}px) scale(1.02)`, transition: "none", zIndex: 10, position: "relative" };
    }
    const shift = getShift(session.current.slots, drag.from, drag.to, index);
    return { transform: shift ? `translateY(${shift}px)` : undefined, transition: "transform 150ms ease" };
  };

  return {
    rowRef: (index: number) => (el: HTMLElement | null) => {
      rowRefs.current[index] = el;
    },
    handleProps,
    rowStyle,
    draggingIndex: drag?.from ?? null,
  };
}
