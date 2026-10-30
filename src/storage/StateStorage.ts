import type { AppState } from "../domain/types";

// Єдина точка збереження. Пізніше сюди додається Firestore-адаптер без змін в UI.
export interface StateStorage {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  readonly label: string;
}
