export type IsoFlowSvgMarqueeProps = {
  readOnly: boolean;
  marqueeRect: { x0: number; y0: number; x1: number; y1: number } | null;
};

export function IsoFlowSvgMarquee({ readOnly, marqueeRect }: IsoFlowSvgMarqueeProps) {
  if (readOnly || !marqueeRect) return null;
  return (
    <rect
      key="iso-marquee"
      x={Math.min(marqueeRect.x0, marqueeRect.x1)}
      y={Math.min(marqueeRect.y0, marqueeRect.y1)}
      width={Math.max(0.001, Math.abs(marqueeRect.x1 - marqueeRect.x0))}
      height={Math.max(0.001, Math.abs(marqueeRect.y1 - marqueeRect.y0))}
      fill="rgba(59, 130, 246, 0.1)"
      stroke="rgb(59 130 246)"
      strokeWidth={1}
      strokeDasharray="5 4"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
      aria-hidden
    />
  );
}
