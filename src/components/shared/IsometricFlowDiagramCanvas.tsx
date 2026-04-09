import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link2, Plus, Trash2 } from "lucide-react";
import { cn } from "../../utils/cn";
import type { IsometricFlowDiagram, IsometricFlowNode } from "../../domain/entities/IsometricFlowDiagram";
import {
  ISOMETRIC_VIEWBOX,
  canvasToIsoGrid,
  isoGridToCanvas,
  nodeAnchor,
} from "../../utils/isometricFlowGeometry";

const CELL = 54;
const ORIGIN_X = ISOMETRIC_VIEWBOX.w / 2;
const ORIGIN_Y = ISOMETRIC_VIEWBOX.h / 2 + 24;
const HIT_R = 44;

function isoBlockPaths(cx: number, cy: number, hue: number) {
  const top = `M ${cx} ${cy - 38} L ${cx + 30} ${cy - 18} L ${cx} ${cy + 2} L ${cx - 30} ${cy - 18} Z`;
  const left = `M ${cx - 30} ${cy - 18} L ${cx - 30} ${cy + 4} L ${cx} ${cy + 24} L ${cx} ${cy + 2} Z`;
  const right = `M ${cx + 30} ${cy - 18} L ${cx} ${cy + 2} L ${cx} ${cy + 24} L ${cx + 30} ${cy + 4} Z`;
  const topFill = `hsl(${hue} 52% 52%)`;
  const leftFill = `hsl(${hue} 48% 38%)`;
  const rightFill = `hsl(${hue} 45% 44%)`;
  const stroke = "rgba(15,23,42,0.35)";
  return { top, left, right, topFill, leftFill, rightFill, stroke };
}

function linkPath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): string {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2 - 28;
  return `M ${ax} ${ay} Q ${mx} ${my} ${bx} ${by}`;
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
  const gradId = useId().replace(/:/g, "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const nodeById = useCallback(
    (id: string) => data.nodes.find((n) => n.id === id),
    [data.nodes],
  );

  const pickNodeAt = useCallback(
    (sx: number, sy: number): IsometricFlowNode | null => {
      let best: IsometricFlowNode | null = null;
      let bestD = HIT_R;
      for (const n of data.nodes) {
        const { x, y } = isoGridToCanvas(n.gx, n.gy, CELL, ORIGIN_X, ORIGIN_Y);
        const d = Math.hypot(sx - x, sy - y);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      return best;
    },
    [data.nodes],
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
                label: "Nuevo",
                hue: (data.nodes.length * 47) % 360,
              },
            ],
          };
          emit(next);
          setSelectedId(next.nodes[next.nodes.length - 1]!.id);
          return;
        }
      }
    }
  }, [data, emit]);

  const removeSelected = useCallback(() => {
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
  }, [data, emit, selectedId]);

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
            (l) =>
              (l.from === connectFrom && l.to === hit.id) ||
              (l.from === hit.id && l.to === connectFrom),
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
        setSelectedId(hit.id);
        const { x: nx, y: ny } = isoGridToCanvas(
          hit.gx,
          hit.gy,
          CELL,
          ORIGIN_X,
          ORIGIN_Y,
        );
        setDrag({
          id: hit.id,
          offsetX: x - nx,
          offsetY: y - ny,
        });
        e.preventDefault();
        return;
      }

      setSelectedId(null);
      setConnectFrom(null);
    },
    [readOnly, connectFrom, data, emit, pickNodeAt],
  );

  /** Arrastre en `window` para que el puntero no pierda el SVG al mover rápido. */
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
            label: "Bloque",
            hue: (data.nodes.length * 53) % 360,
          },
        ],
      });
      setSelectedId(id);
    },
    [readOnly, data, emit, pickNodeAt],
  );

  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConnectFrom(null);
        setEditingId(null);
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedId &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, selectedId, removeSelected]);

  const toolbar = !readOnly && (
    <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-200/90 bg-white/95 px-2 py-1.5 shadow-sm dark:border-border dark:bg-stone-900/95">
      <button
        type="button"
        onClick={addNode}
        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
        aria-label="Añadir bloque"
      >
        <Plus size={14} />
        Bloque
      </button>
      <button
        type="button"
        onClick={() => {
          setConnectFrom((c) => (c ? null : selectedId));
        }}
        disabled={!selectedId}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
          connectFrom
            ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
            : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200",
          !selectedId && "pointer-events-none opacity-40",
        )}
        aria-label="Modo conexión: elige dos bloques"
        title="Conectar: selecciona un bloque y pulsa; luego el destino"
      >
        <Link2 size={14} />
        {connectFrom ? "Elige destino…" : "Conectar"}
      </button>
      <button
        type="button"
        onClick={removeSelected}
        disabled={!selectedId}
        className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-red-950/40"
        aria-label="Eliminar bloque seleccionado"
      >
        <Trash2 size={14} />
        Quitar
      </button>
      <span className="hidden text-[10px] text-stone-500 sm:inline dark:text-stone-400">
        Doble clic en vacío · arrastrar · Del para borrar
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
        className="h-full w-full touch-none select-none"
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onSvgPointerDown}
        onDoubleClick={onSvgDoubleClick}
      >
        <defs>
          <linearGradient id={`${gradId}-floor`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(148,163,184,0.12)" />
            <stop offset="100%" stopColor="rgba(148,163,184,0.04)" />
          </linearGradient>
        </defs>
        <rect
          width={ISOMETRIC_VIEWBOX.w}
          height={ISOMETRIC_VIEWBOX.h}
          fill={`url(#${gradId}-floor)`}
        />

        <g opacity={0.9}>
          {data.links.map((l) => {
            const a = nodeById(l.from);
            const b = nodeById(l.to);
            if (!a || !b) return null;
            const p0 = nodeAnchor(a.gx, a.gy, CELL, ORIGIN_X, ORIGIN_Y);
            const p1 = nodeAnchor(b.gx, b.gy, CELL, ORIGIN_X, ORIGIN_Y);
            return (
              <path
                key={l.id}
                d={linkPath(p0.x, p0.y, p1.x, p1.y)}
                fill="none"
                stroke="rgba(51,65,85,0.55)"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {[...data.nodes]
          .sort((a, b) => a.gx + a.gy - (b.gx + b.gy))
          .map((n) => {
            const { x, y } = isoGridToCanvas(n.gx, n.gy, CELL, ORIGIN_X, ORIGIN_Y);
            const { top, left, right, topFill, leftFill, rightFill, stroke } =
              isoBlockPaths(x, y, n.hue);
            const sel = selectedId === n.id;
            const conn = connectFrom === n.id;
            return (
              <g key={n.id}>
                <path d={left} fill={leftFill} stroke={stroke} strokeWidth={1} />
                <path d={right} fill={rightFill} stroke={stroke} strokeWidth={1} />
                <path d={top} fill={topFill} stroke={stroke} strokeWidth={1} />
                {(sel || conn) && (
                  <path
                    d={top}
                    fill="none"
                    stroke={conn ? "rgb(245 158 11)" : "rgb(16 185 129)"}
                    strokeWidth={3}
                    opacity={0.95}
                  />
                )}
                {editingId === n.id && !readOnly ? (
                  <foreignObject x={x - 56} y={y - 36} width={112} height={36}>
                    <input
                      autoFocus
                      className="w-full rounded border border-emerald-500/60 bg-white px-1 py-0.5 text-center text-[11px] font-semibold text-stone-800 shadow-sm dark:bg-stone-900 dark:text-stone-100"
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
                  <text
                    x={x}
                    y={y - 14}
                    textAnchor="middle"
                    className="pointer-events-auto cursor-default fill-stone-900 text-[11px] font-semibold dark:fill-stone-100"
                    style={{ userSelect: readOnly ? "none" : "text" }}
                    onDoubleClick={(e) => {
                      if (readOnly) return;
                      e.stopPropagation();
                      setEditingId(n.id);
                      setSelectedId(n.id);
                    }}
                  >
                    {n.label.length > 14 ? `${n.label.slice(0, 12)}…` : n.label}
                  </text>
                )}
              </g>
            );
          })}
      </svg>
    </div>
  );
}
