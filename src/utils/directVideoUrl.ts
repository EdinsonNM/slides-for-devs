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
