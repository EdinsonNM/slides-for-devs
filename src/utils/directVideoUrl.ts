const FILE_VIDEO_RE = /\.(mp4|m4v|webm|ogv|ogg|mov)(?:$|[?#])/i;

/**
 * Recurso reproducible con `<video src>`: fichero o blob, no plataformas (YouTube) ni
 * páginas genéricas en iframe (p. ej. un `.mp4` directo; evita scroll/negro con iframe).
 */
export function isDirectVideoFileResourceUrl(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  if (t.includes("youtube.com") || t.includes("youtu.be")) return false;
  if (t.startsWith("blob:") || t.startsWith("data:video/")) {
    return true;
  }
  if (!/^https?:\/\//i.test(t) && !t.startsWith("/")) return false;
  return FILE_VIDEO_RE.test(t);
}

/**
 * URLs aptas para `VideoTexture` (WebGL). Los embeds tipo YouTube/Vimeo no sirven como textura.
 */
export function isDirectVideoTextureUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  if (u.includes("youtube.com") || u.includes("youtu.be") || u.includes("vimeo.com")) {
    return false;
  }
  return (
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("/") ||
    u.startsWith("data:video/") ||
    u.startsWith("blob:")
  );
}
