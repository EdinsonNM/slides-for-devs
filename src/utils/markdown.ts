/**
 * Normaliza y formatea contenido markdown para mostrar correctamente.
 */
export function formatMarkdown(content: string): string {
  if (!content) return "";
  let out = content.replace(/\\n/g, "\n");
  out = out.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  out = out.replace(/\s*•\s+/g, "\n• ");
  return out;
}
