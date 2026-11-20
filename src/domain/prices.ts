import type { Asset } from "./types";

// Повертає той самий масив, якщо жодна ціна не змінилася: тоді стан не позначається зміненим і нічого не зберігається
export function applyPrices(assets: Asset[], prices: ReadonlyMap<string, number>): Asset[] {
  let changed = false;
  const next = assets.map((a) => {
    const price = prices.get(a.ticker);
    if (price === undefined || !(price > 0) || price === a.marketPrice) return a;
    changed = true;
    return { ...a, marketPrice: price };
  });
  return changed ? next : assets;
}
