import { useEffect, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth } from "../firebase/client";

export interface AuthState {
  user: User | null;
  ready: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!auth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  const signIn = async () => {
    if (!auth) return;
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      const code = (e as { code?: string }).code ?? "unknown";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(`Не вдалося увійти (${code})`);
      }
    }
  };

  const signOutUser = async () => {
    if (auth) await signOut(auth);
  };

  return { user, ready, error, signIn, signOutUser };
}
