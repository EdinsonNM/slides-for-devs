import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeftRight,
  BrainCircuit,
  Box,
  Circle,
  Cloud,
  Database,
  Link2,
  Monitor,
  Plus,
  Smartphone,
  Trash2,
  Triangle,
  UserRound,
} from "lucide-react";
import { cn } from "../../utils/cn";
import {
  DEFAULT_ISOMETRIC_LINK_STROKE,
  type IsometricFlowDiagram,
  type IsometricFlowLink,
  type IsometricFlowNode,
  type IsometricFlowNodeShape,
} from "../../domain/entities/IsometricFlowDiagram";
import {
  ISOMETRIC_VIEWBOX,
  arrowHeadPath,
  canvasToIsoGrid,
  distancePointToPolyline,
  isoDiamondAroundPoint,
  isoGridToCanvas,
  isoOrthogonalLinkPoints,
  isoStepGx,
  nodeFoot,
  nodeSlabTop,
  polygonPath,
  shortenPolylineEnd,
} from "../../utils/isometricFlowGeometry";

const CELL = 54;
const ORIGIN_X = ISOMETRIC_VIEWBOX.w / 2;
const ORIGIN_Y = ISOMETRIC_VIEWBOX.h / 2 + 28;
/** Distancia del pie del bloque al centro de la tapa (conectores / tallo de etiqueta). */
const SLAB_TOP_RISE = 11;
/** Rombo del pie / tapa: 0.5 = una celda de rejilla entre vértices opuestos. */
const SLAB_FOOT_HALF = 0.5;
const SLAB_TOP_HALF = 0.48;
/** Separación vertical pie → parte inferior de la etiqueta. */
const LABEL_STACK = 52;
const LABEL_PILL_H = 22;
const LABEL_PILL_PAD_X = 10;
const HIT_R = 42;
const LINK_HIT_PX = 11;
const ARROW_TRIM = 13;
const ARROW_SIZE = 9.5;
const FLOW_DASH_LENGTH = 7;
const FLOW_DASH_GAP = 9;
const FLOW_DASH_SPAN = FLOW_DASH_LENGTH + FLOW_DASH_GAP;
const FLOW_ANIMATION_SEC = 1.15;

const LINK_COLOR_PRESETS = [
  { label: "Azul", stroke: "rgb(37 99 235)", swatch: "rgb(37, 99, 235)" },
  { label: "Verde", stroke: "rgb(22 163 74)", swatch: "rgb(22, 163, 74)" },
  { label: "Ámbar", stroke: "rgb(217 119 6)", swatch: "rgb(217, 119, 6)" },
  { label: "Rosa", stroke: "rgb(225 29 72)", swatch: "rgb(225, 29, 72)" },
  { label: "Pizarra", stroke: "rgb(71 85 105)", swatch: "rgb(71, 85, 105)" },
] as const;

function hslFill(h: number, s: number, l: number) {
  return `hsl(${h} ${s}% ${l}%)`;
}

/** Prisma isométrico alineado a la cuadrícula (pie + caras + tapa). */
function isoSlabPrismPaths(cx: number, cy: number, cell: number, rise: number, hue: number) {
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

const NODE_SHAPE_TOOLBAR: {
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
  { value: "llm", label: "LLM", Icon: BrainCircuit },
  { value: "user", label: "Usuario", Icon: UserRound },
];

function isoCylinderBody(
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

function isoConeFaces(
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
function isoDeviceGlyphExtent(cy: number, topPtY: number): { yTop: number; yBot: number } {
  const yBot = cy - 4;
  const minH = CELL * 0.48;
  const yTop = Math.min(topPtY - 16, yBot - minH);
  return { yTop, yBot };
}

/** Móvil: más alto y ancho que la franja genérica. */
function isoMobileGlyphExtent(cy: number, topPtY: number): { yTop: number; yBot: number } {
  const yBot = cy - 3;
  const minH = CELL * 0.64;
  const yTop = Math.min(topPtY - 24, yBot - minH);
  return { yTop, yBot };
}

/** Monitor de escritorio: proporción ancho/alto ~1,5 (evita “ultra‑ancho” aplastado). */
function isoDesktopMonitorLayout(cx: number, cy: number, topPtY: number): {
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
function isoCloudGlyphPath(cx: number, topY: number, botY: number): string {
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

function linkStroke(l: IsometricFlowLink): string {
  return l.stroke ?? DEFAULT_ISOMETRIC_LINK_STROKE;
}

function resolveLinkDirection(l: IsometricFlowLink): { source: string; target: string } {
  if (l.reversed) return { source: l.to, target: l.from };
  return { source: l.from, target: l.to };
}

function linkPolylinePoints(
  l: IsometricFlowLink,
  nodes: IsometricFlowNode[],
): { x: number; y: number }[] | null {
  const a = nodes.find((n) => n.id === l.from);
  const b = nodes.find((n) => n.id === l.to);
  if (!a || !b) return null;
  const fromN = l.reversed ? b : a;
  const toN = l.reversed ? a : b;
  const p0 = nodeSlabTop(fromN.gx, fromN.gy, CELL, ORIGIN_X, ORIGIN_Y, SLAB_TOP_RISE);
  const p2 = nodeSlabTop(toN.gx, toN.gy, CELL, ORIGIN_X, ORIGIN_Y, SLAB_TOP_RISE);
  const dgx = toN.gx - fromN.gx;
  const dgy = toN.gy - fromN.gy;
  return isoOrthogonalLinkPoints(p0, p2, dgx, dgy, CELL);
}

function labelPillWidth(text: string): number {
  const w = Math.ceil(text.length * 6.8 + LABEL_PILL_PAD_X * 2);
  return Math.max(72, Math.min(200, w));
}

function clientToSvg(
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

function IsoGridBackground({
  cell,
  ox,
  oy,
}: {
  cell: number;
  ox: number;
  oy: number;
}) {
  const range = 14;
  const lines: ReactNode[] = [];
  const stroke = "rgba(148, 163, 184, 0.45)";
  const strokeDark = "rgba(100, 116, 139, 0.35)";
  for (let k = -range; k <= range; k++) {
    const a = isoGridToCanvas(k, -range, cell, ox, oy);
    const b = isoGridToCanvas(k, range, cell, ox, oy);
    lines.push(
      <line
        key={`g${k}`}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={stroke}
        strokeWidth={0.75}
        vectorEffect="non-scaling-stroke"
      />,
    );
    const c = isoGridToCanvas(-range, k, cell, ox, oy);
    const d = isoGridToCanvas(range, k, cell, ox, oy);
    lines.push(
      <line
        key={`h${k}`}
        x1={c.x}
        y1={c.y}
        x2={d.x}
        y2={d.y}
        stroke={strokeDark}
        strokeWidth={0.75}
        vectorEffect="non-scaling-stroke"
      />,
    );
  }
  return <g aria-hidden>{lines}</g>;
}

export interface IsometricFlowDiagramCanvasProps {
  data: IsometricFlowDiagram;
  readOnly?: boolean;
  className?: string;
  onChange?: (next: IsometricFlowDiagram) => void;
}

export function IsometricFlowDiagramCanvas({
  data,
  readOnly = false,
  className,
  onChange,
}: IsometricFlowDiagramCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const uid = useId().replace(/:/g, "");
  const gradId = `${uid}-bg`;
  const shadowId = `${uid}-sh`;
  const flowDashAnimName = `${uid}-flow-dash`;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const emit = useCallback(
    (next: IsometricFlowDiagram) => {
      onChange?.(next);
    },
    [onChange],
  );

  const dataRef = useRef(data);
  dataRef.current = data;
  const emitRef = useRef(emit);
  emitRef.current = emit;

  const pickNodeAt = useCallback(
    (sx: number, sy: number): IsometricFlowNode | null => {
      let best: IsometricFlowNode | null = null;
      let bestD = HIT_R;
      for (const n of data.nodes) {
        const { x, y } = nodeFoot(n.gx, n.gy, CELL, ORIGIN_X, ORIGIN_Y);
        const d = Math.hypot(sx - x, sy - (y - 6));
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      return best;
    },
    [data.nodes],
  );

  const pickLinkAt = useCallback(
    (sx: number, sy: number): IsometricFlowLink | null => {
      let best: IsometricFlowLink | null = null;
      let bestD = LINK_HIT_PX;
      for (const l of data.links) {
        const pts = linkPolylinePoints(l, data.nodes);
        if (!pts || pts.length < 2) continue;
        const d = distancePointToPolyline(sx, sy, pts);
        if (d < bestD) {
          bestD = d;
          best = l;
        }
      }
      return best;
    },
    [data.links, data.nodes],
  );

  const addNode = useCallback(() => {
    const used = new Set(data.nodes.map((n) => `${n.gx},${n.gy}`));
    for (let r = 0; r < 12; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const k = `${dx},${dy}`;
          if (used.has(k)) continue;
          const next: IsometricFlowDiagram = {
            ...data,
            nodes: [
              ...data.nodes,
              {
                id: crypto.randomUUID(),
                gx: dx,
                gy: dy,
                label: "Sin título",
                hue: 205 + ((data.nodes.length * 11) % 25),
                shape: "slab",
              },
            ],
          };
          emit(next);
          setSelectedId(next.nodes[next.nodes.length - 1]!.id);
          setSelectedLinkId(null);
          return;
        }
      }
    }
  }, [data, emit]);

  const removeSelectedLink = useCallback(() => {
    if (!selectedLinkId) return;
    emit({
      ...data,
      links: data.links.filter((l) => l.id !== selectedLinkId),
    });
    setSelectedLinkId(null);
  }, [data, emit, selectedLinkId]);

  const removeSelectedNode = useCallback(() => {
    if (!selectedId) return;
    const next: IsometricFlowDiagram = {
      ...data,
      nodes: data.nodes.filter((n) => n.id !== selectedId),
      links: data.links.filter(
        (l) => l.from !== selectedId && l.to !== selectedId,
      ),
    };
    emit(next);
    setSelectedId(null);
    setConnectFrom(null);
    setSelectedLinkId(null);
  }, [data, emit, selectedId]);

  const removeSelection = useCallback(() => {
    if (selectedLinkId) {
      removeSelectedLink();
      return;
    }
    removeSelectedNode();
  }, [removeSelectedLink, removeSelectedNode, selectedLinkId]);

  const onSvgPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (readOnly || e.button !== 0) return;
      e.stopPropagation();
      const svg = svgRef.current;
      if (!svg) return;
      const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
      const hit = pickNodeAt(x, y);

      if (connectFrom) {
        if (hit && hit.id !== connectFrom) {
          const exists = data.links.some(
            (l) => {
              const dir = resolveLinkDirection(l);
              return dir.source === connectFrom && dir.target === hit.id;
            },
          );
          if (!exists) {
            emit({
              ...data,
              links: [
                ...data.links,
                {
                  id: crypto.randomUUID(),
                  from: connectFrom,
                  to: hit.id,
                },
              ],
            });
          }
        }
        setConnectFrom(null);
        e.preventDefault();
        return;
      }

      if (hit) {
        setSelectedLinkId(null);
        setSelectedId(hit.id);
        const { x: nx, y: ny } = nodeFoot(hit.gx, hit.gy, CELL, ORIGIN_X, ORIGIN_Y);
        setDrag({
          id: hit.id,
          offsetX: x - nx,
          offsetY: y - ny,
        });
        e.preventDefault();
        return;
      }

      const linkHit = pickLinkAt(x, y);
      if (linkHit) {
        setSelectedId(null);
        setConnectFrom(null);
        setSelectedLinkId(linkHit.id);
        e.preventDefault();
        return;
      }

      setSelectedId(null);
      setSelectedLinkId(null);
      setConnectFrom(null);
    },
    [readOnly, connectFrom, data, emit, pickLinkAt, pickNodeAt],
  );

  useEffect(() => {
    if (readOnly || !drag) return;
    const svg = svgRef.current;
    if (!svg) return;

    const onMove = (ev: PointerEvent) => {
      const { x, y } = clientToSvg(svg, ev.clientX, ev.clientY);
      const adjX = x - drag.offsetX;
      const adjY = y - drag.offsetY;
      const { gx, gy } = canvasToIsoGrid(adjX, adjY, CELL, ORIGIN_X, ORIGIN_Y);
      const d = dataRef.current;
      const nextNodes = d.nodes.map((n) =>
        n.id === drag.id ? { ...n, gx, gy } : n,
      );
      emitRef.current({ ...d, nodes: nextNodes });
    };

    const onUp = () => {
      setDrag(null);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [readOnly, drag]);

  const onSvgDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (readOnly) return;
      e.stopPropagation();
      const svg = svgRef.current;
      if (!svg) return;
      const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
      if (pickNodeAt(x, y)) return;
      const { gx, gy } = canvasToIsoGrid(x, y, CELL, ORIGIN_X, ORIGIN_Y);
      const id = crypto.randomUUID();
      emit({
        ...data,
        nodes: [
          ...data.nodes,
          {
            id,
            gx,
            gy,
            label: "Sin título",
            hue: 205,
            shape: "slab",
          },
        ],
      });
      setSelectedId(id);
      setSelectedLinkId(null);
    },
    [readOnly, data, emit, pickNodeAt],
  );

  const setLinkStrokeColor = useCallback(
    (stroke: string) => {
      if (!selectedLinkId) return;
      emit({
        ...data,
        links: data.links.map((l) =>
          l.id === selectedLinkId ? { ...l, stroke } : l,
        ),
      });
    },
    [data, emit, selectedLinkId],
  );

  const toggleLinkReversed = useCallback(() => {
    if (!selectedLinkId) return;
    emit({
      ...data,
      links: data.links.map((l) =>
        l.id === selectedLinkId ? { ...l, reversed: !l.reversed } : l,
      ),
    });
  }, [data, emit, selectedLinkId]);

  const addReverseLink = useCallback(() => {
    if (!selectedLinkId) return;
    const selected = data.links.find((l) => l.id === selectedLinkId);
    if (!selected) return;
    const { source, target } = resolveLinkDirection(selected);
    const reverseExists = data.links.some((l) => {
      if (l.id === selected.id) return false;
      const dir = resolveLinkDirection(l);
      return dir.source === target && dir.target === source;
    });
    if (reverseExists) return;
    emit({
      ...data,
      links: [
        ...data.links,
        {
          id: crypto.randomUUID(),
          from: target,
          to: source,
          ...(selected.stroke ? { stroke: selected.stroke } : {}),
        },
      ],
    });
  }, [data, emit, selectedLinkId]);

  const setSelectedNodeShape = useCallback(
    (shape: IsometricFlowNodeShape) => {
      if (!selectedId) return;
      emit({
        ...data,
        nodes: data.nodes.map((nn) =>
          nn.id === selectedId ? { ...nn, shape } : nn,
        ),
      });
    },
    [data, emit, selectedId],
  );

  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConnectFrom(null);
        setEditingId(null);
        setSelectedLinkId(null);
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        (selectedId || selectedLinkId) &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        removeSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, removeSelection, selectedId, selectedLinkId]);

  const toolbar = !readOnly && (
    <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-200/90 bg-white/95 px-2 py-1.5 shadow-sm dark:border-border dark:bg-stone-900/95">
      <button
        type="button"
        onClick={addNode}
        className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-700"
        aria-label="Añadir bloque"
      >
        <Plus size={14} />
        Bloque
      </button>
      <button
        type="button"
        onClick={() => {
          setSelectedLinkId(null);
          setConnectFrom((c) => (c ? null : selectedId));
        }}
        disabled={!selectedId}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
          connectFrom
            ? "border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
            : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200",
          !selectedId && "pointer-events-none opacity-40",
        )}
        aria-label="Modo conexión: elige dos bloques"
        title="Conectar: origen y destino"
      >
        <Link2 size={14} />
        {connectFrom ? "Destino…" : "Conectar"}
      </button>
      <button
        type="button"
        onClick={removeSelection}
        disabled={!selectedId && !selectedLinkId}
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-red-950/40"
        aria-label={
          selectedLinkId ? "Eliminar conector seleccionado" : "Eliminar bloque seleccionado"
        }
      >
        <Trash2 size={14} />
        Quitar
      </button>
      {selectedId && !selectedLinkId && (
        <div
          className="flex flex-wrap items-center gap-0.5 border-l border-stone-200 pl-1.5 dark:border-stone-600"
          role="group"
          aria-label="Tipo de icono del bloque"
        >
          <span className="sr-only">Tipo de icono</span>
          {NODE_SHAPE_TOOLBAR.map(({ value, label, Icon }) => {
            const current = data.nodes.find((x) => x.id === selectedId)?.shape ?? "slab";
            const active = current === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedNodeShape(value)}
                title={label}
                aria-label={label}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md border text-stone-700 transition-colors",
                  active
                    ? "border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100"
                    : "border-stone-200 bg-stone-50 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700",
                )}
              >
                <Icon size={14} strokeWidth={active ? 2.25 : 1.75} />
              </button>
            );
          })}
        </div>
      )}
      {selectedLinkId && (
        <>
          <button
            type="button"
            onClick={toggleLinkReversed}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            aria-label="Invertir sentido de la flecha"
            title="Invertir flecha"
          >
            <ArrowLeftRight size={14} />
            Sentido
          </button>
          <button
            type="button"
            onClick={addReverseLink}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            aria-label="Crear conector de regreso"
            title="Crear conector en sentido contrario"
          >
            <ArrowLeftRight size={14} />
            Doble sentido
          </button>
          <div className="flex items-center gap-0.5 border-l border-stone-200 pl-1.5 dark:border-stone-600">
            <span className="sr-only">Color del conector</span>
            {LINK_COLOR_PRESETS.map((p) => (
              <button
                key={p.stroke}
                type="button"
                onClick={() => setLinkStrokeColor(p.stroke)}
                className="h-5 w-5 rounded border border-stone-300/80 shadow-sm hover:scale-110 dark:border-stone-500"
                style={{ backgroundColor: p.swatch }}
                title={p.label}
                aria-label={`Color ${p.label}`}
              />
            ))}
          </div>
        </>
      )}
      <span className="hidden text-[10px] text-stone-500 sm:inline dark:text-stone-400">
        Doble clic en vacío · clic en línea · Del
      </span>
    </div>
  );

  return (
    <div className={cn("relative h-full min-h-0 w-full", className)}>
      {toolbar}
      <svg
        ref={svgRef}
        role="img"
        aria-label="Diagrama isométrico"
        viewBox={`0 0 ${ISOMETRIC_VIEWBOX.w} ${ISOMETRIC_VIEWBOX.h}`}
        className="h-full w-full touch-none select-none text-slate-900 dark:text-slate-100"
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onSvgPointerDown}
        onPointerMove={(e) => {
          const svg = svgRef.current;
          if (!svg) return;
          const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
          const hit = pickNodeAt(x, y);
          setHoveredNodeId(hit?.id ?? null);
        }}
        onPointerLeave={() => setHoveredNodeId(null)}
        onDoubleClick={onSvgDoubleClick}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(248 250 252)" />
            <stop offset="55%" stopColor="rgb(241 245 249)" />
            <stop offset="100%" stopColor="rgb(224 231 239)" />
          </linearGradient>
          <filter id={shadowId} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow
              dx="2"
              dy="5"
              stdDeviation="4"
              floodColor="#0f172a"
              floodOpacity="0.12"
            />
          </filter>
        </defs>
        <style>{`
          @keyframes ${flowDashAnimName} {
            to { stroke-dashoffset: -${FLOW_DASH_SPAN}; }
          }
          .iso-node-hoverable {
            transition: transform 180ms ease, filter 180ms ease;
            transform-origin: center;
          }
          .iso-node-hoverable.is-hovered {
            transform: translateY(-3px) scale(1.018);
            filter: brightness(1.04) saturate(1.05);
          }
          @media (prefers-reduced-motion: reduce) {
            .iso-flow-dash {
              animation: none !important;
            }
            .iso-node-hoverable {
              transition: none !important;
            }
            .iso-node-hoverable.is-hovered {
              transform: none !important;
              filter: none !important;
            }
          }
        `}</style>

        <rect
          width={ISOMETRIC_VIEWBOX.w}
          height={ISOMETRIC_VIEWBOX.h}
          fill={`url(#${gradId})`}
          className="dark:opacity-90"
        />
        <IsoGridBackground cell={CELL} ox={ORIGIN_X} oy={ORIGIN_Y} />

        <g aria-hidden>
          {data.links.map((l) => {
            const pts = linkPolylinePoints(l, data.nodes);
            if (!pts || pts.length < 2) return null;
            const stroke = linkStroke(l);
            const trimmed = shortenPolylineEnd(pts, ARROW_TRIM);
            const lineD = `M ${trimmed.map((p) => `${p.x} ${p.y}`).join(" L ")}`;
            const headD = arrowHeadPath(pts, ARROW_SIZE);
            const sel = selectedLinkId === l.id;
            return (
              <g key={l.id} opacity={0.94}>
                {sel && (
                  <path
                    d={`M ${pts.map((p) => `${p.x} ${p.y}`).join(" L ")}`}
                    fill="none"
                    stroke="rgb(255 255 255)"
                    strokeWidth={10}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.45}
                    className="dark:stroke-slate-200"
                  />
                )}
                <path
                  d={lineD}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={sel ? 4 : 3.2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <path
                  d={lineD}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.95)"
                  strokeWidth={sel ? 2.1 : 1.6}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={`${FLOW_DASH_LENGTH} ${FLOW_DASH_GAP}`}
                  className="iso-flow-dash"
                  style={{
                    strokeDashoffset: 0,
                    animation: `${flowDashAnimName} ${FLOW_ANIMATION_SEC}s linear infinite`,
                  }}
                />
                {headD ? (
                  <path d={headD} fill={stroke} stroke="none" />
                ) : null}
              </g>
            );
          })}
        </g>

        {[...data.nodes]
          .sort((a, b) => a.gx + a.gy - (b.gx + b.gy))
          .map((n) => {
            const foot = nodeFoot(n.gx, n.gy, CELL, ORIGIN_X, ORIGIN_Y);
            const { x: cx, y: cy } = foot;
            const topPt = nodeSlabTop(
              n.gx,
              n.gy,
              CELL,
              ORIGIN_X,
              ORIGIN_Y,
              SLAB_TOP_RISE,
            );
            const shape = n.shape;
            const prism =
              shape === "slab"
                ? isoSlabPrismPaths(cx, cy, CELL, SLAB_TOP_RISE, n.hue)
                : null;
            const cyl =
              shape === "cylinder"
                ? isoCylinderBody(cx, cy, CELL, SLAB_TOP_RISE, n.hue)
                : null;
            const cone =
              shape === "cone"
                ? isoConeFaces(cx, cy, CELL, SLAB_TOP_RISE, n.hue, topPt)
                : null;
            const glyphExtent =
              shape === "mobile"
                ? isoMobileGlyphExtent(cy, topPt.y)
                : shape === "cloud" ||
                    shape === "orb" ||
                    shape === "llm" ||
                    shape === "user"
                  ? isoDeviceGlyphExtent(cy, topPt.y)
                  : null;
            const desktopLayout =
              shape === "desktop" ? isoDesktopMonitorLayout(cx, cy, topPt.y) : null;
            const orbR =
              shape === "orb" && glyphExtent
                ? Math.min(CELL * 0.36, (glyphExtent.yBot - glyphExtent.yTop) * 0.44)
                : CELL * 0.34;
            const orbCy =
              shape === "orb" && glyphExtent
                ? (glyphExtent.yTop + glyphExtent.yBot) / 2
                : cy - SLAB_TOP_RISE * 0.42;
            const orbStroke = "rgba(30, 64, 175, 0.28)";
            const sel = selectedId === n.id;
            const hov = hoveredNodeId === n.id;
            const conn = connectFrom === n.id;
            const selDiamond = polygonPath(
              isoDiamondAroundPoint(cx, cy, CELL, SLAB_FOOT_HALF + 0.04),
            );
            const connDiamond = polygonPath(
              isoDiamondAroundPoint(cx, cy, CELL, SLAB_FOOT_HALF + 0.02),
            );
            const pillW = labelPillWidth(
              editingId === n.id ? n.label : n.label.slice(0, 24),
            );
            const pillLeft = cx - pillW / 2;
            const pillTop = cy - LABEL_STACK - LABEL_PILL_H;
            let stemTopY = topPt.y;
            if (shape === "desktop" && desktopLayout) {
              stemTopY = Math.min(topPt.y, desktopLayout.stemY);
            } else if (glyphExtent) {
              if (shape === "orb") {
                stemTopY = Math.min(topPt.y, orbCy - orbR);
              } else {
                stemTopY = Math.min(topPt.y, glyphExtent.yTop);
              }
            }
            const stemBotY = pillTop + LABEL_PILL_H;

            return (
              <g
                key={n.id}
                className={cn("iso-node-hoverable", hov && "is-hovered")}
              >
                {sel && (
                  <path
                    d={selDiamond}
                    fill="none"
                    stroke="rgb(59 130 246)"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    opacity={0.95}
                  />
                )}
                {conn && !sel && (
                  <path
                    d={connDiamond}
                    fill="none"
                    stroke="rgb(245 158 11)"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                  />
                )}

                <g filter={`url(#${shadowId})`}>
                  {shape === "slab" && prism ? (
                    <>
                      <path
                        d={prism.footPath}
                        fill={prism.footFill}
                        stroke={prism.stroke}
                        strokeWidth={1}
                        opacity={0.92}
                      />
                      {prism.sides.map((side, i) => (
                        <path
                          key={i}
                          d={side}
                          fill={prism.sideFills[i]}
                          stroke={prism.stroke}
                          strokeWidth={1}
                        />
                      ))}
                      <path
                        d={prism.topPath}
                        fill={prism.topFill}
                        stroke={prism.stroke}
                        strokeWidth={1}
                      />
                    </>
                  ) : null}
                  {shape === "cylinder" && cyl ? (
                    <>
                      <ellipse
                        cx={cx}
                        cy={cy}
                        rx={cyl.erx}
                        ry={cyl.ery}
                        fill={hslFill(n.hue, 46, 64)}
                        stroke={cyl.stroke}
                        strokeWidth={1}
                        opacity={0.92}
                      />
                      <path
                        d={cyl.bodyPath}
                        fill={cyl.sideFill}
                        stroke={cyl.stroke}
                        strokeWidth={1}
                      />
                      <ellipse
                        cx={cx}
                        cy={cyl.ty}
                        rx={cyl.erx}
                        ry={cyl.ery}
                        fill={cyl.topFill}
                        stroke={cyl.stroke}
                        strokeWidth={1}
                      />
                    </>
                  ) : null}
                  {shape === "cone" && cone ? (
                    <>
                      <path
                        d={cone.footPath}
                        fill={hslFill(n.hue, 46, 62)}
                        stroke={cone.stroke}
                        strokeWidth={1}
                        opacity={0.92}
                      />
                      {cone.ordered.map((face, i) => (
                        <path
                          key={i}
                          d={face.d}
                          fill={face.fill}
                          stroke={cone.stroke}
                          strokeWidth={1}
                          strokeLinejoin="round"
                        />
                      ))}
                    </>
                  ) : null}
                  {shape === "orb" ? (
                    <>
                      <ellipse
                        cx={cx}
                        cy={cy + 3}
                        rx={CELL * 0.28}
                        ry={CELL * 0.11}
                        fill="rgba(15, 23, 42, 0.14)"
                        className="dark:fill-slate-950/35"
                      />
                      <circle
                        cx={cx}
                        cy={orbCy}
                        r={orbR}
                        fill={hslFill(n.hue, 52, 76)}
                        stroke={orbStroke}
                        strokeWidth={1}
                      />
                      <circle
                        cx={cx - CELL * 0.09}
                        cy={orbCy - CELL * 0.06}
                        r={CELL * 0.13}
                        fill="rgba(255, 255, 255, 0.38)"
                      />
                    </>
                  ) : null}
                  {shape === "mobile" && glyphExtent ? (() => {
                    const stroke = "rgba(30, 64, 175, 0.28)";
                    const { yTop, yBot } = glyphExtent;
                    const h = yBot - yTop;
                    const w = CELL * 0.46;
                    const x0 = cx - w / 2;
                    const rx = Math.min(10, w * 0.2);
                    return (
                      <>
                        <rect
                          x={x0}
                          y={yTop}
                          width={w}
                          height={h}
                          rx={rx}
                          ry={rx}
                          fill={hslFill(n.hue, 48, 82)}
                          stroke={stroke}
                          strokeWidth={1.15}
                        />
                        <rect
                          x={x0 + w * 0.085}
                          y={yTop + h * 0.075}
                          width={w * 0.83}
                          height={h * 0.7}
                          rx={3.5}
                          ry={3.5}
                          fill={hslFill(n.hue, 42, 32)}
                        />
                        <circle
                          cx={cx}
                          cy={yTop + h - h * 0.085}
                          r={3.2}
                          fill="rgba(148, 163, 184, 0.95)"
                        />
                      </>
                    );
                  })() : null}
                  {shape === "desktop" && desktopLayout ? (() => {
                    const L = desktopLayout;
                    const { hw, yScreenTop, screenH, stroke } = L;
                    const padX = Math.max(3, hw * 0.09);
                    const padTop = screenH * 0.09;
                    const padBot = screenH * 0.13;
                    const innerH = screenH - padTop - padBot;
                    const rxOuter = Math.min(6, screenH * 0.2);
                    const rxInner = Math.min(4, Math.max(2, innerH * 0.16));
                    return (
                      <>
                        <rect
                          x={cx - hw}
                          y={yScreenTop}
                          width={hw * 2}
                          height={screenH}
                          rx={rxOuter}
                          ry={rxOuter}
                          fill={hslFill(n.hue, 48, 80)}
                          stroke={stroke}
                          strokeWidth={1}
                        />
                        <rect
                          x={cx - hw + padX}
                          y={yScreenTop + padTop}
                          width={hw * 2 - padX * 2}
                          height={innerH}
                          rx={rxInner}
                          ry={rxInner}
                          fill={hslFill(n.hue, 40, 28)}
                        />
                        <path
                          d={L.standPath}
                          fill={hslFill(n.hue, 45, 64)}
                          stroke={stroke}
                          strokeWidth={0.85}
                          strokeLinejoin="round"
                        />
                        <rect
                          x={L.baseX}
                          y={L.baseY}
                          width={L.baseW}
                          height={L.baseH}
                          rx={1.5}
                          ry={1.5}
                          fill={hslFill(n.hue, 44, 60)}
                          stroke={stroke}
                          strokeWidth={0.85}
                        />
                      </>
                    );
                  })() : null}
                  {shape === "cloud" && glyphExtent ? (() => {
                    const stroke = "rgba(30, 64, 175, 0.28)";
                    const d = isoCloudGlyphPath(cx, glyphExtent.yTop, glyphExtent.yBot);
                    return (
                      <path
                        d={d}
                        fill={hslFill(n.hue, 52, 88)}
                        stroke={stroke}
                        strokeWidth={1}
                        strokeLinejoin="round"
                      />
                    );
                  })() : null}
                  {shape === "llm" && glyphExtent ? (() => {
                    const stroke = "rgba(30, 64, 175, 0.28)";
                    const { yTop, yBot } = glyphExtent;
                    const h = yBot - yTop;
                    const w = CELL * 0.56;
                    const x0 = cx - w / 2;
                    const y0 = yTop + h * 0.12;
                    const bodyH = h * 0.72;
                    const corner = Math.max(6, Math.min(10, h * 0.24));
                    return (
                      <>
                        <rect
                          x={x0}
                          y={y0}
                          width={w}
                          height={bodyH}
                          rx={corner}
                          ry={corner}
                          fill={hslFill(n.hue, 48, 82)}
                          stroke={stroke}
                          strokeWidth={1}
                        />
                        <text
                          x={cx}
                          y={y0 + bodyH / 2 + 3}
                          textAnchor="middle"
                          className="fill-slate-800 text-[9px] font-bold tracking-[0.08em] dark:fill-slate-900"
                        >
                          LLM
                        </text>
                      </>
                    );
                  })() : null}
                  {shape === "user" && glyphExtent ? (() => {
                    const stroke = "rgba(30, 64, 175, 0.28)";
                    const { yTop, yBot } = glyphExtent;
                    const h = yBot - yTop;
                    const headR = Math.min(CELL * 0.12, h * 0.2);
                    const headY = yTop + h * 0.28;
                    const shoulderY = headY + headR + h * 0.1;
                    const bodyW = CELL * 0.42;
                    const bodyH = h * 0.34;
                    return (
                      <>
                        <circle
                          cx={cx}
                          cy={headY}
                          r={headR}
                          fill={hslFill(n.hue, 52, 86)}
                          stroke={stroke}
                          strokeWidth={1}
                        />
                        <rect
                          x={cx - bodyW / 2}
                          y={shoulderY}
                          width={bodyW}
                          height={bodyH}
                          rx={bodyH / 2}
                          ry={bodyH / 2}
                          fill={hslFill(n.hue, 48, 76)}
                          stroke={stroke}
                          strokeWidth={1}
                        />
                      </>
                    );
                  })() : null}
                </g>

                <line
                  x1={cx}
                  y1={stemTopY}
                  x2={cx}
                  y2={stemBotY}
                  stroke="rgba(15, 23, 42, 0.45)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />

                {editingId === n.id && !readOnly ? (
                  <foreignObject
                    x={pillLeft}
                    y={pillTop}
                    width={pillW}
                    height={LABEL_PILL_H}
                  >
                    <input
                      autoFocus
                      className="box-border h-full w-full rounded-full border border-sky-500/70 bg-white px-2 text-center text-[11px] font-medium text-slate-900 shadow-sm outline-none dark:bg-slate-900 dark:text-slate-100"
                      value={n.label}
                      onChange={(ev) => {
                        const v = ev.target.value;
                        emit({
                          ...data,
                          nodes: data.nodes.map((nn) =>
                            nn.id === n.id ? { ...nn, label: v } : nn,
                          ),
                        });
                      }}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === "Escape") {
                          ev.preventDefault();
                          setEditingId(null);
                        }
                      }}
                    />
                  </foreignObject>
                ) : (
                  <g
                    className="cursor-default"
                    onDoubleClick={(e) => {
                      if (readOnly) return;
                      e.stopPropagation();
                      setEditingId(n.id);
                      setSelectedId(n.id);
                    }}
                  >
                    <rect
                      x={pillLeft}
                      y={pillTop}
                      width={pillW}
                      height={LABEL_PILL_H}
                      rx={LABEL_PILL_H / 2}
                      ry={LABEL_PILL_H / 2}
                      fill="white"
                      stroke="rgba(148, 163, 184, 0.65)"
                      strokeWidth={1}
                      className="dark:fill-slate-100"
                    />
                    <text
                      x={cx}
                      y={pillTop + LABEL_PILL_H / 2 + 4}
                      textAnchor="middle"
                      className="pointer-events-none fill-slate-900 text-[11px] font-semibold dark:fill-slate-900"
                    >
                      {n.label.length > 22 ? `${n.label.slice(0, 20)}…` : n.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
      </svg>
    </div>
  );
}
