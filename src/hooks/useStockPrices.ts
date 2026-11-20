import { useCallback, useEffect, useRef, useState } from "react";
import { applyPrices } from "../domain/prices";
import type { Asset } from "../domain/types";
import { fetchTickerPrice, getQuoteError } from "../services/quotes";

export interface PriceStatus {
  loading: boolean;
  // Коли ціни востаннє успішно отримано в цій сесії
  updatedAt: Date | null;
  failed: string[];
  failReason?: string;
}

export interface PriceRefreshResult {
  updated: number;
  failed: string[];
  failReason?: string;
}

// Застосунок на телефоні часто відкривають з фону без перезавантаження: тоді оновлюємо, якщо ціни застаріли
const STALE_AFTER_MS = 15 * 60 * 1000;

/** Оновлює ринкові ціни всіх позицій одразу після завантаження стану, при поверненні на вкладку і за запитом. */
export function useStockPrices(enabled: boolean, assets: Asset[], update: (fn: (assets: Asset[]) => Asset[]) => void) {
  const [status, setStatus] = useState<PriceStatus>({ loading: false, updatedAt: null, failed: [] });
  const tickersRef = useRef<string[]>([]);
  tickersRef.current = [...new Set(assets.map((a) => a.ticker))];
  const updateRef = useRef(update);
  updateRef.current = update;
  const running = useRef<Promise<PriceRefreshResult> | null>(null);
  const lastRun = useRef(0);

  const refresh = useCallback((): Promise<PriceRefreshResult> => {
    if (running.current) return running.current;
    const tickers = tickersRef.current;
    if (!tickers.length) return Promise.resolve({ updated: 0, failed: [] });
    setStatus((s) => ({ ...s, loading: true }));
    lastRun.current = Date.now();
    const task = (async () => {
      const results = await Promise.all(tickers.map(async (t) => ({ t, res: await fetchTickerPrice(t) })));
      const prices = new Map<string, number>();
      const failed: string[] = [];
      for (const { t, res } of results) {
        if (res && res.price > 0) prices.set(t, res.price);
        else failed.push(t);
      }
      if (prices.size) updateRef.current((list) => applyPrices(list, prices));
      const failReason = failed.length ? getQuoteError(failed[0]) : undefined;
      setStatus((s) => ({ loading: false, updatedAt: prices.size ? new Date() : s.updatedAt, failed, failReason }));
      return { updated: prices.size, failed, failReason };
    })().finally(() => {
      running.current = null;
    });
    running.current = task;
    return task;
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun.current > STALE_AFTER_MS) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, refresh]);

  return { status, refresh };
}
