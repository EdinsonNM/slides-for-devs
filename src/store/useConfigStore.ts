import { create } from "zustand";
import type { DeckVisualTheme } from "../domain/entities";
import { DEFAULT_DECK_VISUAL_THEME } from "../domain/entities";
import { DEFAULT_DECK_NARRATIVE_PRESET_ID } from "../constants/presentationNarrativePresets";
import { DEFAULT_PRESENTATION_MODEL_ID } from "../constants/presentationModels";

export interface ConfigState {
  deckVisualTheme: DeckVisualTheme;
  deckNarrativePresetId: string;
  narrativeNotes: string;
  presentationReadme: string;
  presentationModelId: string;
  apiKeysVersion: number;

  setConfigState: (state: Partial<ConfigState>) => void;
  incrementApiKeysVersion: () => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  deckVisualTheme: DEFAULT_DECK_VISUAL_THEME,
  deckNarrativePresetId: DEFAULT_DECK_NARRATIVE_PRESET_ID,
  narrativeNotes: "",
  presentationReadme: "",
  presentationModelId: DEFAULT_PRESENTATION_MODEL_ID,
  apiKeysVersion: 0,

  setConfigState: (newState) => set((state) => ({ ...state, ...newState })),
  incrementApiKeysVersion: () => set((state) => ({ apiKeysVersion: state.apiKeysVersion + 1 })),
}));

export function createConfigSetter<K extends keyof ConfigState>(key: K) {
  return (val: ConfigState[K] | ((prev: ConfigState[K]) => ConfigState[K])) => {
    useConfigStore.setState((prev) => ({
      ...prev,
      [key]: typeof val === 'function' ? (val as any)(prev[key]) : val
    }));
  };
}
