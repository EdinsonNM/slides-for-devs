import { useEffect } from "react";
import { useLatestRef } from "./useLatestRef";
import type { MutableRefObject } from "react";
import {
  exitDocumentFullscreen,
  getFullscreenElement,
} from "../../utils/fullscreenApi";

export type DeckNavigationActions = {
  nextSlide: () => void;
  prevSlide: () => void;
};

export type PresentationEditorKeyboardDeps = {
  deckNavigationRef: MutableRefObject<DeckNavigationActions>;
  isEditing: boolean;
  isPreviewMode: boolean;
  setIsPreviewMode: (value: boolean) => void;
  applySlidesUndo: () => void;
  applySlidesRedo: () => void;
};

/**
 * Atajos globales del editor: undo/redo de deck (⌘/Ctrl+Z, ⌘/Ctrl+Shift+Z, Ctrl+Y y ⌘+Y),
 * flechas / espacio para diapositiva, Escape para salir de vista previa.
 * Usa `deckNavigationRef` para delegar en `nextSlide` / `prevSlide` sin duplicar índices.
 */
export function usePresentationEditorKeyboard(
  deps: PresentationEditorKeyboardDeps,
) {
  const depsRef = useLatestRef(deps);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inTextField =
        target != null &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      const d = depsRef.current;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (inTextField) return;
        e.preventDefault();
        d.applySlidesUndo();
        return;
      }
      if (
        (mod && e.shiftKey && e.key.toLowerCase() === "z") ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y")
      ) {
        if (inTextField) return;
        e.preventDefault();
        d.applySlidesRedo();
        return;
      }

      if (inTextField || d.isEditing) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        d.deckNavigationRef.current.nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        d.deckNavigationRef.current.prevSlide();
      } else if (e.key === "Escape" && d.isPreviewMode) {
        if (getFullscreenElement()) {
          void exitDocumentFullscreen();
          return;
        }
        d.setIsPreviewMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
