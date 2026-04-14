import {
  useCallback,
  useEffect,
  useId,
  useMemo,
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
  Image as ImageIcon,
  Link2,
  Monitor,
  Plus,
  Repeat2,
  Smartphone,
  Trash2,
  Triangle,
  UserRound,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { hrefFromGoogleIconRelativePath, resolveBrandIconHref } from "../../utils/isometricBrandIcon";
import {
  DEFAULT_ISOMETRIC_LINK_STROKE,
  dedupeIsometricFlowLinks,
  getResolvedLinkEndpoints,
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
/** Miniaturas por página en el selector (evita miles de etiquetas img a la vez). */
const ICON_PICKER_PAGE_SIZE = 140;

const LINK_COLOR_PRESETS = [
  { label: "Azul", stroke: "rgb(37 99 235)", swatch: "rgb(37, 99, 235)" },
  { label: "Verde", stroke: "rgb(22 163 74)", swatch: "rgb(22, 163, 74)" },
  { label: "Ámbar", stroke: "rgb(217 119 6)", swatch: "rgb(217, 119, 6)" },
  { label: "Rosa", stroke: "rgb(225 29 72)", swatch: "rgb(225, 29, 72)" },
  { label: "Pizarra", stroke: "rgb(71 85 105)", swatch: "rgb(71, 85, 105)" },
] as const;

type BrandIconCatalogEntry = {
  id: string;
  label: string;
  href: string;
};

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
  { value: "brand", label: "Marca (SVG)", Icon: ImageIcon },
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

/** Marca (esfera + SVG): franja un poco más alta que nube/orbe para icono legible. */
function isoBrandGlyphExtent(cy: number, topPtY: number): { yTop: number; yBot: number } {
  const yBot = cy - 4;
  const minH = CELL * 0.58;
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

function linkPolylinePoints(
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
  const flowDashReverseAnimName = `${uid}-flow-dash-reverse`;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brandIconCatalog, setBrandIconCatalog] = useState<BrandIconCatalogEntry[]>([]);
  const [googleIconPathById, setGoogleIconPathById] = useState<Record<string, string>>({});
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconSearchQuery, setIconSearchQuery] = useState("");
  const [iconPickerVisibleLimit, setIconPickerVisibleLimit] = useState(ICON_PICKER_PAGE_SIZE);
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

  useEffect(() => {
    let alive = true;
    void Promise.all([
      fetch("/lobe-icons/manifest.json").then((r) => (r.ok ? r.json() : [])),
      fetch("/google-icons/manifest.json").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([lobeList, googleDoc]: [unknown, unknown]) => {
        if (!alive) return;
        const googlePathById: Record<string, string> = {};
        const googleEntries: BrandIconCatalogEntry[] = [];
        if (googleDoc && typeof googleDoc === "object") {
          const icons = (googleDoc as { icons?: unknown }).icons;
          if (Array.isArray(icons)) {
            for (const raw of icons) {
              if (!raw || typeof raw !== "object") continue;
              const o = raw as Record<string, unknown>;
              if (typeof o.id !== "string" || typeof o.path !== "string") continue;
              const id = o.id.trim().toLowerCase();
              const path = o.path.trim();
              if (!id || !path) continue;
              googlePathById[id] = path;
              const label =
                typeof o.label === "string" && o.label.trim()
                  ? o.label.trim()
                  : id.replace(/^g:/, "");
              googleEntries.push({
                id,
                label,
                href: hrefFromGoogleIconRelativePath(path),
              });
            }
          }
        }

        const lobeSlugs: string[] = Array.isArray(lobeList)
          ? lobeList
              .filter((v): v is string => typeof v === "string")
              .map((v) => v.trim().toLowerCase())
              .filter(Boolean)
          : [];
        const lobeEntries: BrandIconCatalogEntry[] = lobeSlugs.map((id) => ({
          id,
          label: id,
          href: `/lobe-icons/icons/${id}.svg`,
        }));

        setGoogleIconPathById(googlePathById);
        setBrandIconCatalog([...googleEntries, ...lobeEntries]);
      })
      .catch(() => {
        if (!alive) return;
        setGoogleIconPathById({});
        setBrandIconCatalog([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!iconPickerOpen) return;
    setIconSearchQuery("");
  }, [iconPickerOpen]);

  useEffect(() => {
    if (!iconPickerOpen) return;
    setIconPickerVisibleLimit(ICON_PICKER_PAGE_SIZE);
  }, [iconPickerOpen, iconSearchQuery]);

  useEffect(() => {
    if (!selectedId) {
      setIconPickerOpen(false);
      setIconSearchQuery("");
    }
  }, [data.nodes, selectedId]);

  const selectedNode = useMemo(
    () => data.nodes.find((n) => n.id === selectedId) ?? null,
    [data.nodes, selectedId],
  );

  const bidirectionalLinkIds = useMemo(() => {
    const directionPairs = new Set(
      data.links.map((l) => {
        const dir = getResolvedLinkEndpoints(l);
        return `${dir.source}->${dir.target}`;
      }),
    );
    const ids = new Set<string>();
    for (const l of data.links) {
      const dir = getResolvedLinkEndpoints(l);
      if (directionPairs.has(`${dir.target}->${dir.source}`)) {
        ids.add(l.id);
      }
    }
    return ids;
  }, [data.links]);

  const iconPickerFiltered = useMemo(() => {
    if (!brandIconCatalog.length) return [];
    const q = iconSearchQuery.trim().toLowerCase();
    if (!q) return brandIconCatalog;
    return brandIconCatalog.filter(
      (e) =>
        e.id.includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.id.replace(/^g:/, "").includes(q),
    );
  }, [brandIconCatalog, iconSearchQuery]);

  const iconPickerResults = useMemo(
    () => iconPickerFiltered.slice(0, iconPickerVisibleLimit),
    [iconPickerFiltered, iconPickerVisibleLimit],
  );

  const iconPickerHasMore = iconPickerFiltered.length > iconPickerResults.length;

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
              const dir = getResolvedLinkEndpoints(l);
              return dir.source === connectFrom && dir.target === hit.id;
            },
          );
          if (!exists) {
            const newId = crypto.randomUUID();
            const newLink: IsometricFlowLink = {
              id: newId,
              from: connectFrom,
              to: hit.id,
            };
            emit({
              ...data,
              links: dedupeIsometricFlowLinks([...data.links, newLink], newId),
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
    const nextLinks = data.links.map((l) =>
      l.id === selectedLinkId ? { ...l, reversed: !l.reversed } : l,
    );
    emit({
      ...data,
      links: dedupeIsometricFlowLinks(nextLinks, selectedLinkId),
    });
  }, [data, emit, selectedLinkId]);

  const toggleLinkAnimationStyle = useCallback(() => {
    if (!selectedLinkId) return;
    const selected = data.links.find((l) => l.id === selectedLinkId);
    if (!selected) return;
    const selectedDir = getResolvedLinkEndpoints(selected);
    const reverseId = data.links.find((l) => {
      if (l.id === selected.id) return false;
      const dir = getResolvedLinkEndpoints(l);
      return (
        dir.source === selectedDir.target && dir.target === selectedDir.source
      );
    })?.id;

    emit({
      ...data,
      links: data.links.map((l) =>
        l.id === selectedLinkId || l.id === reverseId
          ? {
              ...l,
              animationStyle:
                (selected.animationStyle ?? "dash") === "pulse" ? "dash" : "pulse",
            }
          : l,
      ),
    });
  }, [data, emit, selectedLinkId]);

  const addReverseLink = useCallback(() => {
    if (!selectedLinkId) return;
    const selected = data.links.find((l) => l.id === selectedLinkId);
    if (!selected) return;
    const { source, target } = getResolvedLinkEndpoints(selected);
    const reverseExists = data.links.some((l) => {
      if (l.id === selected.id) return false;
      const dir = getResolvedLinkEndpoints(l);
      return dir.source === target && dir.target === source;
    });
    if (reverseExists) return;
    const newId = crypto.randomUUID();
    const newLink: IsometricFlowLink = {
      id: newId,
      from: target,
      to: source,
      ...(selected.stroke ? { stroke: selected.stroke } : {}),
    };
    emit({
      ...data,
      links: dedupeIsometricFlowLinks([...data.links, newLink], newId),
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

  const setSelectedNodeIconSlug = useCallback(
    (slug: string) => {
      if (!selectedId) return;
      const clean = slug.trim().toLowerCase();
      emit({
        ...data,
        nodes: data.nodes.map((nn) =>
          nn.id === selectedId
            ? {
                ...nn,
                ...(clean ? { iconSlug: clean } : {}),
                ...(clean ? {} : { iconSlug: undefined }),
              }
            : nn,
        ),
      });
    },
    [data, emit, selectedId],
  );

  const setSelectedNodeBrandIcon = useCallback(
    (slug: string) => {
      if (!selectedId) return;
      const clean = slug.trim().toLowerCase();
      emit({
        ...data,
        nodes: data.nodes.map((nn) =>
          nn.id === selectedId
            ? {
                ...nn,
                shape: "brand",
                ...(clean ? { iconSlug: clean } : { iconSlug: "openai" }),
              }
            : nn,
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
      {selectedId && !selectedLinkId ? (
        <div className="flex items-center gap-1 border-l border-stone-200 pl-1.5 dark:border-stone-600">
          <button
            type="button"
            onClick={() => setIconPickerOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            title="Abrir selector de iconos"
          >
            <ImageIcon size={13} />
            Cambiar icono
          </button>
        </div>
      ) : null}
      {selectedLinkId && (
        <>
          <button
            type="button"
            onClick={toggleLinkAnimationStyle}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            aria-label="Cambiar estilo de animación del conector"
            title="Cambiar estilo de animación"
          >
            {data.links.find((l) => l.id === selectedLinkId)?.animationStyle ===
            "pulse"
              ? "Anim: Pulso"
              : "Anim: Flujo"}
          </button>
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
            <Repeat2 size={14} />
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
      {iconPickerOpen && selectedNode ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/45 p-3">
          <div className="flex h-[min(78vh,520px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl dark:border-border dark:bg-stone-900">
            <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-3 py-2 dark:border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                  Cambiar icono
                </span>
                <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                  {iconPickerHasMore
                    ? `${iconPickerResults.length} de ${iconPickerFiltered.length}`
                    : `${iconPickerFiltered.length} iconos`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIconPickerOpen(false)}
                className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800"
              >
                Cerrar
              </button>
            </div>

            <div className="border-b border-stone-200 px-3 py-2 dark:border-border">
              <input
                value={iconSearchQuery}
                onChange={(e) => setIconSearchQuery(e.target.value)}
                placeholder="Buscar (openai, compute, g:storage, networking…)"
                className="h-9 w-full rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-700 outline-none focus:border-sky-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
              />
              <p className="mt-2 text-[11px] leading-snug text-stone-500 dark:text-stone-400">
                El catálogo Lobe es muy grande: solo se pintan miniaturas por tandas para que la UI siga fluida. Usa la
                búsqueda o «Cargar más» para ver el resto.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {iconPickerResults.map((entry) => {
                  const active =
                    (selectedNode.iconSlug ?? "").trim().toLowerCase() === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setSelectedNodeBrandIcon(entry.id);
                        setIconSearchQuery("");
                        setIconPickerOpen(false);
                      }}
                      className={cn(
                        "flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-[11px] text-stone-700 transition-colors dark:text-stone-200",
                        active
                          ? "border-sky-500 bg-sky-50 dark:bg-sky-950/50"
                          : "border-stone-200 bg-stone-50 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800/70 dark:hover:bg-stone-800",
                      )}
                      title={entry.id}
                    >
                      <img
                        src={entry.href}
                        alt={entry.label}
                        className="h-8 w-8 object-contain"
                      />
                      <span className="w-full truncate text-center">{entry.label}</span>
                    </button>
                  );
                })}
              </div>
              {iconPickerHasMore ? (
                <div className="flex justify-center pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setIconPickerVisibleLimit((n) => n + ICON_PICKER_PAGE_SIZE)
                    }
                    className="rounded-md border border-stone-200 bg-stone-50 px-3 py-1.5 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                  >
                    Cargar más ({iconPickerFiltered.length - iconPickerResults.length} restantes)
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
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
          @keyframes ${flowDashReverseAnimName} {
            to { stroke-dashoffset: ${FLOW_DASH_SPAN}; }
          }
          .iso-node-hoverable {
            transition: transform 180ms ease, filter 180ms ease;
            transform-box: fill-box;
            transform-origin: center center;
          }
          .iso-node-hoverable.is-hovered {
            transform: scale(1.045);
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
            const isBidirectional = bidirectionalLinkIds.has(l.id);
            const animationStyle = l.animationStyle ?? "dash";
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
                {animationStyle === "dash" ? (
                  <>
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
                    {isBidirectional ? (
                      <path
                        d={lineD}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.75)"
                        strokeWidth={sel ? 1.5 : 1.2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeDasharray={`${FLOW_DASH_LENGTH} ${FLOW_DASH_GAP}`}
                        className="iso-flow-dash"
                        style={{
                          strokeDashoffset: 0,
                          animation: `${flowDashReverseAnimName} ${FLOW_ANIMATION_SEC}s linear infinite`,
                        }}
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    <circle
                      r={sel ? 3.2 : 2.8}
                      fill="rgba(255,255,255,0.96)"
                      stroke={stroke}
                      strokeWidth={0.75}
                    >
                      <animateMotion
                        dur={`${Math.max(1.05, FLOW_ANIMATION_SEC * 1.05)}s`}
                        repeatCount="indefinite"
                        path={lineD}
                        keyPoints={isBidirectional ? "0;1;0" : "0;1"}
                        keyTimes={isBidirectional ? "0;0.5;1" : "0;1"}
                        calcMode="linear"
                      />
                    </circle>
                  </>
                )}
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
                : shape === "brand"
                  ? isoBrandGlyphExtent(cy, topPt.y)
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
                  {shape === "brand" && glyphExtent ? (() => {
                    const stroke = "rgba(30, 64, 175, 0.28)";
                    const { yTop, yBot } = glyphExtent;
                    const iconSlug = (n.iconSlug ?? "openai").trim().toLowerCase();
                    const brandIconHref = resolveBrandIconHref(n.iconSlug, googleIconPathById);
                    const sphereR = Math.min(CELL * 0.38, (yBot - yTop) * 0.46);
                    const sphereCy = (yTop + yBot) / 2 + 0.5;
                    const iconSize = sphereR * 1.45;
                    const iconX = cx - iconSize / 2;
                    const iconY = sphereCy - iconSize / 2;
                    return (
                      <>
                        <ellipse
                          cx={cx}
                          cy={cy + 3}
                          rx={sphereR * 0.92}
                          ry={sphereR * 0.36}
                          fill="rgba(15, 23, 42, 0.14)"
                          className="dark:fill-slate-950/35"
                        />
                        <circle
                          cx={cx}
                          cy={sphereCy}
                          r={sphereR}
                          fill="rgb(255 255 255)"
                          stroke={stroke}
                          strokeWidth={1}
                        />
                        <circle
                          cx={cx - sphereR * 0.24}
                          cy={sphereCy - sphereR * 0.24}
                          r={sphereR * 0.34}
                          fill="rgba(255, 255, 255, 0.34)"
                        />
                        <image
                          key={`brand-${n.id}-${iconSlug}`}
                          href={brandIconHref}
                          x={iconX}
                          y={iconY}
                          width={iconSize}
                          height={iconSize}
                          opacity={0.98}
                          preserveAspectRatio="xMidYMid meet"
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
