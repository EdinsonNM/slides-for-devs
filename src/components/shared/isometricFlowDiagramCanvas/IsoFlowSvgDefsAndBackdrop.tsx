import { CELL, FLOW_DASH_SPAN, ORIGIN_X, ORIGIN_Y, type IsoViewRect } from "./constants";
import { IsoGridBackground } from "./IsoGridBackground";

export type IsoFlowSvgDefsAndBackdropProps = {
  viewRect: IsoViewRect;
  gradId: string;
  shadowId: string;
  flowDashAnimName: string;
  flowDashReverseAnimName: string;
};

export function IsoFlowSvgDefsAndBackdrop({
  viewRect,
  gradId,
  shadowId,
  flowDashAnimName,
  flowDashReverseAnimName,
}: IsoFlowSvgDefsAndBackdropProps) {
  return (
    <>
      <defs>
          <linearGradient
            id={gradId}
            gradientUnits="objectBoundingBox"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
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
          x={viewRect.x}
          y={viewRect.y}
          width={viewRect.w}
          height={viewRect.h}
          fill={`url(#${gradId})`}
          className="dark:opacity-90"
        />
        <IsoGridBackground
          cell={CELL}
          ox={ORIGIN_X}
          oy={ORIGIN_Y}
          view={viewRect}
        />

    </>
  );
}
