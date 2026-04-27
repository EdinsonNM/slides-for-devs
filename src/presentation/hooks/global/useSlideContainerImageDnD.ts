import { useEffect, type RefObject } from "react";
import {
  clampCanvasRect,
  SLIDE_TYPE,
  type SlideCanvasRect,
} from "../../../domain/entities";
import type { Slide } from "../../../types";
import {
  dragDataTransferHasFileOffer,
  isUsableSlideImageFile,
  pickImageFileFromClipboardData,
} from "../../../utils/slideImageFile";

type IngestImageFn = (
  file: File,
  placement: "patchTargetPanel" | "newPanel",
  newPanelRect?: SlideCanvasRect,
  callbacks?: {
    onAfterApply?: () => void;
    patchMediaPanelElementId?: string;
  },
) => void;

function interactionInSlideHost(
  host: HTMLElement,
  ev: Event,
): boolean {
  const t = ev.target;
  if (t instanceof Node && host.contains(t)) return true;
  const active = document.activeElement;
  return active instanceof HTMLElement && host.contains(active);
}

/**
 * Pegar / arrastrar imagen en el lienzo (`hostRef`): listeners en el propio contenedor fase **capture**
 * para que `dragover`/`drop` apliquen aunque el puntero esté sobre hijos.
 *
 * Pegar y soltar **crean siempre un nuevo** `mediaPanel` con la imagen (posición por defecto o bajo el cursor al soltar).
 */
export function useSlideContainerImageDnD(
  currentSlide: Slide | null | undefined,
  hostRef: RefObject<HTMLElement | null>,
  ingestImageFileOnCurrentSlide: IngestImageFn,
  setDragOverFile?: (v: boolean) => void,
) {
  useEffect(() => {
    if (!currentSlide || currentSlide.type !== SLIDE_TYPE.CONTENT) return;

    let cancelled = false;
    let detach: (() => void) | null = null;
    let attached = false;
    let rafAttempts = 0;
    const maxRafAttempts = 120;

    const tryAttach = () => {
      if (cancelled || attached) return;
      const host = hostRef.current;
      if (!host) {
        rafAttempts += 1;
        if (rafAttempts < maxRafAttempts) {
          requestAnimationFrame(tryAttach);
        }
        return;
      }
      attached = true;

      const onPasteCapture = (e: ClipboardEvent) => {
        if (!interactionInSlideHost(host, e)) return;
        const file = pickImageFileFromClipboardData(e.clipboardData);
        if (!file) return;
        const active = document.activeElement;
        if (active instanceof HTMLElement) {
          const field = active.closest(
            "textarea, input, [contenteditable='true']",
          );
          if (field) {
            const plain = e.clipboardData?.getData("text/plain") ?? "";
            if (plain.trim()) return;
          }
        }
        e.preventDefault();
        e.stopPropagation();
        ingestImageFileOnCurrentSlide(file, "newPanel");
      };

      const onDragOverCapture = (e: DragEvent) => {
        if (!interactionInSlideHost(host, e)) return;
        if (!dragDataTransferHasFileOffer(e.dataTransfer)) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        setDragOverFile?.(true);
      };

      const onDropCapture = (e: DragEvent) => {
        if (!interactionInSlideHost(host, e)) return;
        setDragOverFile?.(false);
        const dt = e.dataTransfer;
        const file =
          dt?.files?.length > 0
            ? Array.from(dt.files).find((f) => isUsableSlideImageFile(f))
            : null;
        if (!file) return;
        e.preventDefault();
        e.stopPropagation();

        const rectEl = host.getBoundingClientRect();
        if (rectEl.width >= 1 && rectEl.height >= 1) {
          const wPct = 38;
          const hPct = 44;
          const cx = ((e.clientX - rectEl.left) / rectEl.width) * 100;
          const cy = ((e.clientY - rectEl.top) / rectEl.height) * 100;
          const newRect: SlideCanvasRect = clampCanvasRect({
            x: cx - wPct / 2,
            y: cy - hPct / 2,
            w: wPct,
            h: hPct,
          });
          ingestImageFileOnCurrentSlide(file, "newPanel", newRect);
        } else {
          ingestImageFileOnCurrentSlide(file, "newPanel");
        }
      };

      const onDragEndCapture = () => setDragOverFile?.(false);

      host.addEventListener("paste", onPasteCapture, true);
      host.addEventListener("dragover", onDragOverCapture, true);
      host.addEventListener("drop", onDropCapture, true);
      host.addEventListener("dragend", onDragEndCapture, true);

      detach = () => {
        host.removeEventListener("paste", onPasteCapture, true);
        host.removeEventListener("dragover", onDragOverCapture, true);
        host.removeEventListener("drop", onDropCapture, true);
        host.removeEventListener("dragend", onDragEndCapture, true);
      };
    };

    tryAttach();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [
    currentSlide?.id,
    currentSlide?.type,
    hostRef,
    ingestImageFileOnCurrentSlide,
    setDragOverFile,
  ]);
}
