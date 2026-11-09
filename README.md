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

## Layout

- `src/domain` – pure types, defaults and calculations (tested)
- `src/storage` – persistence interface and adapters
- `src/services` – ETF catalog and live quotes
- `src/hooks/useFireState.ts` – app state with debounced autosave
- `src/components` – UI panels

ETF quotes are requested from Yahoo Finance through public CORS proxies and may be delayed or unavailable. If all providers fail, the app leaves saved portfolio prices unchanged and reports which tickers failed; enter a price manually if necessary. Catalog prices are not used to update the portfolio.
The portfolio shows the current price per share and the total position value, without average purchase price or P&L columns. The saved average purchase price remains available for portfolio calculations.
