import type { CSSProperties } from "react";
import {
  Box,
  Circle,
  Cloud,
  Database,
  Image as ImageIcon,
  Monitor,
  Smartphone,
  Triangle,
} from "lucide-react";
import { ISOMETRIC_VIEWBOX } from "../../../utils/isometricFlowGeometry";
import type { IsometricFlowNodeShape } from "../../../domain/entities/IsometricFlowDiagram";

export const CELL = 54;
export const ORIGIN_X = ISOMETRIC_VIEWBOX.w / 2;
export const ORIGIN_Y = ISOMETRIC_VIEWBOX.h / 2 + 28;
/** Distancia del pie del bloque al centro de la tapa (conectores / tallo de etiqueta). */
export const SLAB_TOP_RISE = 11;
/** Rombo del pie / tapa: 0.5 = una celda de rejilla entre vértices opuestos. */
export const SLAB_FOOT_HALF = 0.5;
export const SLAB_TOP_HALF = 0.48;
/** Separación vertical pie → parte inferior de la etiqueta. */
export const LABEL_STACK = 52;
export const LABEL_PILL_H = 22;
export const LABEL_PILL_PAD_X = 10;
export const HIT_R = 42;
export const LINK_HIT_PX = 11;
export const LINK_SEG_HIT_STROKE = 22;
export const ARROW_TRIM = 13;
export const ARROW_SIZE = 9.5;
export const FLOW_DASH_LENGTH = 7;
export const FLOW_DASH_GAP = 9;
export const FLOW_DASH_SPAN = FLOW_DASH_LENGTH + FLOW_DASH_GAP;
export const FLOW_ANIMATION_SEC = 1.15;
/** Miniaturas por página en el selector (evita miles de etiquetas img a la vez). */
export const ICON_PICKER_PAGE_SIZE = 140;
/** Tinte por defecto para iconos Lucide (`li:`) en el lienzo y en el selector. */
export const LUCIDE_BRAND_ICON_FILL = "#475569";

export const PICKER_MASK_THUMB_STYLE: CSSProperties = {
  maskSize: "contain",
  WebkitMaskSize: "contain",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskPosition: "center",
  WebkitMaskPosition: "center",
  maskMode: "alpha",
  WebkitMaskMode: "alpha",
};

export const LINK_COLOR_PRESETS = [
  { label: "Azul", stroke: "rgb(37 99 235)", swatch: "rgb(37, 99, 235)" },
  { label: "Verde", stroke: "rgb(22 163 74)", swatch: "rgb(22, 163, 74)" },
  { label: "Ámbar", stroke: "rgb(217 119 6)", swatch: "rgb(217, 119, 6)" },
  { label: "Rosa", stroke: "rgb(225 29 72)", swatch: "rgb(225, 29, 72)" },
  { label: "Pizarra", stroke: "rgb(71 85 105)", swatch: "rgb(71, 85, 105)" },
] as const;

export type BrandIconPack = "google" | "amazon" | "simpleicons" | "lucide" | "lobe";

export type IconPickerPackFilter = "all" | BrandIconPack;

export const ICON_PICKER_PACK_FILTERS: {
  id: IconPickerPackFilter;
  label: string;
  aria: string;
}[] = [
  { id: "all", label: "Todos", aria: "Mostrar iconos de todos los packs" },
  { id: "google", label: "Google Cloud", aria: "Solo pictogramas Google Cloud" },
  { id: "amazon", label: "AWS", aria: "Solo iconos Amazon Web Services" },
  { id: "simpleicons", label: "Simple Icons", aria: "Solo iconos Simple Icons" },
  { id: "lucide", label: "Lucide", aria: "Solo iconos Lucide" },
  { id: "lobe", label: "Lobe Icons", aria: "Solo iconos Lobe" },
];

export function iconPickerPackChipClasses(id: IconPickerPackFilter, active: boolean): string {
  if (!active) {
    return "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700";
  }
  switch (id) {
    case "all":
      return "border-stone-500 bg-stone-200 text-stone-900 dark:border-stone-500 dark:bg-stone-700 dark:text-stone-100";
    case "google":
      return "border-sky-500 bg-sky-100 text-sky-950 dark:border-sky-500 dark:bg-sky-950/70 dark:text-sky-100";
    case "amazon":
      return "border-amber-500 bg-amber-100 text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50";
    case "simpleicons":
      return "border-emerald-500 bg-emerald-100 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-50";
    case "lucide":
      return "border-rose-500 bg-rose-100 text-rose-950 dark:border-rose-500 dark:bg-rose-950/50 dark:text-rose-50";
    case "lobe":
      return "border-violet-500 bg-violet-100 text-violet-950 dark:border-violet-500 dark:bg-violet-950/50 dark:text-violet-50";
    default:
      return "";
  }
}

export type BrandIconCatalogEntry = {
  id: string;
  label: string;
  href: string;
  pack: BrandIconPack;
  /** Carpeta / familia dentro del pack (p. ej. «Storage», «Analytics»). */
  category: string;
};

export const NODE_SHAPE_TOOLBAR: {
  value: IsometricFlowNodeShape;
  label: string;
  Icon: typeof Box;
}[] = [
  { value: "slab", label: "Losa (bloque)", Icon: Box },
  { value: "cylinder", label: "Cilindro (servicio / BD)", Icon: Database },
  { value: "cone", label: "Cono (evento / alerta)", Icon: Triangle },
  { value: "orb", label: "Orbe (nodo / estado)", Icon: Circle },
  { value: "mobile", label: "Móvil", Icon: Smartphone },
  { value: "desktop", label: "PC / escritorio", Icon: Monitor },
  { value: "cloud", label: "Nube", Icon: Cloud },
  { value: "brand", label: "Marca (SVG)", Icon: ImageIcon },
];

export const MARQUEE_ACTIVATE_PX = 5;

export type IsoViewRect = { x: number; y: number; w: number; h: number };

export const ISO_VIEW_ASPECT = ISOMETRIC_VIEWBOX.h / ISOMETRIC_VIEWBOX.w;
/** Zoom máximo (vista más cercana). */
export const ISO_VIEW_MIN_W = 72;
/** No ampliar el encuadre más allá del lienzo completo. */
export const ISO_VIEW_MAX_W = ISOMETRIC_VIEWBOX.w;
