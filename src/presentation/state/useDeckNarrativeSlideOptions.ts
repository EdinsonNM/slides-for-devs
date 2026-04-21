import { useMemo } from "react";
import { buildDeckNarrativeContextForPrompts } from "../../constants/presentationNarrativePresets";

export type DeckNarrativeSlideOptions = {
  deckNarrativeContext: string;
};

/** Contexto de narrativa del deck para prompts de IA (memoizado por preset + notas). */
export function useDeckNarrativeSlideOptions(
  deckNarrativePresetId: string,
  narrativeNotes: string,
): DeckNarrativeSlideOptions {
  return useMemo(
    () => ({
      deckNarrativeContext: buildDeckNarrativeContextForPrompts(
        deckNarrativePresetId,
        narrativeNotes,
      ),
    }),
    [deckNarrativePresetId, narrativeNotes],
  );
}
