import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

const SITE = "https://mahotskuy.github.io";
const env = { ALLOWED_ORIGINS: `${SITE},http://localhost:5173` };
const chartJson = { chart: { result: [{ meta: { regularMarketPrice: 704.5 } }] } };

const call = (path: string, init?: RequestInit, e: { ALLOWED_ORIGINS?: string } = env) =>
  worker.fetch(new Request(`https://quotes.example.workers.dev${path}`, init), e);

const yahooOk = () => new Response(JSON.stringify(chartJson), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("quotes proxy worker", () => {
  it("fetch_AllowedOrigin_ReturnsYahooJsonWithCorsHeaders", async () => {
    const fetchMock = vi.fn().mockResolvedValue(yahooOk());
    vi.stubGlobal("fetch", fetchMock);

    const res = await call("/?symbol=VWRA.L", { headers: { Origin: SITE } });

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(SITE);
    expect(res.headers.get("Vary")).toBe("Origin");
    expect(await res.json()).toEqual(chartJson);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://query1.finance.yahoo.com/v8/finance/chart/VWRA.L?interval=1d&range=1d",
    );
  });

  it("fetch_LocalDevOrigin_IsAllowed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(yahooOk()));

    const res = await call("/?symbol=VOO", { headers: { Origin: "http://localhost:5173" } });

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
  });

  it("fetch_ForeignOrigin_IsRejectedWithoutCallingYahoo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await call("/?symbol=VOO", { headers: { Origin: "https://evil.example" } });

    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetch_NoAllowedOriginsConfigured_RejectsBrowserRequests", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const res = await call("/?symbol=VOO", { headers: { Origin: SITE } }, {});

    expect(res.status).toBe(403);
  });

  it("fetch_NoOriginHeader_WorksForCurlAndOmitsAllowOrigin", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(yahooOk()));

    const res = await call("/?symbol=VOO");

    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it.each(["", "a b", "../etc", "VOO/../../x", "WAYTOOLONGSYMBOLNAME12345", "VOO?x=1"])(
    "fetch_InvalidSymbol%p_Returns400WithoutCallingYahoo",
    async (symbol) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const res = await call(`/?symbol=${encodeURIComponent(symbol)}`, { headers: { Origin: SITE } });

      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("fetch_MissingSymbol_Returns400", async () => {
    vi.stubGlobal("fetch", vi.fn());

    expect((await call("/", { headers: { Origin: SITE } })).status).toBe(400);
  });

  it("fetch_FirstYahooHostRateLimited_FallsBackToSecondHost", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(yahooOk());
    vi.stubGlobal("fetch", fetchMock);

    const res = await call("/?symbol=VOO", { headers: { Origin: SITE } });

    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[1][0]).toContain("query2.finance.yahoo.com");
  });

  it("fetch_FirstYahooHostThrows_FallsBackToSecondHost", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("boom")).mockResolvedValueOnce(yahooOk());
    vi.stubGlobal("fetch", fetchMock);

    expect((await call("/?symbol=VOO", { headers: { Origin: SITE } })).status).toBe(200);
  });

  it.each([
    [404, 404],
    [429, 429],
    [500, 502],
    [503, 502],
  ])("fetch_YahooAnswers%dOnBothHosts_Returns%d", async (upstream, expected) => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("", { status: upstream })));

    const res = await call("/?symbol=VOO", { headers: { Origin: SITE } });

    expect(res.status).toBe(expected);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(SITE);
  });

  it("fetch_YahooUnreachableOnBothHosts_Returns502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("down")));

    expect((await call("/?symbol=VOO", { headers: { Origin: SITE } })).status).toBe(502);
  });

  it("fetch_Preflight_Returns204WithAllowedMethods", async () => {
    const res = await call("/", { method: "OPTIONS", headers: { Origin: SITE } });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(SITE);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET");
  });

  it("fetch_PostRequest_Returns405", async () => {
    vi.stubGlobal("fetch", vi.fn());

    expect((await call("/?symbol=VOO", { method: "POST", headers: { Origin: SITE } })).status).toBe(405);
  });
});
