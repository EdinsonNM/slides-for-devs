import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

/** Quita cercados ```mermaid del texto si el modelo los incluyó. */
export function stripMermaidFences(src: string): string {
  const t = src.trim();
  const fenced = t.match(/^```(?:mermaid)?\s*([\s\S]*?)```$/i);
  if (fenced) return fenced[1].trim();
  return t;
}

function serializeFilesForJson(
  files: Record<string, unknown> | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!files || typeof files !== "object") return out;
  for (const [id, f] of Object.entries(files)) {
    if (f && typeof f === "object") {
      const entry = f as Record<string, unknown>;
      if (typeof entry.dataURL === "string") {
        out[id] = {
          mimeType: entry.mimeType,
          dataURL: entry.dataURL,
          id: entry.id ?? id,
        };
      }
    }
  }
  return out;
}

/**
 * Convierte definición Mermaid en JSON de escena compatible con SlideContentDiagram / ExcalidrawViewer.
 */
export async function buildExcalidrawJsonFromMermaid(
  mermaidSource: string
): Promise<string> {
  const cleaned = stripMermaidFences(mermaidSource).trim();
  if (!cleaned) {
    throw new Error("El diagrama Mermaid está vacío.");
  }
  const { elements, files } = await parseMermaidToExcalidraw(cleaned);
  const excalidrawElements = convertToExcalidrawElements(elements, {
    regenerateIds: true,
  });
  return JSON.stringify({
    elements: excalidrawElements,
    appState: {},
    files: serializeFilesForJson(files as Record<string, unknown> | undefined),
  });
}
