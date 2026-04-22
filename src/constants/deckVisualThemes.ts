import type { DeckVisualTheme } from "../domain/entities/DeckVisualTheme";

export type DeckThemePresetDefinition = {
  id: string;
  label: string;
  theme: DeckVisualTheme;
};

export const DECK_THEME_PRESETS: DeckThemePresetDefinition[] = [
  {
    id: "classic",
    label: "Clásico",
    theme: {
      version: 1,
      presetId: "classic",
      backgroundKind: "solid",
      contentTone: "dark",
      solidColor: "#ffffff",
    },
  },
  {
    id: "midnight",
    label: "Medianoche",
    theme: {
      version: 1,
      presetId: "midnight",
      backgroundKind: "gradient",
      contentTone: "light",
      gradientFrom: "#0f172a",
      gradientTo: "#1e3a5f",
    },
  },
  {
    id: "sunrise",
    label: "Amanecer",
    theme: {
      version: 1,
      presetId: "sunrise",
      backgroundKind: "gradient",
      contentTone: "dark",
      gradientFrom: "#fef3c7",
      gradientTo: "#fda4af",
    },
  },
  {
    id: "forest",
    label: "Bosque",
    theme: {
      version: 1,
      presetId: "forest",
      backgroundKind: "gradient",
      contentTone: "light",
      gradientFrom: "#064e3b",
      gradientTo: "#14532d",
    },
  },
  {
    id: "liquidEther",
    label: "Éter líquido",
    theme: {
      version: 1,
      presetId: "liquidEther",
      backgroundKind: "animatedLiquid",
      contentTone: "light",
      solidColor: "#020617",
      liquidIntensity: 0.55,
      liquidSpeed: 0.35,
      liquidScale: 2.2,
    },
  },
];

export function getDeckThemePresetById(
  id: string,
): DeckThemePresetDefinition | undefined {
  return DECK_THEME_PRESETS.find((p) => p.id === id);
}
