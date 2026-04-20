import { cn } from "../../../utils/cn";
import { clientToSvg } from "./canvasModel";
import type { IsometricFlowCanvasController } from "./useIsometricFlowCanvasController";
import { IsoFlowSvgDefsAndBackdrop } from "./IsoFlowSvgDefsAndBackdrop";
import { IsoFlowSvgLinkSegmentHandles } from "./IsoFlowSvgLinkSegmentHandles";
import { IsoFlowSvgLinksLayer } from "./IsoFlowSvgLinksLayer";
import { IsoFlowSvgMarquee } from "./IsoFlowSvgMarquee";
import { IsoFlowSvgNodesLayer } from "./IsoFlowSvgNodesLayer";

export type IsometricFlowCanvasSvgProps = {
  ctrl: IsometricFlowCanvasController;
};

export function IsometricFlowCanvasSvg({ ctrl }: IsometricFlowCanvasSvgProps) {
  const {
    svgRef,
    viewRect,
    panDrag,
    marqueeRect,
    uid,
    gradId,
    shadowId,
    flowDashAnimName,
    flowDashReverseAnimName,
    data,
    readOnly,
    selectedLinkId,
    hoveredNodeId,
    connectFrom,
    editingId,
    simpleIconHexById,
    googleIconPathById,
    amazonIconPathById,
    simpleIconPathById,
    lucideIconPathById,
    selectedNodeIdSet,
    bidirectionalLinkIds,
    emit,
    onSvgPointerDown,
    onSvgDoubleClick,
    pickNodeAt,
    setHoveredNodeId,
    setEditingId,
    setSelectedNodeIds,
    setConnectFrom,
    setLinkSegDrag,
    splitLinkAtDisplaySegment,
    diagramChrome,
  } = ctrl;

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label="Diagrama isométrico. Rueda del ratón para ampliar o reducir. Botón central o tecla Alt y arrastrar para desplazar la vista. En el fondo vacío, arrastra para seleccionar varios bloques en un rectángulo."
      viewBox={`${viewRect.x} ${viewRect.y} ${viewRect.w} ${viewRect.h}`}
      className={cn(
        "h-full w-full touch-none select-none text-slate-900 dark:text-slate-100",
        panDrag ? "cursor-grabbing" : marqueeRect ? "cursor-crosshair" : "cursor-default",
      )}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={onSvgPointerDown}
      onPointerMove={(e) => {
        const svg = svgRef.current;
        if (!svg) return;
        const { x, y } = clientToSvg(svg, e.clientX, e.clientY);
        const hit = pickNodeAt(x, y);
        setHoveredNodeId(hit?.id ?? null);
      }}
      onPointerLeave={() => setHoveredNodeId(null)}
      onDoubleClick={onSvgDoubleClick}
    >
      <IsoFlowSvgDefsAndBackdrop
        viewRect={viewRect}
        gradId={gradId}
        shadowId={shadowId}
        flowDashAnimName={flowDashAnimName}
        flowDashReverseAnimName={flowDashReverseAnimName}
        diagramChrome={diagramChrome}
      />
      <IsoFlowSvgLinksLayer
        data={data}
        selectedLinkId={selectedLinkId}
        bidirectionalLinkIds={bidirectionalLinkIds}
        flowDashAnimName={flowDashAnimName}
        flowDashReverseAnimName={flowDashReverseAnimName}
        diagramChrome={diagramChrome}
      />
      <IsoFlowSvgNodesLayer
        data={data}
        readOnly={readOnly}
        editingId={editingId}
        shadowId={shadowId}
        emit={emit}
        selectedNodeIdSet={selectedNodeIdSet}
        hoveredNodeId={hoveredNodeId}
        connectFrom={connectFrom}
        simpleIconHexById={simpleIconHexById}
        googleIconPathById={googleIconPathById}
        amazonIconPathById={amazonIconPathById}
        simpleIconPathById={simpleIconPathById}
        lucideIconPathById={lucideIconPathById}
        uid={uid}
        setEditingId={setEditingId}
        setSelectedNodeIds={setSelectedNodeIds}
        diagramChrome={diagramChrome}
      />
      <IsoFlowSvgMarquee
        readOnly={readOnly}
        marqueeRect={marqueeRect}
        diagramChrome={diagramChrome}
      />
      <IsoFlowSvgLinkSegmentHandles
        readOnly={readOnly}
        selectedLinkId={selectedLinkId}
        data={data}
        setSelectedNodeIds={setSelectedNodeIds}
        setConnectFrom={setConnectFrom}
        setLinkSegDrag={setLinkSegDrag}
        splitLinkAtDisplaySegment={splitLinkAtDisplaySegment}
      />
    </svg>
  );
}
