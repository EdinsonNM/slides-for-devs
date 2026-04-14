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
   * Icono de marca: slug Lobe (`public/lobe-icons/icons/{slug}.svg`) o id Google
   * (`public/google-icons/manifest.json`, prefijo `g:`).
   */
  iconSlug?: string;
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

function sanitizeLinkStroke(raw: unknown): string | undefined {
  if (raw == null || typeof raw !== "string") return undefined;
  const s = raw.trim();
  if (s.length === 0 || s.length > LINK_STROKE_MAX) return undefined;
  if (/^#[0-9A-Fa-f]{3,8}$/.test(s)) return s;
  if (/^rgba?\(\s*[\d.\s%,]+\)$/i.test(s)) return s;
  if (/^hsla?\(\s*[\d.\s%,]+\)$/i.test(s)) return s;
  return undefined;
}

export interface IsometricFlowDiagram {
  version: typeof ISOMETRIC_FLOW_VERSION;
  nodes: IsometricFlowNode[];
  links: IsometricFlowLink[];
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
      links.push({
        id: l.id,
        from: l.from,
        to: l.to,
        ...(stroke ? { stroke } : {}),
        ...(reversed ? { reversed: true } : {}),
        ...(l.animationStyle === "pulse" ? { animationStyle: "pulse" } : {}),
      });
    }
    if (nodes.length === 0) return fallback;
    const ids = new Set(nodes.map((n) => n.id));
    const filteredLinks = links.filter((l) => ids.has(l.from) && ids.has(l.to));
    return {
      version: ISOMETRIC_FLOW_VERSION,
      nodes,
      links: dedupeIsometricFlowLinks(filteredLinks),
    };
  } catch {
    return fallback;
  }
}

export function serializeIsometricFlowDiagram(d: IsometricFlowDiagram): string {
  return JSON.stringify(d);
}
