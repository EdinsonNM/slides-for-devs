import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
  type Auth,
} from "firebase/auth";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

/**
 * Config de Firebase. Mejor práctica:
 * - Desarrollo (web y Tauri): usar .env con VITE_FIREBASE_* (Vite inyecta en el frontend).
 * - Producción Tauri (app empaquetada): usar firebase_config.json en AppData (sin .env en el bundle).
 */
export async function getFirebaseConfig(): Promise<FirebaseConfig | null> {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

  if (apiKey && authDomain && projectId && appId) {
    return {
      apiKey,
      authDomain,
      projectId,
      storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) ?? "",
      messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) ?? "",
      appId,
      measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string) ?? undefined,
    };
  }

  const isTauri =
    typeof window !== "undefined" &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined;
  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const raw = await invoke<{
        api_key: string;
        auth_domain: string;
        project_id: string;
        storage_bucket: string;
        messaging_sender_id: string;
        app_id: string;
        measurement_id?: string;
      } | null>("get_firebase_config");
      if (!raw) return null;
      return {
        apiKey: raw.api_key,
        authDomain: raw.auth_domain,
        projectId: raw.project_id,
        storageBucket: raw.storage_bucket,
        messagingSenderId: raw.messaging_sender_id,
        appId: raw.app_id,
        measurementId: raw.measurement_id ?? undefined,
      };
    } catch {
      return null;
    }
  }

  return null;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let analytics: Analytics | null = null;
let firestore: Firestore | null = null;
let storage: FirebaseStorage | null = null;

/**
 * Inicializa Firebase con la config obtenida de Tauri o .env.
 * Idempotente: si ya está inicializado, devuelve la instancia existente.
 */
export async function initFirebase(): Promise<{
  app: FirebaseApp;
  auth: Auth;
  analytics: Analytics | null;
  firestore: Firestore;
  storage: FirebaseStorage;
} | null> {
  if (app && auth && firestore && storage) {
    return { app, auth, analytics, firestore, storage };
  }

  const config = await getFirebaseConfig();
  if (!config) return null;

  if (getApps().length > 0) {
    app = getApps()[0] as FirebaseApp;
  } else {
    app = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
      measurementId: config.measurementId,
    });
  }

  auth = getAuth(app);
  firestore = getFirestore(app);
  storage = getStorage(app);
  if (typeof window !== "undefined" && config.measurementId) {
    try {
      analytics = getAnalytics(app);
    } catch {
      analytics = null;
    }
  }

  return { app, auth, analytics, firestore, storage };
}

export function getFirestoreInstance(): Firestore | null {
  return firestore;
}

export function getFirebaseStorageInstance(): FirebaseStorage | null {
  return storage;
}

export function getAuthInstance(): Auth | null {
  return auth;
}

/** Devuelve la instancia de Analytics si está inicializada (requiere measurementId). Usado por el servicio de analytics. */
export function getAnalyticsInstance(): Analytics | null {
  return analytics;
}

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined
  );
}

/**
 * Inicio de sesión con Google.
 * - Web: popup.
 * - Tauri (desktop): abre el navegador del sistema, callback en 127.0.0.1:8765, intercambio por id_token.
 *   Requiere `googleOauthClientId` en firebase_config.json y URI http://127.0.0.1:8765/callback en la consola Google.
 */
export async function signInWithGoogle(): Promise<User | null> {
  const instance = await initFirebase();
  if (!instance) throw new Error("Firebase no configurado");
  const provider = new GoogleAuthProvider();
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const idToken = await invoke<string>("sign_in_google_external_browser");
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(instance.auth, credential);
      return result.user;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("Login con navegador externo:", e);
      }
      throw e;
    }
  }
  const result = await signInWithPopup(instance.auth, provider);
  return result.user;
}

/** Procesa el resultado del redirect (Tauri) y devuelve el usuario si hubo login. */
export async function handleRedirectResult(): Promise<User | null> {
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user ?? null;
  } catch {
    return null;
  }
}

/** Espera a que el estado de auth (persistencia/redirect) esté resuelto. */
export async function waitForAuthReady(): Promise<void> {
  if (!auth) return;
  await auth.authStateReady();
}

export async function signOut(): Promise<void> {
  if (!auth) return;
  await firebaseSignOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
