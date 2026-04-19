/** Modelo serializable del diagrama mapa mental. */

export const MIND_MAP_VERSION = 1 as const;

export interface MindMapNode {
  id: string;
  /** Posición X en el lienzo (centro del nodo = 0) */
  x: number;
  /** Posición Y en el lienzo (centro del nodo = 0) */
  y: number;
  label: string;
  /** Color del nodo para su círculo y líneas derivadas (hex o HSL) */
  color: string;
  /** Etiqueta central, rama principal o subparada */
  kind: "root" | "branch" | "leaf";
  /** Si los hijos de este nodo están ocultos */
  collapsed?: boolean;
}

export interface MindMapLink {
  id: string;
  from: string;
  to: string;
}

export interface MindMapDiagram {
  version: typeof MIND_MAP_VERSION;
  nodes: MindMapNode[];
  links: MindMapLink[];
}

export function createDefaultMindMapDiagram(): MindMapDiagram {
  return {
    version: MIND_MAP_VERSION,
    nodes: [
      { id: "root", x: 0, y: 0, label: "Idea Central", color: "#3b82f6", kind: "root" },
      { id: "n1", x: -150, y: -80, label: "Rama 1", color: "#10b981", kind: "branch" },
      { id: "n2", x: 150, y: -80, label: "Rama 2", color: "#f59e0b", kind: "branch" },
      { id: "n3", x: 0, y: 120, label: "Rama 3", color: "#8b5cf6", kind: "branch" },
    ],
    links: [
      { id: "l1", from: "root", to: "n1" },
      { id: "l2", from: "root", to: "n2" },
      { id: "l3", from: "root", to: "n3" },
    ],
  };
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function parseMindMapDiagram(raw: string | undefined | null): MindMapDiagram {
  const fallback = createDefaultMindMapDiagram();
  if (raw == null || raw === "") return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return fallback;
    const o = v as Record<string, unknown>;
    if (o.version !== MIND_MAP_VERSION) return fallback;
    if (!Array.isArray(o.nodes) || !Array.isArray(o.links)) return fallback;
    
    const nodes: MindMapNode[] = [];
    for (const item of o.nodes) {
      if (!item || typeof item !== "object") continue;
      const n = item as Record<string, unknown>;
      if (typeof n.id !== "string" || !n.id) continue;
      if (!isFiniteNumber(n.x) || !isFiniteNumber(n.y)) continue;
      const label = typeof n.label === "string" ? n.label : "Nodo";
      const color = typeof n.color === "string" ? n.color : "#3b82f6";
      const kind = n.kind === "root" || n.kind === "branch" || n.kind === "leaf" ? n.kind : "leaf";
      const collapsed = n.collapsed === true;
      nodes.push({ id: n.id, x: n.x, y: n.y, label, color, kind, collapsed });
    }
    
    const links: MindMapLink[] = [];
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
      version: MIND_MAP_VERSION,
      nodes,
      links: filteredLinks,
    };
  } catch {
    return fallback;
  }
}

export function serializeMindMapDiagram(d: MindMapDiagram): string {
  return JSON.stringify(d);
}
