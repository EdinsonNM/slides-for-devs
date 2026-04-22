import { LINK_SEG_HIT_STROKE } from "./constants";
import {
  displaySegToCanonical,
  linkCanonicalFullGridPath,
  linkPolylinePoints,
  sourceIsCanonicalFirstLink,
} from "./canvasModel";
import type { IsometricFlowCanvasController } from "./useIsometricFlowCanvasController";

export type IsoFlowSvgLinkSegmentHandlesProps = Pick<
  IsometricFlowCanvasController,
  | "readOnly"
  | "selectedLinkId"
  | "data"
  | "setSelectedNodeIds"
  | "setConnectFrom"
  | "setLinkSegDrag"
  | "splitLinkAtDisplaySegment"
>;

export function IsoFlowSvgLinkSegmentHandles(props: IsoFlowSvgLinkSegmentHandlesProps) {
  const {
    readOnly,
    selectedLinkId,
    data,
    setSelectedNodeIds,
    setConnectFrom,
    setLinkSegDrag,
    splitLinkAtDisplaySegment,
  } = props;

  if (readOnly || !selectedLinkId) return null;
  const sl = data.links.find((x) => x.id === selectedLinkId);
  if (!sl) return null;
  const pts = linkPolylinePoints(sl, data.nodes);
  if (!pts || pts.length < 2) return null;

  return (
    <g key="iso-link-seg-hits" className="pointer-events-auto">
                  {pts.slice(0, -1).map((p, i) => {
                    const q = pts[i + 1]!;
                    const d = `M ${p.x} ${p.y} L ${q.x} ${q.y}`;
                    return (
                      <path
                        key={`seg-hit-${i}`}
                        d={d}
                        fill="none"
                        stroke="rgba(59, 130, 246, 0.14)"
                        strokeWidth={LINK_SEG_HIT_STROKE}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pointerEvents="stroke"
                        className="cursor-grab touch-none active:cursor-grabbing"
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          try {
                            (e.currentTarget as SVGPathElement).setPointerCapture(
                              e.pointerId,
                            );
                          } catch {
                            /* noop */
                          }
                          setSelectedNodeIds([]);
                          setConnectFrom(null);
                          const flat =
                            sl.bendOffset &&
                            (!sl.routeWaypoints || sl.routeWaypoints.length === 0)
                              ? { ...sl, bendOffset: undefined }
                              : sl;
                          const G = linkCanonicalFullGridPath(flat, data.nodes);
                          if (!G || G.length < 2) return;
                          const cf = sourceIsCanonicalFirstLink(sl, data.nodes);
                          const canonicalSegIndex = displaySegToCanonical(
                            i,
                            G.length,
                            cf,
                          );
                          setLinkSegDrag({
                            linkId: selectedLinkId,
                            canonicalSegIndex,
                          });
                        }}
                        onDoubleClick={(e) => {
                          if (readOnly) return;
                          e.stopPropagation();
                          e.preventDefault();
                          splitLinkAtDisplaySegment(
                            selectedLinkId,
                            i,
                            e.clientX,
                            e.clientY,
                          );
                        }}
                      >
                        <title>
                          Arrastra para mover el tramo en la rejilla. Doble clic: insertar
                          vértice.
                        </title>
                      </path>
                    );
                  })}
                </g>

  );
}
