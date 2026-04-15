import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import type { Slide } from "../types";
import {
  DEFAULT_DECK_VISUAL_THEME,
  type DeckVisualTheme,
  SLIDE_TYPE,
} from "../domain/entities";
import {
  PANEL_CONTENT_KIND,
  resolveMediaPanelDescriptor,
} from "../domain/panelContent";
import { PreviewSlideContent } from "../components/preview/PreviewSlideContent";

/** 720p: mucho más rápido que 1600×900 en `html-to-image` con lienzos pesados. */
const DEFAULT_CAPTURE_W = 1280;
const DEFAULT_CAPTURE_H = 720;

/** Si `toPng` no termina (DOM enorme / bug), seguir con la siguiente diapositiva. */
const DEFAULT_SLIDE_TIMEOUT_MS = 90_000;

export type PptxRasterProgressInfo =
  | {
      phase: "capture_start";
      slideIndex: number;
      totalSlides: number;
      slideId: string;
    }
  | {
      phase: "capture_done";
      slideIndex: number;
      totalSlides: number;
      slideId: string;
      success: boolean;
    };

export type CaptureSlidesRasterOptions = {
  captureWidth?: number;
  captureHeight?: number;
  /** Tiempo máximo por diapositiva para `toPng` (ms). */
  slideTimeoutMs?: number;
  onProgress?: (info: PptxRasterProgressInfo) => void;
};

function settleAnimationFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count;
    const tick = () => {
      requestAnimationFrame(() => {
        remaining -= 1;
        if (remaining <= 0) resolve();
        else tick();
      });
    };
    tick();
  });
}

function extraPaintDelayMs(slide: Slide): number {
  if (slide.type === SLIDE_TYPE.DIAGRAM) return 450;
  if (slide.type === SLIDE_TYPE.ISOMETRIC) return 400;
  if (slide.type === SLIDE_TYPE.MATRIX) return 180;
  if (slide.type === SLIDE_TYPE.CHAPTER) return 120;
  if (slide.type !== SLIDE_TYPE.CONTENT) return 200;
  const kind = resolveMediaPanelDescriptor(slide).kind;
  if (kind === PANEL_CONTENT_KIND.CANVAS_3D && slide.canvas3dGlbUrl?.trim()) {
    return 700;
  }
  if (kind === PANEL_CONTENT_KIND.PRESENTER_3D) return 550;
  if (kind === PANEL_CONTENT_KIND.VIDEO && slide.videoUrl?.trim()) return 280;
  return 220;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Deja que React pinte el indicador de progreso antes del trabajo pesado. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

async function withTimeout<T>(
  task: Promise<T>,
  ms: number,
  onTimeout: () => void,
): Promise<T | "timeout"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => {
      onTimeout();
      resolve("timeout");
    }, ms);
  });
  try {
    return await Promise.race([task, timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Renderiza la misma vista que el lienzo/preview y la rasteriza a PNG (base64 sin prefijo data:)
 * para incrustar en PPTX (imágenes del lienzo, WebGL 3D, isométrico, Excalidraw, etc.).
 */
export async function captureSlideAsPngBase64(
  slide: Slide,
  slideIndex: number,
  deckVisualTheme: DeckVisualTheme,
  captureOptions?: Pick<
    CaptureSlidesRasterOptions,
    "captureWidth" | "captureHeight" | "slideTimeoutMs"
  >,
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  const CAPTURE_W = captureOptions?.captureWidth ?? DEFAULT_CAPTURE_W;
  const CAPTURE_H = captureOptions?.captureHeight ?? DEFAULT_CAPTURE_H;
  const slideTimeoutMs = captureOptions?.slideTimeoutMs ?? DEFAULT_SLIDE_TIMEOUT_MS;

  const host = document.createElement("div");
  host.setAttribute("data-pptx-slide-capture", slide.id);
  host.style.cssText = [
    `position:fixed`,
    `left:-${CAPTURE_W + 400}px`,
    `top:0`,
    `width:${CAPTURE_W}px`,
    `height:${CAPTURE_H}px`,
    `z-index:2147483000`,
    `overflow:hidden`,
    `pointer-events:none`,
  ].join(";");

  document.body.appendChild(host);

  let root: ReturnType<typeof createRoot> | null = null;
  try {
    root = createRoot(host);
    root.render(
      <div
        className="flex h-full w-full min-h-0 min-w-0 flex-col"
        style={{ width: CAPTURE_W, height: CAPTURE_H }}
      >
        <PreviewSlideContent
          slide={slide}
          slideIndex={slideIndex}
          deckVisualTheme={deckVisualTheme}
          imageWidthPercent={50}
          panelHeightPercent={60}
          layout="default"
          disableEntryMotion
          fillExportContainer
        />
      </div>,
    );

    if (typeof document.fonts?.ready !== "undefined") {
      try {
        await Promise.race([
          document.fonts.ready,
          delay(8000),
        ]);
      } catch {
        /* ignore */
      }
    }

    await settleAnimationFrames(3);
    await delay(extraPaintDelayMs(slide));

    const toPngTask = toPng(host, {
      cacheBust: true,
      pixelRatio: 1,
      width: CAPTURE_W,
      height: CAPTURE_H,
      skipFonts: true,
    });

    const result = await withTimeout(toPngTask, slideTimeoutMs, () => {
      console.warn(
        `[pptx] captura superó ${slideTimeoutMs}ms (slide ${slide.id}); se omite la imagen de esta diapositiva.`,
      );
    });

    if (result === "timeout") {
      return null;
    }

    const dataUrl = result;
    const m = dataUrl.match(/^data:image\/png;base64,(.+)$/);
    return m ? m[1]! : null;
  } catch (e) {
    console.warn("[pptx] captura raster fallida para slide", slide.id, e);
    return null;
  } finally {
    root?.unmount();
    root = null;
    host.remove();
  }
}

export async function captureAllSlidesAsPngBase64(
  slides: Slide[],
  deckVisualTheme: DeckVisualTheme | undefined,
  options?: CaptureSlidesRasterOptions,
): Promise<Record<string, string>> {
  const theme = deckVisualTheme ?? DEFAULT_DECK_VISUAL_THEME;
  const out: Record<string, string> = {};
  const total = slides.length;
  const captureW = options?.captureWidth ?? DEFAULT_CAPTURE_W;
  const captureH = options?.captureHeight ?? DEFAULT_CAPTURE_H;
  const slideTimeoutMs = options?.slideTimeoutMs ?? DEFAULT_SLIDE_TIMEOUT_MS;
  const onProgress = options?.onProgress;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]!;
    onProgress?.({
      phase: "capture_start",
      slideIndex: i,
      totalSlides: total,
      slideId: slide.id,
    });
    await nextPaint();

    const b64 = await captureSlideAsPngBase64(slide, i, theme, {
      captureWidth: captureW,
      captureHeight: captureH,
      slideTimeoutMs,
    });
    if (b64) out[slide.id] = b64;

    onProgress?.({
      phase: "capture_done",
      slideIndex: i,
      totalSlides: total,
      slideId: slide.id,
      success: Boolean(b64),
    });
    await delay(0);
  }
  return out;
}
