import { findCatalogItem } from "./catalog";

export interface QuoteResult {
  price: number;
  source: string;
  isLive: boolean;
}

const liveQuotes = new Map<string, number>();

export function getLiveQuote(ticker: string): number | undefined {
  return liveQuotes.get(ticker);
}

// Остання відома ціна: жива котировка, інакше довідник
export function getKnownPrice(ticker: string): number | undefined {
  return liveQuotes.get(ticker) ?? findCatalogItem(ticker)?.price;
}

interface Provider {
  name: string;
  buildUrl: (yahooUrl: string) => string;
  parse: (res: Response) => Promise<number | undefined>;
}

const extractPrice = (data: any): number | undefined => data?.chart?.result?.[0]?.meta?.regularMarketPrice;

const PROVIDERS: Provider[] = [
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

export async function fetchTickerPrice(rawTicker: string, portfolioPrice?: number): Promise<QuoteResult | null> {
  const ticker = rawTicker.trim().toUpperCase();
  if (!ticker) return null;

  const yahooSymbol = findCatalogItem(ticker)?.yahooSymbol ?? ticker;
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;

  for (const provider of PROVIDERS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3200);
    try {
      const res = await fetch(provider.buildUrl(yahooUrl), { signal: controller.signal });
      if (!res.ok) continue;
      const rawPrice = await provider.parse(res);
      if (rawPrice && Number(rawPrice) > 0) {
        const rounded = Number(Number(rawPrice).toFixed(2));
        liveQuotes.set(ticker, rounded);
        return { price: rounded, source: `Live Біржа (${yahooSymbol})`, isLive: true };
      }
    } catch {
      // наступний провайдер
    } finally {
      clearTimeout(timer);
    }
  }

  const catalogPrice = findCatalogItem(ticker)?.price;
  if (catalogPrice) return { price: catalogPrice, source: "Довідник IBKR", isLive: false };
  if (portfolioPrice && portfolioPrice > 0) return { price: portfolioPrice, source: "Портфель", isLive: false };
  return null;
}
