/**
 * Convierte URL de YouTube (o similar) a URL de embed para iframe.
 */
export function getEmbedUrl(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const v = url.split("v=")[1]?.split("&")[0] || url.split("/").pop();
    const id = (v ?? "").split("?")[0];
    if (!id) return url;
    return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
  }
  return url;
}
