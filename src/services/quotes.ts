import { findCatalogItem } from "./catalog";

export interface QuoteResult {
  price: number;
  source: string;
}

const liveQuotes = new Map<string, number>();
const lastErrors = new Map<string, string>();
const inFlight = new Map<string, Promise<QuoteResult | null>>();
let preferredProvider: string | undefined;

export function getLiveQuote(ticker: string): number | undefined {
  return liveQuotes.get(ticker);
}

export function getKnownPrice(ticker: string): number | undefined {
  return liveQuotes.get(ticker);
}

/** Why the last request for this ticker failed, e.g. "corsproxy: HTTP 403; codetabs: таймаут". */
export function getQuoteError(ticker: string): string | undefined {
  return lastErrors.get(ticker.trim().toUpperCase());
}

/** Clears module state. Used by tests. */
export function resetQuoteState(): void {
  liveQuotes.clear();
  lastErrors.clear();
  inFlight.clear();
  preferredProvider = undefined;
}

interface Provider {
  name: string;
  /** Always tried first, regardless of which provider answered last. */
  pinned?: boolean;
  buildUrl: (yahooUrl: string, symbol: string) => string;
  parse: (res: Response) => Promise<unknown>;
}

interface YahooChart {
  chart?: { result?: Array<{ meta?: { regularMarketPrice?: unknown } }> };
}

const extractPrice = (data: YahooChart | null): unknown => data?.chart?.result?.[0]?.meta?.regularMarketPrice;

const PUBLIC_PROVIDERS: Provider[] = [
  {
    name: "corsproxy",
    buildUrl: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    parse: async (res) => extractPrice(await res.json()),
  },
  {
    name: "codetabs",
    buildUrl: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    parse: async (res) => extractPrice(await res.json()),
  },
  {
    name: "allorigins",
    buildUrl: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    parse: async (res) => extractPrice(JSON.parse((await res.json()).contents)),
  },
];

// Own Cloudflare Worker (workers/quotes-proxy). It returns Yahoo's chart JSON unchanged.
function buildProviders(): Provider[] {
  const base = String(import.meta.env.VITE_QUOTES_PROXY_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) return PUBLIC_PROVIDERS;
  const own: Provider = {
    name: "proxy",
    pinned: true,
    buildUrl: (_yahooUrl, symbol) => `${base}/?symbol=${encodeURIComponent(symbol)}`,
    parse: async (res) => extractPrice(await res.json()),
  };
  return [own, ...PUBLIC_PROVIDERS];
}

const TIMEOUT_MS = 6000;
const RETRY_DELAY_MS = 800;
const MAX_ROUNDS = 2;
const MAX_CONCURRENT = 3;

type Attempt = { price: number } | { error: string; transient: boolean };

async function tryProvider(provider: Provider, yahooUrl: string, symbol: string): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(provider.buildUrl(yahooUrl, symbol), { signal: controller.signal });
    if (!res.ok) {
      const status = res.status;
      return {
        error: status ? `HTTP ${status}` : "HTTP помилка",
        transient: status === 429 || status >= 500,
      };
    }
    const price = await provider.parse(res);
    if (typeof price === "number" && Number.isFinite(price) && price > 0) {
      return { price: Number(price.toFixed(2)) };
    }
    return { error: "у відповіді немає ціни", transient: false };
  } catch (e) {
    if (controller.signal.aborted) return { error: "таймаут", transient: true };
    if (e instanceof SyntaxError) return { error: "некоректна відповідь", transient: false };
    return { error: "мережева помилка", transient: true };
  } finally {
    clearTimeout(timer);
  }
}

// After the pinned provider, the one that answered last goes first, so a dead one does not add its timeout to every ticker.
function orderedProviders(): Provider[] {
  const all = buildProviders();
  const pinned = all.filter((p) => p.pinned);
  const rest = all.filter((p) => !p.pinned);
  const i = rest.findIndex((p) => p.name === preferredProvider);
  return [...pinned, ...(i > 0 ? [rest[i], ...rest.slice(0, i), ...rest.slice(i + 1)] : rest)];
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function requestQuote(ticker: string): Promise<QuoteResult | null> {
  const yahooSymbol = findCatalogItem(ticker)?.yahooSymbol ?? ticker;
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
  const providers = orderedProviders();

  let errors: string[] = [];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    errors = [];
    let transient = false;
    for (const provider of providers) {
      const attempt = await tryProvider(provider, yahooUrl, yahooSymbol);
      if ("price" in attempt) {
        preferredProvider = provider.name;
        liveQuotes.set(ticker, attempt.price);
        lastErrors.delete(ticker);
        return { price: attempt.price, source: `Yahoo Finance (${yahooSymbol})` };
      }
      errors.push(`${provider.name}: ${attempt.error}`);
      transient ||= attempt.transient;
    }
    // A second round only helps when something may recover on its own (timeout, network, 429, 5xx).
    if (!transient || round === MAX_ROUNDS - 1) break;
    await sleep(RETRY_DELAY_MS);
  }

  lastErrors.set(ticker, errors.join("; "));
  return null;
}

// At most MAX_CONCURRENT tickers are requested at once, so a burst cannot trip the proxies' rate limits.
let active = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active < MAX_CONCURRENT) active++;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

export function fetchTickerPrice(rawTicker: string): Promise<QuoteResult | null> {
  const ticker = rawTicker.trim().toUpperCase();
  if (!ticker) return Promise.resolve(null);

  const pending = inFlight.get(ticker);
  if (pending) return pending;

  const request = withSlot(() => requestQuote(ticker)).finally(() => inFlight.delete(ticker));
  inFlight.set(ticker, request);
  return request;
}
