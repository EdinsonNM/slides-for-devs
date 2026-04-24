/**
 * Documento incrustado en diapositivas tipo `SLIDE_TYPE.DOCUMENT`.
 * Se persiste como data URL (mismo patrón que imágenes / GLB en el deck).
 */
export type SlideDocumentKind = "pdf" | "markdown" | "docx" | "xlsx";

export interface SlideDocumentEmbed {
  dataUrl: string;
  fileName: string;
  kind: SlideDocumentKind;
}

export function inferSlideDocumentKind(file: File): SlideDocumentKind | null {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime === "text/markdown" ||
    mime === "text/x-markdown" ||
    name.endsWith(".md") ||
    name.endsWith(".markdown")
  ) {
    return "markdown";
  }
  if (
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    name.endsWith(".xlsx")
  ) {
    return "xlsx";
  }
  return null;
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("FileReader error"));
    r.readAsDataURL(file);
  });
}
