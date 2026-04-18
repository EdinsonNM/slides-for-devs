import { useShallow } from "zustand/react/shallow";
import { usePresentationUiStore } from "../state/presentationUiStore.ts";

export function useSlideElementUi() {
  return usePresentationUiStore(
    useShallow((s) => ({
      highlightedTextRole: s.highlightedTextRole,
      setHighlightedTextRole: s.setHighlightedTextRole,
    })),
  );
}
