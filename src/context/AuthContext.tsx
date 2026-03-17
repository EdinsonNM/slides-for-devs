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
    let unsubscribe: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const instance = await initFirebase();
        setFirebaseReady(!!instance);
        if (instance) {
          const redirectUser = await handleRedirectResult();
          if (redirectUser) setUser(redirectUser);
          await waitForAuthReady();
          unsubscribe = subscribeAuthState(setUser);
          const auth = getAuthInstance();
          if (auth?.currentUser) setUser(auth.currentUser);
          timeoutId = setTimeout(() => {
            const a = getAuthInstance();
            if (a?.currentUser) setUser(a.currentUser);
          }, 1500);
        } else {
          setUser(null);
        }
      } catch {
        setFirebaseReady(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (unsubscribe) unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const loggedUser = await firebaseSignInWithGoogle();
      if (loggedUser) setUser(loggedUser);
    } catch (e) {
      console.error("Error al iniciar sesión con Google:", e);
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut();
      setUser(null);
    } catch (e) {
      console.error("Error al cerrar sesión:", e);
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
