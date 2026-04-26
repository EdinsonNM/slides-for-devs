import { useShallow } from "zustand/react/shallow";
import { usePresentationUiStore } from "@/presentation/state/presentationUiStore.ts";

export function useSlideElementUi() {
  return usePresentationUiStore(
    useShallow((s) => ({
      highlightedTextRole: s.highlightedTextRole,
      setHighlightedTextRole: s.setHighlightedTextRole,
    })),
  );
}
