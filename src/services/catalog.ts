export interface CatalogItem {
  ticker: string;
  exchange: string;
  yahooSymbol: string;
  name: string;
  price: number;
}

export const ETF_CATALOG: CatalogItem[] = [
  { ticker: "IVV", exchange: "ARCA", yahooSymbol: "IVV", name: "iShares Core S&P 500 ETF", price: 768.0 },
  { ticker: "IXUS", exchange: "NASDAQ.NMS", yahooSymbol: "IXUS", name: "iShares Core MSCI Total International Stock ETF", price: 93.74 },
  { ticker: "VWO", exchange: "ARCA", yahooSymbol: "VWO", name: "Vanguard FTSE Emerging Markets ETF", price: 56.6 },
  { ticker: "VWOB", exchange: "NASDAQ.NMS", yahooSymbol: "VWOB", name: "Vanguard Emerging Markets Government Bond ETF", price: 64.07 },
  { ticker: "VWRA", exchange: "LSEETF", yahooSymbol: "VWRA.L", name: "Vanguard FTSE All-World UCITS ETF USD Acc", price: 191.28 },
  { ticker: "VWRA.L", exchange: "LSEETF", yahooSymbol: "VWRA.L", name: "Vanguard FTSE All-World UCITS ETF USD Acc (London)", price: 191.28 },
  { ticker: "VOO", exchange: "ARCA", yahooSymbol: "VOO", name: "Vanguard S&P 500 ETF", price: 704.5 },
  { ticker: "QQQM", exchange: "NASDAQ.NMS", yahooSymbol: "QQQM", name: "Invesco NASDAQ 100 ETF", price: 238.4 },
  { ticker: "SCHD", exchange: "ARCA", yahooSymbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF", price: 89.2 },
  { ticker: "SCHG", exchange: "ARCA", yahooSymbol: "SCHG", name: "Schwab U.S. Large-Cap Growth ETF", price: 31.4 },
  { ticker: "VUG", exchange: "ARCA", yahooSymbol: "VUG", name: "Vanguard Growth ETF", price: 428.0 },
  { ticker: "VWCE.DE", exchange: "XETRA", yahooSymbol: "VWCE.DE", name: "Vanguard FTSE All-World UCITS ETF EUR Acc", price: 148.5 },
  { ticker: "BRK.B", exchange: "NYSE", yahooSymbol: "BRK-B", name: "Berkshire Hathaway Inc. Class B", price: 468.9 },
  { ticker: "O", exchange: "NYSE", yahooSymbol: "O", name: "Realty Income Corp (Monthly Dividend REIT)", price: 61.2 },
  { ticker: "VXUS", exchange: "NASDAQ.NMS", yahooSymbol: "VXUS", name: "Vanguard Total International Stock ETF", price: 74.8 },
  { ticker: "VTI", exchange: "ARCA", yahooSymbol: "VTI", name: "Vanguard Total Stock Market ETF", price: 342.1 },
  { ticker: "VT", exchange: "ARCA", yahooSymbol: "VT", name: "Vanguard Total World Stock ETF", price: 136.4 },
  { ticker: "VUAA.L", exchange: "LSEETF", yahooSymbol: "VUAA.L", name: "Vanguard S&P 500 UCITS ETF USD Acc", price: 124.6 },
  { ticker: "CSPX.L", exchange: "LSEETF", yahooSymbol: "CSPX.L", name: "iShares Core S&P 500 UCITS ETF Acc", price: 672.0 },
  { ticker: "IWDA.AS", exchange: "AMS", yahooSymbol: "IWDA.AS", name: "iShares Core MSCI World UCITS ETF", price: 114.8 },
  { ticker: "SGOV", exchange: "ARCA", yahooSymbol: "SGOV", name: "iShares 0-3 Month Treasury Bond ETF", price: 100.52 },
];

export const QUICK_PICKS_IBKR = ["IVV", "IXUS", "VWO", "VWOB", "VWRA"];
export const QUICK_PICKS_OTHER = ["VOO", "QQQM", "SCHD"];

export function findCatalogItem(ticker: string): CatalogItem | undefined {
  return ETF_CATALOG.find((i) => i.ticker === ticker);
}
