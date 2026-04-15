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

const CAPTURE_W = 1600;
const CAPTURE_H = 900;

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
  if (slide.type === SLIDE_TYPE.DIAGRAM) return 950;
  if (slide.type === SLIDE_TYPE.ISOMETRIC) return 850;
  if (slide.type === SLIDE_TYPE.MATRIX) return 400;
  if (slide.type === SLIDE_TYPE.CHAPTER) return 250;
  if (slide.type !== SLIDE_TYPE.CONTENT) return 350;
  const kind = resolveMediaPanelDescriptor(slide).kind;
  if (kind === PANEL_CONTENT_KIND.CANVAS_3D && slide.canvas3dGlbUrl?.trim()) {
    return 1400;
  }
  if (kind === PANEL_CONTENT_KIND.PRESENTER_3D) return 1100;
  if (kind === PANEL_CONTENT_KIND.VIDEO && slide.videoUrl?.trim()) return 500;
  return 450;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Renderiza la misma vista que el lienzo/preview y la rasteriza a PNG (base64 sin prefijo data:)
 * para incrustar en PPTX (imágenes del lienzo, WebGL 3D, isométrico, Excalidraw, etc.).
 */
export async function captureSlideAsPngBase64(
  slide: Slide,
  slideIndex: number,
  deckVisualTheme: DeckVisualTheme,
): Promise<string | null> {
  if (typeof document === "undefined") return null;

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
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
    }

    await settleAnimationFrames(4);
    await delay(extraPaintDelayMs(slide));

    const dataUrl = await toPng(host, {
      cacheBust: true,
      pixelRatio: 1,
      width: CAPTURE_W,
      height: CAPTURE_H,
      /** Evita leer CSS de Google Fonts u otros orígenes (SecurityError en embed-webfonts). */
      skipFonts: true,
    });

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
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, string>> {
  const theme = deckVisualTheme ?? DEFAULT_DECK_VISUAL_THEME;
  const out: Record<string, string> = {};
  const total = slides.length;
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]!;
    const b64 = await captureSlideAsPngBase64(slide, i, theme);
    if (b64) out[slide.id] = b64;
    onProgress?.(i + 1, total);
  }
  return out;
}
