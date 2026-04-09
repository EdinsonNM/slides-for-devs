/** Modelo serializable del diagrama isométrico (estilo infra / FossFLOW). */

export const ISOMETRIC_FLOW_VERSION = 1 as const;

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
}

export interface IsometricFlowLink {
  id: string;
  from: string;
  to: string;
  /** Color del trazo (CSS: `rgb()`, `#hex`, etc.). */
  stroke?: string;
  /** Si es true, la flecha apunta al nodo `from` en lugar de a `to`. */
  reversed?: boolean;
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
      { id: "n1", gx: -1, gy: 0, label: "Sin título", hue: 205 },
      { id: "n2", gx: 0, gy: 0, label: "Sin título", hue: 208 },
      { id: "n3", gx: 1, gy: 0, label: "Sin título", hue: 212 },
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
      });
    }
    if (nodes.length === 0) return fallback;
    const ids = new Set(nodes.map((n) => n.id));
    const filteredLinks = links.filter((l) => ids.has(l.from) && ids.has(l.to));
    return {
      version: ISOMETRIC_FLOW_VERSION,
      nodes,
      links: filteredLinks,
    };
  } catch {
    return fallback;
  }
}

export function serializeIsometricFlowDiagram(d: IsometricFlowDiagram): string {
  return JSON.stringify(d);
}
