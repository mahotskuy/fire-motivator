// Cloudflare Worker: a small CORS-enabled passthrough for Yahoo Finance chart quotes.
//   GET /?symbol=VWRA.L  ->  Yahoo's /v8/finance/chart/<symbol> JSON, unchanged
// The app reads regularMarketPrice from it, exactly as it does through the public proxies.

interface Env {
  /** Comma-separated browser origins allowed to call this Worker, e.g. "https://user.github.io,http://localhost:5173". */
  ALLOWED_ORIGINS?: string;
}

const SYMBOL_PATTERN = /^[A-Za-z0-9.^=-]{1,20}$/;
const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

async function fetchChart(symbol: string, cors: Record<string, string>): Promise<Response> {
  let upstreamStatus = 0;
  for (const host of YAHOO_HOSTS) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        // Cloudflare edge cache: repeated refreshes do not hit Yahoo again, and errors are not cached.
        cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": 60, "404": 30, "429": 0, "500-599": 0 } },
      } as RequestInit);
      if (res.ok) {
        return new Response(res.body, {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=30" },
        });
      }
      upstreamStatus = res.status;
    } catch {
      // try the next Yahoo host
    }
  }
  if (upstreamStatus === 404) return json({ error: "symbol not found" }, 404, cors);
  if (upstreamStatus === 429) return json({ error: "rate limited by upstream" }, 429, cors);
  return json({ error: "upstream unavailable" }, 502, cors);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigins(env).includes(origin)) {
      return json({ error: "origin not allowed" }, 403);
    }
    const cors: Record<string, string> = origin
      ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
      : { Vary: "Origin" };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: { ...cors, "Access-Control-Allow-Methods": "GET", "Access-Control-Max-Age": "86400" },
      });
    }
    if (request.method !== "GET") return json({ error: "method not allowed" }, 405, cors);

    const symbol = new URL(request.url).searchParams.get("symbol") ?? "";
    if (!SYMBOL_PATTERN.test(symbol)) return json({ error: "invalid symbol" }, 400, cors);

    return fetchChart(symbol, cors);
  },
};
