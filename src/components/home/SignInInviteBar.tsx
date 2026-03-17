import { useState } from "react";
import { Cloud, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { GoogleIcon } from "../shared/GoogleIcon";

/**
 * Barra que invita a iniciar sesión con Google para sincronizar en la nube.
 * Se muestra en el home cuando el usuario está en modo local (sin cuenta).
 */
export function SignInInviteBar() {
  const { user, firebaseReady, signInWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return null;

  const handleClick = async () => {
    if (firebaseReady !== true || isSigningIn) return;
    setError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setError("No se pudo completar el inicio de sesión.");
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="shrink-0 flex items-center justify-center gap-3 px-4 py-2.5 bg-emerald-500/15 dark:bg-emerald-600/20 border-b border-emerald-500/20 dark:border-emerald-500/30">
      <Cloud size={18} className="text-emerald-700 dark:text-emerald-400 shrink-0" />
      <span className="text-sm text-stone-700 dark:text-stone-200">
        Inicia sesión con Google para sincronizar tus presentaciones en la nube
      </span>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      )}
      {firebaseReady === true ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={isSigningIn}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-teal-900 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 shadow-sm hover:bg-stone-50 dark:hover:bg-stone-700 disabled:opacity-60 transition-colors"
        >
          {isSigningIn ? (
            <Loader2 size={16} className="animate-spin shrink-0" />
          ) : (
            <GoogleIcon className="shrink-0" />
          )}
          Iniciar sesión
        </button>
      ) : (
        <span className="text-xs text-stone-500 dark:text-stone-400">
          (configura Firebase para habilitar)
        </span>
      )}
    </div>
  );
}
