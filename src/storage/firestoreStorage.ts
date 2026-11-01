import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { normalizeState } from "../domain/defaults";
import type { AppState } from "../domain/types";
import type { StateStorage } from "./StateStorage";
import { localStorageStorage } from "./localStorageStorage";

// Один документ на користувача: users/{uid}. Доступ обмежується правилами Firestore.
export function createFirestoreStorage(db: Firestore, uid: string): StateStorage {
  const ref = doc(db, "users", uid);

  return {
    label: "Firebase Cloud",

    async load(): Promise<AppState | null> {
      const snap = await getDoc(ref);
      if (snap.exists()) return normalizeState(snap.data());

      // Перший вхід: переносимо дані, збережені в цьому браузері
      const local = await localStorageStorage.load();
      if (local) await setDoc(ref, { ...local, updatedAt: new Date().toISOString() });
      return local;
    },

    async save(state: AppState): Promise<void> {
      await setDoc(ref, { ...state, updatedAt: new Date().toISOString() });
    },
  };
}
