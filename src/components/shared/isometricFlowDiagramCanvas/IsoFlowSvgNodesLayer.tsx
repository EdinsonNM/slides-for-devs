import { cn } from "../../../utils/cn";
import { resolveBrandIconHref } from "../../../utils/isometricBrandIcon";
import { sanitizeBrandIconColor } from "../../../domain/entities/IsometricFlowDiagram";
import {
  isoDiamondAroundPoint,
  nodeFoot,
  nodeSlabTop,
  polygonPath,
} from "../../../utils/isometricFlowGeometry";
import {
  CELL,
  LABEL_PILL_H,
  LABEL_STACK,
  LUCIDE_BRAND_ICON_FILL,
  ORIGIN_X,
  ORIGIN_Y,
  SLAB_FOOT_HALF,
  SLAB_TOP_RISE,
} from "./constants";
import {
  hslFillChrome,
  isoBrandGlyphExtent,
  isoCloudGlyphPath,
  isoConeFaces,
  isoCylinderBody,
  isoDesktopMonitorLayout,
  isoDeviceGlyphExtent,
  isoMobileGlyphExtent,
  isoShapeStroke,
  isoSlabPrismPaths,
  labelPillWidth,
  normalizeSimpleIconHex,
} from "./canvasModel";
import type { IsometricFlowCanvasController } from "./useIsometricFlowCanvasController";

export type IsoFlowSvgNodesLayerProps = Pick<
  IsometricFlowCanvasController,
  | "data"
  | "readOnly"
  | "editingId"
  | "emit"
  | "selectedNodeIdSet"
  | "hoveredNodeId"
  | "connectFrom"
  | "simpleIconHexById"
  | "googleIconPathById"
  | "amazonIconPathById"
  | "simpleIconPathById"
  | "lucideIconPathById"
  | "uid"
  | "shadowId"
  | "setEditingId"
  | "setSelectedNodeIds"
  | "diagramChrome"
>;

export function IsoFlowSvgNodesLayer(props: IsoFlowSvgNodesLayerProps) {
  const {
    data,
    readOnly,
    editingId,
    emit,
    selectedNodeIdSet,
    hoveredNodeId,
    connectFrom,
    simpleIconHexById,
    googleIconPathById,
    amazonIconPathById,
    simpleIconPathById,
    lucideIconPathById,
    uid,
    shadowId,
    setEditingId,
    setSelectedNodeIds,
    diagramChrome,
  } = props;

  return (
    <>
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
                ? isoSlabPrismPaths(cx, cy, CELL, SLAB_TOP_RISE, n.hue, diagramChrome)
                : null;
            const cyl =
              shape === "cylinder"
                ? isoCylinderBody(cx, cy, CELL, SLAB_TOP_RISE, n.hue, diagramChrome)
                : null;
            const cone =
              shape === "cone"
                ? isoConeFaces(cx, cy, CELL, SLAB_TOP_RISE, n.hue, topPt, diagramChrome)
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
              shape === "desktop"
                ? isoDesktopMonitorLayout(cx, cy, topPt.y, diagramChrome)
                : null;
            const orbR =
              shape === "orb" && glyphExtent
                ? Math.min(CELL * 0.36, (glyphExtent.yBot - glyphExtent.yTop) * 0.44)
                : CELL * 0.34;
            const orbCy =
              shape === "orb" && glyphExtent
                ? (glyphExtent.yTop + glyphExtent.yBot) / 2
                : cy - SLAB_TOP_RISE * 0.42;
            const orbStroke = isoShapeStroke(diagramChrome);
            const sel = selectedNodeIdSet.has(n.id);
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
                        fill={hslFillChrome(n.hue, 46, 64, diagramChrome)}
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
                        fill={hslFillChrome(n.hue, 46, 62, diagramChrome)}
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
                        fill={hslFillChrome(n.hue, 52, 76, diagramChrome)}
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
                    const stroke = isoShapeStroke(diagramChrome);
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
                          fill={hslFillChrome(n.hue, 48, 82, diagramChrome)}
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
                          fill={hslFillChrome(n.hue, 42, 32, diagramChrome)}
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
                          fill={hslFillChrome(n.hue, 48, 80, diagramChrome)}
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
                          fill={hslFillChrome(n.hue, 40, 28, diagramChrome)}
                        />
                        <path
                          d={L.standPath}
                          fill={hslFillChrome(n.hue, 45, 64, diagramChrome)}
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
                          fill={hslFillChrome(n.hue, 44, 60, diagramChrome)}
                          stroke={stroke}
                          strokeWidth={0.85}
                        />
                      </>
                    );
                  })() : null}
                  {shape === "cloud" && glyphExtent ? (() => {
                    const stroke = isoShapeStroke(diagramChrome);
                    const d = isoCloudGlyphPath(cx, glyphExtent.yTop, glyphExtent.yBot);
                    return (
                      <path
                        d={d}
                        fill={hslFillChrome(n.hue, 52, 88, diagramChrome)}
                        stroke={stroke}
                        strokeWidth={1}
                        strokeLinejoin="round"
                      />
                    );
                  })() : null}
                  {shape === "llm" && glyphExtent ? (() => {
                    const stroke = isoShapeStroke(diagramChrome);
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
                          fill={hslFillChrome(n.hue, 48, 82, diagramChrome)}
                          stroke={stroke}
                          strokeWidth={1}
                        />
                        <text
                          x={cx}
                          y={y0 + bodyH / 2 + 3}
                          textAnchor="middle"
                          className="fill-slate-800 text-[9px] font-bold tracking-[0.08em] dark:fill-slate-200"
                        >
                          LLM
                        </text>
                      </>
                    );
                  })() : null}
                  {shape === "user" && glyphExtent ? (() => {
                    const stroke = isoShapeStroke(diagramChrome);
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
                          fill={hslFillChrome(n.hue, 52, 86, diagramChrome)}
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
                          fill={hslFillChrome(n.hue, 48, 76, diagramChrome)}
                          stroke={stroke}
                          strokeWidth={1}
                        />
                      </>
                    );
                  })() : null}
                  {shape === "brand" && glyphExtent ? (() => {
                    const stroke = isoShapeStroke(diagramChrome);
                    const { yTop, yBot } = glyphExtent;
                    const iconSlug = (n.iconSlug ?? "openai").trim().toLowerCase();
                    const brandIconHref = resolveBrandIconHref(
                      n.iconSlug,
                      googleIconPathById,
                      amazonIconPathById,
                      simpleIconPathById,
                      lucideIconPathById,
                    );
                    const sphereR = Math.min(CELL * 0.38, (yBot - yTop) * 0.46);
                    const sphereCy = (yTop + yBot) / 2 + 0.5;
                    const iconSize = sphereR * 1.45;
                    const iconX = cx - iconSize / 2;
                    const iconY = sphereCy - iconSize / 2;
                    const isSimpleIcon = iconSlug.startsWith("si:");
                    const isLucideIcon = iconSlug.startsWith("li:");
                    const catalogHex = isSimpleIcon
                      ? simpleIconHexById[iconSlug]
                      : isLucideIcon
                        ? LUCIDE_BRAND_ICON_FILL
                        : undefined;
                    const customFill = n.brandIconColor
                      ? sanitizeBrandIconColor(n.brandIconColor)
                      : undefined;
                    const tintFill = (customFill ?? catalogHex ?? "").trim();
                    const useSvgTint =
                      (isSimpleIcon || isLucideIcon) && tintFill.length > 0;
                    /** `feFlood` + `feComposite in` respeta la alpha del icono (no la máscara por luminancia, que deja el negro invisible). */
                    const brandTintFilterId = `${uid}-sib-${n.id.replace(/\s/g, "")}`;
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
                          fill={
                            diagramChrome === "dark"
                              ? hslFillChrome(n.hue, 14, 26, diagramChrome)
                              : "rgb(255 255 255)"
                          }
                          stroke={stroke}
                          strokeWidth={1}
                        />
                        {useSvgTint ? (
                          <>
                            <defs>
                              <filter
                                id={brandTintFilterId}
                                colorInterpolationFilters="sRGB"
                                x="0%"
                                y="0%"
                                width="100%"
                                height="100%"
                              >
                                <feFlood floodColor={tintFill} floodOpacity="1" result="flood" />
                                <feComposite in="flood" in2="SourceGraphic" operator="in" />
                              </filter>
                            </defs>
                            <image
                              key={`brand-${n.id}-${iconSlug}-tint`}
                              href={brandIconHref}
                              x={iconX}
                              y={iconY}
                              width={iconSize}
                              height={iconSize}
                              opacity={0.98}
                              preserveAspectRatio="xMidYMid meet"
                              filter={`url(#${brandTintFilterId})`}
                            />
                          </>
                        ) : (
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
                        )}
                      </>
                    );
                  })() : null}
                </g>

                <line
                  x1={cx}
                  y1={stemTopY}
                  x2={cx}
                  y2={stemBotY}
                  stroke={
                    diagramChrome === "dark"
                      ? "rgba(148, 163, 184, 0.35)"
                      : "rgba(15, 23, 42, 0.45)"
                  }
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />

                {editingId === n.id && !readOnly ? (
                  <foreignObject
                    x={pillLeft}
                    y={pillTop}
                    width={pillW}
                    height={LABEL_PILL_H}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      className="box-border h-full w-full rounded-full border border-sky-500/70 bg-white px-2 text-center text-[11px] font-medium text-slate-900 shadow-sm outline-none dark:bg-slate-900 dark:text-slate-100"
                      value={n.label}
                      onDoubleClick={(e) => e.stopPropagation()}
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
                      setSelectedNodeIds([n.id]);
                    }}
                  >
                    <rect
                      x={pillLeft}
                      y={pillTop}
                      width={pillW}
                      height={LABEL_PILL_H}
                      rx={LABEL_PILL_H / 2}
                      ry={LABEL_PILL_H / 2}
                      fill={
                        diagramChrome === "dark" ? "rgb(30 41 59)" : "white"
                      }
                      stroke={
                        diagramChrome === "dark"
                          ? "rgba(148, 163, 184, 0.45)"
                          : "rgba(148, 163, 184, 0.65)"
                      }
                      strokeWidth={1}
                    />
                    <text
                      x={cx}
                      y={pillTop + LABEL_PILL_H / 2 + 4}
                      textAnchor="middle"
                      className="pointer-events-none fill-slate-900 text-[11px] font-semibold dark:fill-slate-100"
                    >
                      {n.label.length > 22 ? `${n.label.slice(0, 20)}…` : n.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

    </>
  );
}
