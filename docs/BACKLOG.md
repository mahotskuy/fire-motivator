# Backlog

Next features, roughly in priority order.

## 1. Authentication and cloud persistence
- Google sign-in (Firebase Auth), one sign-in per device.
- Firestore adapter implementing `StateStorage` (`src/storage/StateStorage.ts`) with one document per user, replacing `localStorageStorage` in `src/App.tsx`.
- Firestore security rules: allow read/write only for the owner's UID/email. **Do not enable Firestore with open rules while the repo/site is public.**
- Firebase project setup: create project, Firestore in production mode, register a web app, put config into `VITE_FIREBASE_*` env vars.

## 2. Deployment
- GitHub Actions deploy of `dist/` on merge to `main` (Firebase Hosting, or GitHub Pages as a zero-setup alternative).

## 3. Other
- PWA (manifest + offline cache) for the phone home screen.
- Reliable live prices: replace the free CORS proxies with a Cloud Function / own proxy.
- Move UI strings to one place (currently inline Ukrainian) if a second language is needed.
- Charts for snapshots history.
