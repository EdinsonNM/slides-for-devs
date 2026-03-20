import PptxGenJS from "pptxgenjs";
import type { Presentation } from "../types";
import type { Slide } from "../domain/entities/Slide";
import { isTauri } from "./updater";

/**
 * Convierte markdown básico a texto plano para PowerPoint
 * (elimina sintaxis markdown para que se vea legible).
 */
function markdownToPlainText(md: string): string {
  if (!md || typeof md !== "string") return "";
  let out = md
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .trim();
  return out;
}

/**
 * Extrae base64 y tipo de un data URL (data:image/png;base64,...).
 */
function parseDataUrl(dataUrl: string): { data: string; type: string } | null {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { data: match[2], type: match[1] };
}

/**
 * Genera un archivo .pptx en memoria a partir de la presentación
 * y lo devuelve como base64 (para Tauri) o dispara la descarga (navegador).
 */
export async function buildPresentationPptx(
  presentation: Presentation
): Promise<string> {
  const pptx = new PptxGenJS();
  const { topic, slides } = presentation;

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

  for (const slide of slides) {
    addSlideToPptx(pptx, slide);
  }

  // Escribir a base64 para poder guardar desde Tauri o devolver
  const base64 = await pptx.write({ outputType: "base64" });
  return typeof base64 === "string" ? base64 : "";
}

/**
 * Exporta la presentación a PowerPoint: en Tauri abre el diálogo de guardar
 * y escribe el archivo; en navegador descarga el .pptx.
 */
export async function exportPresentationToPowerPoint(
  presentation: Presentation,
  defaultFileName?: string
): Promise<void> {
  const base64 = await buildPresentationPptx(presentation);
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

function addSlideToPptx(pptx: PptxGenJS, slide: Slide): void {
  const s = pptx.addSlide();

  if (slide.type === "chapter") {
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

  if (slide.type === "diagram") {
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

  // type === "content"
  const bodyY = 0.9;
  const hasSplitPanel =
    Boolean(slide.imageUrl || slide.code || slide.videoUrl) ||
    slide.contentType === "presenter3d";
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

    if (slide.contentType === "code" && slide.code) {
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
      (slide.contentType === "video" ||
        (slide.contentType === "presenter3d" && slide.presenter3dScreenMedia === "video")) &&
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
      (slide.contentType !== "presenter3d" || slide.presenter3dScreenMedia !== "video")
    ) {
      const parsed = parseDataUrl(slide.imageUrl);
      if (parsed) {
        s.addImage({
          data: parsed.data,
          x: xRight,
          y: bodyY,
          w: imgW,
          h: imgH,
        });
      } else if (
        slide.imageUrl.startsWith("http://") ||
        slide.imageUrl.startsWith("https://")
      ) {
        try {
          s.addImage({
            path: slide.imageUrl,
            x: xRight,
            y: bodyY,
            w: imgW,
            h: imgH,
          });
        } catch {
          s.addText("[Imagen no disponible]", {
            x: xRight,
            y: bodyY + 1.2,
            w: imgW,
            h: 0.5,
            fontSize: 11,
            color: "7F7F7F",
          });
        }
      }
    } else if (slide.contentType === "presenter3d") {
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
        }
      );
    }
  }
}
