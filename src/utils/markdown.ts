/**
 * Si el hueco entre tokens tenía al menos un salto de línea, inserta separación de bloque (\n\n)
 * para que CommonMark no fusione párrafos con listas. Si solo había espacios, basta un \n.
 */
function splitBeforeListToken(full: string, listToken: string): string {
  const ws = full.slice(0, full.length - listToken.length);
  return (/\n/.test(ws) ? "\n\n" : "\n") + listToken;
}

/** Aplica `map` solo a trozos fuera de bloques ``` … ``` para no alterar código. */
function mapOutsideFencedCode(source: string, map: (chunk: string) => string): string {
  let result = "";
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf("```", cursor);
    if (open === -1) {
      result += map(source.slice(cursor));
      break;
    }
    result += map(source.slice(cursor, open));
    const close = source.indexOf("```", open + 3);
    if (close === -1) {
      result += source.slice(open);
      break;
    }
    result += source.slice(open, close + 3);
    cursor = close + 3;
  }
  return result;
}

function formatMarkdownChunkCore(chunk: string): string {
  let c = chunk;

  // Tras texto en la misma línea, un solo \n antes de # deja el encabezado en el mismo bloque que el párrafo
  // en el AST (se ve "pegado" y a veces no se interpreta como ATX). Forzar línea en blanco.
  c = c.replace(/([^\n])\n(#{1,6}\s)/g, "$1\n\n$2");

  // Encabezados pegados a lista sin salto de línea: "## Título* item" o "### Título* item" → "## Título\n* item"
  c = c.replace(/(#{1,6}\s+.+?)(\*\s+)/g, "$1\n$2");
  c = c.replace(/(#{1,6}\s+.+?)(-\s+)/g, "$1\n$2");
  c = c.replace(/(#{1,6}\s+.+?)(\d+\.\s+)/g, "$1\n$2");

  // Viñetas Unicode → lista markdown
  c = c.replace(/\s*•\s+/g, "\n* ");

  c = c.replace(/\s{2,}(\d+\.\s+)/g, (full, tok) => splitBeforeListToken(full, tok));
  c = c.replace(/\s+(\*\s+\*\*)/g, (full, tok) => splitBeforeListToken(full, tok));
  c = c.replace(/\s{2,}(\*\s+)/g, (full, tok) => splitBeforeListToken(full, tok));
  c = c.replace(/\s+(-\s+\*\*)/g, (full, tok) => splitBeforeListToken(full, tok));
  c = c.replace(/\s{2,}(-\s+)/g, (full, tok) => splitBeforeListToken(full, tok));

  return c;
}

const MAX_EXTRA_BLANK_SPACERS = 14;

/**
 * `\n\n` = separación mínima entre bloques. Cada `\n` adicional en una racha se traduce en
 * párrafos con NBSP (vía SlideMarkdown) para que el preview respete el espacio vertical.
 */
function expandExtraBlankLineRuns(c: string): string {
  return c.replace(/\n{3,}/g, (m) => {
    const k = m.length;
    const extra = k - 2;
    const n = Math.min(Math.max(extra, 0), MAX_EXTRA_BLANK_SPACERS);
    if (n === 0) return "\n\n";
    const spacer = "\u00a0\n\n";
    return "\n\n" + spacer.repeat(n);
  });
}

function normalizeNewlines(content: string): string {
  let out = content.replace(/\\n/g, "\n");
  out = out.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return out;
}

/**
 * Normaliza markdown para persistencia, textarea y APIs (sin párrafos NBSP sintéticos).
 */
export function formatMarkdown(content: string): string {
  if (!content) return "";
  const out = normalizeNewlines(content);
  return mapOutsideFencedCode(out, formatMarkdownChunkCore).trim();
}

/**
 * Normaliza + expande líneas en blanco extra para render con SlideMarkdown (preview, presentador).
 * No usar al rellenar el textarea: los NBSP serían visibles al editar.
 */
export function formatMarkdownForDisplay(content: string): string {
  if (!content) return "";
  const out = normalizeNewlines(content);
  return mapOutsideFencedCode(out, (chunk) =>
    expandExtraBlankLineRuns(formatMarkdownChunkCore(chunk)),
  ).trim();
}

/**
 * Solo normaliza finales de línea y recorta: para .md importados (README) donde
 * `formatMarkdownForDisplay` podría alterar el texto fuera de bloques de código.
 */
export function formatMarkdownImportedFile(content: string): string {
  if (!content) return "";
  return normalizeNewlines(content).trim();
}
