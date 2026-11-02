import { useCallback, useEffect, useRef, useState } from "react";
import type { FxCache } from "../domain/currency";
import { fetchFxRates } from "../services/fx";

export interface FxStatus {
  loading: boolean;
  // true лише коли курси щойно успішно отримано з мережі в цій сесії
  fresh: boolean;
  failed: boolean;
}

export function useFxRates(enabled: boolean, onRates: (cache: FxCache) => void) {
  const [status, setStatus] = useState<FxStatus>({ loading: false, fresh: false, failed: false });
  const handler = useRef(onRates);
  handler.current = onRates;

  const refresh = useCallback(async () => {
    setStatus((s) => ({ ...s, loading: true }));
    const rates = await fetchFxRates();
    if (rates) {
      handler.current({ rates, fetchedAt: new Date().toISOString() });
      setStatus({ loading: false, fresh: true, failed: false });
    } else {
      setStatus({ loading: false, fresh: false, failed: true });
    }
    return rates !== null;
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { status, refresh };
}
