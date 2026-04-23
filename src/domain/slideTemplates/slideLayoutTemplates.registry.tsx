import type { ReactElement } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Boxes, Image as ImageIcon, Map as MapIcon, PencilRuler, Table2 } from "lucide-react";
import {
  SLIDE_LAYOUT_TEMPLATE_ID,
  type SlideLayoutTemplateId,
} from "./slideLayoutTemplateIds";

function PreviewTitle() {
  return (
    <div className="w-full aspect-video bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg overflow-hidden flex items-center justify-center p-1">
      <div className="w-3/4 h-2 bg-stone-300 dark:bg-stone-600 rounded" />
    </div>
  );
}

function PreviewContentSplit() {
  return (
    <div className="w-full aspect-video bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg overflow-hidden flex p-0.5 gap-0.5">
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="h-1.5 w-2/3 bg-stone-300 dark:bg-stone-600 rounded" />
        <div className="h-1 w-full bg-stone-100 dark:bg-stone-700 rounded" />
        <div className="h-1 w-full bg-stone-100 dark:bg-stone-700 rounded" />
        <div className="h-1 w-4/5 bg-stone-100 dark:bg-stone-700 rounded" />
      </div>
      <div className="w-1/3 bg-stone-100 dark:bg-stone-700 rounded flex items-center justify-center">
        <div className="w-full aspect-square max-w-[80%] bg-stone-200 dark:bg-stone-600 rounded" />
      </div>
    </div>
  );
}

function PreviewContentFull() {
  return (
    <div className="w-full aspect-video bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg overflow-hidden flex flex-col p-0.5 gap-1">
      <div className="h-1.5 w-2/3 bg-stone-300 dark:bg-stone-600 rounded shrink-0" />
      <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-700 rounded shrink-0" />
      <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-700 rounded shrink-0" />
      <div className="h-1.5 w-4/5 bg-stone-100 dark:bg-stone-700 rounded shrink-0" />
      <div className="h-1.5 w-3/4 bg-stone-100 dark:bg-stone-700 rounded shrink-0" />
    </div>
  );
}

function PreviewContentPanelFull() {
  return (
    <div className="w-full aspect-video bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg overflow-hidden flex flex-col p-0.5 gap-1">
      <div className="h-1.5 w-3/4 bg-stone-300 dark:bg-stone-600 rounded shrink-0" />
      <div className="flex-1 min-h-0 bg-stone-100 dark:bg-stone-700 rounded flex items-center justify-center p-1">
        <div className="w-full h-full rounded border border-dashed border-stone-300 dark:border-stone-600 flex items-center justify-center bg-stone-50 dark:bg-stone-800">
          <ImageIcon className="w-5 h-5 text-stone-400 dark:text-stone-500" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

function PreviewDiagram() {
  return (
    <div className="w-full aspect-video bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg overflow-hidden flex items-center justify-center p-1">
      <div className="w-full h-full border border-dashed border-stone-300 dark:border-stone-600 rounded flex items-center justify-center">
        <PencilRuler className="w-6 h-6 text-stone-400 dark:text-stone-500" />
      </div>
    </div>
  );
}

function PreviewIsometricFlow() {
  return (
    <div className="w-full aspect-video bg-linear-to-br from-[rgb(246_246_246)] to-[rgb(245_245_240)] dark:from-[rgb(28_28_28)] dark:to-[rgb(23_23_23)] border border-stone-200 dark:border-border rounded-lg overflow-hidden flex flex-col items-center justify-center gap-1.5 p-2">
      <div className="flex items-end justify-center -space-x-1">
        <div
          className="h-3 w-3.5 rounded-[2px] bg-sky-400/90 shadow-sm dark:bg-sky-600"
          style={{ transform: "skewX(-18deg) translateY(2px)" }}
        />
        <div
          className="h-3.5 w-4 rounded-[2px] bg-emerald-500/95 shadow dark:bg-emerald-600 z-[1]"
          style={{ transform: "skewX(-18deg)" }}
        />
        <div
          className="h-3 w-3.5 rounded-[2px] bg-amber-400/90 shadow-sm dark:bg-amber-600"
          style={{ transform: "skewX(-18deg) translateY(2px)" }}
        />
      </div>
      <Boxes className="w-5 h-5 text-stone-400 dark:text-stone-500" strokeWidth={1.5} />
    </div>
  );
}

function PreviewMindMap() {
  const reduced = useReducedMotion() ?? false;
  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-stone-200 bg-stone-900 dark:border-border">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <path
          d="M 50 50 Q 30 70 20 80"
          fill="none"
          className="stroke-slate-600/90"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M 50 50 Q 80 40 90 20"
          fill="none"
          className="stroke-slate-600/90"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M 50 50 Q 20 30 15 20"
          fill="none"
          className="stroke-slate-600/90"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M 50 50 Q 70 80 85 85"
          fill="none"
          className="stroke-slate-600/90"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
      <motion.div
        className="absolute top-1/2 left-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500"
        style={{ boxShadow: "0 0 12px rgba(59,130,246,0.55)" }}
        animate={reduced ? { opacity: 1 } : { scale: [1, 1.06, 1], boxShadow: ["0 0 8px rgba(59,130,246,0.4)", "0 0 16px rgba(59,130,246,0.75)", "0 0 8px rgba(59,130,246,0.4)"] }}
        transition={reduced ? { duration: 0 } : { duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      {[
        { c: "bg-emerald-500", pos: "top-[20%] left-[15%]" },
        { c: "bg-amber-500", pos: "top-[80%] left-[20%]" },
        { c: "bg-purple-500", pos: "top-[20%] left-[90%]" },
        { c: "bg-rose-500", pos: "top-[85%] left-[85%]" },
      ].map((o, i) => (
        <motion.div
          key={i}
          className={`z-10 absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${o.c} ${o.pos}`}
          initial={reduced ? false : { scale: 0, opacity: 0 }}
          animate={reduced ? { scale: 1, opacity: 1 } : { scale: 1, opacity: [0.72, 1, 0.72] }}
          transition={
            reduced
              ? { duration: 0 }
              : {
                  type: "spring" as const,
                  stiffness: 360,
                  damping: 20,
                  delay: 0.1 + i * 0.05,
                  opacity: {
                    duration: 2.4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                    delay: 0.2 * i,
                  },
                }
          }
        />
      ))}
    </div>
  );
}

function PreviewMaps() {
  return (
    <div className="w-full aspect-video rounded-lg border border-stone-200 bg-stone-100/90 dark:border-border dark:bg-background overflow-hidden relative">
      <div className="absolute inset-0 opacity-35 bg-[linear-gradient(105deg,transparent_45%,rgb(20_184_166/0.35)_48%,transparent_52%)] dark:opacity-25" />
      <div className="absolute bottom-2 left-2 right-2 top-6 rounded border border-stone-300/70 bg-white/90 dark:border-border dark:bg-surface-elevated/60 flex items-end justify-center gap-3 pb-2">
        <MapIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" strokeWidth={2} />
        <div className="h-1 w-8 rounded-full bg-stone-400/50 dark:bg-stone-500/45" />
        <div className="size-2 rounded-full bg-emerald-500 shadow-sm" />
      </div>
    </div>
  );
}

function PreviewMatrix() {
  return (
    <div className="w-full aspect-video bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg overflow-hidden flex flex-col p-1 gap-0.5">
      <div className="h-1 w-1/2 bg-stone-300 dark:bg-stone-600 rounded shrink-0" />
      <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-2 gap-0.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-sm bg-stone-100 dark:bg-stone-700 border border-stone-200/80 dark:border-stone-600"
          />
        ))}
      </div>
      <div className="flex justify-center shrink-0 pt-0.5">
        <Table2 className="w-4 h-4 text-stone-400 dark:text-stone-500" strokeWidth={1.5} />
      </div>
    </div>
  );
}

export interface SlideLayoutTemplateDefinition {
  id: SlideLayoutTemplateId;
  label: string;
  Preview: () => ReactElement;
}

/** Orden de las miniaturas en el panel de plantillas (única fuente de verdad del catálogo). */
export const SLIDE_LAYOUT_TEMPLATE_REGISTRY: readonly SlideLayoutTemplateDefinition[] = [
  { id: SLIDE_LAYOUT_TEMPLATE_ID.TITLE, label: "Título", Preview: PreviewTitle },
  {
    id: SLIDE_LAYOUT_TEMPLATE_ID.CONTENT_SPLIT,
    label: "Contenido (con panel)",
    Preview: PreviewContentSplit,
  },
  {
    id: SLIDE_LAYOUT_TEMPLATE_ID.CONTENT_FULL,
    label: "Contenido (solo texto)",
    Preview: PreviewContentFull,
  },
  {
    id: SLIDE_LAYOUT_TEMPLATE_ID.CONTENT_PANEL_FULL,
    label: "Título + panel",
    Preview: PreviewContentPanelFull,
  },
  { id: SLIDE_LAYOUT_TEMPLATE_ID.MATRIX, label: "Tabla / matriz", Preview: PreviewMatrix },
  { id: SLIDE_LAYOUT_TEMPLATE_ID.DIAGRAM, label: "Diagrama", Preview: PreviewDiagram },
  {
    id: SLIDE_LAYOUT_TEMPLATE_ID.ISOMETRIC_FLOW,
    label: "Isométrico (infra)",
    Preview: PreviewIsometricFlow,
  },
  {
    id: SLIDE_LAYOUT_TEMPLATE_ID.MIND_MAP,
    label: "Mapa Mental",
    Preview: PreviewMindMap,
  },
  {
    id: SLIDE_LAYOUT_TEMPLATE_ID.MAPS,
    label: "Mapas",
    Preview: PreviewMaps,
  },
];
