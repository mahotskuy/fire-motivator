# FIRE Motivator

Personal dashboard for tracking progress to financial independence (FIRE): $1,000/month passive income, IBKR portfolio, wealth snapshots, side goals.

Vite + React + TypeScript + Tailwind. Data is stored in Firestore (`users/{uid}`) after Google sign-in when the `VITE_FIREBASE_*` variables are set (see `.env.example`; in GitHub: Settings → Secrets and variables → Actions → Variables). Without them the app falls back to browser `localStorage`. Rules: `firestore.rules`. Backlog: [docs/BACKLOG.md](docs/BACKLOG.md).

## Commands

```
npm install
npm run dev        # dev server
npm test           # unit tests for the calculations (src/domain)
npm run build      # typecheck + production build into dist/
```

## PR preview

Deploy a branch to GitHub Pages for manual checking: add the `deploy` label to a pull request (it redeploys on every new commit), or run Actions → PR preview → Run workflow and pick the branch. The preview is served at `/fire-motivator/preview/` next to production (`/fire-motivator/`, always rebuilt from `main`). Only the latest preview exists and the next deploy from `main` removes it. The preview uses the same Firebase project as production, so it reads and writes the real data.

## Live prices proxy

Free public CORS proxies are unreliable, so `workers/quotes-proxy` is a small Cloudflare Worker (free tier) that fetches Yahoo's chart quote and adds CORS headers. It only answers the origins in `ALLOWED_ORIGINS` and only for valid ticker symbols, and Cloudflare caches each quote for 60 seconds.

Deploy once:

1. `cd workers/quotes-proxy && npx wrangler login` (creates a free Cloudflare account if you have none).
2. Check `ALLOWED_ORIGINS` in `wrangler.toml`. It lists the site origin without a path (default `https://mahotskuy.github.io`, plus `http://localhost:5173` for `npm run dev`). Change it if the site runs on a custom domain.
3. `npx wrangler deploy`. It prints the Worker URL, like `https://fire-motivator-quotes.<your-subdomain>.workers.dev`.
4. In GitHub: Settings → Secrets and variables → Actions → Variables → add `VITE_QUOTES_PROXY_URL` with that URL, then redeploy `main` (re-run the CI workflow). For local development put the same line in `.env.local`.

Check it: open `<Worker URL>/?symbol=VOO`. You should see Yahoo's JSON with `regularMarketPrice`. If refresh still fails, the toast lists the reason per provider (`proxy: HTTP 403; corsproxy: ...`); a `proxy:` entry that fails points at the Worker or `ALLOWED_ORIGINS`.

Tests for the Worker run with `npm test`.

## Layout

- `src/domain` – pure types, defaults and calculations (tested)
- `src/storage` – persistence interface and adapters
- `src/services` – ETF catalog and live quotes
- `src/hooks/useFireState.ts` – app state with debounced autosave
- `src/components` – UI panels

ETF quotes are requested from Yahoo Finance. When `VITE_QUOTES_PROXY_URL` is set they go through your own Cloudflare Worker first (see [Live prices proxy](#live-prices-proxy)); the public CORS proxies below are the fallback and the only source when it is not set. They may be delayed or unavailable. At most three tickers are requested at once, a request for the same ticker is shared, the provider that answered last is tried first, and a transient failure (timeout, network error, HTTP 429/5xx) gets one more round. If all providers fail, the app leaves saved portfolio prices unchanged and reports which tickers failed and why (per provider); enter a price manually if necessary. Catalog prices are not used to update the portfolio.
The portfolio shows the current price per share and the total position value, without average purchase price or P&L columns. The saved average purchase price remains available for portfolio calculations.
