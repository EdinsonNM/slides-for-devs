import {
  ISOMETRIC_VIEWBOX,
  ISO_VIEW_ASPECT,
  ISO_VIEW_MAX_W,
  ISO_VIEW_MIN_W,
} from "../../utils/isometricFlowGeometry";

/** Modelo serializable del diagrama isométrico (estilo infra / FossFLOW). */
export const ISOMETRIC_FLOW_VERSION = 1 as const;

/** Formas visuales del bloque (persistido en JSON). */
export const ISOMETRIC_FLOW_NODE_SHAPES = [
  "slab",
  "cylinder",
  "cone",
  "orb",
  "mobile",
  "desktop",
  "cloud",
  "llm",
  "user",
  "brand",
] as const;

export type IsometricFlowNodeShape = (typeof ISOMETRIC_FLOW_NODE_SHAPES)[number];

const ISOMETRIC_FLOW_NODE_SHAPE_SET = new Set<string>(ISOMETRIC_FLOW_NODE_SHAPES);

function sanitizeNodeShape(raw: unknown): IsometricFlowNodeShape | undefined {
  if (typeof raw !== "string") return undefined;
  return ISOMETRIC_FLOW_NODE_SHAPE_SET.has(raw)
    ? (raw as IsometricFlowNodeShape)
    : undefined;
}

/** Color de trazo por defecto de los conectores (diagrama isométrico). */
export const DEFAULT_ISOMETRIC_LINK_STROKE = "rgb(37 99 235)";

export interface IsometricFlowNode {
  id: string;
  /** Celda en rejilla isométrica (enteros recomendados). */
  gx: number;
  gy: number;
  label: string;
  /** Matiz HSL del bloque (0–360). */
  hue: number;
  /** Silueta del icono (prisma, cilindro, cono, orbe, móvil, PC, nube, LLM, usuario o marca SVG). */
  shape: IsometricFlowNodeShape;
  /**
   * Icono de marca: slug Lobe (`public/lobe-icons/icons/{slug}.svg`), id Google
   * (`public/google-icons/manifest.json`, prefijo `g:`), id AWS
   * (`public/amazon-icons/manifest.json`, prefijo `aws:`), id Simple Icons
   * (`public/simple-icons/manifest.json`, prefijo `si:`) o id Lucide
   * (`public/lucide-icons/manifest.json`, prefijo `li:`).
   */
  iconSlug?: string;
  /**
   * Simple Icons (`si:`) o Lucide (`li:`): sustituye el color por defecto del icono.
   * Formato CSS: `#RRGGBB`, `rgb()` o `hsl()`.
   */
  brandIconColor?: string;
}

/** Desplazamiento en px del punto de ruta (codo o punto medio) respecto a la ortogonal automática. */
export interface IsometricFlowLinkBendOffset {
  x: number;
  y: number;
}

export const ISOMETRIC_LINK_BEND_MAX = 520;

export function clampLinkBendOffset(
  x: number,
  y: number,
): IsometricFlowLinkBendOffset {
  const m = ISOMETRIC_LINK_BEND_MAX;
  return {
    x: Math.max(-m, Math.min(m, x)),
    y: Math.max(-m, Math.min(m, y)),
  };
}

export function sanitizeLinkBendOffset(
  raw: unknown,
): IsometricFlowLinkBendOffset | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.x !== "number" || typeof o.y !== "number") return undefined;
  if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) return undefined;
  const c = clampLinkBendOffset(o.x, o.y);
  if (c.x === 0 && c.y === 0) return undefined;
  return c;
}

/** Esquinas internas de la ruta en celdas isométricas (orden canónico id menor → id mayor). */
export interface IsometricFlowRouteWaypoint {
  gx: number;
  gy: number;
}

const ISOMETRIC_ROUTE_WP_MAX = 32;

export function sanitizeRouteWaypoints(
  raw: unknown,
): IsometricFlowRouteWaypoint[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const out: IsometricFlowRouteWaypoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (
      typeof o.gx !== "number" ||
      typeof o.gy !== "number" ||
      !Number.isFinite(o.gx) ||
      !Number.isFinite(o.gy)
    )
      continue;
    out.push({ gx: Math.round(o.gx), gy: Math.round(o.gy) });
    if (out.length >= ISOMETRIC_ROUTE_WP_MAX) break;
  }
  if (out.length === 0) return undefined;
  return out;
}

export interface IsometricFlowLink {
  id: string;
  from: string;
  to: string;
  /** Color del trazo (CSS: `rgb()`, `#hex`, etc.). */
  stroke?: string;
  /** Si es true, la flecha apunta al nodo `from` en lugar de a `to`. */
  reversed?: boolean;
  /** Estilo de animación del flujo en el conector. */
  animationStyle?: "dash" | "pulse";
  /**
   * Ajuste manual de la ruta: desplaza el codo (o el punto medio si el trazo es recto)
   * en coordenadas de lienzo SVG respecto a la geometría automática.
   */
  bendOffset?: IsometricFlowLinkBendOffset;
  /**
   * Ruta ortogonal explícita en la rejilla (solo esquinas internas, orden canónico).
   * Si existe, sustituye la ruta automática de un codo y el ajuste por `bendOffset`.
   */
  routeWaypoints?: IsometricFlowRouteWaypoint[];
}

/** Extremos efectivos del conector (tiene en cuenta `reversed`). */
export function getResolvedLinkEndpoints(l: IsometricFlowLink): {
  source: string;
  target: string;
} {
  if (l.reversed) return { source: l.to, target: l.from };
  return { source: l.from, target: l.to };
}

export function resolvedLinkKey(l: IsometricFlowLink): string {
  const { source, target } = getResolvedLinkEndpoints(l);
  return `${source}\0${target}`;
}

/**
 * Un solo enlace por sentido efectivo A→B. Evita solapamientos cuando se combinan
 * `reversed` con un segundo tramo creado por «doble sentido».
 * Si `preferId` existe en la lista, ese enlace gana la clave frente a duplicados posteriores.
 */
export function dedupeIsometricFlowLinks(
  links: IsometricFlowLink[],
  preferId?: string,
): IsometricFlowLink[] {
  const ordered =
    preferId != null && links.some((l) => l.id === preferId)
      ? [
          ...links.filter((l) => l.id === preferId),
          ...links.filter((l) => l.id !== preferId),
        ]
      : [...links];
  const seen = new Set<string>();
  const out: IsometricFlowLink[] = [];
  for (const l of ordered) {
    const k = resolvedLinkKey(l);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
}

const LINK_STROKE_MAX = 80;
const BRAND_ICON_COLOR_MAX = 80;

function sanitizeLinkStroke(raw: unknown): string | undefined {
  if (raw == null || typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (s.length === 0 || s.length > LINK_STROKE_MAX) return undefined;
  if (/^#[0-9A-Fa-f]{3,8}$/.test(s)) return s;
  if (/^rgba?\(\s*[\d.\s%,]+\)$/i.test(s)) return s;
  if (/^hsla?\(\s*[\d.\s%,]+\)$/i.test(s)) return s;
  return undefined;
}

export function sanitizeBrandIconColor(raw: unknown): string | undefined {
  if (raw == null || typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (s.length === 0 || s.length > BRAND_ICON_COLOR_MAX) return undefined;
  if (/^#[0-9A-Fa-f]{3,8}$/.test(s)) return s;
  if (/^rgba?\(\s*[\d.\s%,]+\)$/i.test(s)) return s;
  if (/^hsla?\(\s*[\d.\s%,]+\)$/i.test(s)) return s;
  return undefined;
}

export interface IsometricFlowDiagram {
  version: typeof ISOMETRIC_FLOW_VERSION;
  nodes: IsometricFlowNode[];
  links: IsometricFlowLink[];
  /**
   * Encuadre de cámara (viewBox SVG) persistido: zoom y desplazamiento.
   * Si no existe o es el encuadre por defecto, no se serializa en el JSON.
   */
  view?: { x: number; y: number; w: number; h: number };
}

function isDefaultIsoViewForSerialize(v: { x: number; y: number; w: number; h: number }): boolean {
  return (
    Math.abs(v.x) < 0.5 &&
    Math.abs(v.y) < 0.5 &&
    Math.abs(v.w - ISOMETRIC_VIEWBOX.w) < 0.5 &&
    Math.abs(v.h - ISOMETRIC_VIEWBOX.h) < 0.5
  );
}

function sanitizeIsoViewFromJson(
  raw: unknown,
): { x: number; y: number; w: number; h: number } | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (![o.x, o.y, o.w, o.h].every((n) => typeof n === "number" && Number.isFinite(n as number)))
    return undefined;
  const w = Math.max(ISO_VIEW_MIN_W, Math.min(ISO_VIEW_MAX_W, o.w as number));
  const h = w * ISO_VIEW_ASPECT;
  return { x: o.x as number, y: o.y as number, w, h };
}

export function createDefaultIsometricFlowDiagram(): IsometricFlowDiagram {
  return {
    version: ISOMETRIC_FLOW_VERSION,
    nodes: [
      { id: "n1", gx: -1, gy: 0, label: "Sin título", hue: 205, shape: "slab" },
      { id: "n2", gx: 0, gy: 0, label: "Sin título", hue: 208, shape: "slab" },
      { id: "n3", gx: 1, gy: 0, label: "Sin título", hue: 212, shape: "slab" },
    ],
    links: [
      { id: "l1", from: "n1", to: "n2" },
      { id: "l2", from: "n2", to: "n3" },
    ],
  };
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function parseIsometricFlowDiagram(raw: string | undefined | null): IsometricFlowDiagram {
  const fallback = createDefaultIsometricFlowDiagram();
  if (raw == null || raw === "") return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return fallback;
    const o = v as Record<string, unknown>;
    if (o.version !== ISOMETRIC_FLOW_VERSION) return fallback;
    if (!Array.isArray(o.nodes) || !Array.isArray(o.links)) return fallback;
    const nodes: IsometricFlowNode[] = [];
    for (const item of o.nodes) {
      if (!item || typeof item !== "object") continue;
      const n = item as Record<string, unknown>;
      if (typeof n.id !== "string" || !n.id) continue;
      if (!isFiniteNumber(n.gx) || !isFiniteNumber(n.gy)) continue;
      const label = typeof n.label === "string" ? n.label : "Bloque";
      const hue =
        isFiniteNumber(n.hue) ? Math.max(0, Math.min(360, Math.round(n.hue))) : 160;
      const brandIconColor = sanitizeBrandIconColor(n.brandIconColor);
      nodes.push({
        id: n.id,
        gx: Math.round(n.gx),
        gy: Math.round(n.gy),
        label,
        hue,
        shape: sanitizeNodeShape(n.shape) ?? "slab",
        ...(typeof n.iconSlug === "string" && n.iconSlug.trim()
          ? { iconSlug: n.iconSlug.trim().toLowerCase() }
          : {}),
        ...(brandIconColor ? { brandIconColor } : {}),
      });
    }
    const links: IsometricFlowLink[] = [];
    for (const item of o.links) {
      if (!item || typeof item !== "object") continue;
      const l = item as Record<string, unknown>;
      if (typeof l.id !== "string" || !l.id) continue;
      if (typeof l.from !== "string" || typeof l.to !== "string") continue;
      if (l.from === l.to) continue;
      const stroke = sanitizeLinkStroke(l.stroke);
      const reversed =
        l.reversed === true || l.reversed === "true" || l.reversed === 1;
      const bendOffset = sanitizeLinkBendOffset(l.bendOffset);
      const routeWaypoints = sanitizeRouteWaypoints(l.routeWaypoints);
      links.push({
        id: l.id,
        from: l.from,
        to: l.to,
        ...(stroke ? { stroke } : {}),
        ...(reversed ? { reversed: true } : {}),
        ...(l.animationStyle === "pulse" ? { animationStyle: "pulse" } : {}),
        ...(bendOffset ? { bendOffset } : {}),
        ...(routeWaypoints ? { routeWaypoints } : {}),
      });
    }
    if (nodes.length === 0) return fallback;
    const ids = new Set(nodes.map((n) => n.id));
    const filteredLinks = links.filter((l) => ids.has(l.from) && ids.has(l.to));
    const view = sanitizeIsoViewFromJson(o.view);
    return {
      version: ISOMETRIC_FLOW_VERSION,
      nodes,
      links: dedupeIsometricFlowLinks(filteredLinks),
      ...(view ? { view } : {}),
    };
  } catch {
    return fallback;
  }
}

export function serializeIsometricFlowDiagram(d: IsometricFlowDiagram): string {
  const base: IsometricFlowDiagram = {
    version: d.version,
    nodes: d.nodes,
    links: d.links,
  };
  if (d.view && !isDefaultIsoViewForSerialize(d.view)) {
    base.view = d.view;
  }
  return JSON.stringify(base);
}
