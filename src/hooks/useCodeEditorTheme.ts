import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "slides-for-devs-code-editor-theme";
const THEME_EVENT = "slides-for-devs-code-editor-theme-change";

export type CodeEditorTheme = "dark" | "light";

function readStored(): CodeEditorTheme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

function notifyThemeChange() {
  try {
    window.dispatchEvent(new Event(THEME_EVENT));
  } catch {
    /* ignore */
  }
}

/**
 * Tema del panel de código (independiente del tema global de la app).
 * Se persiste en localStorage. Varias instancias del hook (panel + vista previa)
 * se sincronizan al cambiar el tema.
 */
export function useCodeEditorTheme() {
  const [theme, setThemeState] = useState<CodeEditorTheme>(readStored);

  useEffect(() => {
    const sync = () => setThemeState(readStored());
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((t: CodeEditorTheme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    notifyThemeChange();
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      notifyThemeChange();
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme, isLight: theme === "light" };
}
