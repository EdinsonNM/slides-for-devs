import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { User } from "firebase/auth";
import {
  initFirebase,
  getAuthInstance,
  handleRedirectResult,
  waitForAuthReady,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOut as firebaseSignOut,
  subscribeAuthState,
} from "../services/firebase";
import { setAnalyticsUserId } from "../services/analytics";

interface AuthState {
  /** Si Firebase está configurado (Tauri: archivo en AppData; web: .env). */
  firebaseReady: boolean | null;
  /** Usuario actual o null. */
  user: User | null;
  /** Cargando config o estado de auth. */
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseReady, setFirebaseReady] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const instance = await initFirebase();
        if (cancelled) return;
        setFirebaseReady(!!instance);
        if (instance) {
          const redirectUser = await handleRedirectResult();
          if (cancelled) return;
          if (redirectUser) setUser(redirectUser);
          await waitForAuthReady();
          if (cancelled) return;
          const authInstance = getAuthInstance();
          setUser(authInstance?.currentUser ?? null);
          unsubscribe = subscribeAuthState((next) => {
            if (!cancelled) setUser(next);
          });
          if (cancelled) return;
          timeoutId = setTimeout(() => {
            if (cancelled) return;
            const a = getAuthInstance();
            if (a?.currentUser) setUser(a.currentUser);
          }, 1500);
        } else {
          setUser(null);
        }
      } catch {
        if (!cancelled) {
          setFirebaseReady(false);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Asociar eventos de Analytics al usuario logueado para poder analizar uso por cuenta en GA4
  useEffect(() => {
    setAnalyticsUserId(user?.uid ?? null);
  }, [user?.uid]);

  const signInWithGoogle = useCallback(async () => {
    try {
      const loggedUser = await firebaseSignInWithGoogle();
      if (loggedUser) setUser(loggedUser);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("Error al iniciar sesión con Google:", e);
      }
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut();
      setUser(null);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("Error al cerrar sesión:", e);
      }
      setUser(null);
    }
  }, []);

  const value: AuthState = {
    firebaseReady,
    user,
    loading,
    signInWithGoogle,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}
