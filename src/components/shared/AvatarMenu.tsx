import { useState } from "react";
import {
  ChevronDown,
  Copy,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../utils/cn";
import { GoogleIcon } from "./GoogleIcon";
import { checkForAppUpdates } from "../../services/updater";

export interface AvatarMenuProps {
  onOpenConfig?: () => void;
  className?: string;
  /** Estilo más suave para home (fondo translúcido en el trigger). */
  variant?: "default" | "home";
}

/**
 * Menú de cuenta/avatar: muestra avatar o icono de usuario y dropdown con
 * configuración, tema, verificar actualizaciones y cerrar sesión (o iniciar sesión).
 * Reutilizable en Header y en pantallas Home.
 */
export function AvatarMenu({
  onOpenConfig,
  className,
  variant = "default",
}: AvatarMenuProps) {
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [copyUidDone, setCopyUidDone] = useState(false);
  const { firebaseReady, user, signInWithGoogle, signOut } = useAuth();
  const { preference, setPreference } = useTheme();

  const cycleTheme = () => {
    setPreference(
      preference === "light" ? "dark" : preference === "dark" ? "system" : "light"
    );
  };

  const handleCheckUpdates = async () => {
    if (isCheckingUpdates) return;
    setIsCheckingUpdates(true);
    await checkForAppUpdates(false);
    setIsCheckingUpdates(false);
  };

  const handleSignInWithGoogle = async () => {
    if (isSigningIn) return;
    setSignInError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setSignInError("No se pudo completar el inicio de sesión. Vuelve a intentarlo.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setAuthMenuOpen(false);
    await signOut();
  };

  const handleCopyMyUid = async () => {
    if (!user?.uid) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopyUidDone(true);
      window.setTimeout(() => setCopyUidDone(false), 2000);
    } catch {
      setCopyUidDone(false);
    }
  };

  const isHome = variant === "home";
  const triggerBase =
    "flex items-center gap-2 rounded-full pl-0.5 pr-2 py-0.5 text-xs text-stone-600 dark:text-muted-foreground border border-stone-200 dark:border-border";
  const triggerHover = isHome
    ? "hover:bg-white/60 dark:hover:bg-stone-700/60"
    : "hover:bg-stone-100 dark:hover:bg-surface";
  const triggerIconOnlyBase =
    "flex items-center justify-center w-9 h-9 rounded-full text-stone-500 dark:text-muted-foreground border border-stone-200 dark:border-border";
  const triggerIconOnlyHover = isHome
    ? "hover:bg-white/60 dark:hover:bg-stone-700/60"
    : "hover:bg-stone-100 dark:hover:bg-surface";

  return (
    <div className={cn("relative flex items-center shrink-0", className)}>
      {user ? (
        <>
          <button
            type="button"
            onClick={() => setAuthMenuOpen((v) => !v)}
            className={cn(triggerBase, triggerHover)}
            title={user.email ?? "Cuenta y opciones"}
            aria-expanded={authMenuOpen}
            aria-haspopup="menu"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-8 h-8 rounded-full shrink-0 object-cover"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-stone-300 dark:bg-stone-600 flex items-center justify-center text-stone-600 dark:text-stone-300 text-xs font-medium shrink-0">
                {(user.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="truncate max-w-[120px] hidden sm:inline">
              {user.displayName || user.email}
            </span>
            <ChevronDown
              size={14}
              className={cn("shrink-0 transition-transform", authMenuOpen && "rotate-180")}
            />
          </button>
          {authMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                aria-hidden
                onClick={() => setAuthMenuOpen(false)}
              />
              <div
                className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg shadow-lg py-1 min-w-[200px]"
                role="menu"
              >
                <div className="px-3 py-2 border-b border-stone-100 dark:border-border">
                  <p className="text-xs font-medium text-stone-900 dark:text-foreground truncate">
                    {user.displayName || "Cuenta"}
                  </p>
                  <p className="text-[11px] text-stone-500 dark:text-muted-foreground truncate">
                    {user.email}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyMyUid();
                    }}
                    className="mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[11px] text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-800/80 hover:bg-stone-100 dark:hover:bg-stone-700 border border-stone-200/80 dark:border-border"
                  >
                    <Copy size={14} />
                    {copyUidDone ? "UID copiado" : "Copiar mi UID (para compartir)"}
                  </button>
                </div>
                {onOpenConfig && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAuthMenuOpen(false);
                      onOpenConfig();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 dark:text-foreground hover:bg-stone-50 dark:hover:bg-surface"
                  >
                    <Settings size={16} />
                    Configuración
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAuthMenuOpen(false);
                    cycleTheme();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 dark:text-foreground hover:bg-stone-50 dark:hover:bg-surface"
                >
                  {preference === "light" ? (
                    <Sun size={16} />
                  ) : preference === "dark" ? (
                    <Moon size={16} />
                  ) : (
                    <Monitor size={16} />
                  )}
                  Cambiar tema
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAuthMenuOpen(false);
                    handleCheckUpdates();
                  }}
                  disabled={isCheckingUpdates}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 dark:text-foreground hover:bg-stone-50 dark:hover:bg-surface disabled:opacity-60"
                >
                  {isCheckingUpdates ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  Verificar actualizaciones
                </button>
                <div className="border-t border-stone-100 dark:border-border my-1" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 dark:text-foreground hover:bg-stone-50 dark:hover:bg-surface"
                >
                  <LogOut size={16} />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setAuthMenuOpen((v) => !v)}
            className={cn(triggerIconOnlyBase, triggerIconOnlyHover)}
            title="Cuenta y opciones"
            aria-expanded={authMenuOpen}
            aria-haspopup="menu"
          >
            <User size={20} />
          </button>
          {authMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                aria-hidden
                onClick={() => setAuthMenuOpen(false)}
              />
              <div
                className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg shadow-lg py-1 min-w-[200px]"
                role="menu"
              >
                {firebaseReady === true && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAuthMenuOpen(false);
                      handleSignInWithGoogle();
                    }}
                    disabled={isSigningIn}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 dark:text-foreground hover:bg-stone-50 dark:hover:bg-surface disabled:opacity-60"
                  >
                    {isSigningIn ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <GoogleIcon className="size-4" />
                    )}
                    Iniciar sesión con Google
                  </button>
                )}
                {signInError && (
                  <p className="px-3 py-2 text-xs text-red-600 dark:text-red-400" role="alert">
                    {signInError}
                  </p>
                )}
                {onOpenConfig && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAuthMenuOpen(false);
                      onOpenConfig();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 dark:text-foreground hover:bg-stone-50 dark:hover:bg-surface"
                  >
                    <Settings size={16} />
                    Configuración
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAuthMenuOpen(false);
                    cycleTheme();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 dark:text-foreground hover:bg-stone-50 dark:hover:bg-surface"
                >
                  {preference === "light" ? (
                    <Sun size={16} />
                  ) : preference === "dark" ? (
                    <Moon size={16} />
                  ) : (
                    <Monitor size={16} />
                  )}
                  Cambiar tema
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAuthMenuOpen(false);
                    handleCheckUpdates();
                  }}
                  disabled={isCheckingUpdates}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 dark:text-foreground hover:bg-stone-50 dark:hover:bg-surface disabled:opacity-60"
                >
                  {isCheckingUpdates ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  Verificar actualizaciones
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
