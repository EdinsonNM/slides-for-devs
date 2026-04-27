import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "slides-for-devs-code-editor-theme";
const THEME_EVENT = "slides-for-devs-code-editor-theme-change";

export type CodeEditorTheme = "dark" | "light";

export function readPersistedCodeEditorTheme(): CodeEditorTheme {
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

export function cycleCodeEditorTheme(): void {
  const next: CodeEditorTheme =
    readPersistedCodeEditorTheme() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  notifyThemeChange();
}

export function useCodeEditorTheme() {
  const [theme, setThemeState] = useState<CodeEditorTheme>(
    readPersistedCodeEditorTheme,
  );

  useEffect(() => {
    const sync = () => setThemeState(readPersistedCodeEditorTheme());
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
    cycleCodeEditorTheme();
    setThemeState(readPersistedCodeEditorTheme());
  }, []);

  return { theme, setTheme, toggleTheme, isLight: theme === "light" };
}
