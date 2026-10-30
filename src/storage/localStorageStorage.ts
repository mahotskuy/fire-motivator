import { normalizeState } from "../domain/defaults";
import type { AppState } from "../domain/types";
import type { StateStorage } from "./StateStorage";

const STORAGE_KEY = "fire_ibkr_firebase_state_v5";

export const localStorageStorage: StateStorage = {
  label: "Локальний кеш браузера",

  async load(): Promise<AppState | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  },

  async save(state: AppState): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  },
};
