import { Image as ImageIcon } from "lucide-react";
import * as RiveReact from "@rive-app/react-webgl2";
import {
  SlideRivePlayer,
  riveStateMachinesFromStoredNames,
} from "../shared/SlideRivePlayer";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../utils/cn";
import { getEmbedUrl } from "../../utils/video";
import { sanitizeIframeEmbedSrc } from "../../utils/iframeEmbedUrl";
import type { Slide } from "../../types";
import {
  SLIDE_TYPE,
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
  type DeckContentTone,
} from "../../domain/entities";
import { deckMutedTextClass } from "../../utils/deckSlideChrome";
import type { SlideCanvasElement } from "../../domain/entities";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import {
  getCanvasMarkdownBodyDisplay,
  presenter3dDisplayPropsFromCanvasElement,
  readTextMarkdownFromElement,
  slideAppearanceForMediaElement,
} from "../../domain/slideCanvas/slideCanvasPayload";
import { plainTextFromRichHtml } from "../../utils/slideRichText";
import { DEFAULT_DEVICE_3D_ID } from "../../constants/device3d";
import {
  SlideChapterTitleReadOnly,
  SlideContentTitleReadOnly,
  SlideSubtitleMarkdownBody,
} from "../../presentation/slide-elements";
import { SlideMarkdown } from "../shared/SlideMarkdown";
import { SlideCanvasRichDescription } from "./SlideCanvasRichDescription";
import { CodeDisplay } from "../shared/CodeDisplay";
import { ExcalidrawViewer } from "../shared/ExcalidrawViewer";
import { IsometricFlowDiagramCanvas } from "../shared/IsometricFlowDiagramCanvas";
import { parseMindMapDiagram } from "../../domain/entities/MindMapDiagram";
import { MindMapDiagramCanvas } from "../shared/MindMapDiagramCanvas";
import { parseIsometricFlowDiagram } from "../../domain/entities/IsometricFlowDiagram";
import { parseSlideMapData } from "../../domain/entities/SlideMapData";
import { SlideMapboxCanvas } from "../shared/SlideMapboxCanvas";
import { Device3DViewport } from "../shared/Device3DViewport";
import { Canvas3DViewport } from "../shared/Canvas3DViewport";
import { DeferHeavyWebglMount } from "../shared/DeferHeavyWebglMount";
import { DataMotionRingExperience } from "../shared/DataMotionRingExperience";
import { normalizeDataMotionRingState } from "../../domain/dataMotionRing/dataMotionRingModel";
import { SlideMatrixTable } from "../shared/SlideMatrixTable";
import {
  PANEL_CONTENT_KIND,
  resolveMediaPanelDescriptor,
} from "../../domain/panelContent";
import { useThemeOptional } from "../../context/ThemeContext";
import type { MapboxCanvasAppearance } from "../shared/SlideMapboxCanvas";

const { Alignment, Fit, Layout } = RiveReact;

const MAPBOX_ENV_TOKEN = (
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined
)?.trim();

const riveReadonlyLayout = new Layout({
  fit: Fit.Contain,
  alignment: Alignment.Center,
});

export interface SlideCanvasViewProps {
  slide: Slide;
  /** Contenedor ya en 16:9; el lienzo llena el área útil. */
  className?: string;
  /** Contraste de tipografía con el fondo del deck (por defecto texto oscuro). */
  deckContentTone?: DeckContentTone;
  /**
   * Clave opcional para forzar re-sincronización de viewports R3F (3D) cuando el layout cambia
   * sin resize CSS (p. ej. presentación con transforms).
   */
  r3fHostMeasureKey?: string;
  /**
   * Solo ventana de presentación: conecta el mapa a la búsqueda por dirección/país.
   * @default false
   */
  registerPresenterMapFlyTo?: boolean;
  /**
   * Presentación / pantalla completa: Canvas 3D sin rejilla ni texto de ayuda de órbita.
   * @default false
   */
  minimalCanvas3dChrome?: boolean;
}

function mediaBlock(
  deckSlide: Slide,
  tone: DeckContentTone,
  /** Presentador 3D: slide + elemento para leer solo el `payload` del bloque (sin espejo raíz). */
  presenterCanvas?: { slide: Slide; element: SlideCanvasElement },
  r3fHostMeasureKey?: string,
  minimalCanvas3dChrome?: boolean,
  r3fStackRevision = 0,
) {
  const panel = resolveMediaPanelDescriptor(deckSlide);
  switch (panel.kind) {
    case PANEL_CONTENT_KIND.CODE:
      return (
        <CodeDisplay
          code={deckSlide.code ?? ""}
          language={deckSlide.language}
          fontSize={deckSlide.fontSize ?? 14}
          showChrome
          responsiveFontSize
          codeEditorTheme={deckSlide.codeEditorTheme}
          className="h-full min-h-0 w-full"
        />
      );
    case PANEL_CONTENT_KIND.VIDEO:
      return (
        <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-stone-900">
          {deckSlide.videoUrl ? (
            <iframe
              src={getEmbedUrl(deckSlide.videoUrl)}
              className="h-full w-full"
              allowFullScreen
              title="Video"
            />
          ) : (
            <span className={cn("italic", deckMutedTextClass(tone))}>
              Sin video
            </span>
          )}
        </div>
      );
    case PANEL_CONTENT_KIND.IFRAME_EMBED: {
      const iframeSrc = sanitizeIframeEmbedSrc(deckSlide.iframeEmbedUrl ?? "");
      return (
        <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-300/40 dark:bg-stone-100">
          {iframeSrc ? (
            <iframe
              src={iframeSrc}
              className="h-full w-full border-0"
              title="Contenido incrustado"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <span className={cn("italic", deckMutedTextClass(tone))}>
              Sin URL de iframe
            </span>
          )}
        </div>
      );
    }
    case PANEL_CONTENT_KIND.PRESENTER_3D: {
      const fullSlide = presenterCanvas?.slide ?? deckSlide;
      const el = presenterCanvas?.element;
      const fromPayload =
        el != null
          ? presenter3dDisplayPropsFromCanvasElement(fullSlide, el)
          : null;
      const canvasBlock = el != null && fromPayload != null;
      const deferWebgl = Boolean(minimalCanvas3dChrome);
      return (
        <div className="h-full min-h-0 w-full overflow-hidden rounded-xl">
          <DeferHeavyWebglMount
            enabled={deferWebgl}
            className="h-full min-h-[120px] w-full"
          >
            <Device3DViewport
              slideId={fullSlide.id}
              orbitScopeSuffix={el?.id}
              deviceId={
                canvasBlock
                  ? fromPayload.deviceId
                  : ((deckSlide.presenter3dDeviceId as string | undefined) ??
                    DEFAULT_DEVICE_3D_ID)
              }
              screenMedia={
                canvasBlock
                  ? fromPayload.screenMedia
                  : (deckSlide.presenter3dScreenMedia ?? "image")
              }
              imageUrl={
                canvasBlock ? fromPayload.imageUrl : deckSlide.imageUrl
              }
              videoUrl={
                canvasBlock ? fromPayload.videoUrl : deckSlide.videoUrl
              }
              viewState={
                canvasBlock
                  ? fromPayload.viewState
                  : deckSlide.presenter3dViewState
              }
              showInteractionHint={false}
              className="h-full min-h-[120px]"
              hostMeasureKey={r3fHostMeasureKey}
              stackRevision={r3fStackRevision}
              skipEnvironmentMaps={deferWebgl}
            />
          </DeferHeavyWebglMount>
        </div>
      );
    }
    case PANEL_CONTENT_KIND.CANVAS_3D: {
      const deferWebgl = Boolean(minimalCanvas3dChrome);
      return (
        <div className="h-full min-h-0 w-full overflow-hidden rounded-xl">
          <DeferHeavyWebglMount
            enabled={deferWebgl}
            className="h-full min-h-[120px] w-full"
          >
            <Canvas3DViewport
              slideId={deckSlide.id}
              glbUrl={deckSlide.canvas3dGlbUrl}
              viewState={deckSlide.canvas3dViewState}
              modelTransform={deckSlide.canvas3dModelTransform}
              animationClipName={deckSlide.canvas3dAnimationClipName}
              showInteractionHint={!minimalCanvas3dChrome}
              showGroundGrid={!minimalCanvas3dChrome}
              className="h-full min-h-[120px]"
              hostMeasureKey={r3fHostMeasureKey}
              stackRevision={r3fStackRevision}
              skipEnvironmentMaps={deferWebgl}
            />
          </DeferHeavyWebglMount>
        </div>
      );
    }
    case PANEL_CONTENT_KIND.DATA_MOTION_RING:
      return (
        <div className="h-full min-h-0 w-full overflow-visible rounded-xl">
          <DataMotionRingExperience
            state={normalizeDataMotionRingState(deckSlide.dataMotionRing)}
            className="h-full min-h-[120px]"
          />
        </div>
      );
    case PANEL_CONTENT_KIND.RIVE: {
      const src = deckSlide.riveUrl?.trim() ?? "";
      if (!src) {
        return (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center rounded-xl bg-stone-900/90",
              deckMutedTextClass(tone),
            )}
          >
            <span className="text-sm italic">Sin animación Rive</span>
          </div>
        );
      }
      return (
        <div className="pointer-events-auto relative z-[2] h-full min-h-0 w-full overflow-hidden rounded-xl bg-transparent">
          <SlideRivePlayer
            key={`${src}\0${deckSlide.riveStateMachineNames ?? ""}\0${deckSlide.riveArtboard ?? ""}`}
            src={src}
            artboard={deckSlide.riveArtboard?.trim() || undefined}
            stateMachines={riveStateMachinesFromStoredNames(
              deckSlide.riveStateMachineNames,
            )}
            layout={riveReadonlyLayout}
            className="h-full w-full min-h-[80px] bg-transparent touch-manipulation"
          />
        </div>
      );
    }
    case PANEL_CONTENT_KIND.IMAGE:
      if (deckSlide.imageUrl) {
        return (
          <img
            src={deckSlide.imageUrl}
            alt={deckSlide.title}
            className="h-full w-full object-cover select-none"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            referrerPolicy="no-referrer"
          />
        );
      }
      return (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center",
            deckMutedTextClass(tone),
          )}
        >
          <ImageIcon size={64} strokeWidth={1} />
        </div>
      );
  }
}

function CanvasElementReadOnly({
  element,
  slide,
  deckContentTone,
  r3fHostMeasureKey,
  mapAppearance = "light",
  registerPresenterMapFlyTo = false,
  minimalCanvas3dChrome = false,
}: {
  element: SlideCanvasElement;
  slide: Slide;
  deckContentTone: DeckContentTone;
  r3fHostMeasureKey?: string;
  /** Cielo / niebla Mapbox según tema de la app. */
  mapAppearance?: MapboxCanvasAppearance;
  registerPresenterMapFlyTo?: boolean;
  minimalCanvas3dChrome?: boolean;
}) {
  const tone = deckContentTone;
  const panelSlide =
    element.kind === "mediaPanel"
      ? slideAppearanceForMediaElement(slide, element)
      : slide;
  const { rect, kind, z } = element;
  const r3fStackRevision = Math.round(Number.isFinite(z) ? z : 0);
  const rotation = element.rotation ?? 0;
  const box: CSSProperties = {
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.w}%`,
    height: `${rect.h}%`,
    zIndex: z,
  };
  const panelIsDataMotionRing =
    kind === "mediaPanel" &&
    resolveMediaPanelDescriptor(panelSlide).kind ===
      PANEL_CONTENT_KIND.DATA_MOTION_RING;
  const shell = cn(
    "absolute min-h-0 min-w-0",
    panelIsDataMotionRing ? "overflow-visible" : "overflow-hidden",
  );

  const rotated = (className: string, children: ReactNode) => {
    const style: CSSProperties | undefined = (() => {
      if (!rotation && !panelIsDataMotionRing) return undefined;
      const s: CSSProperties = {};
      if (rotation) {
        s.transform = `rotate(${rotation}deg)`;
        s.transformOrigin = "center center";
      }
      if (panelIsDataMotionRing) {
        s.transformStyle = "preserve-3d";
      }
      return s;
    })();
    return (
      <div className={cn("min-h-0 min-w-0", className)} style={style}>
        {children}
      </div>
    );
  };

  switch (kind) {
    case "sectionLabel":
      return null;
    case "title":
      return (
        <div style={box} className={shell}>
          {rotated(
            "flex h-full min-h-0 w-full flex-col overflow-hidden px-2 py-1",
            <SlideContentTitleReadOnly tone={tone}>
              {readTextMarkdownFromElement(slide, element)}
            </SlideContentTitleReadOnly>,
          )}
        </div>
      );
    case "subtitle":
      if (!readTextMarkdownFromElement(slide, element).trim()) return null;
      return (
        <div style={box} className={shell}>
          {rotated(
            "flex h-full min-h-0 w-full flex-col overflow-hidden px-2 py-0.5",
            <SlideSubtitleMarkdownBody tone={tone} variant="default">
              {readTextMarkdownFromElement(slide, element)}
            </SlideSubtitleMarkdownBody>,
          )}
        </div>
      );
    case "chapterTitle":
      return (
        <div style={box} className={shell}>
          {rotated(
            "flex h-full min-h-0 w-full flex-col items-center justify-start overflow-hidden px-3 text-center",
            <SlideChapterTitleReadOnly tone={tone}>
              {readTextMarkdownFromElement(slide, element)}
            </SlideChapterTitleReadOnly>,
          )}
        </div>
      );
    case "chapterSubtitle":
      if (!readTextMarkdownFromElement(slide, element).trim()) return null;
      return (
        <div style={box} className={shell}>
          {rotated(
            "flex h-full min-h-0 w-full items-start justify-center overflow-hidden px-3 text-center",
            <SlideSubtitleMarkdownBody tone={tone} variant="chapter">
              {readTextMarkdownFromElement(slide, element)}
            </SlideSubtitleMarkdownBody>,
          )}
        </div>
      );
    case "markdown": {
      const disp = getCanvasMarkdownBodyDisplay(slide, element);
      const empty =
        disp.kind === "html"
          ? !plainTextFromRichHtml(disp.html).trim()
          : !disp.source.trim();
      return (
        <div style={box} className={shell}>
          {rotated(
            "h-full overflow-y-auto px-2 py-1 scrollbar-on-hover",
            !empty ? (
              <SlideCanvasRichDescription
                elementId={element.id}
                tone={tone}
                display={disp}
                isEditing={false}
                plainBuffer=""
                richHtmlBuffer=""
                fontScale={disp.kind === "html" ? disp.scale : 1}
                onPlainAndRichChange={() => {}}
                onBlurCommit={() => {}}
              />
            ) : null,
          )}
        </div>
      );
    }
    case "mediaPanel":
      return (
        <div style={box} className={shell}>
          {rotated(
            "h-full p-1 md:p-2",
            mediaBlock(
              panelSlide,
              tone,
              { slide, element },
              r3fHostMeasureKey,
              minimalCanvas3dChrome,
              r3fStackRevision,
            ),
          )}
        </div>
      );
    case "matrix":
      if (slide.type !== SLIDE_TYPE.MATRIX) return null;
      return (
        <div style={box} className={shell}>
          {rotated(
            "h-full overflow-y-auto px-1 py-1 scrollbar-on-hover",
            <SlideMatrixTable
              presentationDensity="preview"
              deckContentTone={tone}
              data={normalizeSlideMatrixData(
                slide.matrixData ?? createEmptySlideMatrixData(),
              )}
            />,
          )}
        </div>
      );
    case "matrixNotes":
      if (
        slide.type !== SLIDE_TYPE.MATRIX ||
        !readTextMarkdownFromElement(slide, element).trim()
      )
        return null;
      return (
        <div style={box} className={shell}>
          {rotated(
            cn(
              "h-full overflow-y-auto border-t px-2 py-1",
              tone === "light"
                ? "border-slate-600/60"
                : "border-stone-100 dark:border-border",
            ),
            <SlideMarkdown contentTone={tone}>
              {readTextMarkdownFromElement(slide, element)}
            </SlideMarkdown>,
          )}
        </div>
      );
    case "excalidraw":
      return (
        <div
          style={box}
          className={cn(shell, "bg-white dark:bg-surface-elevated")}
        >
          {rotated(
            "absolute inset-0 min-h-0",
            <ExcalidrawViewer
              key={`${slide.id}-${slide.excalidrawData ? "x" : "empty"}`}
              excalidrawData={slide.excalidrawData}
              className="absolute inset-0 h-full w-full"
              fitToViewOnLoad
            />,
          )}
        </div>
      );
    case "isometricFlow":
      if (slide.type !== SLIDE_TYPE.ISOMETRIC) return null;
      return (
        <div
          style={box}
          className={cn(
            shell,
            /* El SVG pinta el fondo de la rejilla; sin capa extra para no mostrar el tema del deck alrededor. */
            "bg-transparent",
          )}
        >
          {rotated(
            "absolute inset-0 min-h-0",
            <IsometricFlowDiagramCanvas
              key={`${slide.id}-${slide.isometricFlowData ? "d" : "empty"}`}
              data={parseIsometricFlowDiagram(slide.isometricFlowData)}
              readOnly
              className="h-full w-full"
              isometricDataSyncKey={`${slide.id}|${slide.isometricFlowData ?? ""}`}
            />,
          )}
        </div>
      );
    case "mindMap":
      if (slide.type !== SLIDE_TYPE.MIND_MAP) return null;
      return (
        <div style={box} className={shell}>
          {rotated(
            "absolute inset-0 min-h-0",
            <MindMapDiagramCanvas
              key={`${slide.id}-${slide.mindMapData ? "m" : "empty"}`}
              data={parseMindMapDiagram(slide.mindMapData)}
              readOnly
              className="h-full w-full"
            />,
          )}
        </div>
      );
    case "mapboxMap":
      if (slide.type !== SLIDE_TYPE.MAPS) return null;
      if (!MAPBOX_ENV_TOKEN) {
        return (
          <div
            style={box}
            className={cn(
              shell,
              "flex items-center justify-center bg-slate-900 px-2 text-center text-[11px] text-slate-400",
            )}
          >
            Mapbox: configura VITE_MAPBOX_ACCESS_TOKEN para ver el mapa.
          </div>
        );
      }
      return (
        <div style={box} className={shell}>
          {rotated(
            "absolute inset-0 min-h-0",
            <SlideMapboxCanvas
              key={`${slide.id}-map`}
              mapData={parseSlideMapData(slide.mapData)}
              accessToken={MAPBOX_ENV_TOKEN}
              appearance={mapAppearance}
              readOnly
              persistViewportOnMoveEnd={false}
              registerViewportCaptureBridge={false}
              registerPresenterFlyToBridge={registerPresenterMapFlyTo}
              showPresenterSearchInput={registerPresenterMapFlyTo}
              className="h-full w-full"
            />,
          )}
        </div>
      );
    default:
      return null;
  }
}

/** Vista previa / presentador: lienzo a partir de `canvasScene` (migra si hace falta). */
export function SlideCanvasView({
  slide,
  className,
  deckContentTone = "dark",
  r3fHostMeasureKey,
  registerPresenterMapFlyTo = false,
  minimalCanvas3dChrome = false,
}: SlideCanvasViewProps) {
  const theme = useThemeOptional();
  const mapAppearance: MapboxCanvasAppearance = theme?.isDark
    ? "dark"
    : "light";
  const ensured = ensureSlideCanvasScene(slide);
  const scene = ensured.canvasScene!;
  const sorted = [...scene.elements].sort((a, b) => a.z - b.z);

  return (
    <div className={cn("relative h-full min-h-0 w-full min-w-0", className)}>
      {sorted.map((el) => (
        <CanvasElementReadOnly
          key={el.id}
          element={el}
          slide={ensured}
          deckContentTone={deckContentTone}
          r3fHostMeasureKey={r3fHostMeasureKey}
          mapAppearance={mapAppearance}
          registerPresenterMapFlyTo={registerPresenterMapFlyTo}
          minimalCanvas3dChrome={minimalCanvas3dChrome}
        />
      ))}
    </div>
  );
}
