/** Modelo serializable del diagrama isométrico (estilo infra / FossFLOW). */

export const ISOMETRIC_FLOW_VERSION = 1 as const;

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
      { id: "n1", gx: -1, gy: 0, label: "Cliente", hue: 210 },
      { id: "n2", gx: 0, gy: 0, label: "Servicio", hue: 155 },
      { id: "n3", gx: 1, gy: 0, label: "Datos", hue: 32 },
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
      links.push({ id: l.id, from: l.from, to: l.to });
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
