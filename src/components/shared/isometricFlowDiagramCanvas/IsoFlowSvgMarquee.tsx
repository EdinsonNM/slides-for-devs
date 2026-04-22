import type { IsoDiagramChrome } from "./canvasModel";

export type IsoFlowSvgMarqueeProps = {
  readOnly: boolean;
  marqueeRect: { x0: number; y0: number; x1: number; y1: number } | null;
  diagramChrome: IsoDiagramChrome;
};

export function IsoFlowSvgMarquee({
  readOnly,
  marqueeRect,
  diagramChrome,
}: IsoFlowSvgMarqueeProps) {
  if (readOnly || !marqueeRect) return null;
  const fill =
    diagramChrome === "dark" ? "rgba(56, 189, 248, 0.12)" : "rgba(59, 130, 246, 0.1)";
  const stroke =
    diagramChrome === "dark" ? "rgb(56 189 248)" : "rgb(59 130 246)";
  return (
    <rect
      key="iso-marquee"
      x={Math.min(marqueeRect.x0, marqueeRect.x1)}
      y={Math.min(marqueeRect.y0, marqueeRect.y1)}
      width={Math.max(0.001, Math.abs(marqueeRect.x1 - marqueeRect.x0))}
      height={Math.max(0.001, Math.abs(marqueeRect.y1 - marqueeRect.y0))}
      fill={fill}
      stroke={stroke}
      strokeWidth={1}
      strokeDasharray="5 4"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
      aria-hidden
    />
  );
}
