import { useState } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { GoogleIcon } from "../shared/GoogleIcon";

export interface WelcomeSignInPanelProps {
  /** Si el usuario elige continuar sin cuenta (Firebase no configurado o no quiere iniciar sesión). */
  onContinueWithoutAccount?: () => void;
}

/**
 * Panel de bienvenida con vídeo de fondo (`/slaim-welcome.mp4`), texto a la izquierda
 * y botón para iniciar sesión con Google. Se muestra por defecto cuando el usuario no ha iniciado sesión.
 */
export function WelcomeSignInPanel({ onContinueWithoutAccount }: WelcomeSignInPanelProps) {
  const { firebaseReady, signInWithGoogle } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setSignInError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setSignInError(
        "No se pudo completar el inicio de sesión. Comprueba tu conexión o vuelve a intentarlo."
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="relative isolate min-h-screen w-full flex items-center font-sans overflow-hidden bg-teal-900">
      {/* Fondo: vídeo de bienvenida (fallback: color de fondo arriba) */}
      <video
        className="pointer-events-none absolute inset-0 z-0 h-full min-h-full w-full min-w-full object-cover"
        src="/slaim-welcome.mp4"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
      />
      {/* Capas para legibilidad del texto y coherencia con la marca */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(105deg, rgba(15, 91, 86, 0.88) 0%, rgba(15, 118, 110, 0.5) 42%, rgba(13, 148, 136, 0.22) 62%, rgba(0, 0, 0, 0.12) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(90deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0) 55%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center px-8 py-16 sm:px-12 lg:px-16">
        <div className="max-w-xl shrink-0">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight drop-shadow-lg"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            Bienvenido a Slaim
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 text-lg sm:text-xl text-white/90 max-w-md leading-relaxed"
          >
            Crea presentaciones técnicas con ayuda de IA. Inicia sesión para
            sincronizar tus proyectos y acceder desde cualquier lugar.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-col items-center gap-4"
          >
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSigningIn || firebaseReady !== true}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-base font-semibold text-teal-900 bg-white shadow-xl hover:bg-stone-50 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 w-fit"
            >
              {isSigningIn ? (
                <Loader2 size={22} className="animate-spin shrink-0" />
              ) : (
                <GoogleIcon className="shrink-0 w-[22px] h-[22px]" />
              )}
              {isSigningIn
                ? "Conectando…"
                : firebaseReady !== true
                  ? "Iniciar sesión con Google (configura Firebase)"
                  : "Iniciar sesión con Google"}
            </button>
            {signInError && (
              <p className="text-sm text-red-200 bg-red-900/30 px-4 py-2 rounded-lg max-w-md text-center">
                {signInError}
              </p>
            )}
            {onContinueWithoutAccount && (
              <button
                type="button"
                onClick={onContinueWithoutAccount}
                className="text-sm text-white/80 hover:text-white underline underline-offset-2 transition-colors"
              >
                Continuar sin cuenta
              </button>
            )}
          </motion.div>
        </div>
      </div>

      {/* Formas decorativas de fondo */}
      <div className="pointer-events-none absolute right-0 top-1/2 z-[2] h-2/3 w-1/3 max-w-md -translate-y-1/2 opacity-10">
        <div className="absolute inset-0 rounded-full bg-white blur-3xl" />
      </div>
    </div>
  );
}
