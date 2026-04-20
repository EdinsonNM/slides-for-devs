import { useMemo, type ReactNode } from "react";
import { isoGridToCanvas } from "../../../utils/isometricFlowGeometry";
import { isoGridIndexBoundsForView, type IsoDiagramChrome } from "./canvasModel";
import type { IsoViewRect } from "./constants";

export function IsoGridBackground({
  cell,
  ox,
  oy,
  view,
  diagramChrome,
}: {
  cell: number;
  ox: number;
  oy: number;
  view: IsoViewRect;
  diagramChrome: IsoDiagramChrome;
}) {
  const lines = useMemo(() => {
    const { gx0, gx1, gy0, gy1 } = isoGridIndexBoundsForView(view, cell, ox, oy, 5);
    const out: ReactNode[] = [];
    const stroke =
      diagramChrome === "dark"
        ? "rgba(148, 163, 184, 0.22)"
        : "rgba(148, 163, 184, 0.45)";
    const strokeDark =
      diagramChrome === "dark"
        ? "rgba(100, 116, 139, 0.2)"
        : "rgba(100, 116, 139, 0.35)";
    for (let k = gx0; k <= gx1; k++) {
      const a = isoGridToCanvas(k, gy0, cell, ox, oy);
      const b = isoGridToCanvas(k, gy1, cell, ox, oy);
      out.push(
        <line
          key={`gx${k}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={stroke}
          strokeWidth={0.75}
          vectorEffect="non-scaling-stroke"
        />,
      );
    }
    for (let k = gy0; k <= gy1; k++) {
      const c = isoGridToCanvas(gx0, k, cell, ox, oy);
      const d = isoGridToCanvas(gx1, k, cell, ox, oy);
      out.push(
        <line
          key={`gy${k}`}
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
    return out;
  }, [cell, ox, oy, view.x, view.y, view.w, view.h, diagramChrome]);
  return <g aria-hidden>{lines}</g>;
}
