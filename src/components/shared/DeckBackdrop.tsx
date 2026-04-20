import { lazy, Suspense, useMemo, useSyncExternalStore } from "react";
import type { DeckVisualTheme } from "../../domain/entities";
import { useThemeOptional } from "../../context/ThemeContext";
import { cn } from "../../utils/cn";

const LiquidEtherBackdropCanvas = lazy(
  () => import("./LiquidEtherBackdropCanvas"),
);

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

export interface DeckBackdropProps {
  theme: DeckVisualTheme;
  className?: string;
}

function staticLiquidFallback(theme: DeckVisualTheme): string {
  const a = theme.gradientFrom ?? "#020617";
  const b = theme.gradientTo ?? "#0e7490";
  return `linear-gradient(135deg, ${a} 0%, ${b} 50%, #020617 100%)`;
}

/** Luminancia relativa aproximada en [0,1] para `#RRGGBB`. */
function hexSolidLuminance(hex: string): number | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return null;
  const r = Number.parseInt(m[1], 16);
  const g = Number.parseInt(m[2], 16);
  const b = Number.parseInt(m[3], 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function isLightDeckSurface(hex: string): boolean {
  const lum = hexSolidLuminance(hex);
  return lum == null ? true : lum > 0.55;
}

/**
 * Con tema de diapositiva «texto oscuro sobre fondo claro» (`contentTone: dark`),
 * en UI oscura alineamos el lienzo con `--color-surface` si el fondo del deck es claro,
 * para que coincida con `dark:` en tipografía. Fuera de `ThemeProvider` no aplica
 * (capturas PPTX usan colores canónicos del deck).
 */
function useDarkAppSlideChrome(theme: DeckVisualTheme): boolean {
  const themeCtx = useThemeOptional();
  if (!themeCtx?.isDark) return false;
  if (theme.contentTone !== "dark") return false;
  if (theme.backgroundKind === "solid") {
    return isLightDeckSurface(theme.solidColor ?? "#ffffff");
  }
  if (theme.backgroundKind === "gradient") {
    const from = theme.gradientFrom ?? "#f8fafc";
    const to = theme.gradientTo ?? "#bae6fd";
    const a = hexSolidLuminance(from) ?? 0;
    const b = hexSolidLuminance(to) ?? 0;
    return (a + b) / 2 > 0.55;
  }
  return false;
}

export function DeckBackdrop({ theme, className }: DeckBackdropProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const darkAppChrome = useDarkAppSlideChrome(theme);

  const staticStyle = useMemo(() => {
    if (theme.backgroundKind === "solid") {
      if (darkAppChrome) {
        return { backgroundColor: "var(--color-surface)" };
      }
      return { backgroundColor: theme.solidColor ?? "#ffffff" };
    }
    if (theme.backgroundKind === "gradient") {
      const from = theme.gradientFrom ?? "#f8fafc";
      const to = theme.gradientTo ?? "#bae6fd";
      if (darkAppChrome) {
        return {
          backgroundImage:
            "linear-gradient(135deg, var(--color-surface), var(--color-background))",
        };
      }
      return {
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
      };
    }
    return { backgroundImage: staticLiquidFallback(theme) };
  }, [theme, darkAppChrome]);

  if (theme.backgroundKind !== "animatedLiquid" || reducedMotion) {
    return (
      <div
        className={cn("pointer-events-none absolute inset-0", className)}
        style={staticStyle}
        aria-hidden
      />
    );
  }

  const intensity = theme.liquidIntensity ?? 0.55;
  const speed = theme.liquidSpeed ?? 0.35;
  const scale = theme.liquidScale ?? 2.2;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <Suspense
        fallback={
          <div className="absolute inset-0" style={{ backgroundImage: staticLiquidFallback(theme) }} />
        }
      >
        <LiquidEtherBackdropCanvas
          intensity={intensity}
          speed={speed}
          scale={scale}
        />
      </Suspense>
    </div>
  );
}
