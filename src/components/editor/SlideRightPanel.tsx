import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { useMinWidthLg } from "../../hooks/useMatchMedia";
import type { Slide } from "../../types";
import { CodeBlock } from "./CodeBlock";
import { ImagePanel } from "./ImagePanel";
import { VideoPanel } from "./VideoPanel";
import { IframeEmbedPanel } from "./IframeEmbedPanel";
import { Presenter3DPanel } from "./Presenter3DPanel";
import { Canvas3DPanel } from "./Canvas3DPanel";
import { DataMotionRingPanel } from "./DataMotionRingPanel";
import {
  PANEL_CONTENT_KIND,
  resolveMediaPanelDescriptor,
} from "../../domain/panelContent";

export interface SlideRightPanelProps {
  /** Si true, el panel ocupa todo el espacio (layout panel-full), sin borde ni resize. */
  fullWidth?: boolean;
  /** Lienzo del slide: el contenedor no es flex; hace falta llenar el rect del selector y encuadre 3D más ajustado. */
  embeddedInCanvas?: boolean;
  /** Datos del `mediaPanel` concreto en el lienzo (varios paneles). Si no se pasa, se usa `currentSlide`. */
  canvasPanelSlide?: Slide;
  /** Id del elemento `mediaPanel` en el lienzo (varios paneles de código). */
  canvasMediaElementId?: string;
  /**
   * Lienzo: fuerza re-medición / `setSize` en visores R3F (Canvas 3D / Presentador 3D) cuando cambia
   * el orden z u otro layout sin resize CSS (misma idea que `SlideCanvasView` en presentación).
   */
  canvasR3fHostMeasureKey?: string;
  /**
   * Orden de apilado (z) del `mediaPanel`: fuerza re-medición 3D al reordenar, sin destruir WebGL.
   * @default 0
   */
  r3fStackRevision?: number;
  /**
   * Lienzo: `false` mientras el `mediaPanel` 3D / presentador no está seleccionado (vista
   * congelada, sin WebGL en vivo). En el panel derecho del deck se omite (sigue en vivo).
   * @default true
   */
  r3fUseLiveWebgl?: boolean;
  onCanvas3dAnimationClipNames?: (
    mediaPanelElementId: string,
    names: string[],
  ) => void;
}

export function SlideRightPanel({
  fullWidth,
  embeddedInCanvas = false,
  canvasPanelSlide,
  canvasMediaElementId,
  canvasR3fHostMeasureKey,
  r3fStackRevision = 0,
  r3fUseLiveWebgl = true,
  onCanvas3dAnimationClipNames,
}: SlideRightPanelProps = {}) {
  const { currentSlide, imageWidthPercent, isResizing, setIsResizing } =
    usePresentation();
  const isLgUp = useMinWidthLg();

  if (!currentSlide) return null;

  const panelSlide = canvasPanelSlide ?? currentSlide;
  const panelKind = resolveMediaPanelDescriptor(panelSlide).kind;

  return (
    <div
      className={cn(
        "flex flex-col relative group min-h-0",
        embeddedInCanvas
          ? "bg-transparent"
          : panelKind === PANEL_CONTENT_KIND.CANVAS_3D ||
              panelKind === PANEL_CONTENT_KIND.DATA_MOTION_RING
            ? "bg-transparent"
            : "bg-white dark:bg-surface",
        fullWidth
          ? "h-full min-h-0 w-full flex-1 border-0"
          : "h-full min-h-0 border-l border-stone-200 dark:border-border",
      )}
      style={fullWidth ? undefined : { width: `${imageWidthPercent}%` }}
    >
      {!fullWidth && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/30 transition-colors z-30 flex items-center justify-center group/handle"
        >
          <div className="w-0.5 h-8 bg-stone-300 dark:bg-stone-600 group-hover/handle:bg-emerald-500 rounded-full" />
        </div>
      )}

      {panelKind === PANEL_CONTENT_KIND.CODE ? (
        <CodeBlock
          titleBarMode={embeddedInCanvas ? "minimal" : isLgUp ? "minimal" : "full"}
          embeddedInCanvas={embeddedInCanvas}
          canvasPanelSlide={canvasPanelSlide}
          canvasMediaElementId={canvasMediaElementId}
        />
      ) : panelKind === PANEL_CONTENT_KIND.VIDEO ? (
        <VideoPanel canvasPanelSlide={canvasPanelSlide} />
      ) : panelKind === PANEL_CONTENT_KIND.IFRAME_EMBED ? (
        <IframeEmbedPanel canvasPanelSlide={canvasPanelSlide} />
      ) : panelKind === PANEL_CONTENT_KIND.PRESENTER_3D ? (
        <Presenter3DPanel
          embeddedInCanvas={embeddedInCanvas}
          canvasPanelSlide={canvasPanelSlide}
          canvasMediaElementId={canvasMediaElementId}
          hostMeasureKey={canvasR3fHostMeasureKey}
          stackRevision={r3fStackRevision}
          r3fUseLiveWebgl={r3fUseLiveWebgl}
        />
      ) : panelKind === PANEL_CONTENT_KIND.CANVAS_3D ? (
        <Canvas3DPanel
          embeddedInCanvas={embeddedInCanvas}
          canvasPanelSlide={canvasPanelSlide}
          canvasMediaElementId={canvasMediaElementId}
          hostMeasureKey={canvasR3fHostMeasureKey}
          stackRevision={r3fStackRevision}
          r3fUseLiveWebgl={r3fUseLiveWebgl}
          onCanvas3dAnimationClipNames={onCanvas3dAnimationClipNames}
        />
      ) : panelKind === PANEL_CONTENT_KIND.DATA_MOTION_RING ? (
        <DataMotionRingPanel
          embeddedInCanvas={embeddedInCanvas}
          canvasPanelSlide={canvasPanelSlide}
          currentSlide={currentSlide}
        />
      ) : panelKind === PANEL_CONTENT_KIND.RIVE ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          Rive está desactivado temporalmente en el editor.
        </div>
      ) : (
        <ImagePanel canvasPanelSlide={canvasPanelSlide} />
      )}
    </div>
  );
}
