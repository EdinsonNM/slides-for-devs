/**
 * Convierte markdown básico a texto plano (exportaciones, Remotion, etc.).
 */
export function markdownToPlainText(md: string): string {
  if (!md || typeof md !== "string") return "";
  return md
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .trim();
}
