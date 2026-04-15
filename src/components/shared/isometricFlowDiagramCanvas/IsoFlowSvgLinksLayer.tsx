import { arrowHeadPath, shortenPolylineEnd } from "../../../utils/isometricFlowGeometry";
import { linkPolylinePoints, linkStroke } from "./canvasModel";
import {
  ARROW_SIZE,
  ARROW_TRIM,
  FLOW_ANIMATION_SEC,
  FLOW_DASH_GAP,
  FLOW_DASH_LENGTH,
  FLOW_DASH_SPAN,
} from "./constants";
import type { IsometricFlowDiagram } from "../../../domain/entities/IsometricFlowDiagram";

export type IsoFlowSvgLinksLayerProps = {
  data: IsometricFlowDiagram;
  selectedLinkId: string | null;
  bidirectionalLinkIds: Set<string>;
  flowDashAnimName: string;
  flowDashReverseAnimName: string;
};

export function IsoFlowSvgLinksLayer({
  data,
  selectedLinkId,
  bidirectionalLinkIds,
  flowDashAnimName,
  flowDashReverseAnimName,
}: IsoFlowSvgLinksLayerProps) {
  return (
    <>
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

    </>
  );
}
