import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Box,
  Code2,
  Image as ImageIcon,
  PencilRuler,
  Smartphone,
  Video,
} from "lucide-react";
import type { Slide } from "../../types";
import {
  SLIDE_TYPE,
  type DeckContentTone,
  type SlideCanvasElement,
} from "../../domain/entities";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import {
  compareCanvasElementsByZThenId,
  getCanvasMarkdownBodyDisplay,
  readTextMarkdownFromElement,
  slideAppearanceForMediaElement,
} from "../../domain/slideCanvas/slideCanvasPayload";
import { plainTextFromRichHtml } from "../../utils/slideRichText";
import {
  PANEL_CONTENT_KIND,
  resolveMediaPanelDescriptor,
} from "../../domain/panelContent";
import {
  deckChapterSubtitleHintClass,
  deckPrimaryTextClass,
} from "../../utils/deckSlideChrome";
import { SlideMarkdown } from "../shared/SlideMarkdown";
import { SlideCanvasRichDescription } from "../canvas/SlideCanvasRichDescription";
import { cn } from "../../utils/cn";
import { IsoStyleThreeDBadge } from "../shared/IsoStyleThreeDBadge";

/**
 * Miniatura del sidebar usa fondo claro u oscuro elevado, no el lienzo del deck.
 * Con `contentTone === "light"` del deck, los helpers de color del lienzo no coinciden con el fondo de la miniatura
 * pensado para slides sobre fondo oscuro — aquí el título quedaría invisible.
 */
const SIDEBAR_THUMB_TEXT_TONE: DeckContentTone = "dark";

function rotated(
  rotation: number | undefined,
  className: string,
  children: ReactNode,
) {
  return (
    <div
      className={cn("h-full w-full min-h-0 min-w-0", className)}
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

/**
 * Bloques de panel / diagrama (no isométrico): icono reconocible sobre fondo suave.
 * Las tres barras sesgadas quedan reservadas a `IsoStyleThreeDBadge` (diagrama isométrico en miniatura).
 */
function SidebarCanvasBlockIconThumb({
  Icon,
  surfaceClassName,
  iconClassName,
}: {
  Icon: LucideIcon;
  surfaceClassName: string;
  iconClassName: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded border border-dashed border-stone-300/85 bg-linear-to-br dark:border-stone-600",
        surfaceClassName,
      )}
    >
      <Icon
        className={cn(
          "pointer-events-none h-3 w-3 max-h-[42%] max-w-[42%] min-h-2 min-w-2 shrink-0 drop-shadow-sm",
          iconClassName,
        )}
        strokeWidth={1.75}
        aria-hidden
      />
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
        <SidebarCanvasBlockIconThumb
          Icon={ImageIcon}
          surfaceClassName="from-stone-100 to-stone-50 dark:from-stone-800 dark:to-stone-900/85"
          iconClassName="text-stone-500 dark:text-stone-400"
        />
      );
    case PANEL_CONTENT_KIND.CODE:
      return (
        <SidebarCanvasBlockIconThumb
          Icon={Code2}
          surfaceClassName="from-amber-50 to-amber-100/90 dark:from-amber-950/35 dark:to-amber-900/25"
          iconClassName="text-amber-800 dark:text-amber-200"
        />
      );
    case PANEL_CONTENT_KIND.VIDEO:
      return (
        <SidebarCanvasBlockIconThumb
          Icon={Video}
          surfaceClassName="from-sky-50 to-sky-100/90 dark:from-sky-950/35 dark:to-sky-900/25"
          iconClassName="text-sky-800 dark:text-sky-200"
        />
      );
    case PANEL_CONTENT_KIND.PRESENTER_3D:
      /* No mostrar la textura de pantalla: la miniatura representa el bloque de panel 3D, no el contenido cargado. */
      return (
        <SidebarCanvasBlockIconThumb
          Icon={Smartphone}
          surfaceClassName="from-violet-50 to-violet-100/90 dark:from-violet-950/40 dark:to-violet-900/30"
          iconClassName="text-violet-800 dark:text-violet-200"
        />
      );
    case PANEL_CONTENT_KIND.CANVAS_3D:
      return (
        <SidebarCanvasBlockIconThumb
          Icon={Box}
          surfaceClassName="from-teal-50 to-teal-100/90 dark:from-teal-950/40 dark:to-teal-900/30"
          iconClassName="text-teal-800 dark:text-teal-200"
        />
      );
    default: {
      const _e: never = kind;
      return _e;
    }
  }
}

/** Márgenes de prose más apretados en el área minúscula de la miniatura (misma escala tipográfica que el lienzo). */
const THUMB_MARKDOWN_COMPACT =
  "[&_p]:mb-1 [&_p]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-px";

function miniPreviewForElement(slide: Slide, el: SlideCanvasElement): ReactNode {
  const tone = SIDEBAR_THUMB_TEXT_TONE;
  const { rect, z, rotation, kind } = el;
  const boxStyle: CSSProperties = {
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.w}%`,
    height: `${rect.h}%`,
    zIndex: z,
  };
  const shell = "absolute min-h-0 min-w-0 overflow-hidden";

  switch (kind) {
    case "sectionLabel":
      return null;
    case "title":
      return (
        <div key={el.id} style={boxStyle} className={shell}>
          {rotated(
            rotation,
            "flex h-full min-h-0 w-full flex-col overflow-hidden px-2 py-1",
            <>
              <h2
                className={cn(
                  "min-h-0 min-w-0 w-full max-w-full shrink font-serif italic leading-tight whitespace-pre-wrap wrap-break-word",
                  deckPrimaryTextClass(tone),
                )}
                style={{ fontSize: "var(--slide-title)" }}
              >
                {readTextMarkdownFromElement(slide, el)}
              </h2>
              <div className="mt-2 h-1.5 w-20 shrink-0 rounded-full bg-emerald-600" />
            </>,
          )}
        </div>
      );
    case "subtitle":
      if (!readTextMarkdownFromElement(slide, el).trim()) return null;
      return (
        <div key={el.id} style={boxStyle} className={shell}>
          {rotated(
            rotation,
            "flex h-full min-h-0 w-full flex-col overflow-hidden px-2 py-0.5",
            <SlideMarkdown
              contentTone={tone}
              className={cn(
                "prose-sm max-w-none min-w-0 w-full",
                THUMB_MARKDOWN_COMPACT,
              )}
              style={{ fontSize: "var(--slide-subtitle)" }}
            >
              {readTextMarkdownFromElement(slide, el)}
            </SlideMarkdown>,
          )}
        </div>
      );
    case "chapterSubtitle": {
      const raw = readTextMarkdownFromElement(slide, el).trim();
      if (!raw) return null;
      return (
        <div key={el.id} style={boxStyle} className={shell}>
          {rotated(
            rotation,
            cn(
              "flex h-full min-h-0 w-full items-start justify-center overflow-hidden px-3 text-center",
              deckChapterSubtitleHintClass(tone),
            ),
            <SlideMarkdown
              contentTone={tone}
              className={cn(
                "prose-sm max-w-none min-w-0 w-full text-center font-light normal-case tracking-wide",
                THUMB_MARKDOWN_COMPACT,
              )}
              style={{ fontSize: "var(--slide-subtitle)" }}
            >
              {readTextMarkdownFromElement(slide, el)}
            </SlideMarkdown>,
          )}
        </div>
      );
    }
    case "chapterTitle":
      return (
        <div key={el.id} style={boxStyle} className={shell}>
          {rotated(
            rotation,
            "flex h-full min-h-0 w-full flex-col items-center justify-start overflow-hidden px-3 text-center",
            <>
              <div className="mb-3 h-1 w-14 shrink-0 rounded-full bg-emerald-600 md:mb-4" />
              <h1
                className={cn(
                  "min-h-0 min-w-0 w-full max-w-full shrink font-serif italic leading-tight whitespace-pre-wrap wrap-break-word",
                  deckPrimaryTextClass(tone),
                )}
                style={{ fontSize: "var(--slide-title-chapter)" }}
              >
                {readTextMarkdownFromElement(slide, el)}
              </h1>
            </>,
          )}
        </div>
      );
    case "markdown": {
      const disp = getCanvasMarkdownBodyDisplay(slide, el);
      const empty =
        disp.kind === "html"
          ? !plainTextFromRichHtml(disp.html).trim()
          : !disp.source.trim();
      if (empty) return null;
      return (
        <div key={el.id} style={boxStyle} className={shell}>
          {rotated(
            rotation,
            "h-full min-h-0 overflow-y-auto px-2 py-1 scrollbar-on-hover",
            <SlideCanvasRichDescription
              elementId={el.id}
              tone={tone}
              display={disp}
              isEditing={false}
              plainBuffer=""
              richHtmlBuffer=""
              fontScale={disp.kind === "html" ? disp.scale : 1}
              onPlainAndRichChange={() => {}}
              onBlurCommit={() => {}}
              shellClassName={cn("max-w-none min-w-0", THUMB_MARKDOWN_COMPACT)}
            />,
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
            "box-border h-full min-h-0 w-full min-w-0 p-1",
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
        <div key={el.id} style={boxStyle} className={shell}>
          {rotated(
            rotation,
            cn(
              "h-full min-h-0 overflow-y-auto border-t px-2 py-1 scrollbar-on-hover",
              tone === "light"
                ? "border-slate-600/60"
                : "border-stone-100 dark:border-border",
            ),
            <SlideMarkdown
              contentTone={tone}
              className={cn("max-w-none min-w-0", THUMB_MARKDOWN_COMPACT)}
            >
              {readTextMarkdownFromElement(slide, el)}
            </SlideMarkdown>,
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
            <SidebarCanvasBlockIconThumb
              Icon={PencilRuler}
              surfaceClassName="from-indigo-50 to-violet-100/90 dark:from-indigo-950/40 dark:to-violet-950/35"
              iconClassName="text-indigo-800 dark:text-indigo-200"
            />,
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
      <div className="relative isolate flex h-full min-h-0 w-full items-center justify-center rounded bg-stone-100/90 text-left text-[8px] text-stone-400 dark:bg-stone-800/90 dark:text-stone-500">
        Vacío
      </div>
    );
  }
  const sorted = [...scene.elements].sort(compareCanvasElementsByZThenId);

  return (
    <div className="sidebar-slide-canvas-mini relative isolate h-full min-h-0 w-full overflow-hidden rounded bg-white text-left dark:bg-surface-elevated">
      {sorted.map((el) => miniPreviewForElement(ensured, el))}
    </div>
  );
}
