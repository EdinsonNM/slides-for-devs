import { useEffect } from "react";
import type { PresentationEditorLifecycleDeps } from "./presentationEditorLifecycleDeps";

/**
 * Efectos de ciclo de vida del editor sin acoplar persistencia ni modales de IA.
 *
 * 1. Al cambiar de diapositiva, volcar edición en curso al slide anterior si aplica.
 * 2. Al cambiar slide (por índice o id), rehidratar campos de edición y salir de modo edición.
 * 3. Si el deck queda vacío, refrescar el listado guardado (home / modal).
 */
export function usePresentationEditorLifecycleEffects(
  deps: PresentationEditorLifecycleDeps,
) {
  useEffect(() => {
    const prevIdx = deps.prevSlideIndexForFlushRef.current;
    if (prevIdx !== deps.currentIndex && deps.isEditingRef.current) {
      deps.flushEditsToSlideIndex(prevIdx);
    }
    deps.prevSlideIndexForFlushRef.current = deps.currentIndex;
  }, [deps.currentIndex, deps.flushEditsToSlideIndex]);

  useEffect(() => {
    if (deps.currentSlide) {
      deps.syncEditFieldsFromSlide(deps.currentSlide);
      deps.setIsEditing(false);
    }
  }, [
    deps.currentIndex,
    deps.currentSlide?.id,
    deps.syncEditFieldsFromSlide,
  ]);

  useEffect(() => {
    if (deps.slidesLength !== 0) return;
    void deps.refreshSavedList();
  }, [deps.slidesLength, deps.localAccountScope, deps.refreshSavedList]);
}
