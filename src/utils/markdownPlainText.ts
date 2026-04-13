/**
 * Convierte markdown básico a texto plano (exportaciones, Remotion, etc.).
 */
/**
 * URLs de imágenes en markdown `![](url)` o `<img src="...">` (para exportación a vídeo, etc.).
 */
export function markdownExtractImageUrls(md: string): string[] {
  if (!md || typeof md !== "string") return [];
  const out: string[] = [];
  const mdImg = /!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdImg.exec(md)) !== null) {
    const u = m[1]?.trim();
    if (u) out.push(u);
  }
  const htmlImg = /<img[^>]+src=["']([^"']+)["']/gi;
  while ((m = htmlImg.exec(md)) !== null) {
    const u = m[1]?.trim();
    if (u) out.push(u);
  }
  return out;
}

export function markdownToPlainText(md: string): string {
  if (!md || typeof md !== "string") return "";
  return md
    .replace(/^#+\s+/gm, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .trim();
}
