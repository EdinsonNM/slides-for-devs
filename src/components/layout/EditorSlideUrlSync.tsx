import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import {
  EDITOR_SLIDE_QUERY_PARAM,
  clampEditorSlideIndex,
} from "../../constants/editorNavigation";

/**
 * Mantiene `?slide=N` (índice 0-based) en la URL del editor para que un refresh
 * restaure el slide activo vía `readEditorSlideIndexFromHash` al cargar la presentación.
 */
export function EditorSlideUrlSync() {
  const { currentIndex, slides } = usePresentation();
  const [searchParams, setSearchParams] = useSearchParams();
  const slideCount = slides.length;
  const slideParam = searchParams.get(EDITOR_SLIDE_QUERY_PARAM);

  useEffect(() => {
    if (slideCount === 0) return;
    const desired = String(clampEditorSlideIndex(currentIndex, slideCount));
    if (slideParam === desired) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(EDITOR_SLIDE_QUERY_PARAM, desired);
        return next;
      },
      { replace: true },
    );
  }, [currentIndex, slideCount, slideParam, setSearchParams]);

  return null;
}
