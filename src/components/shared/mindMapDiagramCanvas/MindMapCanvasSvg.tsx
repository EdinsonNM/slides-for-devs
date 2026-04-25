import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { MindMapCanvasController } from "./useMindMapCanvasController";
import type { MindMapNode, MindMapLink } from "../../../domain/entities/MindMapDiagram";
import { SlideCanvasBlockStyleSelectionFrame } from "../../editor/CanvaSelectionFrame";
import { cn } from "../../../utils/cn";

const WORLD = 2000;
const CX = WORLD / 2;
const CY = WORLD / 2;

const NODE_SPRING = { type: "spring" as const, stiffness: 420, damping: 30, mass: 0.38 };

/** Anillos que “emiten” desde el nodo (ondas sucesivas). */
function NodePulseRings({
  ncx,
  ncy,
  r,
  color,
  isRoot,
  staggerIndex,
  active,
}: {
  ncx: number;
  ncy: number;
  r: number;
  color: string;
  isRoot: boolean;
  staggerIndex: number;
  active: boolean;
}) {
  if (!active) return null;
  const expand = isRoot ? 42 : 26;
  const dur = isRoot ? 2.45 : 2.05;
  const ease = [0.2, 0.85, 0.35, 1] as [number, number, number, number];
  const wave = (staggerIndex % 7) * 0.11;
  return (
    <>
      <motion.circle
        cx={ncx}
        cy={ncy}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={isRoot ? 2.25 : 1.35}
        className="pointer-events-none"
        initial={false}
        animate={{
          r: [r * 0.98, r + expand],
          opacity: [0.5, 0],
          strokeOpacity: [0.85, 0],
        }}
        transition={{
          duration: dur,
          repeat: Number.POSITIVE_INFINITY,
          ease,
          delay: wave,
        }}
      />
      <motion.circle
        cx={ncx}
        cy={ncy}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={isRoot ? 1.85 : 1.1}
        className="pointer-events-none"
        initial={false}
        animate={{
          r: [r * 0.98, r + expand * 0.92],
          opacity: [0.38, 0],
          strokeOpacity: [0.65, 0],
        }}
        transition={{
          duration: dur,
          repeat: Number.POSITIVE_INFINITY,
          ease,
          delay: wave + dur * 0.5,
        }}
      />
    </>
  );
}

function mindMapViewBox(
  vpW: number,
  vpH: number,
  panX: number,
  panY: number,
  zoom: number,
): { minX: number; minY: number; vbW: number; vbH: number } {
  const z = Math.max(0.1, Math.min(5, zoom));
  const vbW = vpW / z;
  const vbH = vpH / z;
  const camX = CX - panX / z;
  const camY = CY - panY / z;
  return {
    minX: camX - vbW / 2,
    minY: camY - vbH / 2,
    vbW,
    vbH,
  };
}

const DESCRIPTION_PANEL_W = 300;
const DESCRIPTION_PANEL_H = 380;
/** Márgen respecto al rectángulo visible (viewBox = área del slide en pantalla). */
const SLIDE_DESC_INSET = 16;

/** Esquina superior izquierda del panel: fija al borde inferior derecho del slide visible. */
function descriptionPanelSlideBottomRight(
  minX: number,
  minY: number,
  vbW: number,
  vbH: number,
  panelW: number,
  panelH: number,
  inset: number,
): { x: number; y: number } {
  return {
    x: minX + vbW - panelW - inset,
    y: minY + vbH - panelH - inset,
  };
}

const DESC_SIZE_MIN_W = 120;
const DESC_SIZE_MIN_H = 64;

type MindMapDescriptionResizableBoxProps = {
  width: number;
  height: number;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
  onSizeChange: (w: number, h: number) => void;
  children: ReactNode;
};

/** Contenedor con `resize` nativo y `ResizeObserver` para persistir dimensiones. */
function MindMapDescriptionResizableBox({
  width,
  height,
  minW,
  minH,
  maxW,
  maxH,
  onSizeChange,
  children,
}: MindMapDescriptionResizableBoxProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const lastReported = useRef({ w: width, h: height });

  useLayoutEffect(() => {
    lastReported.current = { w: width, h: height };
  }, [width, height]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!boxRef.current) return;
      let rw = boxRef.current.offsetWidth;
      let rh = boxRef.current.offsetHeight;
      rw = Math.min(maxW, Math.max(minW, Math.round(rw)));
      rh = Math.min(maxH, Math.max(minH, Math.round(rh)));
      if (
        Math.abs(rw - lastReported.current.w) < 0.5 &&
        Math.abs(rh - lastReported.current.h) < 0.5
      ) {
        return;
      }
      lastReported.current = { w: rw, h: rh };
      onSizeChange(rw, rh);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [minW, minH, maxW, maxH, onSizeChange]);

  return (
    <div
      ref={boxRef}
      data-mind-map-ui
      className="box-border flex min-h-0 w-full min-w-0 flex-col overflow-auto resize"
      style={{
        width,
        height,
        minWidth: minW,
        minHeight: minH,
        maxWidth: maxW,
        maxHeight: maxH,
        pointerEvents: "auto",
        boxSizing: "border-box",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function MindMapCanvasSvg({ ctrl }: { ctrl: MindMapCanvasController }) {
  const {
    data,
    handlePointerDownNode,
    activeDragNodeId,
    dragPos,
    selectedNodeId,
    toggleNodeCollapse,
    updateNodeLabel,
    updateNodeDescription,
    updateNodeDescriptionSize,
    readOnly,
    zoom,
  } = ctrl;

  const reduced = useReducedMotion() ?? false;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: 800, h: 600 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setVp({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setVp({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    return () => ro.disconnect();
  }, []);

  const { minX, minY, vbW, vbH } = mindMapViewBox(vp.w, vp.h, ctrl.panX, ctrl.panY, zoom);
  const viewBoxStr = `${minX} ${minY} ${vbW} ${vbH}`;

  const { visibleNodes, visibleLinks, nodeStaggerMap } = useMemo(() => {
    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
    const childMap = new Map<string, string[]>();
    const hasChildren = new Set<string>();

    for (const l of data.links) {
      if (!childMap.has(l.from)) childMap.set(l.from, []);
      childMap.get(l.from)!.push(l.to);
      hasChildren.add(l.from);
    }

    const incoming = new Set(data.links.map((l) => l.to));
    const roots = data.nodes.filter((n) => !incoming.has(n.id));

    const visibleNodeIds = new Set<string>();
    const visibleLinksArr: MindMapLink[] = [];

    const traverse = (nodeId: string, isVisible: boolean) => {
      if (isVisible) visibleNodeIds.add(nodeId);
      const node = nodeMap.get(nodeId);
      if (!node) return;

      const children = childMap.get(nodeId) || [];
      const childrenVisible = isVisible && !node.collapsed;

      for (const childId of children) {
        if (childrenVisible) {
          const link = data.links.find((l) => l.from === nodeId && l.to === childId);
          if (link) visibleLinksArr.push(link);
        }
        traverse(childId, childrenVisible);
      }
    };

    for (const root of roots) traverse(root.id, true);
    for (const node of data.nodes) {
      if (!visibleNodeIds.has(node.id) && !incoming.has(node.id)) traverse(node.id, true);
    }

    const vis = data.nodes
      .filter((n) => visibleNodeIds.has(n.id))
      .map((n) => ({ ...n, hasChildren: hasChildren.has(n.id) }));
    const stagger: Record<string, number> = {};
    vis.forEach((n, i) => {
      stagger[n.id] = i;
    });

    return { visibleNodes: vis, visibleLinks: visibleLinksArr, nodeStaggerMap: stagger };
  }, [data]);

  const onNodePointerDown = useCallback(
    (id: string, e: React.PointerEvent) => {
      e.stopPropagation();
      handlePointerDownNode(id, e);
    },
    [handlePointerDownNode],
  );

  const descriptionTarget = useMemo(() => {
    if (!selectedNodeId) return null;
    return data.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [data.nodes, selectedNodeId]);

  const isSelectedNodeVisible = useMemo(
    () =>
      selectedNodeId != null && visibleNodes.some((n) => n.id === selectedNodeId),
    [visibleNodes, selectedNodeId],
  );

  const showDescriptionPanel = Boolean(
    selectedNodeId != null &&
    descriptionTarget &&
    isSelectedNodeVisible &&
    (!readOnly ||
      (descriptionTarget.description && descriptionTarget.description.trim().length > 0)),
  );

  /* Alineado con `IsoGridBackground` (rejilla isométrica). */
  const gridStroke = "rgba(148, 163, 184, 0.45)";
  const gridStrokeAlt = "rgba(100, 116, 139, 0.35)";
  const gridStrokeDark = "rgba(148, 163, 184, 0.22)";
  const gridStrokeDarkAlt = "rgba(100, 116, 139, 0.2)";

  return (
    <div ref={wrapRef} className="absolute inset-0 select-none touch-none overflow-hidden">
      <svg
        width="100%"
        height="100%"
        viewBox={viewBoxStr}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full touch-none"
        style={{ shapeRendering: "geometricPrecision", textRendering: "geometricPrecision" }}
      >
        <defs>
          <radialGradient id="mm-root-shine" cx="32%" cy="22%" r="55%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <pattern id="mm-grid" width={100} height={100} patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 100 100" fill="none" stroke={gridStroke} strokeWidth={1} />
            <path d="M 0 100 L 100 100" fill="none" stroke={gridStrokeAlt} strokeWidth={1} />
          </pattern>
          <pattern id="mm-grid-dark" width={100} height={100} patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 100 100" fill="none" stroke={gridStrokeDark} strokeWidth={1} />
            <path d="M 0 100 L 100 100" fill="none" stroke={gridStrokeDarkAlt} strokeWidth={1} />
          </pattern>
        </defs>

        <rect x={minX} y={minY} width={vbW} height={vbH} fill="url(#mm-grid)" className="pointer-events-none dark:hidden" />
        <rect
          x={minX}
          y={minY}
          width={vbW}
          height={vbH}
          fill="url(#mm-grid-dark)"
          className="pointer-events-none hidden dark:block"
        />

        <AnimatePresence initial={false}>
          {visibleLinks.map((link, linkIndex) => {
            const source = visibleNodes.find((n) => n.id === link.from);
            const target = visibleNodes.find((n) => n.id === link.to);
            if (!source || !target) return null;

            const sx = source.id === activeDragNodeId && dragPos ? dragPos.x : source.x;
            const sy = source.id === activeDragNodeId && dragPos ? dragPos.y : source.y;
            const tx = target.id === activeDragNodeId && dragPos ? dragPos.x : target.x;
            const ty = target.id === activeDragNodeId && dragPos ? dragPos.y : target.y;

            const cx1 = sx + (tx - sx) * 0.5;
            const cy1 = sy;
            const cx2 = tx - (tx - sx) * 0.5;
            const cy2 = ty;

            const path = `M ${CX + sx} ${CY + sy} C ${CX + cx1} ${CY + cy1}, ${CX + cx2} ${CY + cy2}, ${CX + tx} ${CY + ty}`;

            return (
              <motion.path
                key={link.id}
                layout={false}
                d={path}
                fill="none"
                stroke={source.color}
                strokeWidth={2}
                strokeOpacity={0.52}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none"
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.92 }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        pathLength: 0.02,
                        transition: { duration: 0.24, ease: "easeIn" as const },
                      }
                }
                transition={
                  reduced
                    ? { duration: 0 }
                    : {
                        pathLength: {
                          type: "tween" as const,
                          duration: 0.72,
                          delay: linkIndex * 0.045,
                          ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                        },
                        opacity: { duration: 0.28, delay: linkIndex * 0.045 + 0.08 },
                      }
                }
              />
            );
          })}
        </AnimatePresence>

        <AnimatePresence initial={false}>
        {visibleNodes.map((node) => {
          const rx = node.id === activeDragNodeId && dragPos ? dragPos.x : node.x;
          const ry = node.id === activeDragNodeId && dragPos ? dragPos.y : node.y;
          const ncx = CX + rx;
          const ncy = CY + ry;

          const isRoot = node.kind === "root";
          const r = isRoot ? 26 : node.kind === "branch" ? 11 : 8.5;
          const hitR = r + 14;
          /** Etiqueta a la izquierda del nodo si el nodo está a la izquierda del centro (incl. raíz). */
          const labelLeft = rx < 0;
          const isSelected = selectedNodeId === node.id;
          const isDragging = activeDragNodeId === node.id;
          const isHover = hoveredId === node.id && !isDragging;
          const rVis = isHover && !readOnly && !isDragging ? r + (isRoot ? 1.5 : 2) : r;
          const staggerI = nodeStaggerMap[node.id] ?? 0;

          /* Área para texto: ancho fijo; el flex alinea la pastilla al borde cercano al nodo (antes quedaba al otro extremo). */
          const foW = 220;
          const foH = isRoot ? 34 : 30;
          const gap = 10;
          const foX = labelLeft ? ncx - r - gap - foW : ncx + r + gap;
          const foY = ncy - foH / 2;

          const showPulse = !reduced && activeDragNodeId !== node.id;

          return (
            <motion.g
              key={node.id}
              layout={false}
              initial={reduced ? false : { opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={
                reduced
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      scale: 0.78,
                      transition: {
                        duration: 0.26,
                        ease: [0.4, 0, 0.9, 0.6] as [number, number, number, number],
                      },
                    }
              }
              transition={
                reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 400, damping: 28 }
              }
              style={{ transformOrigin: `${ncx}px ${ncy}px` }}
            >
              <NodePulseRings
                ncx={ncx}
                ncy={ncy}
                r={r}
                color={node.color}
                isRoot={isRoot}
                staggerIndex={staggerI}
                active={showPulse}
              />
              <circle
                cx={ncx}
                cy={ncy}
                r={hitR}
                fill="transparent"
                className="cursor-pointer"
                onPointerDown={(e) => onNodePointerDown(node.id, e)}
                onPointerEnter={() => setHoveredId(node.id)}
                onPointerLeave={() => setHoveredId((h) => (h === node.id ? null : h))}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  toggleNodeCollapse(node.id);
                }}
              />
              <motion.circle
                cx={ncx}
                cy={ncy}
                r={rVis}
                fill={node.color}
                stroke={
                  isSelected ? "#ffffff" : isHover ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.22)"
                }
                strokeWidth={isSelected ? 2.6 : isRoot ? 2 : 1.25}
                className="pointer-events-none"
                initial={false}
                animate={{ opacity: isDragging ? 0.9 : 1 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { ...NODE_SPRING, delay: Math.min(0.5, staggerI * 0.038) }
                }
              />
              {isRoot ? (
                <circle cx={ncx} cy={ncy} r={r * 0.92} fill="url(#mm-root-shine)" className="pointer-events-none" />
              ) : null}

              {node.hasChildren && node.collapsed && !isRoot ? (
                <g className="pointer-events-none" stroke="white" strokeWidth={2} strokeLinecap="round">
                  <line x1={ncx - 4} y1={ncy} x2={ncx + 4} y2={ncy} />
                  <line x1={ncx} y1={ncy - 4} x2={ncx} y2={ncy + 4} />
                </g>
              ) : null}

              {node.hasChildren && !node.collapsed && !isRoot ? (
                <circle cx={ncx} cy={ncy} r={2.2} className="pointer-events-none fill-black/25" />
              ) : null}

              <foreignObject x={foX} y={foY} width={foW} height={foH} className="overflow-visible">
                <div
                  className={cn(
                    "flex h-full w-full min-w-0 items-center",
                    labelLeft ? "justify-end" : "justify-start",
                  )}
                  style={{ pointerEvents: "auto" }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <span
                    className={cn(
                      /* Misma línea visual que el editor en `IsoFlowSvgNodesLayer` (border sky + slate). */
                      "max-w-full shrink truncate border border-sky-500/70 bg-white px-2.5 py-1 text-left text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100",
                      "rounded-xl",
                      isRoot && "px-3 py-1.5 text-[13px] font-semibold leading-tight",
                      !isRoot && "text-[11px] font-medium leading-tight md:text-[12px]",
                    )}
                    style={{ fontWeight: isRoot ? 600 : 500 }}
                  >
                    <span
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                      className="inline-block min-w-[1rem] cursor-text rounded px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
                      onBlur={(e) => updateNodeLabel(node.id, e.currentTarget.textContent || "")}
                      onFocus={() => {
                        if (selectedNodeId !== node.id) ctrl.setSelectedNodeId(node.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.currentTarget as HTMLElement).blur();
                        }
                      }}
                    >
                      {node.label}
                    </span>
                  </span>
                </div>
              </foreignObject>
            </motion.g>
          );
        })}
        </AnimatePresence>

        {showDescriptionPanel && descriptionTarget
          ? (() => {
              const n = descriptionTarget;
              const maxW = Math.max(DESC_SIZE_MIN_W, vbW - 2 * SLIDE_DESC_INSET);
              const maxH = Math.max(DESC_SIZE_MIN_H, vbH - 2 * SLIDE_DESC_INSET);
              const rawW = n.descriptionWidth ?? DESCRIPTION_PANEL_W;
              const rawH = n.descriptionHeight ?? DESCRIPTION_PANEL_H;
              const panelW = Math.min(rawW, maxW);
              const panelH = Math.min(rawH, maxH);
              const { x: pX, y: pY } = descriptionPanelSlideBottomRight(
                minX,
                minY,
                vbW,
                vbH,
                panelW,
                panelH,
                SLIDE_DESC_INSET,
              );
              const descTextBase =
                "h-full w-full min-h-0 min-w-0 border-0 bg-transparent p-0 text-left text-[12px] font-normal leading-relaxed " +
                "text-slate-800 outline-none ring-0 shadow-none focus:outline-none focus:ring-0 dark:text-slate-100";
              return (
                <foreignObject
                  key={`mm-desc-${n.id}`}
                  x={pX}
                  y={pY}
                  width={panelW}
                  height={panelH}
                  className="overflow-visible"
                >
                  {readOnly ? (
                    <p
                      data-mind-map-ui
                      className={cn(
                        descTextBase,
                        "m-0 h-full w-full box-border cursor-default overflow-y-auto whitespace-pre-wrap wrap-break-word select-text",
                      )}
                      style={{ pointerEvents: "auto" }}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {n.description?.trim() ? n.description : "\u00a0"}
                    </p>
                  ) : (
                    <div
                      className="relative h-full w-full min-h-0 min-w-0 overflow-visible"
                      data-mind-map-ui
                      data-slide-selection-frame
                    >
                      <SlideCanvasBlockStyleSelectionFrame />
                      <div className="relative z-1 flex h-full min-h-0 w-full min-w-0 flex-col">
                        <MindMapDescriptionResizableBox
                          width={panelW}
                          height={panelH}
                          minW={DESC_SIZE_MIN_W}
                          minH={DESC_SIZE_MIN_H}
                          maxW={maxW}
                          maxH={maxH}
                          onSizeChange={(w, h) => updateNodeDescriptionSize(n.id, w, h)}
                        >
                          <textarea
                            data-mind-map-ui
                            className={cn(
                              descTextBase,
                              "min-h-0 min-w-0 flex-1 resize-none cursor-text overflow-y-auto select-text box-border placeholder:text-slate-500/50 dark:placeholder:text-slate-500/45",
                            )}
                            style={{ pointerEvents: "auto" }}
                            onPointerDown={(e) => e.stopPropagation()}
                            placeholder="Añade más detalle…"
                            value={n.description ?? ""}
                            onChange={(e) => updateNodeDescription(n.id, e.target.value)}
                            rows={2}
                            spellCheck
                          />
                        </MindMapDescriptionResizableBox>
                      </div>
                    </div>
                  )}
                </foreignObject>
              );
            })()
          : null}
      </svg>
    </div>
  );
}
