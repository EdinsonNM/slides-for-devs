import { Film } from "lucide-react";
import { usePresentation } from "../../presentation/contexts/PresentationContext";
import { useMinWidthLg } from "../../presentation/hooks/global/useMatchMedia";
import { cn } from "../../utils/cn";
import type { Slide } from "../../types";
import {
  SlideRivePlayer,
  riveStateMachinesFromStoredNames,
} from "../shared/SlideRivePlayer";

export interface RivePanelProps {
  canvasPanelSlide?: Slide;
}

export function RivePanel({ canvasPanelSlide }: RivePanelProps = {}) {
  const { currentSlide } = usePresentation();
  const isLgUp = useMinWidthLg();

  if (!currentSlide) return null;

  const slide = canvasPanelSlide ?? currentSlide;
  const src = slide.riveUrl?.trim() ?? "";
  const smKey = slide.riveStateMachineNames ?? "";
  const abKey = slide.riveArtboard ?? "";

  const outerFill =
    "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden";

  if (src) {
    return (
      <div
        className={cn(
          outerFill,
          "h-full bg-transparent",
          isLgUp ? "p-0" : "p-3",
        )}
      >
        <div className="relative flex min-h-0 w-full flex-1 overflow-hidden rounded-2xl border border-stone-200/40 bg-transparent dark:border-border/60">
          <SlideRivePlayer
            key={`${src}\0${smKey}\0${abKey}`}
            src={src}
            artboard={slide.riveArtboard?.trim() || undefined}
            stateMachines={riveStateMachinesFromStoredNames(
              slide.riveStateMachineNames,
            )}
            className="h-full w-full min-h-[120px] bg-transparent touch-manipulation"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        outerFill,
        "h-full items-center justify-center bg-white dark:bg-surface",
        isLgUp ? "p-0" : "p-4",
      )}
    >
      <div className="flex max-w-sm flex-col items-center gap-4 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 text-rose-300 dark:bg-rose-950/40 dark:text-rose-500/80">
          <Film size={40} strokeWidth={1.25} aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
            Panel Rive
          </p>
          <p className="text-xs leading-relaxed text-stone-400 dark:text-stone-500">
            Abre el inspector derecho en{" "}
            <span className="font-medium text-stone-500 dark:text-stone-400">
              Rive
            </span>{" "}
            y carga un archivo <span className="font-mono">.riv</span>, o cambia
            este bloque a tipo Rive desde la barra inferior del lienzo.
          </p>
        </div>
      </div>
    </div>
  );
}
