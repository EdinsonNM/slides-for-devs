import PptxGenJS from "pptxgenjs";
import type { Presentation } from "../types";
import type { Slide } from "../domain/entities/Slide";
import type { DeckVisualTheme } from "../domain/entities";
import {
  SLIDE_TYPE,
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
} from "../domain/entities";
import {
  resolveMediaPanelDescriptor,
  CodeMediaPanelDescriptor,
  VideoMediaPanelDescriptor,
  Presenter3dMediaPanelDescriptor,
  Canvas3dMediaPanelDescriptor,
} from "../domain/panelContent";
import { markdownToPlainText } from "../utils/markdownPlainText";
import { isTauri } from "./updater";
import {
  captureAllSlidesAsPngBase64,
  type PptxRasterProgressInfo,
} from "./pptxSlideRasterCapture";

export type PowerPointExportProgress =
  | PptxRasterProgressInfo
  | { phase: "pptx_packaging" };

export type { PptxRasterProgressInfo };

/**
 * Extrae base64 y tipo de un data URL (data:image/png;base64,...).
 */
function parseDataUrl(dataUrl: string): { data: string; type: string } | null {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { data: match[2]!, type: match[1]! };
}

/**
 * pptxgenjs valida que `data` contenga `base64,` y al empaquetar hace `split(',').pop()`.
 * Lo más fiable es pasar `data:image/<mime>;base64,<payload>` (ver `createChartMediaRels` en pptxgen).
 */
function inferImageMimeFromRawBase64(b64: string): string {
  const s = b64.trimStart();
  if (s.startsWith("/9j/")) return "image/jpeg";
  if (s.startsWith("iVBOR")) return "image/png";
  if (s.startsWith("R0lGOD")) return "image/gif";
  if (s.startsWith("UklGR")) return "image/webp";
  return "image/png";
}

function ensurePptxImageDataField(raw: string, mimeHint?: string): string {
  const v = raw.replace(/\s+/g, "").trim();
  if (!v) return v;
  const low = v.toLowerCase();
  if (low.startsWith("data:image/") && low.includes(";base64,")) return v;
  if (/^image\/[\w+.-]+;base64,/i.test(low)) {
    return low.startsWith("data:") ? v : `data:${v}`;
  }
  const mime = mimeHint?.trim() || inferImageMimeFromRawBase64(v);
  return `data:${mime};base64,${v}`;
}

/** Evita incrustar PNG vacío o inválido (PowerPoint muestra marco en blanco). */
function isUsableSlideRasterData(s: string | undefined | null): s is string {
  if (!s?.trim()) return false;
  const t = s.replace(/\s+/g, "").trim();
  const i = t.toLowerCase().lastIndexOf("base64,");
  if (i >= 0) return t.length - i - "base64,".length >= 48;
  return /^[0-9a-z+/=_-]+$/i.test(t) && t.length >= 120;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode.apply(
      null,
      Array.from(sub) as unknown as number[],
    );
  }
  return btoa(binary);
}

/**
 * Obtiene PNG/JPEG/WebP en base64 crudo para `pptxgenjs` (sin prefijo data:).
 */
export async function loadImageUrlAsPptxBase64(rawUrl: string): Promise<string | null> {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const parsed = parseDataUrl(trimmed);
  if (parsed?.type.startsWith("image/")) return parsed.data;

  if (trimmed.startsWith("blob:")) {
    try {
      const res = await fetch(trimmed);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      return arrayBufferToBase64(buf);
    } catch {
      return null;
    }
  }

  let url = trimmed;
  if (trimmed.startsWith("/") && typeof window !== "undefined" && window.location?.origin) {
    url = `${window.location.origin}${trimmed}`;
  }
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/") && !/octet-stream/i.test(ct)) {
      /* Algunos CDN no envían content-type correcto; aceptamos el buffer. */
    }
    const buf = await res.arrayBuffer();
    return arrayBufferToBase64(buf);
  } catch {
    return null;
  }
}

export type PowerPointExportOptions = {
  deckVisualTheme?: DeckVisualTheme;
  /**
   * En el navegador, por defecto se rasteriza cada diapositiva (imágenes, 3D, isométrico, Excalidraw).
   * Desactivar solo para depuración o entornos sin DOM.
   */
  rasterizeSlides?: boolean;
  /** Captura y empaquetado del .pptx (para UI de progreso). */
  onExportProgress?: (info: PowerPointExportProgress) => void;
  /** Ancho/alto de la captura raster (16:9 recomendado). Por defecto 1280×720. */
  rasterCaptureWidth?: number;
  rasterCaptureHeight?: number;
  /** Tiempo máximo por diapositiva en la captura `toPng` (ms). Por defecto 90000. */
  rasterSlideTimeoutMs?: number;
};

/**
 * Genera un archivo .pptx en memoria a partir de la presentación
 * y lo devuelve como base64 (para Tauri) o dispara la descarga (navegador).
 */
export async function buildPresentationPptx(
  presentation: Presentation,
  options?: PowerPointExportOptions,
): Promise<string> {
  const { topic, slides } = presentation;
  const themeForCapture =
    options?.deckVisualTheme ?? presentation.deckVisualTheme;

  const useRaster =
    options?.rasterizeSlides !== false &&
    typeof window !== "undefined" &&
    slides.length > 0;

  let slideRasterPngBase64: Record<string, string> = {};
  if (useRaster) {
    slideRasterPngBase64 = await captureAllSlidesAsPngBase64(
      slides,
      themeForCapture,
      {
        captureWidth: options?.rasterCaptureWidth,
        captureHeight: options?.rasterCaptureHeight,
        slideTimeoutMs: options?.rasterSlideTimeoutMs,
        onProgress: options?.onExportProgress
          ? (info) => options.onExportProgress!(info)
          : undefined,
      },
    );
  }

  const pptx = new PptxGenJS();

  pptx.title = topic || "Presentación";
  pptx.author = "Slides for Devs";
  pptx.subject = topic || "";

  // Portada
  const titleSlide = pptx.addSlide();
  titleSlide.addText(topic || "Presentación", {
    x: 0.5,
    y: 1.5,
    w: "90%",
    h: 1.2,
    fontSize: 44,
    bold: true,
    align: "center",
    fontFace: "Arial",
  });
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: "45%",
    y: 2.8,
    w: "10%",
    h: 0.03,
    fill: { color: "2D7D5E" },
  });

  const imageCache = new Map<string, Promise<string | null>>();

  const getCachedImage = (url: string) => {
    const key = url.trim();
    let p = imageCache.get(key);
    if (!p) {
      p = loadImageUrlAsPptxBase64(key);
      imageCache.set(key, p);
    }
    return p;
  };

  for (const slide of slides) {
    await addSlideToPptx(pptx, slide, {
      fullSlideRasterBase64: slideRasterPngBase64[slide.id],
      getImageBase64: getCachedImage,
    });
  }

  options?.onExportProgress?.({ phase: "pptx_packaging" });
  if (typeof requestAnimationFrame !== "undefined") {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }

  const base64 = await pptx.write({ outputType: "base64" });
  return typeof base64 === "string" ? base64 : "";
}

/**
 * Exporta la presentación a PowerPoint: en Tauri abre el diálogo de guardar
 * y escribe el archivo; en navegador descarga el .pptx.
 */
export async function exportPresentationToPowerPoint(
  presentation: Presentation,
  defaultFileName?: string,
  options?: PowerPointExportOptions,
): Promise<void> {
  const base64 = await buildPresentationPptx(presentation, options);
  if (!base64) {
    throw new Error("No se pudo generar el archivo PowerPoint.");
  }

  const fileName =
    defaultFileName ||
    `${(presentation.topic || "presentacion").replace(/[^\w\s-]/g, "").trim().slice(0, 80) || "presentacion"}.pptx`;

  if (isTauri()) {
    const { save: openSaveDialog } = await import("@tauri-apps/plugin-dialog");
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await openSaveDialog({
      defaultPath: fileName,
      filters: [{ name: "PowerPoint", extensions: ["pptx"] }],
    });
    if (path) {
      await invoke("write_binary_file", {
        path,
        base64Content: base64,
      });
    }
  } else {
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([binary], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

type AddSlideOpts = {
  fullSlideRasterBase64?: string;
  getImageBase64: (url: string) => Promise<string | null>;
};

async function addSlideToPptx(
  pptx: PptxGenJS,
  slide: Slide,
  opts: AddSlideOpts,
): Promise<void> {
  if (isUsableSlideRasterData(opts.fullSlideRasterBase64)) {
    const s = pptx.addSlide();
    s.addImage({
      data: ensurePptxImageDataField(opts.fullSlideRasterBase64, "image/png"),
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
    });
    return;
  }

  const s = pptx.addSlide();

  if (slide.type === SLIDE_TYPE.CHAPTER) {
    s.addText(slide.title, {
      x: 0.5,
      y: 2,
      w: "90%",
      h: 1.2,
      fontSize: 36,
      bold: true,
      italic: true,
      align: "center",
      fontFace: "Arial",
    });
    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 0.5,
        y: 3,
        w: "90%",
        h: 0.5,
        fontSize: 18,
        align: "center",
        color: "7F7F7F",
        fontFace: "Arial",
      });
    }
    s.addShape(pptx.ShapeType.rect, {
      x: "45%",
      y: 1.7,
      w: "10%",
      h: 0.03,
      fill: { color: "2D7D5E" },
    });
    return;
  }

  if (slide.type === SLIDE_TYPE.MATRIX) {
    const m = normalizeSlideMatrixData(slide.matrixData ?? createEmptySlideMatrixData());
    s.addText(slide.title || "Tabla", {
      x: 0.5,
      y: 0.25,
      w: "90%",
      h: 0.55,
      fontSize: 26,
      bold: true,
      fontFace: "Arial",
    });
    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 0.5,
        y: 0.78,
        w: "90%",
        h: 0.35,
        fontSize: 14,
        color: "7F7F7F",
        fontFace: "Arial",
      });
    }
    const headerLine = m.columnHeaders.join(" · ");
    const rowLines = m.rows.map((r) => r.join(" · "));
    const tableText = [headerLine, ...rowLines].join("\n");
    s.addText(tableText, {
      x: 0.5,
      y: slide.subtitle ? 1.2 : 0.95,
      w: "92%",
      h: 3.6,
      fontSize: 11,
      fontFace: "Arial",
      valign: "top",
    });
    const notes = markdownToPlainText(slide.content || "");
    if (notes) {
      s.addText(notes, {
        x: 0.5,
        y: 4.85,
        w: "92%",
        h: 1.2,
        fontSize: 10,
        color: "555555",
        fontFace: "Arial",
        valign: "top",
      });
    }
    return;
  }

  if (slide.type === SLIDE_TYPE.DIAGRAM) {
    s.addText(slide.title || "Diagrama", {
      x: 0.5,
      y: 0.3,
      w: "90%",
      h: 0.6,
      fontSize: 28,
      bold: true,
      fontFace: "Arial",
    });
    s.addText("(Diagrama Excalidraw – revisar en la app)", {
      x: 0.5,
      y: 2.5,
      w: "90%",
      h: 0.5,
      fontSize: 14,
      color: "7F7F7F",
      align: "center",
      fontFace: "Arial",
    });
    return;
  }

  if (slide.type === SLIDE_TYPE.ISOMETRIC) {
    let y = 0.3;
    s.addText(slide.title || "Diagrama isométrico", {
      x: 0.5,
      y,
      w: "90%",
      h: 0.55,
      fontSize: 28,
      bold: true,
      fontFace: "Arial",
    });
    y += 0.75;
    const subPlain = markdownToPlainText(slide.subtitle || "").trim();
    if (subPlain) {
      s.addText(subPlain, {
        x: 0.5,
        y,
        w: "90%",
        h: 0.45,
        fontSize: 16,
        fontFace: "Arial",
      });
      y += 0.55;
    }
    const bodyPlain = markdownToPlainText(slide.content || "").trim();
    if (bodyPlain) {
      s.addText(bodyPlain, {
        x: 0.5,
        y,
        w: "90%",
        h: Math.min(2.8, 4.2 - y),
        fontSize: 12,
        fontFace: "Arial",
        valign: "top",
      });
      y += Math.min(2.8, 4.2 - y) + 0.15;
    }
    s.addText("(Diagrama isométrico – revisar en la app)", {
      x: 0.5,
      y: Math.max(y, 2.5),
      w: "90%",
      h: 0.5,
      fontSize: 14,
      color: "7F7F7F",
      align: "center",
      fontFace: "Arial",
    });
    return;
  }

  // type === "content"
  const bodyY = 0.9;
  const panelDesc = resolveMediaPanelDescriptor(slide);
  const hasSplitPanel = panelDesc.splitPanelOccupied(slide);
  s.addText(slide.title, {
    x: 0.5,
    y: 0.3,
    w: hasSplitPanel ? "55%" : "90%",
    h: 0.55,
    fontSize: 24,
    bold: true,
    fontFace: "Arial",
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 0.82,
    w: 1,
    h: 0.02,
    fill: { color: "2D7D5E" },
  });

  const bodyText = markdownToPlainText(slide.content || "");
  if (bodyText) {
    s.addText(bodyText, {
      x: 0.5,
      y: bodyY,
      w: hasSplitPanel ? "55%" : "90%",
      h: 3.8,
      fontSize: 12,
      fontFace: "Arial",
      valign: "top",
      bullet: true,
    });
  }

  const hasRightContent = hasSplitPanel;
  if (hasRightContent) {
    const imgW = 4.2;
    const imgH = 3.2;
    const xRight = 6;

    if (panelDesc instanceof CodeMediaPanelDescriptor && slide.code) {
      s.addText(slide.code, {
        x: xRight,
        y: bodyY,
        w: imgW,
        h: imgH,
        fontSize: 10,
        fontFace: "Consolas",
        valign: "top",
        fill: { color: "F5F5F5" },
        align: "left",
      });
    } else if (
      (panelDesc instanceof VideoMediaPanelDescriptor ||
        (panelDesc instanceof Presenter3dMediaPanelDescriptor &&
          slide.presenter3dScreenMedia === "video")) &&
      slide.videoUrl
    ) {
      s.addText(`Video: ${slide.videoUrl}`, {
        x: xRight,
        y: bodyY + 1.2,
        w: imgW,
        h: 0.8,
        fontSize: 11,
        fontFace: "Arial",
        hyperlink: { url: slide.videoUrl, tooltip: "Abrir video" },
      });
    } else if (
      slide.imageUrl &&
      (!(panelDesc instanceof Presenter3dMediaPanelDescriptor) ||
        slide.presenter3dScreenMedia !== "video")
    ) {
      const parsed = parseDataUrl(slide.imageUrl);
      const imgRaw = parsed?.data ?? (await opts.getImageBase64(slide.imageUrl));
      if (imgRaw) {
        const mime =
          parsed?.type && parsed.type.startsWith("image/")
            ? parsed.type
            : inferImageMimeFromRawBase64(imgRaw);
        s.addImage({
          data: ensurePptxImageDataField(imgRaw, mime),
          x: xRight,
          y: bodyY,
          w: imgW,
          h: imgH,
        });
      } else {
        s.addText("[Imagen no disponible o CORS bloqueado]", {
          x: xRight,
          y: bodyY + 1.2,
          w: imgW,
          h: 0.5,
          fontSize: 11,
          color: "7F7F7F",
        });
      }
    } else if (panelDesc instanceof Presenter3dMediaPanelDescriptor) {
      s.addText(
        "[Presentador 3D — la maqueta no se exporta a PPTX; la textura de pantalla sí, si hay imagen o enlace de vídeo válido]",
        {
          x: xRight,
          y: bodyY + 0.8,
          w: imgW,
          h: 1.5,
          fontSize: 10,
          fontFace: "Arial",
          color: "7F7F7F",
        },
      );
    } else if (panelDesc instanceof Canvas3dMediaPanelDescriptor) {
      const raw = slide.canvas3dGlbUrl?.trim() ?? "";
      const urlPreview =
        raw.startsWith("data:") && raw.length > 80
          ? `${raw.slice(0, 48)}… (modelo incrustado en la presentación)`
          : raw.length > 120
            ? `${raw.slice(0, 120)}…`
            : raw;
      const hint = raw
        ? `[Canvas 3D — el GLB no se incrusta en PPTX; referencia: ${urlPreview}]`
        : "[Canvas 3D — sin modelo enlazado en esta diapositiva]";
      s.addText(hint, {
        x: xRight,
        y: bodyY + 0.8,
        w: imgW,
        h: 1.5,
        fontSize: 10,
        fontFace: "Arial",
        color: "7F7F7F",
      });
    }
  }
}
