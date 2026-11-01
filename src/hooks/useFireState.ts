import { useCallback, useEffect, useRef, useState } from "react";
import { createDefaultState } from "../domain/defaults";
import type { AppState } from "../domain/types";
import type { StateStorage } from "../storage/StateStorage";

export type SaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: Date } | { kind: "error" };

const SAVE_DEBOUNCE_MS = 400;

export function useFireState(storage: StateStorage) {
  const [state, setState] = useState<AppState>(createDefaultState);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const latest = useRef(state);
  const dirty = useRef(false);

  useEffect(() => {
    let cancelled = false;
    storage
      .load()
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          latest.current = saved;
          setState(saved);
        }
        setLoaded(true);
      })
      .catch(() => {
        // Без успішного читання не вмикаємо збереження, щоб не затерти хмарні дані
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const flush = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setStatus({ kind: "saving" });
    try {
      await storage.save(latest.current);
      setStatus({ kind: "saved", at: new Date() });
    } catch {
      dirty.current = true;
      setStatus({ kind: "error" });
    }
  }, [storage]);

  const update = useCallback((fn: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = fn(prev);
      latest.current = next;
      dirty.current = true;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!loaded || !dirty.current) return;
    const timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state, loaded, flush]);

  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  return { state, update, loaded, loadError, status };
}
