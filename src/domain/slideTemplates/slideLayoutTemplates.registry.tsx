import type { ReactElement } from "react";
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
    <div className="w-full aspect-video bg-linear-to-br from-slate-50 to-sky-50/80 dark:from-stone-900 dark:to-sky-950/40 border border-stone-200 dark:border-border rounded-lg overflow-hidden flex flex-col items-center justify-center gap-1.5 p-2">
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
  return (
    <div className="w-full aspect-video bg-stone-900 border border-stone-200 dark:border-border rounded-lg overflow-hidden relative flex items-center justify-center">
      {/* Curved lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M 50 50 Q 30 70 20 80" fill="none" stroke="#334155" strokeWidth="1" />
        <path d="M 50 50 Q 80 40 90 20" fill="none" stroke="#334155" strokeWidth="1" />
        <path d="M 50 50 Q 20 30 15 20" fill="none" stroke="#334155" strokeWidth="1" />
        <path d="M 50 50 Q 70 80 85 85" fill="none" stroke="#334155" strokeWidth="1" />
      </svg>
      {/* Central Node */}
      <div className="absolute w-5 h-5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] z-10" />
      {/* Leaf Nodes */}
      <div className="absolute w-3 h-3 rounded-full bg-emerald-500 top-[20%] left-[15%] z-10" />
      <div className="absolute w-3 h-3 rounded-full bg-amber-500 top-[80%] left-[20%] z-10" />
      <div className="absolute w-3 h-3 rounded-full bg-purple-500 top-[20%] left-[90%] z-10" />
      <div className="absolute w-3 h-3 rounded-full bg-rose-500 top-[85%] left-[85%] z-10" />
    </div>
  );
}

function PreviewMaps() {
  return (
    <div className="w-full aspect-video rounded-lg border border-stone-200 bg-sky-100/80 dark:border-border dark:bg-sky-950/50 overflow-hidden relative">
      <div className="absolute inset-0 opacity-40 bg-[linear-gradient(105deg,transparent_45%,#0ea5e9_48%,transparent_52%)]" />
      <div className="absolute bottom-2 left-2 right-2 top-6 rounded border border-sky-300/60 bg-sky-50/90 dark:border-sky-700/50 dark:bg-sky-900/40 flex items-end justify-center gap-3 pb-2">
        <MapIcon className="w-4 h-4 text-sky-600 dark:text-sky-400" strokeWidth={2} />
        <div className="h-1 w-8 rounded-full bg-sky-500/50" />
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
