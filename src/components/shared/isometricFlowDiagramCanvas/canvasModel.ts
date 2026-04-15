import {
  DEFAULT_ISOMETRIC_LINK_STROKE,
  getResolvedLinkEndpoints,
  type IsometricFlowLink,
  type IsometricFlowNode,
} from "../../../domain/entities/IsometricFlowDiagram";
import {
  ISOMETRIC_VIEWBOX,
  canvasToIsoGridFloat,
  isoDiamondAroundPoint,
  isoOrthogonalLinkPoints,
  isoStepGx,
  nodeFoot,
  nodeSlabTop,
  polygonPath,
} from "../../../utils/isometricFlowGeometry";
import {
  CELL,
  LABEL_PILL_H,
  LABEL_PILL_PAD_X,
  LABEL_STACK,
  ORIGIN_X,
  ORIGIN_Y,
  SLAB_FOOT_HALF,
  SLAB_TOP_HALF,
  SLAB_TOP_RISE,
  ISO_VIEW_ASPECT,
  ISO_VIEW_MAX_W,
  ISO_VIEW_MIN_W,
  type BrandIconCatalogEntry,
  type BrandIconPack,
  type IconPickerPackFilter,
  type IsoViewRect,
} from "./constants";

export function packSortOrder(p: BrandIconPack): number {
  if (p === "google") return 0;
  if (p === "amazon") return 1;
  if (p === "simpleicons") return 2;
  if (p === "lucide") return 3;
  return 4;
}

export function sortBrandIconCatalog(entries: BrandIconCatalogEntry[]): BrandIconCatalogEntry[] {
  return [...entries].sort(
    (a, b) =>
      packSortOrder(a.pack) - packSortOrder(b.pack) ||
      a.label.localeCompare(b.label, "es", { sensitivity: "base" }) ||
      a.id.localeCompare(b.id),
  );
}

export function sortBrandIconCatalogByCategory(entries: BrandIconCatalogEntry[]): BrandIconCatalogEntry[] {
  return [...entries].sort(
    (a, b) =>
      packSortOrder(a.pack) - packSortOrder(b.pack) ||
      a.category.localeCompare(b.category, "es", { sensitivity: "base" }) ||
      a.label.localeCompare(b.label, "es", { sensitivity: "base" }) ||
      a.id.localeCompare(b.id),
  );
}

export function packShortLabel(p: BrandIconPack): string {
  if (p === "google") return "Google Cloud";
  if (p === "amazon") return "AWS";
  if (p === "simpleicons") return "Simple Icons";
  if (p === "lucide") return "Lucide";
  return "Lobe Icons";
}

/** Encabezado de subgrupo: carpeta del manifiesto; si hay varios packs, se antepone el nombre del pack. */
export function iconPickerGroupHeading(entry: BrandIconCatalogEntry, packFilter: IconPickerPackFilter): string {
  if (packFilter !== "all") return entry.category;
  return `${packShortLabel(entry.pack)} · ${entry.category}`;
}

export function groupIconPickerEntriesByHeading(
  entries: BrandIconCatalogEntry[],
  packFilter: IconPickerPackFilter,
): { heading: string; entries: BrandIconCatalogEntry[] }[] {
  const map = new Map<string, BrandIconCatalogEntry[]>();
  const order: string[] = [];
  for (const e of entries) {
    const h = iconPickerGroupHeading(e, packFilter);
    if (!map.has(h)) {
      map.set(h, []);
      order.push(h);
    }
    map.get(h)!.push(e);
  }
  return order.map((heading) => ({ heading, entries: map.get(heading)! }));
}

export function categoryFromRelativePath(relPath: string, fallback: string): string {
  const seg = relPath.split("/").filter(Boolean)[0];
  return seg && seg.length > 0 ? seg : fallback;
}

export function hslFill(h: number, s: number, l: number) {
  return `hsl(${h} ${s}% ${l}%)`;
}

/** Normaliza hex de Simple Icons (`ABC` o `#abc`) a `#rrggbb` para `<input type="color">` y `fill`. */
export function normalizeSimpleIconHex(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  let t = raw.trim();
  if (!t) return undefined;
  if (t.startsWith("#")) t = t.slice(1);
  if (!/^[0-9A-Fa-f]{3}$/.test(t) && !/^[0-9A-Fa-f]{6}$/.test(t)) return undefined;
  if (t.length === 3) {
    const a = t[0]!;
    const b = t[1]!;
    const c = t[2]!;
    t = `${a}${a}${b}${b}${c}${c}`;
  }
  return `#${t.toLowerCase()}`;
}

/** Prisma isométrico alineado a la cuadrícula (pie + caras + tapa). */
export function isoSlabPrismPaths(cx: number, cy: number, cell: number, rise: number, hue: number) {
  const footVerts = isoDiamondAroundPoint(cx, cy, cell, SLAB_FOOT_HALF);
  const topVerts = isoDiamondAroundPoint(cx, cy - rise, cell, SLAB_TOP_HALF);
  const stroke = "rgba(30, 64, 175, 0.28)";
  const sides = [0, 1, 2, 3].map((i) => {
    const a = footVerts[i]!;
    const b = footVerts[(i + 1) % 4]!;
    const c = topVerts[(i + 1) % 4]!;
    const d = topVerts[i]!;
    return `M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y} L ${d.x} ${d.y} Z`;
  });
  const sideFills = [
    hslFill(hue, 48, 71),
    hslFill(hue, 50, 80),
    hslFill(hue, 47, 73),
    hslFill(hue, 49, 78),
  ];
  return {
    footPath: polygonPath(footVerts),
    topPath: polygonPath(topVerts),
    sides,
    sideFills,
    topFill: hslFill(hue, 55, 91),
    footFill: hslFill(hue, 52, 86),
    stroke,
    footVerts,
    topVerts,
  };
}

export function isoCylinderBody(
  cx: number,
  cy: number,
  cell: number,
  rise: number,
  hue: number,
): {
  bodyPath: string;
  topFill: string;
  sideFill: string;
  stroke: string;
  erx: number;
  ery: number;
  ty: number;
} {
  const gx = isoStepGx(cell);
  const erx = SLAB_TOP_HALF * gx.x;
  const ery = SLAB_TOP_HALF * gx.y;
  const ty = cy - rise;
  const stroke = "rgba(30, 64, 175, 0.28)";
  const sideFill = hslFill(hue, 49, 72);
  const topFill = hslFill(hue, 55, 91);
  const bodyPath = `M ${cx - erx} ${cy} A ${erx} ${ery} 0 0 1 ${cx + erx} ${cy} L ${cx + erx} ${ty} A ${erx} ${ery} 0 0 0 ${cx - erx} ${ty} Z`;
  return { bodyPath, topFill, sideFill, stroke, erx, ery, ty };
}

export function isoConeFaces(
  cx: number,
  cy: number,
  cell: number,
  rise: number,
  hue: number,
  apex: { x: number; y: number },
): { ordered: { d: string; fill: string }[]; stroke: string; footPath: string } {
  const footVerts = isoDiamondAroundPoint(cx, cy, cell, SLAB_FOOT_HALF);
  const stroke = "rgba(30, 64, 175, 0.28)";
  const footPath = polygonPath(footVerts);
  const faces = [0, 1, 2, 3].map((i) => {
    const a = footVerts[i]!;
    const b = footVerts[(i + 1) % 4]!;
    const d = `M ${a.x} ${a.y} L ${b.x} ${b.y} L ${apex.x} ${apex.y} Z`;
    const fill = hslFill(hue, 50, 66 + (i % 2) * 8);
    const minY = Math.min(a.y, b.y, apex.y);
    return { d, fill, minY };
  });
  faces.sort((p, q) => p.minY - q.minY);
  return {
    ordered: faces.map(({ d, fill }) => ({ d, fill })),
    stroke,
    footPath,
  };
}

/**
 * Franja vertical para nube y orbe (más alta que el prisma base).
 */
export function isoDeviceGlyphExtent(cy: number, topPtY: number): { yTop: number; yBot: number } {
  const yBot = cy - 4;
  const minH = CELL * 0.48;
  const yTop = Math.min(topPtY - 16, yBot - minH);
  return { yTop, yBot };
}

/** Marca (esfera + SVG): franja un poco más alta que nube/orbe para icono legible. */
export function isoBrandGlyphExtent(cy: number, topPtY: number): { yTop: number; yBot: number } {
  const yBot = cy - 4;
  const minH = CELL * 0.58;
  const yTop = Math.min(topPtY - 16, yBot - minH);
  return { yTop, yBot };
}

/** Móvil: más alto y ancho que la franja genérica. */
export function isoMobileGlyphExtent(cy: number, topPtY: number): { yTop: number; yBot: number } {
  const yBot = cy - 3;
  const minH = CELL * 0.64;
  const yTop = Math.min(topPtY - 24, yBot - minH);
  return { yTop, yBot };
}

/** Monitor de escritorio: proporción ancho/alto ~1,5 (evita “ultra‑ancho” aplastado). */
export function isoDesktopMonitorLayout(cx: number, cy: number, topPtY: number): {
  stroke: string;
  stemY: number;
  hw: number;
  yScreenTop: number;
  yScreenBot: number;
  screenH: number;
  standPath: string;
  baseX: number;
  baseY: number;
  baseW: number;
  baseH: number;
} {
  const stroke = "rgba(30, 64, 175, 0.28)";
  const screenH = CELL * 0.46;
  const aspect = 1.48;
  const hw = (screenH * aspect) / 2;
  const standH = CELL * 0.095;
  const yClusterBot = cy - 4;
  const yStandBot = yClusterBot;
  const yStandTop = yStandBot - standH;
  const yScreenBot = yStandTop;
  const yScreenTop = yScreenBot - screenH;
  const stemY = Math.min(topPtY - 2, yScreenTop - 2);
  const neckW = Math.max(5, hw * 0.22);
  const standPath = `M ${cx - hw * 0.92} ${yStandBot} L ${cx - neckW} ${yStandTop} L ${cx + neckW} ${yStandTop} L ${cx + hw * 0.92} ${yStandBot} Z`;
  const baseW = Math.min(CELL * 0.36, hw * 1.85);
  return {
    stroke,
    stemY,
    hw,
    yScreenTop,
    yScreenBot,
    screenH,
    standPath,
    baseX: cx - baseW / 2,
    baseY: yStandBot,
    baseW,
    baseH: Math.min(4.5, cy - yStandBot - 1),
  };
}

/** Silueta de nube (SVG), centrada en `cx` y entre `topY` y `botY`. */
export function isoCloudGlyphPath(cx: number, topY: number, botY: number): string {
  const mid = (topY + botY) / 2 - 1;
  const s = CELL * 0.095;
  return [
    `M ${cx - 4.2 * s} ${mid + 0.45 * s}`,
    `C ${cx - 4.6 * s} ${mid - 0.9 * s} ${cx - 2.9 * s} ${mid - 2.1 * s} ${cx - 1.1 * s} ${mid - 1.75 * s}`,
    `C ${cx - 0.45 * s} ${mid - 2.95 * s} ${cx + 1.55 * s} ${mid - 3.05 * s} ${cx + 2.5 * s} ${mid - 1.55 * s}`,
    `C ${cx + 4.15 * s} ${mid - 1.95 * s} ${cx + 5.55 * s} ${mid + 0.15 * s} ${cx + 4.85 * s} ${mid + 1.45 * s}`,
    `C ${cx + 5 * s} ${mid + 2.75 * s} ${cx + 3.45 * s} ${mid + 3.25 * s} ${cx + 1.75 * s} ${mid + 2.85 * s}`,
    `C ${cx + 0.4 * s} ${mid + 3.45 * s} ${cx - 1.85 * s} ${mid + 3.35 * s} ${cx - 3 * s} ${mid + 2.15 * s}`,
    `C ${cx - 4.75 * s} ${mid + 2.55 * s} ${cx - 5.15 * s} ${mid + 1.05 * s} ${cx - 4.2 * s} ${mid + 0.45 * s}`,
    "Z",
  ].join(" ");
}

export function linkStroke(l: IsometricFlowLink): string {
  return l.stroke ?? DEFAULT_ISOMETRIC_LINK_STROKE;
}

export type IsoGridPoint = { gx: number; gy: number };

export function dedupeIsoGridPath(points: IsoGridPoint[]): IsoGridPoint[] {
  const out: IsoGridPoint[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && prev.gx === p.gx && prev.gy === p.gy) continue;
    out.push({ gx: p.gx, gy: p.gy });
  }
  return out;
}

export function isoGridOrthogonalOk(seq: IsoGridPoint[]): boolean {
  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i]!;
    const b = seq[i + 1]!;
    if (a.gx !== b.gx && a.gy !== b.gy) return false;
  }
  return true;
}

export function classifyIsoCanonicalPath(
  g: IsoGridPoint[],
): "line" | "lGx" | "lGy" | "corridorGx" | "corridorGy" | "other" {
  if (g.length < 2) return "other";
  if (g.length === 2) return "line";
  const s = g[0]!;
  const t = g[g.length - 1]!;
  if (g.length === 3) {
    const w = g[1]!;
    if (w.gy === s.gy && w.gx === t.gx && s.gx !== t.gx && s.gy !== t.gy) return "lGx";
    if (w.gx === s.gx && w.gy === t.gy && s.gx !== t.gx && s.gy !== t.gy) return "lGy";
    return "other";
  }
  if (g.length === 4) {
    const a = g[0]!;
    const b = g[1]!;
    const c = g[2]!;
    const d = g[3]!;
    if (a.gy === b.gy && b.gy === c.gy && b.gx !== c.gx && c.gx === d.gx) return "corridorGx";
    if (a.gx === b.gx && b.gx !== c.gx && b.gy === c.gy && c.gx === d.gx && d.gy !== b.gy)
      return "corridorGy";
  }
  return "other";
}

export function defaultRouteInternals(s: IsoGridPoint, t: IsoGridPoint): IsoGridPoint[] {
  const dgx = t.gx - s.gx;
  const dgy = t.gy - s.gy;
  if (dgx === 0 || dgy === 0) return [];
  return [{ gx: t.gx, gy: s.gy }];
}

export function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Arrastra tramos internos (no tocan los extremos S/T). */
export function applyIsoLinkUniDrag(
  g: IsoGridPoint[],
  canonicalSegIndex: number,
  sfx: number,
  sfy: number,
): IsoGridPoint[] | null {
  const n = g.length;
  if (n < 4) return null;
  const si = canonicalSegIndex;
  if (si <= 0 || si >= n - 2) return null;
  const A = g[si]!;
  const B = g[si + 1]!;
  const loYB = Math.min(...g.map((p) => p.gy)) - 40;
  const hiYB = Math.max(...g.map((p) => p.gy)) + 40;
  const loXB = Math.min(...g.map((p) => p.gx)) - 40;
  const hiXB = Math.max(...g.map((p) => p.gx)) + 40;
  const out = [...g];
  if (A.gy === B.gy && A.gx !== B.gx) {
    const ng = clampInt(Math.round(sfy), loYB, hiYB);
    out[si] = { gx: A.gx, gy: ng };
    out[si + 1] = { gx: B.gx, gy: ng };
    if (!isoGridOrthogonalOk(out)) return null;
    return dedupeIsoGridPath(out);
  }
  if (A.gx === B.gx && A.gy !== B.gy) {
    const ng = clampInt(Math.round(sfx), loXB, hiXB);
    out[si] = { gx: ng, gy: A.gy };
    out[si + 1] = { gx: ng, gy: B.gy };
    if (!isoGridOrthogonalOk(out)) return null;
    return dedupeIsoGridPath(out);
  }
  return null;
}

export function applyIsoLinkCanonicalDrag(
  g: IsoGridPoint[],
  canonicalSegIndex: number,
  sfx: number,
  sfy: number,
): IsoGridPoint[] | null {
  const kind = classifyIsoCanonicalPath(g);
  const s = g[0]!;
  const t = g[g.length - 1]!;
  const nseg = g.length - 1;
  if (canonicalSegIndex < 0 || canonicalSegIndex >= nseg) return null;

  const loX = Math.min(s.gx, t.gx);
  const hiX = Math.max(s.gx, t.gx);
  const loY = Math.min(s.gy, t.gy);
  const hiY = Math.max(s.gy, t.gy);

  if (kind === "line") return null;

  if (kind === "lGx") {
    if (canonicalSegIndex === 0) {
      const k = clampInt(Math.round(sfx), loX, hiX);
      if (k === t.gx) return dedupeIsoGridPath([s, { gx: t.gx, gy: s.gy }, t]);
      return dedupeIsoGridPath([s, { gx: k, gy: s.gy }, { gx: t.gx, gy: s.gy }, t]);
    }
    if (canonicalSegIndex === 1) {
      const k = clampInt(Math.round(sfy), loY, hiY);
      if (k === s.gy) return dedupeIsoGridPath([s, { gx: t.gx, gy: s.gy }, t]);
      return dedupeIsoGridPath([s, { gx: s.gx, gy: k }, { gx: t.gx, gy: k }, t]);
    }
    return null;
  }
  if (kind === "lGy") {
    if (canonicalSegIndex === 0 || canonicalSegIndex === 1) {
      const k = clampInt(Math.round(sfy), loY, hiY);
      if (k === t.gy) return dedupeIsoGridPath([s, { gx: s.gx, gy: t.gy }, t]);
      return dedupeIsoGridPath([s, { gx: s.gx, gy: k }, { gx: t.gx, gy: k }, t]);
    }
    return null;
  }
  if (kind === "corridorGx") {
    if (canonicalSegIndex === 2) return null;
    const sy = g[1]!.gy;
    const k = clampInt(Math.round(sfx), loX, hiX);
    if (k === t.gx) return dedupeIsoGridPath([s, { gx: t.gx, gy: sy }, t]);
    return dedupeIsoGridPath([s, { gx: k, gy: sy }, { gx: t.gx, gy: sy }, t]);
  }
  if (kind === "corridorGy") {
    if (canonicalSegIndex === 2) return null;
    const sx0 = g[0]!.gx;
    const tx0 = g[2]!.gx;
    const k = clampInt(Math.round(sfy), loY, hiY);
    if (k === t.gy) return dedupeIsoGridPath([s, { gx: sx0, gy: t.gy }, t]);
    return dedupeIsoGridPath([s, { gx: sx0, gy: k }, { gx: tx0, gy: k }, t]);
  }
  return null;
}

/** Inserta un vértice en la rejilla sobre un tramo (subdivide la arista). */
export function insertWaypointOnCanonicalSegment(
  g: IsoGridPoint[],
  canonicalSegIndex: number,
  sfx: number,
  sfy: number,
): IsoGridPoint[] | null {
  const n = g.length;
  if (canonicalSegIndex < 0 || canonicalSegIndex >= n - 1) return null;
  const A = g[canonicalSegIndex]!;
  const B = g[canonicalSegIndex + 1]!;
  if (A.gy === B.gy && A.gx !== B.gx) {
    const lo = Math.min(A.gx, B.gx);
    const hi = Math.max(A.gx, B.gx);
    const midGx = clampInt(Math.round(sfx), lo, hi);
    if (midGx === A.gx || midGx === B.gx) return null;
    const p: IsoGridPoint = { gx: midGx, gy: A.gy };
    return dedupeIsoGridPath([
      ...g.slice(0, canonicalSegIndex + 1),
      p,
      ...g.slice(canonicalSegIndex + 1),
    ]);
  }
  if (A.gx === B.gx && A.gy !== B.gy) {
    const lo = Math.min(A.gy, B.gy);
    const hi = Math.max(A.gy, B.gy);
    const midGy = clampInt(Math.round(sfy), lo, hi);
    if (midGy === A.gy || midGy === B.gy) return null;
    const p: IsoGridPoint = { gx: A.gx, gy: midGy };
    return dedupeIsoGridPath([
      ...g.slice(0, canonicalSegIndex + 1),
      p,
      ...g.slice(canonicalSegIndex + 1),
    ]);
  }
  return null;
}

export function displaySegToCanonical(
  displaySeg: number,
  nPoints: number,
  sourceIsCanonicalFirst: boolean,
): number {
  const nSeg = nPoints - 1;
  if (sourceIsCanonicalFirst) return displaySeg;
  return nSeg - 1 - displaySeg;
}

export function sourceIsCanonicalFirstLink(
  l: IsometricFlowLink,
  nodes: IsometricFlowNode[],
): boolean {
  const { source, target } = getResolvedLinkEndpoints(l);
  const sn = nodes.find((n) => n.id === source);
  const tn = nodes.find((n) => n.id === target);
  if (!sn || !tn) return true;
  const cFirst = sn.id <= tn.id ? sn : tn;
  return cFirst.id === source;
}

export function linkCanonicalFullGridPath(
  l: IsometricFlowLink,
  nodes: IsometricFlowNode[],
): IsoGridPoint[] | null {
  const dir = getResolvedLinkEndpoints(l);
  const sourceNode = nodes.find((n) => n.id === dir.source);
  const targetNode = nodes.find((n) => n.id === dir.target);
  if (!sourceNode || !targetNode) return null;
  const canonicalStart =
    sourceNode.id <= targetNode.id ? sourceNode : targetNode;
  const canonicalEnd =
    sourceNode.id <= targetNode.id ? targetNode : sourceNode;
  const s: IsoGridPoint = { gx: canonicalStart.gx, gy: canonicalStart.gy };
  const t: IsoGridPoint = { gx: canonicalEnd.gx, gy: canonicalEnd.gy };
  const def = defaultRouteInternals(s, t);
  let internals: IsoGridPoint[];
  if (l.routeWaypoints != null && l.routeWaypoints.length > 0) {
    internals = l.routeWaypoints.map((p) => ({
      gx: Math.round(p.gx),
      gy: Math.round(p.gy),
    }));
  } else {
    internals = [...def];
  }
  let full = dedupeIsoGridPath([s, ...internals, t]);
  const endsOk =
    full.length >= 2 &&
    full[0]!.gx === s.gx &&
    full[0]!.gy === s.gy &&
    full[full.length - 1]!.gx === t.gx &&
    full[full.length - 1]!.gy === t.gy;
  if (!isoGridOrthogonalOk(full) || !endsOk) {
    full = dedupeIsoGridPath([s, ...def, t]);
  }
  return full;
}

export function linkPolylinePointsNoBend(
  l: IsometricFlowLink,
  nodes: IsometricFlowNode[],
): { x: number; y: number }[] | null {
  const dir = getResolvedLinkEndpoints(l);
  const sourceNode = nodes.find((n) => n.id === dir.source);
  const targetNode = nodes.find((n) => n.id === dir.target);
  if (!sourceNode || !targetNode) return null;

  // Usa una orientación canónica por par de nodos para que ida/vuelta compartan exactamente la misma ruta.
  const canonicalStartNode =
    sourceNode.id <= targetNode.id ? sourceNode : targetNode;
  const canonicalEndNode =
    sourceNode.id <= targetNode.id ? targetNode : sourceNode;

  const p0 = nodeSlabTop(
    canonicalStartNode.gx,
    canonicalStartNode.gy,
    CELL,
    ORIGIN_X,
    ORIGIN_Y,
    SLAB_TOP_RISE,
  );
  const p2 = nodeSlabTop(
    canonicalEndNode.gx,
    canonicalEndNode.gy,
    CELL,
    ORIGIN_X,
    ORIGIN_Y,
    SLAB_TOP_RISE,
  );
  const dgx = canonicalEndNode.gx - canonicalStartNode.gx;
  const dgy = canonicalEndNode.gy - canonicalStartNode.gy;
  const canonicalPoints = isoOrthogonalLinkPoints(p0, p2, dgx, dgy, CELL);

  // Si la dirección real es la opuesta a la canónica, invierte la secuencia:
  // mismo trazo físico, flecha en el extremo contrario.
  if (sourceNode.id !== canonicalStartNode.id) {
    return [...canonicalPoints].reverse();
  }
  return canonicalPoints;
}

export function applyLinkBendToPoints(
  pts: { x: number; y: number }[],
  bend: { x: number; y: number },
): { x: number; y: number }[] {
  if (pts.length === 3) {
    const a = pts[0]!;
    const b = pts[1]!;
    const c = pts[2]!;
    return [a, { x: b.x + bend.x, y: b.y + bend.y }, c];
  }
  if (pts.length === 2) {
    const a = pts[0]!;
    const b = pts[1]!;
    return [
      a,
      {
        x: (a.x + b.x) / 2 + bend.x,
        y: (a.y + b.y) / 2 + bend.y,
      },
      b,
    ];
  }
  return pts;
}

export function linkPolylinePoints(
  l: IsometricFlowLink,
  nodes: IsometricFlowNode[],
): { x: number; y: number }[] | null {
  const dir = getResolvedLinkEndpoints(l);
  const sourceNode = nodes.find((n) => n.id === dir.source);
  const targetNode = nodes.find((n) => n.id === dir.target);
  if (!sourceNode || !targetNode) return null;
  const canonicalStart =
    sourceNode.id <= targetNode.id ? sourceNode : targetNode;

  if (!l.routeWaypoints?.length && l.bendOffset) {
    const base = linkPolylinePointsNoBend(l, nodes);
    if (!base) return null;
    return applyLinkBendToPoints(base, l.bendOffset);
  }

  const G = linkCanonicalFullGridPath(l, nodes);
  if (!G) return null;
  let canvas = G.map((p) =>
    nodeSlabTop(p.gx, p.gy, CELL, ORIGIN_X, ORIGIN_Y, SLAB_TOP_RISE),
  );
  if (sourceNode.id !== canonicalStart.id) {
    canvas = [...canvas].reverse();
  }
  return canvas;
}

export function labelPillWidth(text: string): number {
  const w = Math.ceil(text.length * 6.8 + LABEL_PILL_PAD_X * 2);
  return Math.max(72, Math.min(200, w));
}

/** Caja alineada a ejes para intersección con el rectángulo de selección. */
export type IsoMarqueeBBox = { minX: number; minY: number; maxX: number; maxY: number };

export function rectsIntersect(a: IsoMarqueeBBox, b: IsoMarqueeBBox): boolean {
  return !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);
}

/**
 * Envoltura conservadora del bloque (icono + etiqueta) en coords SVG,
 * coherente con el layout del lienzo.
 */
export function isoNodeMarqueeBounds(n: IsometricFlowNode): IsoMarqueeBBox {
  const foot = nodeFoot(n.gx, n.gy, CELL, ORIGIN_X, ORIGIN_Y);
  const cx = foot.x;
  const cy = foot.y;
  const topPt = nodeSlabTop(n.gx, n.gy, CELL, ORIGIN_X, ORIGIN_Y, SLAB_TOP_RISE);
  const pillW = labelPillWidth(n.label.slice(0, 24));
  const pillLeft = cx - pillW / 2;
  const pillTop = cy - LABEL_STACK - LABEL_PILL_H;
  const padX = CELL * 0.62;
  const padTop = CELL * 0.48;
  const padBot = CELL * 0.22;
  return {
    minX: Math.min(pillLeft, cx - padX),
    minY: Math.min(pillTop - 4, topPt.y - padTop),
    maxX: Math.max(pillLeft + pillW, cx + padX),
    maxY: Math.max(pillTop + LABEL_PILL_H + 6, cy + padBot),
  };
}
export function clientToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

export function defaultIsoViewRect(): IsoViewRect {
  return {
    x: 0,
    y: 0,
    w: ISOMETRIC_VIEWBOX.w,
    h: ISOMETRIC_VIEWBOX.h,
  };
}

export function isoViewRectIsDefault(r: IsoViewRect): boolean {
  return (
    Math.abs(r.x) < 0.5 &&
    Math.abs(r.y) < 0.5 &&
    Math.abs(r.w - ISOMETRIC_VIEWBOX.w) < 0.5 &&
    Math.abs(r.h - ISOMETRIC_VIEWBOX.h) < 0.5
  );
}

/**
 * Delta para zoom: preferimos `deltaY`; solo `deltaX` si `deltaY` es casi nulo (Shift+rueda horizontal).
 */
export function wheelZoomEffectiveDelta(ev: WheelEvent): number {
  let dy = ev.deltaY;
  let dx = ev.deltaX;
  if (ev.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    dy *= 16;
    dx *= 16;
  } else if (ev.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    dy *= 120;
    dx *= 120;
  }
  const yMag = Math.abs(dy);
  const xMag = Math.abs(dx);
  if (yMag < 0.5 && xMag >= 0.5) return dx;
  if (yMag >= 0.5) return dy;
  const legacyWd = (ev as unknown as { wheelDelta?: number }).wheelDelta;
  if (typeof legacyWd === "number" && legacyWd !== 0) {
    return -legacyWd / 3;
  }
  return dy + dx;
}

export function zoomIsoViewTowardPoint(
  prev: IsoViewRect,
  sx: number,
  sy: number,
  deltaY: number,
): IsoViewRect {
  const zoomIntensity = 0.0014;
  const factor = Math.exp(-deltaY * zoomIntensity);
  let nw = prev.w / factor;
  nw = Math.min(ISO_VIEW_MAX_W, Math.max(ISO_VIEW_MIN_W, nw));
  const nh = nw * ISO_VIEW_ASPECT;
  const safeW = prev.w > 1e-6 ? prev.w : ISO_VIEW_MAX_W;
  const safeH = prev.h > 1e-6 ? prev.h : ISO_VIEW_MAX_W * ISO_VIEW_ASPECT;
  const nx = sx - ((sx - prev.x) / safeW) * nw;
  const ny = sy - ((sy - prev.y) / safeH) * nh;
  if (nw >= ISO_VIEW_MAX_W - 0.05) {
    return defaultIsoViewRect();
  }
  return { x: nx, y: ny, w: nw, h: nh };
}

/**
 * Rango de índices de rejilla isométrica que cubre el rectángulo de vista SVG.
 * `gx`/`gy` son lineales en (x,y), así que basta con evaluar las esquinas.
 */
export function isoGridIndexBoundsForView(
  view: IsoViewRect,
  cell: number,
  ox: number,
  oy: number,
  padCells: number,
): { gx0: number; gx1: number; gy0: number; gy1: number } {
  const corners: [number, number][] = [
    [view.x, view.y],
    [view.x + view.w, view.y],
    [view.x, view.y + view.h],
    [view.x + view.w, view.y + view.h],
  ];
  let minGx = Infinity;
  let maxGx = -Infinity;
  let minGy = Infinity;
  let maxGy = -Infinity;
  for (const [cx, cy] of corners) {
    const { gx, gy } = canvasToIsoGridFloat(cx, cy, cell, ox, oy);
    minGx = Math.min(minGx, gx);
    maxGx = Math.max(maxGx, gx);
    minGy = Math.min(minGy, gy);
    maxGy = Math.max(maxGy, gy);
  }
  return {
    gx0: Math.floor(minGx) - padCells,
    gx1: Math.ceil(maxGx) + padCells,
    gy0: Math.floor(minGy) - padCells,
    gy1: Math.ceil(maxGy) + padCells,
  };
}
