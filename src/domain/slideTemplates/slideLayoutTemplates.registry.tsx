import type { ReactElement } from "react";
import { Image as ImageIcon, PencilRuler, Table2 } from "lucide-react";
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
];
