import type { Slide } from "../domain/entities/Slide";
import type { DeckVisualTheme } from "../domain/entities";
import { DEFAULT_DECK_VISUAL_THEME } from "../domain/entities";
import { isTauri } from "./updater";

const CAPTURE_HIDE_CSS_CLASS = "slide-export-capture-in-progress";

function injectCaptureStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.setAttribute("data-export-slide-capture", "1");
  style.textContent = `
    .${CAPTURE_HIDE_CSS_CLASS} [data-slide-canvas-chrome],
    .${CAPTURE_HIDE_CSS_CLASS} [data-slide-canvas-hover],
    .${CAPTURE_HIDE_CSS_CLASS} [data-canvas-resize],
    .${CAPTURE_HIDE_CSS_CLASS} .slide-canvas-alignment-guide {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
    .${CAPTURE_HIDE_CSS_CLASS} {
      border-color: transparent !important;
      outline: none !important;
      box-shadow: none !important;
    }
  `;
  document.head.appendChild(style);
  return style;
}

async function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 50);
      });
    });
  });
}

/**
 * Captura con html2canvas (no usa SVG foreignObject, más compatible con WebKit/Tauri).
 */
async function captureWithHtml2Canvas(
  el: HTMLElement,
  w: number,
  h: number,
): Promise<string | null> {
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, {
      scale: 2,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      foreignObjectRendering: false,
      allowTaint: true,
      ignoreElements: (node) => {
        if (node instanceof HTMLIFrameElement) return true;
        const ds = (node as HTMLElement).dataset;
        if (ds?.slideCanvasChrome !== undefined) return true;
        if (ds?.slideCanvasHover !== undefined) return true;
        if (ds?.canvasResize !== undefined) return true;
        return false;
      },
    });
    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL("image/png");
    } catch (e) {
      console.warn("[exportSlide] html2canvas: lienzo contaminado (tainted)", e);
      return null;
    }
    if (!dataUrl || dataUrl.length < 100) return null;
    return dataUrl;
  } catch (e) {
    console.warn("[exportSlide] html2canvas falló:", e);
    return null;
  }
}

/**
 * Captura con html-to-image (toPng) como fallback.
 */
async function captureWithToPng(
  el: HTMLElement,
  w: number,
  h: number,
): Promise<string | null> {
  try {
    const { toPng } = await import("html-to-image");
    const result = await toPng(el, {
      cacheBust: false,
      pixelRatio: 2,
      width: w,
      height: h,
      skipFonts: true,
      backgroundColor: "#ffffff",
    });
    if (!result || result.length < 100) return null;
    return result;
  } catch (e) {
    console.warn("[exportSlide] toPng falló:", e);
    return null;
  }
}

function findSlideElement(): HTMLElement | null {
  const el = document.querySelector(".slide-content") as HTMLElement | null;
  if (el) return el;
  const wrap = document.querySelector(
    ".slide-editor-canvas-wrap",
  ) as HTMLElement | null;
  if (wrap) {
    const inner = wrap.querySelector("[class*='aspect-video']") as HTMLElement | null;
    if (inner) return inner;
  }
  return null;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(",");
  if (!header || !payload) throw new Error("Data URL inválida");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function exportCurrentSlideAsImage(
  slide: Slide,
  slideIndex: number,
  _deckVisualTheme?: DeckVisualTheme,
): Promise<void> {
  void (_deckVisualTheme ?? DEFAULT_DECK_VISUAL_THEME);

  const el = findSlideElement();
  if (!el) {
    throw new Error(
      "No se encontró el elemento de la diapositiva en el DOM. " +
        "Asegúrate de estar en el editor con una diapositiva visible.",
    );
  }

  const style = injectCaptureStyles();
  el.classList.add(CAPTURE_HIDE_CSS_CLASS);

  let dataUrl: string | null = null;

  try {
    await waitForPaint();

    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);

    if (w < 10 || h < 10) {
      throw new Error(
        `El elemento de la diapositiva tiene dimensiones inválidas (${w}×${h}). ` +
          "Asegúrate de que la diapositiva sea visible en pantalla.",
      );
    }

    console.info(
      `[exportSlide] capturando .slide-content (${w}×${h}) con html2canvas…`,
    );
    dataUrl = await captureWithHtml2Canvas(el, w, h);

    if (!dataUrl) {
      console.info("[exportSlide] html2canvas falló, intentando toPng…");
      dataUrl = await captureWithToPng(el, w, h);
    }
  } finally {
    el.classList.remove(CAPTURE_HIDE_CSS_CLASS);
    style.remove();
  }

  if (!dataUrl) {
    throw new Error(
      "No se pudo capturar la diapositiva. Tanto html2canvas como html-to-image fallaron. " +
        "Revisa la consola del navegador (F12 → Console) para ver los errores detallados.",
    );
  }

  const safeTitle =
    (slide.title || "slide")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .slice(0, 60) || "slide";
  const fileName = `${safeTitle}-${slideIndex + 1}.png`;

  if (isTauri()) {
    const { save: openSaveDialog } = await import("@tauri-apps/plugin-dialog");
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await openSaveDialog({
      defaultPath: fileName,
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });
    if (path) {
      const base64Content = dataUrl.includes(",")
        ? dataUrl.split(",")[1]!
        : dataUrl;
      await invoke("write_binary_file", {
        path,
        base64Content,
      });
    }
  } else {
    const blob = dataUrlToBlob(dataUrl);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
