import { parseFrankfurterRates, type FxRates } from "../domain/currency";

const FX_URL = "https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,UAH,GBP";
const TIMEOUT_MS = 8000;

// У запит потрапляють лише валютні пари, жодних даних про активи
export async function fetchFxRates(fetchImpl: typeof fetch = fetch): Promise<FxRates | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(FX_URL, { signal: controller.signal });
    if (!res.ok) return null;
    return parseFrankfurterRates(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
