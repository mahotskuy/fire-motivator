import { describe, expect, it } from "vitest";
import { applyPrices } from "./prices";
import type { Asset } from "./types";

const assets: Asset[] = [
  { ticker: "VOO", shares: 2, avgBuyPrice: 400, marketPrice: 450, goalId: "fire" },
  { ticker: "SCHD", shares: 5, avgBuyPrice: 25, marketPrice: 27, goalId: "fire" },
];

describe("applyPrices", () => {
  it("applyPrices_NewPrice_UpdatesOnlyThatTicker", () => {
    const next = applyPrices(assets, new Map([["VOO", 470]]));
    expect(next.map((a) => a.marketPrice)).toEqual([470, 27]);
    expect(next[1]).toBe(assets[1]);
  });

  it("applyPrices_SamePricesOrUnknownTickers_ReturnsSameArray", () => {
    expect(applyPrices(assets, new Map([["VOO", 450], ["QQQ", 500]]))).toBe(assets);
  });

  it("applyPrices_ZeroPrice_IsIgnored", () => {
    expect(applyPrices(assets, new Map([["VOO", 0]]))).toBe(assets);
  });
});
