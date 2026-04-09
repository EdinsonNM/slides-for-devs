/**
 * Si el hueco entre tokens tenía al menos un salto de línea, inserta separación de bloque (\n\n)
 * para que CommonMark no fusione párrafos con listas. Si solo había espacios, basta un \n.
 */
function splitBeforeListToken(full: string, listToken: string): string {
  const ws = full.slice(0, full.length - listToken.length);
  return (/\n/.test(ws) ? "\n\n" : "\n") + listToken;
}

/**
 * Normaliza y formatea contenido markdown para mostrar correctamente.
 * - Unifica saltos de línea y convierte viñetas Unicode en listas.
 * - Separa listas que vienen pegadas en una sola línea.
 * - Asegura salto de línea después de encabezados (# ## ###) cuando van pegados a listas.
 */
export function formatMarkdown(content: string): string {
  if (!content) return "";
  let out = content.replace(/\\n/g, "\n");
  out = out.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Encabezados pegados a lista sin salto de línea: "## Título* item" o "### Título* item" → "## Título\n* item"
  // Así el markdown interpreta ## como encabezado y * como lista en líneas distintas
  out = out.replace(/(#{1,6}\s+.+?)(\*\s+)/g, "$1\n$2");
  out = out.replace(/(#{1,6}\s+.+?)(-\s+)/g, "$1\n$2");
  out = out.replace(/(#{1,6}\s+.+?)(\d+\.\s+)/g, "$1\n$2");

  // Viñetas Unicode → lista markdown
  out = out.replace(/\s*•\s+/g, "\n* ");

  // Sublistas numeradas pegadas en una línea: "  1.  **X**" o "   2.  **Y**" (2+ espacios) → nueva línea antes del número
  out = out.replace(/\s{2,}(\d+\.\s+)/g, (full, tok) => splitBeforeListToken(full, tok));

  // Listas con asterisco pegadas: " * **Título**: ..." o ".* * **Siguiente**" → nueva línea antes de cada ítem
  out = out.replace(/\s+(\*\s+\*\*)/g, (full, tok) => splitBeforeListToken(full, tok));
  // También "* item" cuando aparece después de espacios (varios ítems en una línea)
  out = out.replace(/\s{2,}(\*\s+)/g, (full, tok) => splitBeforeListToken(full, tok));
  // Listas con guión pegadas: " - **Título**: ..." → nueva línea
  out = out.replace(/\s+(-\s+\*\*)/g, (full, tok) => splitBeforeListToken(full, tok));
  out = out.replace(/\s{2,}(-\s+)/g, (full, tok) => splitBeforeListToken(full, tok));

  // Eliminar líneas completamente vacías múltiples (máximo una vacía entre bloques)
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}
