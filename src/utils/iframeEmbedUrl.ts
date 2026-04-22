/**
 * Normaliza una URL para `iframe.src`: solo `http:` / `https:` permitidos.
 */
export function sanitizeIframeEmbedSrc(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
