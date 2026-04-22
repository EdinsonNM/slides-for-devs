import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type * as React from "react";
import {
  dedupeIsometricFlowLinks,
  getResolvedLinkEndpoints,
  sanitizeBrandIconColor,
  type IsometricFlowDiagram,
  type IsometricFlowLink,
  type IsometricFlowNode,
  type IsometricFlowNodeShape,
} from "../../../domain/entities/IsometricFlowDiagram";
import { canvasToIsoGrid, canvasToIsoGridFloat, distancePointToPolyline, nodeFoot } from "../../../utils/isometricFlowGeometry";
import {
  CELL,
  HIT_R,
  ICON_PICKER_PAGE_SIZE,
  LABEL_PILL_H,
  LABEL_STACK,
  LINK_HIT_PX,
  MARQUEE_ACTIVATE_PX,
  ORIGIN_X,
  ORIGIN_Y,
  type BrandIconCatalogEntry,
  type IconPickerPackFilter,
  type IsoViewRect,
} from "./constants";
import {
  applyIsoLinkCanonicalDrag,
  applyIsoLinkUniDrag,
  categoryFromRelativePath,
  clientToSvg,
  defaultIsoViewRect,
  displaySegToCanonical,
  groupIconPickerEntriesByHeading,
  insertWaypointOnCanonicalSegment,
  isoNodeMarqueeBounds,
  labelPillWidth,
  linkCanonicalFullGridPath,
  linkPolylinePoints,
  normalizeSimpleIconHex,
  rectsIntersect,
  sortBrandIconCatalog,
  sortBrandIconCatalogByCategory,
  sourceIsCanonicalFirstLink,
  wheelZoomEffectiveDelta,
  zoomIsoViewTowardPoint,
  type IsoMarqueeBBox,
} from "./canvasModel";
import {
  hrefFromAmazonIconRelativePath,
  hrefFromGoogleIconRelativePath,
  hrefFromLucideIconRelativePath,
  hrefFromSimpleIconRelativePath,
} from "../../../utils/isometricBrandIcon";
import type { IsometricFlowDiagramCanvasProps } from "./isometricFlowDiagramCanvasTypes";
import { useThemeOptional } from "../../../context/ThemeContext";
import type { IsoDiagramChrome } from "./canvasModel";

export function useIsometricFlowCanvasController({
  data,
  readOnly = false,
  className,
  onChange,
  slideTextOverlayToolbar,
  onEditorSurfacePointerDown,
}: IsometricFlowDiagramCanvasProps) {
  const themeOptional = useThemeOptional();
  const diagramChrome: IsoDiagramChrome = themeOptional?.isDark ? "dark" : "light";
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewRect, setViewRect] = useState<IsoViewRect>(() => defaultIsoViewRect());
  const viewRectRef = useRef<IsoViewRect>(viewRect);
  viewRectRef.current = viewRect;
  const [panDrag, setPanDrag] = useState<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startVx: number;
    startVy: number;
    startVw: number;
    startVh: number;
    /** Escala uniforme viewBox→pantalla (`meet`) al inicio del pan. */
    viewCssScale: number;
  } | null>(null);
  const uid = useId().replace(/:/g, "");
  const gradId = `${uid}-bg`;
  const shadowId = `${uid}-sh`;
  const flowDashAnimName = `${uid}-flow-dash`;
  const flowDashReverseAnimName = `${uid}-flow-dash-reverse`;
  /** Orden de selección: el último es el nodo “principal” (barra de herramientas, conectar, icono). */
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brandIconCatalog, setBrandIconCatalog] = useState<BrandIconCatalogEntry[]>([]);
  const [googleIconPathById, setGoogleIconPathById] = useState<Record<string, string>>({});
  const [amazonIconPathById, setAmazonIconPathById] = useState<Record<string, string>>({});
  const [simpleIconPathById, setSimpleIconPathById] = useState<Record<string, string>>({});
  const [simpleIconHexById, setSimpleIconHexById] = useState<Record<string, string>>({});
  const [lucideIconPathById, setLucideIconPathById] = useState<Record<string, string>>({});
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconSearchQuery, setIconSearchQuery] = useState("");
  const [iconPickerPackFilter, setIconPickerPackFilter] = useState<IconPickerPackFilter>("all");
  const [iconPickerGroupByCategory, setIconPickerGroupByCategory] = useState(false);
  const [iconPickerVisibleLimit, setIconPickerVisibleLimit] = useState(ICON_PICKER_PAGE_SIZE);
  const [drag, setDrag] = useState<{
    /** Nodo bajo el puntero; la rejilla se calcula respecto a su pie. */
    primaryId: string;
    offsetX: number;
    offsetY: number;
    /** Posición en rejilla al inicio del gesto para cada nodo arrastrado (selección al pointerdown). */
    startById: Record<string, { gx: number; gy: number }>;
  } | null>(null);
  const [linkSegDrag, setLinkSegDrag] = useState<{
    linkId: string;
    /** Índice del tramo en orden canónico (id menor → id mayor), fijado al pulsar. */
    canonicalSegIndex: number;
  } | null>(null);

  /** Selección tipo explorador: arrastrar en vacío para encuadrar bloques (ref + listeners globales). */
  const marqueeSessionRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    x0: number;
    y0: number;
    extend: boolean;
    active: boolean;
  } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);

  const primarySelectedId =
    selectedNodeIds.length > 0
      ? selectedNodeIds[selectedNodeIds.length - 1]!
      : null;
  const selectedNodeIdSet = useMemo(
    () => new Set(selectedNodeIds),
    [selectedNodeIds],
  );

  const emit = useCallback(
    (next: IsometricFlowDiagram) => {
      onChange?.(next);
    },
    [onChange],
  );

  const dataRef = useRef(data);
  if (!linkSegDrag) {
    dataRef.current = data;
  }
  const emitRef = useRef(emit);
  emitRef.current = emit;

  useEffect(() => {
    if (readOnly) return;
    const onMove = (ev: PointerEvent) => {
      const m = marqueeSessionRef.current;
      if (!m || ev.pointerId !== m.pointerId) return;
      const svg = svgRef.current;
      if (!svg) return;
      const { x, y } = clientToSvg(svg, ev.clientX, ev.clientY);
      if (!m.active) {
        if (
          Math.hypot(ev.clientX - m.startClientX, ev.clientY - m.startClientY) <
          MARQUEE_ACTIVATE_PX
        ) {
          return;
        }
        m.active = true;
      }
      setMarqueeRect({ x0: m.x0, y0: m.y0, x1: x, y1: y });
    };
    const finish = (ev: PointerEvent) => {
      const m = marqueeSessionRef.current;
      if (!m || ev.pointerId !== m.pointerId) return;
      const svg = svgRef.current;
      marqueeSessionRef.current = null;
      setMarqueeRect(null);
      if (svg) {
        try {
          svg.releasePointerCapture(ev.pointerId);
        } catch {
          /* noop */
        }
      }
      const { x: x1, y: y1 } = svg
        ? clientToSvg(svg, ev.clientX, ev.clientY)
        : { x: m.x0, y: m.y0 };
      if (!m.active) {
        if (!m.extend) {
          setSelectedNodeIds([]);
        }
        return;
      }
      const dx = Math.abs(x1 - m.x0);
      const dy = Math.abs(y1 - m.y0);
      if (dx < 2 && dy < 2) {
        if (!m.extend) {
          setSelectedNodeIds([]);
        }
        return;
      }
      const r: IsoMarqueeBBox = {
        minX: Math.min(m.x0, x1),
        maxX: Math.max(m.x0, x1),
        minY: Math.min(m.y0, y1),
        maxY: Math.max(m.y0, y1),
      };
      const nodes = dataRef.current.nodes;
      const hits = nodes
        .filter((n) => rectsIntersect(isoNodeMarqueeBounds(n), r))
        .sort((a, b) => a.gx + a.gy - (b.gx + b.gy))
        .map((n) => n.id);
      setSelectedNodeIds((prev) => {
        if (!m.extend) return hits;
        const seen = new Set(prev);
        const out = [...prev];
        for (const id of hits) {
          if (!seen.has(id)) {
            seen.add(id);
            out.push(id);
          }
        }
        return out;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, [readOnly]);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      fetch("/lobe-icons/manifest.json").then((r) => (r.ok ? r.json() : [])),
      fetch("/google-icons/manifest.json").then((r) => (r.ok ? r.json() : null)),
      fetch("/amazon-icons/manifest.json").then((r) => (r.ok ? r.json() : null)),
      fetch("/simple-icons/manifest.json").then((r) => (r.ok ? r.json() : null)),
      fetch("/lucide-icons/manifest.json").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(
        ([lobeList, googleDoc, amazonDoc, simpleDoc, lucideDoc]: [
          unknown,
          unknown,
          unknown,
          unknown,
          unknown,
        ]) => {
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
              const cat = categoryFromRelativePath(path, "Google Cloud");
              googleEntries.push({
                id,
                label,
                href: hrefFromGoogleIconRelativePath(path),
                pack: "google",
                category: cat,
              });
            }
          }
        }

        const amazonPathById: Record<string, string> = {};
        const amazonEntries: BrandIconCatalogEntry[] = [];
        if (amazonDoc && typeof amazonDoc === "object") {
          const icons = (amazonDoc as { icons?: unknown }).icons;
          if (Array.isArray(icons)) {
            for (const raw of icons) {
              if (!raw || typeof raw !== "object") continue;
              const o = raw as Record<string, unknown>;
              if (typeof o.id !== "string" || typeof o.path !== "string") continue;
              const id = o.id.trim().toLowerCase();
              const path = o.path.trim();
              if (!id || !path) continue;
              amazonPathById[id] = path;
              const label =
                typeof o.label === "string" && o.label.trim()
                  ? o.label.trim()
                  : id.replace(/^aws:/, "").replace(/__/g, " / ");
              const cat = categoryFromRelativePath(path, "AWS");
              amazonEntries.push({
                id,
                label,
                href: hrefFromAmazonIconRelativePath(path),
                pack: "amazon",
                category: cat,
              });
            }
          }
        }

        const simplePathById: Record<string, string> = {};
        const simpleHexById: Record<string, string> = {};
        const simpleEntries: BrandIconCatalogEntry[] = [];
        if (simpleDoc && typeof simpleDoc === "object") {
          const icons = (simpleDoc as { icons?: unknown }).icons;
          if (Array.isArray(icons)) {
            for (const raw of icons) {
              if (!raw || typeof raw !== "object") continue;
              const o = raw as Record<string, unknown>;
              if (typeof o.id !== "string" || typeof o.path !== "string") continue;
              const id = o.id.trim().toLowerCase();
              const relPath = o.path.trim();
              if (!id || !relPath) continue;
              simplePathById[id] = relPath;
              if (typeof o.hex === "string") {
                const hx = normalizeSimpleIconHex(o.hex);
                if (hx) simpleHexById[id] = hx;
              }
              const label =
                typeof o.label === "string" && o.label.trim()
                  ? o.label.trim()
                  : id.replace(/^si:/, "").replace(/-/g, " ");
              simpleEntries.push({
                id,
                label,
                href: hrefFromSimpleIconRelativePath(relPath),
                pack: "simpleicons",
                category: "Simple Icons",
              });
            }
          }
        }

        const lucidePathById: Record<string, string> = {};
        const lucideEntries: BrandIconCatalogEntry[] = [];
        if (lucideDoc && typeof lucideDoc === "object") {
          const icons = (lucideDoc as { icons?: unknown }).icons;
          if (Array.isArray(icons)) {
            for (const raw of icons) {
              if (!raw || typeof raw !== "object") continue;
              const o = raw as Record<string, unknown>;
              if (typeof o.id !== "string" || typeof o.path !== "string") continue;
              const id = o.id.trim().toLowerCase();
              const relPath = o.path.trim();
              if (!id || !relPath) continue;
              lucidePathById[id] = relPath;
              const label =
                typeof o.label === "string" && o.label.trim()
                  ? o.label.trim()
                  : id.replace(/^li:/, "").replace(/-/g, " ");
              const cat =
                typeof o.category === "string" && o.category.trim()
                  ? o.category.trim()
                  : "Lucide";
              lucideEntries.push({
                id,
                label,
                href: hrefFromLucideIconRelativePath(relPath),
                pack: "lucide",
                category: cat,
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
          pack: "lobe",
          category: "Lobe Icons",
        }));

        setGoogleIconPathById(googlePathById);
        setAmazonIconPathById(amazonPathById);
        setSimpleIconPathById(simplePathById);
        setSimpleIconHexById(simpleHexById);
        setLucideIconPathById(lucidePathById);
        setBrandIconCatalog(
          sortBrandIconCatalog([
            ...googleEntries,
            ...amazonEntries,
            ...simpleEntries,
            ...lucideEntries,
            ...lobeEntries,
          ]),
        );
      })
      .catch(() => {
        if (!alive) return;
        setGoogleIconPathById({});
        setAmazonIconPathById({});
        setSimpleIconPathById({});
        setSimpleIconHexById({});
        setLucideIconPathById({});
        setBrandIconCatalog([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!iconPickerOpen) return;
    setIconSearchQuery("");
    setIconPickerPackFilter("all");
  }, [iconPickerOpen]);

  useEffect(() => {
    if (!iconPickerOpen) return;
    setIconPickerVisibleLimit(ICON_PICKER_PAGE_SIZE);
  }, [iconPickerOpen, iconSearchQuery, iconPickerPackFilter, iconPickerGroupByCategory]);

  useEffect(() => {
    const onWheel = (ev: WheelEvent) => {
      /* El overlay del picker es absolute sobre el mismo área que el SVG: el hit-test por
       * rectángulo del SVG sigue siendo true y robaba el wheel al listado con scroll. */
      if (iconPickerOpen) return;
      const svg = svgRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      if (
        ev.clientX < r.left ||
        ev.clientX > r.right ||
        ev.clientY < r.top ||
        ev.clientY > r.bottom
      ) {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      const { x: sx, y: sy } = clientToSvg(svg, ev.clientX, ev.clientY);
      const prev = viewRectRef.current;
      const dy = wheelZoomEffectiveDelta(ev);
      const next = zoomIsoViewTowardPoint(prev, sx, sy, dy);
      viewRectRef.current = next;
      setViewRect(next);
    };
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [iconPickerOpen]);

  useEffect(() => {
    if (!panDrag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const { pointerId } = panDrag;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dcx = ev.clientX - panDrag.startClientX;
      const dcy = ev.clientY - panDrag.startClientY;
      const s = panDrag.viewCssScale;
      const next: IsoViewRect = {
        x: panDrag.startVx - dcx / s,
        y: panDrag.startVy - dcy / s,
        w: panDrag.startVw,
        h: panDrag.startVh,
      };
      viewRectRef.current = next;
      setViewRect(next);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      setPanDrag(null);
      try {
        svg.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [panDrag]);

  useEffect(() => {
    if (selectedNodeIds.length === 0) {
      setIconPickerOpen(false);
      setIconSearchQuery("");
    }
  }, [data.nodes, selectedNodeIds.length]);

  const selectedNode = useMemo(
    () =>
      primarySelectedId
        ? (data.nodes.find((n) => n.id === primarySelectedId) ?? null)
        : null,
    [data.nodes, primarySelectedId],
  );

  useEffect(() => {
    const valid = new Set(data.nodes.map((n) => n.id));
    setSelectedNodeIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) {
        return prev;
      }
      return next;
    });
  }, [data.nodes]);

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

  const brandIconCatalogByPack = useMemo(() => {
    if (!brandIconCatalog.length) return [];
    if (iconPickerPackFilter === "all") return brandIconCatalog;
    return brandIconCatalog.filter((e) => e.pack === iconPickerPackFilter);
  }, [brandIconCatalog, iconPickerPackFilter]);

  const iconPickerFiltered = useMemo(() => {
    const q = iconSearchQuery.trim().toLowerCase();
    if (!q) {
      if (!brandIconCatalogByPack.length) return [];
      return brandIconCatalogByPack;
    }
    if (!brandIconCatalog.length) return [];
    const matched = brandIconCatalog.filter(
      (e) =>
        e.id.includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.id.replace(/^g:/, "").includes(q) ||
        e.id.replace(/^aws:/, "").includes(q) ||
        e.id.replace(/^si:/, "").includes(q) ||
        e.id.replace(/^li:/, "").includes(q),
    );
    return sortBrandIconCatalog(matched);
  }, [brandIconCatalog, brandIconCatalogByPack, iconSearchQuery]);

  const iconPickerOrderedFlat = useMemo(() => {
    if (!iconPickerGroupByCategory) return iconPickerFiltered;
    return sortBrandIconCatalogByCategory(iconPickerFiltered);
  }, [iconPickerFiltered, iconPickerGroupByCategory]);

  const iconPickerResults = useMemo(
    () => iconPickerOrderedFlat.slice(0, iconPickerVisibleLimit),
    [iconPickerOrderedFlat, iconPickerVisibleLimit],
  );

  const iconPickerGroupedSections = useMemo(() => {
    if (!iconPickerGroupByCategory) return null;
    return groupIconPickerEntriesByHeading(iconPickerResults, iconPickerPackFilter);
  }, [iconPickerGroupByCategory, iconPickerResults, iconPickerPackFilter]);

  const iconPickerHasMore = iconPickerOrderedFlat.length > iconPickerResults.length;

  const pickNodeAt = useCallback(
    (sx: number, sy: number): IsometricFlowNode | null => {
      const depthKey = (n: IsometricFlowNode) => n.gx + n.gy;
      const sortedByDepth = [...data.nodes].sort(
        (a, b) => depthKey(a) - depthKey(b),
      );
      for (let i = sortedByDepth.length - 1; i >= 0; i--) {
        const n = sortedByDepth[i]!;
        const { x: cx, y: cy } = nodeFoot(n.gx, n.gy, CELL, ORIGIN_X, ORIGIN_Y);
        const labelForPill =
          editingId === n.id ? n.label : n.label.slice(0, 24);
        const pillW = labelPillWidth(labelForPill);
        const pillLeft = cx - pillW / 2;
        const pillTop = cy - LABEL_STACK - LABEL_PILL_H;
        if (
          sx >= pillLeft &&
          sx <= pillLeft + pillW &&
          sy >= pillTop &&
          sy <= pillTop + LABEL_PILL_H
        ) {
          return n;
        }
      }

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
    [data.nodes, editingId],
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
          setSelectedNodeIds([next.nodes[next.nodes.length - 1]!.id]);
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

  const removeSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const removeSet = new Set(selectedNodeIds);
    const next: IsometricFlowDiagram = {
      ...data,
      nodes: data.nodes.filter((n) => !removeSet.has(n.id)),
      links: data.links.filter(
        (l) => !removeSet.has(l.from) && !removeSet.has(l.to),
      ),
    };
    emit(next);
    setSelectedNodeIds([]);
    setConnectFrom(null);
    setSelectedLinkId(null);
  }, [data, emit, selectedNodeIds]);

  const removeSelection = useCallback(() => {
    if (selectedLinkId) {
      removeSelectedLink();
      return;
    }
    removeSelectedNodes();
  }, [removeSelectedLink, removeSelectedNodes, selectedLinkId]);

  const onSvgPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.stopPropagation();
      onEditorSurfacePointerDown?.();
      const svg = svgRef.current;
      if (!svg) return;

      if (!readOnly && editingId !== null) {
        const { x: sx, y: sy } = clientToSvg(svg, e.clientX, e.clientY);
        const node = data.nodes.find((nn) => nn.id === editingId);
        if (!node) {
          setEditingId(null);
        } else {
          const { x: cx, y: cy } = nodeFoot(
            node.gx,
            node.gy,
            CELL,
            ORIGIN_X,
            ORIGIN_Y,
          );
          const pillW = labelPillWidth(node.label);
          const pillLeft = cx - pillW / 2;
          const pillTop = cy - LABEL_STACK - LABEL_PILL_H;
          const inPill =
            sx >= pillLeft &&
            sx <= pillLeft + pillW &&
            sy >= pillTop &&
            sy <= pillTop + LABEL_PILL_H;
          if (!inPill) setEditingId(null);
        }
      }

      const startPan = (pointerId: number) => {
        const vr = viewRectRef.current;
        const r = svg.getBoundingClientRect();
        const viewCssScale = Math.min(r.width / vr.w, r.height / vr.h);
        setPanDrag({
          pointerId,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startVx: vr.x,
          startVy: vr.y,
          startVw: vr.w,
          startVh: vr.h,
          viewCssScale: viewCssScale > 0 ? viewCssScale : 1,
        });
        svg.setPointerCapture(pointerId);
      };

      if (e.button === 1) {
        e.preventDefault();
        startPan(e.pointerId);
        return;
      }

      if (readOnly) {
        if (e.button === 0 && e.altKey) {
          e.preventDefault();
          startPan(e.pointerId);
        }
        return;
      }

      if (e.button === 0 && e.altKey) {
        const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
        if (!pickNodeAt(x, y) && !pickLinkAt(x, y)) {
          e.preventDefault();
          startPan(e.pointerId);
          return;
        }
      }

      if (e.button !== 0) return;

      const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
      const hit = pickNodeAt(x, y);

      if (connectFrom) {
        marqueeSessionRef.current = null;
        setMarqueeRect(null);
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
        marqueeSessionRef.current = null;
        setMarqueeRect(null);
        setSelectedLinkId(null);
        const extend =
          e.shiftKey || e.metaKey || e.ctrlKey;
        let nextSelection: string[];
        if (extend) {
          if (selectedNodeIds.includes(hit.id)) {
            nextSelection = selectedNodeIds.filter((id) => id !== hit.id);
          } else {
            nextSelection = [...selectedNodeIds, hit.id];
          }
        } else if (selectedNodeIds.includes(hit.id)) {
          /** Clic en un nodo ya seleccionado: conservar el grupo (p. ej. tras marquee) para arrastrar todos. */
          nextSelection = selectedNodeIds;
        } else {
          nextSelection = [hit.id];
        }
        setSelectedNodeIds(nextSelection);
        if (nextSelection.includes(hit.id)) {
          const startById: Record<string, { gx: number; gy: number }> = {};
          for (const id of nextSelection) {
            const node = data.nodes.find((nn) => nn.id === id);
            if (node) startById[id] = { gx: node.gx, gy: node.gy };
          }
          const { x: nx, y: ny } = nodeFoot(hit.gx, hit.gy, CELL, ORIGIN_X, ORIGIN_Y);
          setDrag({
            primaryId: hit.id,
            offsetX: x - nx,
            offsetY: y - ny,
            startById,
          });
        }
        e.preventDefault();
        return;
      }

      const linkHit = pickLinkAt(x, y);
      if (linkHit) {
        marqueeSessionRef.current = null;
        setMarqueeRect(null);
        setSelectedNodeIds([]);
        setConnectFrom(null);
        setSelectedLinkId(linkHit.id);
        e.preventDefault();
        return;
      }

      setSelectedLinkId(null);
      setConnectFrom(null);
      marqueeSessionRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        x0: x,
        y0: y,
        extend: e.shiftKey || e.metaKey || e.ctrlKey,
        active: false,
      };
      setMarqueeRect(null);
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      e.preventDefault();
    },
    [
      readOnly,
      connectFrom,
      data,
      editingId,
      emit,
      onEditorSurfacePointerDown,
      pickLinkAt,
      pickNodeAt,
      selectedNodeIds,
      setEditingId,
    ],
  );

  const resetIsoView = useCallback(() => {
    const next = defaultIsoViewRect();
    viewRectRef.current = next;
    setViewRect(next);
  }, []);

  useEffect(() => {
    if (readOnly || !drag) return;
    const svg = svgRef.current;
    if (!svg) return;

    const onMove = (ev: PointerEvent) => {
      const { x, y } = clientToSvg(svg, ev.clientX, ev.clientY);
      const adjX = x - drag.offsetX;
      const adjY = y - drag.offsetY;
      const { gx: newPrimaryGx, gy: newPrimaryGy } = canvasToIsoGrid(
        adjX,
        adjY,
        CELL,
        ORIGIN_X,
        ORIGIN_Y,
      );
      const d = dataRef.current;
      const primaryStart = drag.startById[drag.primaryId];
      if (!primaryStart) return;
      const dgx = newPrimaryGx - primaryStart.gx;
      const dgy = newPrimaryGy - primaryStart.gy;
      const nextNodes = d.nodes.map((n) => {
        const s = drag.startById[n.id];
        if (!s) return n;
        return { ...n, gx: s.gx + dgx, gy: s.gy + dgy };
      });
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

  useLayoutEffect(() => {
    if (readOnly || !linkSegDrag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const { linkId, canonicalSegIndex } = linkSegDrag;

    const onMove = (ev: PointerEvent) => {
      const { x, y } = clientToSvg(svg, ev.clientX, ev.clientY);
      const { gx: sfx, gy: sfy } = canvasToIsoGridFloat(
        x,
        y,
        CELL,
        ORIGIN_X,
        ORIGIN_Y,
      );

      const d = dataRef.current;
      const link = d.links.find((ll) => ll.id === linkId);
      if (!link) return;

      const flat =
        link.bendOffset &&
        (!link.routeWaypoints || link.routeWaypoints.length === 0)
          ? { ...link, bendOffset: undefined }
          : link;
      const G = linkCanonicalFullGridPath(flat, d.nodes);
      if (!G || G.length < 2) return;

      const nextFull =
        applyIsoLinkUniDrag(G, canonicalSegIndex, sfx, sfy) ??
        applyIsoLinkCanonicalDrag(G, canonicalSegIndex, sfx, sfy);
      if (!nextFull) return;

      const internals = nextFull.slice(1, -1);
      const nextDiagram: IsometricFlowDiagram = {
        ...d,
        links: d.links.map((ll) => {
          if (ll.id !== linkId) return ll;
          const { bendOffset: _b, routeWaypoints: _rw, ...rest } = ll;
          return {
            ...rest,
            ...(internals.length > 0 ? { routeWaypoints: internals } : {}),
          };
        }),
      };
      dataRef.current = nextDiagram;
      emitRef.current(nextDiagram);
    };

    const onUp = () => {
      setLinkSegDrag(null);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [readOnly, linkSegDrag]);

  const onSvgDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (readOnly) return;
      e.stopPropagation();
      if (editingId !== null) return;
      const svg = svgRef.current;
      if (!svg) return;
      const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
      const hit = pickNodeAt(x, y);
      if (hit) {
        const { x: cx, y: cy } = nodeFoot(hit.gx, hit.gy, CELL, ORIGIN_X, ORIGIN_Y);
        const labelForPill =
          editingId === hit.id ? hit.label : hit.label.slice(0, 24);
        const pillW = labelPillWidth(labelForPill);
        const pillLeft = cx - pillW / 2;
        const pillTop = cy - LABEL_STACK - LABEL_PILL_H;
        const onLabelPill =
          x >= pillLeft &&
          x <= pillLeft + pillW &&
          y >= pillTop &&
          y <= pillTop + LABEL_PILL_H;
        if (onLabelPill) {
          setEditingId(hit.id);
          setSelectedNodeIds([hit.id]);
        }
        return;
      }
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
      setSelectedNodeIds([id]);
      setSelectedLinkId(null);
    },
    [readOnly, editingId, data, emit, pickNodeAt, setEditingId, setSelectedNodeIds],
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

  const resetLinkBend = useCallback(() => {
    if (!selectedLinkId) return;
    emit({
      ...data,
      links: data.links.map((ll) => {
        if (ll.id !== selectedLinkId) return ll;
        const { bendOffset: _b, routeWaypoints: _r, ...rest } = ll;
        return rest;
      }),
    });
  }, [data, emit, selectedLinkId]);

  const splitLinkAtDisplaySegment = useCallback(
    (linkIdForSplit: string, displaySegIndex: number, clientX: number, clientY: number) => {
      if (readOnly) return;
      const svg = svgRef.current;
      if (!svg) return;
      const { x, y } = clientToSvg(svg, clientX, clientY);
      const { gx: sfx, gy: sfy } = canvasToIsoGridFloat(
        x,
        y,
        CELL,
        ORIGIN_X,
        ORIGIN_Y,
      );
      const d = dataRef.current;
      const link = d.links.find((ll) => ll.id === linkIdForSplit);
      if (!link) return;
      const flat =
        link.bendOffset &&
        (!link.routeWaypoints || link.routeWaypoints.length === 0)
          ? { ...link, bendOffset: undefined }
          : link;
      const G = linkCanonicalFullGridPath(flat, d.nodes);
      if (!G || G.length < 2) return;
      const srcFirst = sourceIsCanonicalFirstLink(link, d.nodes);
      const canonicalSeg = displaySegToCanonical(
        displaySegIndex,
        G.length,
        srcFirst,
      );
      const nextFull = insertWaypointOnCanonicalSegment(G, canonicalSeg, sfx, sfy);
      if (!nextFull) return;
      const internals = nextFull.slice(1, -1);
      if (internals.length > 32) return;
      emit({
        ...d,
        links: d.links.map((ll) => {
          if (ll.id !== linkIdForSplit) return ll;
          const { bendOffset: _b, routeWaypoints: _rw, ...rest } = ll;
          return {
            ...rest,
            routeWaypoints: internals,
          };
        }),
      });
    },
    [emit, readOnly],
  );

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
      ...(selected.bendOffset ? { bendOffset: { ...selected.bendOffset } } : {}),
      ...(selected.routeWaypoints?.length
        ? {
            routeWaypoints: selected.routeWaypoints.map((p) => ({
              gx: p.gx,
              gy: p.gy,
            })),
          }
        : {}),
    };
    emit({
      ...data,
      links: dedupeIsometricFlowLinks([...data.links, newLink], newId),
    });
  }, [data, emit, selectedLinkId]);

  const setSelectedNodeShape = useCallback(
    (shape: IsometricFlowNodeShape) => {
      if (!primarySelectedId) return;
      emit({
        ...data,
        nodes: data.nodes.map((nn) =>
          nn.id === primarySelectedId ? { ...nn, shape } : nn,
        ),
      });
    },
    [data, emit, primarySelectedId],
  );

  const setSelectedNodeIconSlug = useCallback(
    (slug: string) => {
      if (!primarySelectedId) return;
      const clean = slug.trim().toLowerCase();
      emit({
        ...data,
        nodes: data.nodes.map((nn) =>
          nn.id === primarySelectedId
            ? {
                ...nn,
                ...(clean ? { iconSlug: clean } : {}),
                ...(clean ? {} : { iconSlug: undefined }),
              }
            : nn,
        ),
      });
    },
    [data, emit, primarySelectedId],
  );

  const setSelectedNodeBrandIcon = useCallback(
    (slug: string) => {
      if (!primarySelectedId) return;
      const clean = slug.trim().toLowerCase();
      emit({
        ...data,
        nodes: data.nodes.map((nn) =>
          nn.id === primarySelectedId
            ? {
                ...nn,
                shape: "brand",
                ...(clean ? { iconSlug: clean } : { iconSlug: "openai" }),
                brandIconColor: undefined,
              }
            : nn,
        ),
      });
    },
    [data, emit, primarySelectedId],
  );

  const setSelectedNodeBrandIconColor = useCallback(
    (cssColor: string | null) => {
      if (!primarySelectedId) return;
      const sanitized = cssColor != null ? sanitizeBrandIconColor(cssColor) : undefined;
      emit({
        ...data,
        nodes: data.nodes.map((nn) => {
          if (nn.id !== primarySelectedId) return nn;
          if (!sanitized) {
            const { brandIconColor: _c, ...rest } = nn;
            return rest;
          }
          return { ...nn, brandIconColor: sanitized };
        }),
      });
    },
    [data, emit, primarySelectedId],
  );

  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const ms = marqueeSessionRef.current;
        if (ms && svgRef.current) {
          try {
            svgRef.current.releasePointerCapture(ms.pointerId);
          } catch {
            /* noop */
          }
        }
        marqueeSessionRef.current = null;
        setMarqueeRect(null);
        setConnectFrom(null);
        setEditingId(null);
        setSelectedLinkId(null);
        setLinkSegDrag(null);
        setSelectedNodeIds([]);
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        (selectedNodeIds.length > 0 || selectedLinkId) &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        removeSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, removeSelection, selectedNodeIds.length, selectedLinkId]);

  return {
    className,
    data,
    readOnly,
    slideTextOverlayToolbar,
    onEditorSurfacePointerDown,
    svgRef,
    viewRect,
    panDrag,
    marqueeRect,
    uid,
    gradId,
    shadowId,
    flowDashAnimName,
    flowDashReverseAnimName,
    selectedNodeIds,
    selectedLinkId,
    hoveredNodeId,
    connectFrom,
    editingId,
    simpleIconHexById,
    googleIconPathById,
    amazonIconPathById,
    simpleIconPathById,
    lucideIconPathById,
    iconPickerOpen,
    iconSearchQuery,
    iconPickerPackFilter,
    iconPickerGroupByCategory,
    iconPickerVisibleLimit,
    primarySelectedId,
    selectedNode,
    selectedNodeIdSet,
    bidirectionalLinkIds,
    iconPickerHasMore,
    iconPickerGroupedSections,
    iconPickerResults,
    iconPickerOrderedFlat,
    addNode,
    removeSelection,
    setSelectedLinkId,
    setConnectFrom,
    setSelectedNodeShape,
    setIconPickerOpen,
    setSelectedNodeBrandIconColor,
    setLinkStrokeColor,
    toggleLinkReversed,
    resetLinkBend,
    toggleLinkAnimationStyle,
    addReverseLink,
    resetIsoView,
    onSvgPointerDown,
    onSvgDoubleClick,
    pickNodeAt,
    emit,
    splitLinkAtDisplaySegment,
    setEditingId,
    setSelectedNodeIds,
    setHoveredNodeId,
    setLinkSegDrag,
    setIconSearchQuery,
    setIconPickerPackFilter,
    setIconPickerGroupByCategory,
    setIconPickerVisibleLimit,
    setSelectedNodeBrandIcon,
    diagramChrome,
  };
}

export type IsometricFlowCanvasController = ReturnType<typeof useIsometricFlowCanvasController>;
