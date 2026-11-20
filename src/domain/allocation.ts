import type { Asset } from "./types";

export interface AllocationSlice {
  ticker: string;
  value: number;
  share: number;
}

/** Частки ETF у портфелі акцій за ринковою вартістю, від найбільшої. Позиції з нульовою вартістю не показуються. */
export function getEtfAllocation(assets: Asset[]): AllocationSlice[] {
  const byTicker = new Map<string, number>();
  for (const a of assets) {
    const value = (Number(a.shares) || 0) * (Number(a.marketPrice) || 0);
    if (value > 0) byTicker.set(a.ticker, (byTicker.get(a.ticker) ?? 0) + value);
  }
  const total = [...byTicker.values()].reduce((s, v) => s + v, 0);
  return [...byTicker.entries()]
    .map(([ticker, value]) => ({ ticker, value, share: value / total }))
    .sort((a, b) => b.value - a.value);
}
