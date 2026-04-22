/** Schema version for forward-compatible persistence. */
export const DECK_VISUAL_THEME_VERSION = 1 as const;

export type DeckBackgroundKind = "solid" | "gradient" | "animatedLiquid";

/** `light` = texto claro sobre fondo oscuro; `dark` = texto oscuro sobre fondo claro. */
export type DeckContentTone = "light" | "dark";

export interface DeckVisualTheme {
  version: typeof DECK_VISUAL_THEME_VERSION;
  presetId: string;
  backgroundKind: DeckBackgroundKind;
  contentTone: DeckContentTone;
  /** Hex #RRGGBB cuando backgroundKind === solid */
  solidColor?: string;
  /** Inicio / fin de gradiente (hex) cuando backgroundKind === gradient */
  gradientFrom?: string;
  gradientTo?: string;
  /** Parámetros del preset animado (acotados) */
  liquidIntensity?: number;
  liquidSpeed?: number;
  liquidScale?: number;
}

export const DEFAULT_DECK_VISUAL_THEME: DeckVisualTheme = {
  version: DECK_VISUAL_THEME_VERSION,
  presetId: "classic",
  backgroundKind: "solid",
  contentTone: "dark",
  solidColor: "#ffffff",
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isHexColor(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(s);
}

export function normalizeDeckVisualTheme(raw: unknown): DeckVisualTheme {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_DECK_VISUAL_THEME };
  const o = raw as Record<string, unknown>;
  const version =
    typeof o.version === "number" && o.version >= 1
      ? (o.version as typeof DECK_VISUAL_THEME_VERSION)
      : DECK_VISUAL_THEME_VERSION;
  const presetId =
    typeof o.presetId === "string" && o.presetId.trim().length > 0
      ? o.presetId.trim()
      : DEFAULT_DECK_VISUAL_THEME.presetId;
  const bg = o.backgroundKind;
  const backgroundKind: DeckBackgroundKind =
    bg === "gradient" || bg === "animatedLiquid" || bg === "solid"
      ? bg
      : "solid";
  const ct = o.contentTone;
  const contentTone: DeckContentTone =
    ct === "light" || ct === "dark" ? ct : "dark";
  const solidColor =
    typeof o.solidColor === "string" && isHexColor(o.solidColor)
      ? o.solidColor
      : DEFAULT_DECK_VISUAL_THEME.solidColor;
  const gradientFrom =
    typeof o.gradientFrom === "string" && isHexColor(o.gradientFrom)
      ? o.gradientFrom
      : "#0f172a";
  const gradientTo =
    typeof o.gradientTo === "string" && isHexColor(o.gradientTo)
      ? o.gradientTo
      : "#0369a1";
  return {
    version,
    presetId,
    backgroundKind,
    contentTone,
    solidColor,
    gradientFrom,
    gradientTo,
    liquidIntensity: clamp(
      typeof o.liquidIntensity === "number" ? o.liquidIntensity : 0.55,
      0.2,
      1,
    ),
    liquidSpeed: clamp(
      typeof o.liquidSpeed === "number" ? o.liquidSpeed : 0.35,
      0.05,
      1.2,
    ),
    liquidScale: clamp(
      typeof o.liquidScale === "number" ? o.liquidScale : 2.2,
      0.8,
      4,
    ),
  };
}

export function mergeDeckVisualTheme(
  base: DeckVisualTheme,
  patch: Partial<DeckVisualTheme>,
): DeckVisualTheme {
  return normalizeDeckVisualTheme({ ...base, ...patch });
}

/** Fondo estático para exportación Remotion (sin WebGL). */
export function deckThemeToExportBackgroundCss(theme: DeckVisualTheme): string {
  const t = normalizeDeckVisualTheme(theme);
  if (t.backgroundKind === "solid") {
    return t.solidColor ?? "#ffffff";
  }
  if (t.backgroundKind === "gradient") {
    const from = t.gradientFrom ?? "#0f172a";
    const to = t.gradientTo ?? "#0369a1";
    return `linear-gradient(135deg, ${from}, ${to})`;
  }
  return `linear-gradient(135deg, ${t.gradientFrom ?? "#020617"}, ${t.gradientTo ?? "#0e7490"})`;
}
