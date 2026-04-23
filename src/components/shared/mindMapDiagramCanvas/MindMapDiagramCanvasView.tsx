import { motion, useReducedMotion } from "motion/react";
import { cn } from "../../../utils/cn";
import { MindMapCanvasSvg } from "./MindMapCanvasSvg";
import { MindMapCanvasToolbar } from "./MindMapCanvasToolbar";
import type { MindMapCanvasProps } from "./useMindMapCanvasController";
import { useMindMapCanvasController } from "./useMindMapCanvasController";

/**
 * Zoom y pan del mapa viven en el SVG (`viewBox`), no en `scale()` CSS:
 * así curvas y círculos siguen siendo vectores nítidos al acercar.
 */
export function MindMapDiagramCanvasView(props: MindMapCanvasProps) {
  const ctrl = useMindMapCanvasController(props);
  const reduced = useReducedMotion() ?? false;

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-slate-50 dark:bg-[#0a0a0e]",
        props.className
      )}
      onWheel={ctrl.handleWheel}
      onPointerDown={ctrl.handlePointerDownBg}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          aria-hidden
          className="absolute top-[-20%] left-[-10%] h-[50%] w-[50%] rounded-full bg-blue-500/10 blur-[100px] mix-blend-multiply dark:bg-blue-500/20 dark:mix-blend-screen"
          animate={reduced ? { opacity: 0.2 } : { scale: [1, 1.04, 1], opacity: [0.12, 0.22, 0.12] }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
          }
        />
        <motion.div
          aria-hidden
          className="absolute right-[-10%] bottom-[-20%] h-[60%] w-[60%] rounded-full bg-purple-500/10 blur-[120px] mix-blend-multiply dark:bg-purple-600/20 dark:mix-blend-screen"
          animate={reduced ? { opacity: 0.2 } : { scale: [1, 1.05, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 16, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 1.5 }
          }
        />
        <motion.div
          aria-hidden
          className="absolute top-[30%] right-[20%] h-[30%] w-[30%] rounded-full bg-emerald-500/5 blur-[80px] mix-blend-multiply dark:bg-emerald-500/10 dark:mix-blend-screen"
          animate={reduced ? { opacity: 0.12 } : { x: [0, 6, 0], y: [0, -4, 0], opacity: [0.06, 0.12, 0.06] }}
          transition={
            reduced
              ? { duration: 0 }
              : { duration: 18, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
          }
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: "radial-gradient(circle at center, transparent 32%, rgba(0,0,0,0.06) 100%)",
        }}
      />

      <div className="absolute inset-0 z-20 h-full w-full">
        <MindMapCanvasSvg ctrl={ctrl} />
      </div>
      <MindMapCanvasToolbar {...ctrl} />
    </div>
  );
}
