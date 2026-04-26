import { motion, AnimatePresence } from "motion/react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { SlideCanvasSlide } from "../canvas/SlideCanvasSlide";
import { PresentationReadmeEditor } from "./PresentationReadmeEditor";
import { PresentationSettingsEditor } from "./PresentationSettingsEditor";

export function SlideEditor() {
  const {
    currentSlide,
    currentIndex,
    isReadmePanelOpen,
    isPresentationSettingsPanelOpen,
  } = usePresentation();

  if (isPresentationSettingsPanelOpen) {
    return (
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PresentationSettingsEditor />
      </section>
    );
  }

  if (isReadmePanelOpen) {
    return (
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PresentationReadmeEditor />
      </section>
    );
  }

  if (!currentSlide) return null;

  return (
    <section
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-stone-200/50 p-3 pb-24 md:p-4 lg:p-6 dark:bg-stone-900/60"
      onPointerDown={(e) => {
        const t = e.target as HTMLElement;
        if (!t.closest(".slide-content")) {
          document.dispatchEvent(new CustomEvent("slide:dismissCanvasSelection"));
        }
      }}
    >
      <div className="slide-editor-canvas-wrap flex min-h-0 w-full flex-1 flex-col">
        <div className="slide-editor-stage flex min-h-0 flex-1 flex-col items-center justify-center pb-16">
          {/*
            Misma anchura que el slide (cqw/cqh del stage): la etiqueta «Sección» queda alineada al borde
            izquierdo del marco 16:9 sin mover el slide (antes `self-start` al ancho completo del panel).
          */}
          <div className="flex w-[min(100cqw,calc((100cqh-2.75rem)*16/9))] shrink-0 flex-col gap-1">
            <div className="w-full shrink-0 text-left">
              <span
                className="font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400"
                style={{ fontSize: "var(--slide-section-out-label)" }}
              >
                Sección {currentIndex + 1}
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className={cn(
                  "slide-content relative box-border aspect-video w-full shrink-0 overflow-visible rounded-lg border border-stone-200/90 bg-white dark:border-border dark:bg-surface-elevated",
                )}
              >
                <div className="absolute inset-0 z-0 min-h-0 min-w-0">
                  <SlideCanvasSlide />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
