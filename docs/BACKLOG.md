# Backlog

Next features, roughly in priority order.

## 1. ~~Authentication and cloud persistence~~ (implemented, needs Firebase project + env vars)
- Google sign-in, `createFirestoreStorage` (`users/{uid}`), rules in `firestore.rules`.
- Follow-ups: live cross-device updates via `onSnapshot` (currently data loads on open and saves on change; last write wins).

## 2. Deployment
- GitHub Actions deploy of `dist/` on merge to `main` (Firebase Hosting, or GitHub Pages as a zero-setup alternative).

## 3. Other
- PWA (manifest + offline cache) for the phone home screen.
- Reliable live prices: replace the free CORS proxies with a Cloud Function / own proxy.
- Move UI strings to one place (currently inline Ukrainian) if a second language is needed.
- Charts for snapshots history.
