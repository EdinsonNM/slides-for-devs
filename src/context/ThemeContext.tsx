import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "slides-for-devs-theme";

function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function getEffectiveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return preference;
}

interface ThemeContextValue {
  /** User preference: light, dark, or follow system */
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
  /** Resolved theme for styling (light or dark) */
  effectiveTheme: "light" | "dark";
  /** True when effective theme is dark */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getStoredPreference);
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(() =>
    getEffectiveTheme(preference)
  );

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    localStorage.setItem(STORAGE_KEY, value);
  }, []);

  useEffect(() => {
    const resolved = getEffectiveTheme(preference);
    setEffectiveTheme(resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const resolved = getEffectiveTheme("system");
      setEffectiveTheme(resolved);
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [preference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      setPreference,
      effectiveTheme,
      isDark: effectiveTheme === "dark",
    }),
    [preference, setPreference, effectiveTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
