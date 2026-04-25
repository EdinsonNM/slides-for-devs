import type { CSSProperties } from "react";
import { cn } from "../../utils/cn";

export type ClaudeDotFadeVariant = "light" | "dark";

/** Malla de puntos con desvanecido horizontal (referencia tipo Claude). */
export function claudeDotFadeLayerStyle(variant: ClaudeDotFadeVariant): CSSProperties {
  const dot =
    variant === "light"
      ? "radial-gradient(circle 1.1px at center, rgba(120,113,108,0.22) 100%, transparent 0)"
      : "radial-gradient(circle 1.1px at center, rgba(255,255,255,0.07) 100%, transparent 0)";
  const fade =
    "linear-gradient(to right, #000 0%, #000 22%, rgba(0,0,0,0.48) 52%, transparent 96%)";
  return {
    backgroundImage: dot,
    backgroundSize: "20px 20px",
    WebkitMaskImage: fade,
    maskImage: fade,
    opacity: variant === "light" ? 0.92 : 0.5,
  };
}

export function ClaudeDotFadeLayer({
  variant,
  className,
}: {
  variant: ClaudeDotFadeVariant;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={claudeDotFadeLayerStyle(variant)}
    />
  );
}
