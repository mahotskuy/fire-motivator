# FIRE Motivator

Personal dashboard for tracking progress to financial independence (FIRE): $1,000/month passive income, IBKR portfolio, wealth snapshots, side goals.

Vite + React + TypeScript + Tailwind. Data is stored in the browser (`localStorage`) behind the `StateStorage` interface; cloud sync is in [docs/BACKLOG.md](docs/BACKLOG.md).

## Commands

```
npm install
npm run dev        # dev server
npm test           # unit tests for the calculations (src/domain)
npm run build      # typecheck + production build into dist/
```

## Layout

- `src/domain` – pure types, defaults and calculations (tested)
- `src/storage` – persistence interface and adapters
- `src/services` – ETF catalog and live quotes
- `src/hooks/useFireState.ts` – app state with debounced autosave
- `src/components` – UI panels
