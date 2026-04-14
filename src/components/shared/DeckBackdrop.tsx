import { lazy, Suspense, useMemo, useSyncExternalStore } from "react";
import type { DeckVisualTheme } from "../../domain/entities";
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

export function DeckBackdrop({ theme, className }: DeckBackdropProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const staticStyle = useMemo(() => {
    if (theme.backgroundKind === "solid") {
      return { backgroundColor: theme.solidColor ?? "#ffffff" };
    }
    if (theme.backgroundKind === "gradient") {
      const from = theme.gradientFrom ?? "#f8fafc";
      const to = theme.gradientTo ?? "#bae6fd";
      return {
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
      };
    }
    return { backgroundImage: staticLiquidFallback(theme) };
  }, [theme]);

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
