import { useState } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../presentation/contexts/AuthContext";
import { GoogleIcon } from "../shared/GoogleIcon";

/**
 * Panel de bienvenida con vídeo de fondo (`/slaim-welcome.mp4`), texto a la izquierda
 * y botón para iniciar sesión con Google. Se muestra cuando el usuario no ha iniciado sesión.
 */
export function WelcomeSignInPanel() {
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
    <div className="relative isolate flex min-h-dvh w-full items-center justify-center overflow-x-hidden overflow-y-auto bg-teal-900 font-sans">
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
      {/* Refuerzo de contraste en móvil (vídeo / 3D muy claros abajo o a los lados) */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-linear-to-b from-black/20 via-transparent to-teal-950/55 lg:hidden"
        aria-hidden
      />
      {/* Textura de puntos sobre tintes (opacidad y paso moderados para no competir con el contenido) */}
      <div
        className="pointer-events-none absolute inset-0 z-[3]"
        style={{
          backgroundImage: [
            "radial-gradient(circle, rgba(255, 255, 255, 0.2) 1px, transparent 1.75px)",
            "radial-gradient(circle, rgba(4, 47, 46, 0.11) 1px, transparent 1.75px)",
          ].join(", "),
          backgroundSize: "20px 20px, 20px 20px",
          backgroundPosition: "0 0, 10px 10px",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center px-4 py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:py-14 md:px-12 lg:px-16 lg:py-16">
        <div className="w-full min-w-0 max-w-xl shrink-0 text-center sm:text-left">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-balance text-3xl font-bold leading-tight tracking-tight text-white drop-shadow-lg sm:text-4xl md:text-5xl lg:text-6xl"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            Bienvenido a Slaim
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mt-4 max-w-md text-pretty text-base leading-relaxed text-white/90 sm:mx-0 sm:mt-6 sm:text-lg lg:text-xl"
          >
            Crea presentaciones técnicas con ayuda de IA. Inicia sesión para
            sincronizar tus proyectos y acceder desde cualquier lugar.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 flex flex-col items-center gap-3 sm:mt-10 sm:items-start sm:gap-4"
          >
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSigningIn || firebaseReady !== true}
              className="inline-flex w-full min-h-12 items-center justify-center gap-3 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-teal-900 shadow-xl transition-all hover:bg-stone-50 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 sm:w-fit sm:min-h-0 sm:justify-start sm:px-8 sm:py-4 sm:text-base"
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
              <p className="max-w-full rounded-lg bg-red-900/30 px-4 py-2 text-center text-sm text-red-200 sm:max-w-md">
                {signInError}
              </p>
            )}
          </motion.div>
        </div>
      </div>

      {/* Formas decorativas de fondo (ocultas en móvil para no competir con el contenido) */}
      <div className="pointer-events-none absolute right-0 top-1/2 z-[2] hidden h-2/3 w-2/5 max-w-md -translate-y-1/2 opacity-10 sm:block md:w-1/3">
        <div className="absolute inset-0 rounded-full bg-white blur-3xl" />
      </div>
    </div>
  );
}
