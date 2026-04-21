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

/** 720p: equilibrio entre calidad y tiempo con `html-to-image`. */
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
  /** Iconos SVG remotos + manifiestos: necesita más tiempo que un slide de texto. */
  if (slide.type === SLIDE_TYPE.ISOMETRIC) return 2400;
  if (slide.type === SLIDE_TYPE.MATRIX) return 180;
  if (slide.type === SLIDE_TYPE.CHAPTER) return 120;
  if (slide.type !== SLIDE_TYPE.CONTENT) return 200;
  const kind = resolveMediaPanelDescriptor(slide).kind;
  if (kind === PANEL_CONTENT_KIND.CANVAS_3D && slide.canvas3dGlbUrl?.trim()) {
    return 700;
  }
  if (kind === PANEL_CONTENT_KIND.PRESENTER_3D) return 550;
  if (kind === PANEL_CONTENT_KIND.VIDEO && slide.videoUrl?.trim()) return 280;
  if (kind === PANEL_CONTENT_KIND.IFRAME_EMBED && slide.iframeEmbedUrl?.trim()) {
    return 500;
  }
  if (kind === PANEL_CONTENT_KIND.RIVE && slide.riveUrl?.trim()) return 520;
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
 * `html-to-image` puede devolver `data:image/png;base64,…` o con `charset=utf-8` u otro
 * parámetro antes de `base64,`. Un regex estricto solo PNG hacía fallar la captura → null.
 * Devuelve un data URL canónico `data:<mime>;base64,<payload>` para pptxgenjs.
 */
function normalizeHtmlToImageDataUrlForPptx(fromToPng: string): string | null {
  const s = fromToPng.trim().replace(/\s+/g, "");
  if (!s) return null;
  const lower = s.toLowerCase();
  const b64Marker = ";base64,";
  const idx = lower.indexOf(b64Marker);
  if (idx < 0) return null;
  const payload = s.slice(idx + b64Marker.length);
  if (payload.length < 48) return null;
  if (!lower.startsWith("data:image/")) return null;
  const before = s.slice("data:".length, idx);
  const mime = before.split(";")[0]!.trim().toLowerCase();
  if (!mime.startsWith("image/")) return null;
  return `data:${mime};base64,${payload}`;
}

/**
 * Las animaciones CSS dentro del SVG (trazos discontinuos) suelen romper o bloquear
 * la clonación de `html-to-image`; las desactivamos solo bajo el host de captura.
 */
function injectPptxCaptureNoMotionCss(host: HTMLElement): void {
  const s = document.createElement("style");
  s.setAttribute("data-pptx-capture-css", "1");
  s.textContent = `
    [data-pptx-slide-capture] .iso-flow-dash { animation: none !important; }
    [data-pptx-slide-capture] .iso-node-hoverable { transition: none !important; }
    [data-pptx-slide-capture] .iso-node-hoverable.is-hovered {
      transform: none !important;
      filter: none !important;
    }
  `;
  host.insertBefore(s, host.firstChild);
}

async function tryToPngRawBase64(
  node: HTMLElement | SVGSVGElement,
  options: {
    width: number;
    height: number;
    backgroundColor?: string;
  },
  slideTimeoutMs: number,
  slideId: string,
  label: string,
): Promise<string | null> {
  const task = toPng(node as HTMLElement, {
    /** `true` fuerza refetch con query params y puede romper CORS en capturas offscreen. */
    cacheBust: false,
    pixelRatio: 1,
    width: options.width,
    height: options.height,
    skipFonts: true,
    ...(options.backgroundColor
      ? { backgroundColor: options.backgroundColor }
      : {}),
  });
  const result = await withTimeout(task, slideTimeoutMs, () => {
    console.warn(
      `[pptx] captura (${label}) superó ${slideTimeoutMs}ms — slide ${slideId}`,
    );
  });
  if (result === "timeout") return null;
  return normalizeHtmlToImageDataUrlForPptx(result);
}

/**
 * Segundo intento: `html2canvas` clona el DOM de otra forma (sin foreignObject como `html-to-image`)
 * y suele funcionar cuando `toPng` devuelve vacío o lanza (p. ej. WebKit/Tauri o SVG complejos).
 */
async function tryHtml2CanvasDataUrl(
  node: HTMLElement,
  options: {
    width: number;
    height: number;
    backgroundColor?: string;
  },
): Promise<string | null> {
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(node, {
      scale: 1,
      width: options.width,
      height: options.height,
      windowWidth: options.width,
      windowHeight: options.height,
      backgroundColor: options.backgroundColor ?? "#ffffff",
      useCORS: true,
      logging: false,
      foreignObjectRendering: false,
      ignoreElements: (el) => el instanceof HTMLIFrameElement,
    });
    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL("image/png");
    } catch (e) {
      console.warn("[pptx] html2canvas: lienzo contaminado (tainted), sin data URL", e);
      return null;
    }
    return normalizeHtmlToImageDataUrlForPptx(dataUrl);
  } catch (e) {
    console.warn("[pptx] html2canvas falló", e);
    return null;
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
    `display:flex`,
    `flex-direction:column`,
  ].join(";");

  document.body.appendChild(host);

  let root: ReturnType<typeof createRoot> | null = null;
  try {
    root = createRoot(host);
    root.render(
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col"
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
          pptxExportFrame
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

    await settleAnimationFrames(4);
    await delay(extraPaintDelayMs(slide));
    injectPptxCaptureNoMotionCss(host);
    await settleAnimationFrames(2);

    let raw: string | null = null;
    try {
      raw = await tryToPngRawBase64(
        host,
        { width: CAPTURE_W, height: CAPTURE_H },
        slideTimeoutMs,
        slide.id,
        "lienzo completo",
      );
    } catch (e) {
      console.warn("[pptx] toPng(host) falló", slide.id, e);
    }

    if (!raw) {
      raw = await tryHtml2CanvasDataUrl(host, {
        width: CAPTURE_W,
        height: CAPTURE_H,
        backgroundColor: "#ffffff",
      });
      if (!raw) {
        console.warn(
          "[pptx] captura raster: html-to-image y html2canvas devolvieron null —",
          slide.id,
        );
      }
    }

    if (
      !raw &&
      slide.type === SLIDE_TYPE.ISOMETRIC &&
      typeof HTMLElement !== "undefined"
    ) {
      const svg = host.querySelector("svg[role='img']") as SVGSVGElement | null;
      if (svg) {
        const br = svg.getBoundingClientRect();
        if (br.width >= 24 && br.height >= 24) {
          const sw = Math.min(Math.ceil(br.width), CAPTURE_W);
          const sh = Math.min(Math.ceil(br.height), CAPTURE_H);
          try {
            raw = await tryToPngRawBase64(
              svg,
              {
                width: sw,
                height: sh,
                backgroundColor: "rgb(248 250 252)",
              },
              Math.min(slideTimeoutMs, 45_000),
              slide.id,
              "SVG isométrico",
            );
          } catch (e) {
            console.warn("[pptx] toPng(svg) isométrico falló", slide.id, e);
          }
        }
      }
    }

    return raw;
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
