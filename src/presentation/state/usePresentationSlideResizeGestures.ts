import { useEffect } from "react";
import { useLatestRef } from "./useLatestRef";
import type { PresentationSlideResizeGesturesDeps } from "./presentationSlideResizeGesturesDeps";

const SLIDE_CONTAINER_ID = "slide-container";

/**
 * Arrastre global para redimensionar el panel de imagen (split) y la altura del panel
 * en layout `panel-full`, usando el rectángulo de `#slide-container`.
 */
export function usePresentationSlideResizeGestures(
  deps: PresentationSlideResizeGesturesDeps,
) {
  const depsRef = useLatestRef(deps);

  useEffect(() => {
    if (!deps.isResizing) {
      document.body.style.cursor = "default";
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const live = depsRef.current;
      if (!live.isResizing) return;
      const container = document.getElementById(SLIDE_CONTAINER_ID);
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.min(Math.max(15, 100 - (x / rect.width) * 100), 85);
      live.setSlides((prev) => {
        const idx = live.currentIndex;
        if (idx < 0 || idx >= prev.length) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], imageWidthPercent: percent };
        return updated;
      });
    };

    const handleMouseUp = () => {
      depsRef.current.setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
    };
  }, [deps.isResizing]);

  useEffect(() => {
    if (!deps.isResizingPanelHeight) {
      document.body.style.cursor = "";
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const live = depsRef.current;
      if (!live.isResizingPanelHeight) return;
      const container = document.getElementById(SLIDE_CONTAINER_ID);
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percent = Math.min(Math.max(25, 100 - (y / rect.height) * 100), 95);
      live.setSlides((prev) => {
        const idx = live.currentIndex;
        if (idx < 0 || idx >= prev.length) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], panelHeightPercent: percent };
        return updated;
      });
    };

    const handleMouseUp = () => {
      depsRef.current.setIsResizingPanelHeight(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "row-resize";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [deps.isResizingPanelHeight]);
}
