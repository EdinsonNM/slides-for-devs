import type { CSSProperties, ReactNode } from "react";
import {
  Box,
  Code2,
  Image as ImageIcon,
  MonitorPlay,
  PencilRuler,
  Video,
} from "lucide-react";
import type { Slide } from "../../types";
import {
  SLIDE_TYPE,
  type DeckContentTone,
  type SlideCanvasElement,
  type SlideCanvasElementKind,
} from "../../domain/entities";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import {
  compareCanvasElementsByZThenId,
  readTextMarkdownFromElement,
  slideAppearanceForMediaElement,
} from "../../domain/slideCanvas/slideCanvasPayload";
import {
  PANEL_CONTENT_KIND,
  resolveMediaPanelDescriptor,
} from "../../domain/panelContent";
import { deckChapterSubtitleHintClass } from "../../utils/deckSlideChrome";
import { cn } from "../../utils/cn";
import { IsoStyleThreeDBadge } from "../shared/IsoStyleThreeDBadge";

/**
 * Miniatura del sidebar usa fondo claro u oscuro elevado, no el lienzo del deck.
 * Con `contentTone === "light"` del deck, los helpers de color del lienzo no coinciden con el fondo de la miniatura
 * pensado para slides sobre fondo oscuro — aquí el título quedaría invisible.
 */
const SIDEBAR_THUMB_TEXT_TONE: DeckContentTone = "dark";

/**
 * En el listado lateral priorizamos leer título/subtítulo/cuerpo aunque en el lienzo
 * un `mediaPanel` u otro bloque tenga mayor `z` y los tape en la miniatura.
 */
const THUMB_TEXT_KINDS: ReadonlySet<SlideCanvasElementKind> = new Set([
  "title",
  "subtitle",
  "chapterTitle",
  "chapterSubtitle",
  "markdown",
  "matrixNotes",
]);
const THUMB_TEXT_Z_BOOST = 50_000;

function stripMarkdownOneLine(s: string, maxLen: number): string {
  const t = s
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

/** `fillMinHeight: auto` evita que `min-h-0` en flex recorte glifos (títulos cortados por abajo). */
function rotated(
  rotation: number | undefined,
  className: string,
  children: ReactNode,
  opts?: { fillMinHeight?: "zero" | "auto" },
) {
  const fillMin =
    opts?.fillMinHeight === "auto" ? "min-h-auto" : "min-h-0";
  return (
    <div
      className={cn("h-full w-full min-w-0", fillMin, className)}
      style={
        rotation
          ? {
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center center",
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

function SidebarMiniMediaBlock({ panelSlide }: { panelSlide: Slide }) {
  const kind = resolveMediaPanelDescriptor(panelSlide).kind;
  switch (kind) {
    case PANEL_CONTENT_KIND.IMAGE:
      return panelSlide.imageUrl ? (
        <img
          src={panelSlide.imageUrl}
          alt=""
          draggable={false}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <IsoStyleThreeDBadge Icon={ImageIcon} compact />
      );
    case PANEL_CONTENT_KIND.CODE:
      return <IsoStyleThreeDBadge Icon={Code2} compact />;
    case PANEL_CONTENT_KIND.VIDEO:
      return <IsoStyleThreeDBadge Icon={Video} compact />;
    case PANEL_CONTENT_KIND.PRESENTER_3D:
      if (panelSlide.imageUrl) {
        return (
          <img
            src={panelSlide.imageUrl}
            alt=""
            draggable={false}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        );
      }
      return <IsoStyleThreeDBadge Icon={MonitorPlay} compact />;
    case PANEL_CONTENT_KIND.CANVAS_3D:
      return <IsoStyleThreeDBadge Icon={Box} compact />;
    default: {
      const _e: never = kind;
      return _e;
    }
  }
}

function miniPreviewForElement(slide: Slide, el: SlideCanvasElement): ReactNode {
  const tone = SIDEBAR_THUMB_TEXT_TONE;
  const { rect, z, rotation, kind } = el;
  const boxStyle: CSSProperties = {
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.w}%`,
    height: `${rect.h}%`,
    zIndex: THUMB_TEXT_KINDS.has(kind) ? z + THUMB_TEXT_Z_BOOST : z,
  };
  const shell = "absolute min-h-0 min-w-0 overflow-hidden";
  /**
   * Texto: sin `overflow-y-hidden` en el bloque (recortaba la parte inferior de las letras con flex+min-h-0).
   * `container-type: size` sigue en este nodo para `cqh` en `font-size`.
   */
  const textBlockShell = cn(
    "absolute min-h-0 min-w-0 overflow-x-clip overflow-y-visible [container-type:size]",
  );

  switch (kind) {
    case "sectionLabel":
      return null;
    case "title":
      return (
        <div key={el.id} style={boxStyle} className={textBlockShell}>
          {rotated(
            rotation,
            "flex h-full w-full min-h-0 flex-col justify-start overflow-visible px-[3%] py-[4%]",
            <>
              <p
                className={cn(
                  /* Misma familia/estilo que la miniatura isométrica del sidebar (`SlideSidebar`): sans, medium, sin itálica */
                  "line-clamp-4 min-w-0 max-w-full shrink-0 break-words py-px text-left font-sans font-medium leading-normal text-stone-900 dark:text-foreground",
                )}
                style={{
                  fontSize:
                    "clamp(9px, min(5.5cqw, 48cqh), 14px)",
                  lineHeight: 1.45,
                }}
              >
                {readTextMarkdownFromElement(slide, el).trim() || "—"}
              </p>
              <div className="mt-[3%] h-[2px] min-h-[2px] w-[min(42%,2.5rem)] max-w-[90%] shrink-0 rounded-full bg-emerald-600" />
            </>,
            { fillMinHeight: "auto" },
          )}
        </div>
      );
    case "subtitle":
    case "chapterSubtitle": {
      const raw = readTextMarkdownFromElement(slide, el).trim();
      if (!raw) return null;
      return (
        <div key={el.id} style={boxStyle} className={textBlockShell}>
          {rotated(
            rotation,
            "flex h-full w-full min-h-0 flex-col justify-start overflow-visible px-[3%] py-[4%]",
            <p
              className={cn(
                "line-clamp-4 min-w-0 max-w-full shrink-0 break-words py-px text-left font-sans font-medium leading-normal text-stone-900 dark:text-foreground",
                kind === "chapterSubtitle" && deckChapterSubtitleHintClass(tone),
              )}
              style={{
                fontSize: "clamp(8px, min(4.5cqw, 40cqh), 13px)",
                lineHeight: 1.45,
              }}
            >
              {stripMarkdownOneLine(raw, 120)}
            </p>,
            { fillMinHeight: "auto" },
          )}
        </div>
      );
    }
    case "chapterTitle":
      return (
        <div key={el.id} style={boxStyle} className={textBlockShell}>
          {rotated(
            rotation,
            "flex h-full w-full min-h-0 flex-col items-center justify-center overflow-visible px-[4%] py-[4%] text-center",
            <p
              className="line-clamp-4 min-w-0 max-w-full shrink-0 break-words py-px text-center font-sans font-medium leading-normal text-stone-900 dark:text-foreground"
              style={{
                fontSize: "clamp(9px, min(5.5cqw, 44cqh), 14px)",
                lineHeight: 1.45,
              }}
            >
              {readTextMarkdownFromElement(slide, el).trim() || "—"}
            </p>,
            { fillMinHeight: "auto" },
          )}
        </div>
      );
    case "markdown": {
      const raw = readTextMarkdownFromElement(slide, el).trim();
      if (!raw) return null;
      return (
        <div key={el.id} style={boxStyle} className={textBlockShell}>
          {rotated(
            rotation,
            "flex h-full w-full min-h-0 flex-col justify-start overflow-visible px-[3%] py-[4%]",
            <p
              className="line-clamp-4 min-w-0 max-w-full shrink-0 break-words py-px text-left font-sans font-normal leading-normal text-stone-700 dark:text-stone-300"
              style={{
                fontSize: "clamp(7px, min(3.8cqw, 32cqh), 11px)",
                lineHeight: 1.45,
              }}
            >
              {stripMarkdownOneLine(raw, 200)}
            </p>,
            { fillMinHeight: "auto" },
          )}
        </div>
      );
    }
    case "mediaPanel":
      if (slide.type !== SLIDE_TYPE.CONTENT) return null;
      return (
        <div key={el.id} style={boxStyle} className={shell}>
          {rotated(
            rotation,
            "box-border h-full min-h-0 w-full min-w-0 p-px",
            <SidebarMiniMediaBlock
              panelSlide={slideAppearanceForMediaElement(slide, el)}
            />,
          )}
        </div>
      );
    case "matrix":
      if (slide.type !== SLIDE_TYPE.MATRIX) return null;
      return (
        <div key={el.id} style={boxStyle} className={shell}>
          {rotated(
            rotation,
            "h-full min-h-0 w-full min-w-0 bg-stone-200 p-px dark:bg-stone-600",
            <div className="grid h-full w-full grid-cols-3 gap-px overflow-hidden rounded-sm">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="min-h-0 min-w-0 bg-stone-50 dark:bg-stone-800"
                />
              ))}
            </div>,
          )}
        </div>
      );
    case "matrixNotes": {
      const raw = readTextMarkdownFromElement(slide, el).trim();
      if (!raw || slide.type !== SLIDE_TYPE.MATRIX) return null;
      return (
        <div key={el.id} style={boxStyle} className={textBlockShell}>
          {rotated(
            rotation,
            "flex h-full w-full min-h-0 flex-col justify-start overflow-visible border-t border-stone-300/60 px-[3%] py-[4%] dark:border-stone-600",
            <p
              className="line-clamp-4 min-w-0 max-w-full shrink-0 break-words py-px text-left font-sans font-normal leading-normal text-stone-600 dark:text-stone-400"
              style={{
                fontSize: "clamp(7px, min(3.5cqw, 30cqh), 10px)",
                lineHeight: 1.45,
              }}
            >
              {stripMarkdownOneLine(raw, 100)}
            </p>,
            { fillMinHeight: "auto" },
          )}
        </div>
      );
    }
    case "excalidraw":
      return (
        <div key={el.id} style={boxStyle} className={shell}>
          {rotated(
            rotation,
            "h-full w-full min-h-0 min-w-0",
            <IsoStyleThreeDBadge Icon={PencilRuler} compact />,
          )}
        </div>
      );
    case "isometricFlow":
      if (slide.type !== SLIDE_TYPE.ISOMETRIC) return null;
      return (
        <div key={el.id} style={boxStyle} className={shell}>
          {rotated(
            rotation,
            "h-full w-full min-h-0 min-w-0",
            <IsoStyleThreeDBadge compact borderless />,
          )}
        </div>
      );
    default:
      return null;
  }
}

/**
 * Vista compacta del lienzo (`canvasScene`) para miniaturas del listado lateral:
 * respeta posición/tamaño/z de cada bloque (p. ej. varias imágenes o paneles de código).
 */
export function SidebarSlideCanvasMiniPreview({ slide }: { slide: Slide }) {
  const ensured = ensureSlideCanvasScene(slide);
  const scene = ensured.canvasScene;
  if (!scene?.elements?.length) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded border border-dashed border-stone-300 bg-stone-50 text-[8px] text-stone-400 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-500">
        Vacío
      </div>
    );
  }
  const sorted = [...scene.elements].sort(compareCanvasElementsByZThenId);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded border border-stone-200 bg-white [container-type:inline-size] dark:border-stone-600 dark:bg-surface-elevated">
      {sorted.map((el) => miniPreviewForElement(ensured, el))}
    </div>
  );
}
