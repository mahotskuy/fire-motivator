import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTickerPrice } from "./quotes";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchTickerPrice", () => {
  it("fetchTickerPrice_VwraProvidersUnavailable_DoesNotReplacePortfolioPriceWithCatalogPrice", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const savedPrice = 184.98;
    const quote = await fetchTickerPrice("VWRA");
    expect(quote?.price ?? savedPrice).toBe(184.98);
    expect(quote).toBeNull();
  });

  it("fetchTickerPrice_IvvProvidersUnavailable_DoesNotReplacePortfolioPriceWithCatalogPrice", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const savedPrice = 650;
    const quote = await fetchTickerPrice("IVV");
    expect(quote?.price ?? savedPrice).toBe(650);
    expect(quote).toBeNull();
  });

  it.each([
    ["VWRA", "VWRA.L", 184.98],
    ["IVV", "IVV", 650.25],
  ])("fetchTickerPrice_%sQuoteAvailable_ReturnsYahooPrice", async (ticker, symbol, price) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: price } }] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchTickerPrice(ticker)).toEqual({ price, source: `Yahoo Finance (${symbol})` });
    expect(decodeURIComponent(fetchMock.mock.calls[0][0])).toContain(`/chart/${symbol}?`);
  });

  it("fetchTickerPrice_FirstProviderFails_ReturnsSecondProviderQuote", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: 184.98 } }] } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchTickerPrice("vwra")).toEqual({ price: 184.98, source: "Yahoo Finance (VWRA.L)" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([null, 0, -1, "191.28", Infinity])(
    "fetchTickerPrice_InvalidQuote%p_DoesNotReturnCatalogPrice",
    async (price) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: price } }] } }),
      }));

      expect(await fetchTickerPrice("VWRA")).toBeNull();
    },
  );
});
