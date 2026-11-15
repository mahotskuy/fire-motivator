import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTickerPrice, getQuoteError, resetQuoteState } from "./quotes";

const okQuote = (price: number) => ({
  ok: true,
  json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: price } }] } }),
});

beforeEach(() => {
  resetQuoteState();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
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

  it("fetchTickerPrice_AllProvidersRefuse_ExplainsFailurePerProvider", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    expect(await fetchTickerPrice("VOO")).toBeNull();
    expect(getQuoteError("voo")).toBe("corsproxy: HTTP 403; codetabs: HTTP 403; allorigins: HTTP 403");
  });

  it("fetchTickerPrice_NetworkError_ReportsNetworkFailure", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = fetchTickerPrice("VOO");
    await vi.advanceTimersByTimeAsync(5000);

    expect(await result).toBeNull();
    expect(getQuoteError("VOO")).toBe("corsproxy: мережева помилка; codetabs: мережева помилка; allorigins: мережева помилка");
  });

  it("fetchTickerPrice_SuccessAfterFailure_ClearsPreviousError", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValue(okQuote(704.5));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchTickerPrice("VOO")).toBeNull();
    expect(getQuoteError("VOO")).toBeDefined();
    expect(await fetchTickerPrice("VOO")).toEqual({ price: 704.5, source: "Yahoo Finance (VOO)" });
    expect(getQuoteError("VOO")).toBeUndefined();
  });

  it("fetchTickerPrice_RateLimitedThenRecovers_RetriesAndReturnsQuote", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValue(okQuote(704.5));
    vi.stubGlobal("fetch", fetchMock);

    const result = fetchTickerPrice("VOO");
    await vi.advanceTimersByTimeAsync(1000);

    expect(await result).toEqual({ price: 704.5, source: "Yahoo Finance (VOO)" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("fetchTickerPrice_PermanentFailure_DoesNotRetry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    vi.stubGlobal("fetch", fetchMock);

    await fetchTickerPrice("VOO");

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("fetchTickerPrice_SameTickerRequestedTwiceAtOnce_SendsOneRequest", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okQuote(704.5));
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([fetchTickerPrice("VOO"), fetchTickerPrice("voo")]);

    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetchTickerPrice_ManyTickersAtOnce_LimitsConcurrentRequests", async () => {
    const releases: Array<() => void> = [];
    const fetchMock = vi.fn().mockImplementation(
      () => new Promise((resolve) => releases.push(() => resolve(okQuote(100)))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = ["VOO", "VTI", "VT", "SCHD", "SCHG"].map((t) => fetchTickerPrice(t));
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(3);

    while (releases.length) {
      releases.shift()!();
      await new Promise((r) => setTimeout(r, 0));
    }
    const settled = await Promise.all(results);
    expect(settled.every((q) => q?.price === 100)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  describe("own proxy (VITE_QUOTES_PROXY_URL)", () => {
    it("fetchTickerPrice_ProxyConfigured_AsksProxyFirstWithYahooSymbol", async () => {
      vi.stubEnv("VITE_QUOTES_PROXY_URL", "https://quotes.example.workers.dev/");
      const fetchMock = vi.fn().mockResolvedValue(okQuote(184.98));
      vi.stubGlobal("fetch", fetchMock);

      expect(await fetchTickerPrice("VWRA")).toEqual({ price: 184.98, source: "Yahoo Finance (VWRA.L)" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("https://quotes.example.workers.dev/?symbol=VWRA.L");
    });

    it("fetchTickerPrice_ProxyDown_FallsBackToPublicProviders", async () => {
      vi.stubEnv("VITE_QUOTES_PROXY_URL", "https://quotes.example.workers.dev");
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 403 })
        .mockResolvedValue(okQuote(704.5));
      vi.stubGlobal("fetch", fetchMock);

      expect(await fetchTickerPrice("VOO")).toEqual({ price: 704.5, source: "Yahoo Finance (VOO)" });
      expect(fetchMock.mock.calls[0][0]).toContain("quotes.example.workers.dev");
      expect(fetchMock.mock.calls[1][0]).toContain("corsproxy.io");
    });

    it("fetchTickerPrice_ProxyDownThenRecovers_IsTriedFirstAgain", async () => {
      vi.stubEnv("VITE_QUOTES_PROXY_URL", "https://quotes.example.workers.dev");
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 403 })
        .mockResolvedValue(okQuote(100));
      vi.stubGlobal("fetch", fetchMock);

      await fetchTickerPrice("VOO");
      await fetchTickerPrice("VTI");

      expect(fetchMock.mock.calls[2][0]).toContain("quotes.example.workers.dev");
    });

    it("fetchTickerPrice_ProxyFails_ReportsItByName", async () => {
      vi.stubEnv("VITE_QUOTES_PROXY_URL", "https://quotes.example.workers.dev");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

      await fetchTickerPrice("VOO");

      expect(getQuoteError("VOO")).toBe(
        "proxy: HTTP 403; corsproxy: HTTP 403; codetabs: HTTP 403; allorigins: HTTP 403",
      );
    });
  });

  it("fetchTickerPrice_SecondProviderAnsweredLast_IsTriedFirstForNextTicker", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValue(okQuote(100));
    vi.stubGlobal("fetch", fetchMock);

    await fetchTickerPrice("VOO");
    await fetchTickerPrice("VTI");

    expect(fetchMock.mock.calls[0][0]).toContain("corsproxy.io");
    expect(fetchMock.mock.calls[1][0]).toContain("codetabs.com");
    expect(fetchMock.mock.calls[2][0]).toContain("codetabs.com");
  });
});
