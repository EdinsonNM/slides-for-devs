/**
 * Convierte URL de YouTube (o similar) a URL de embed para iframe.
 */
export function getEmbedUrl(url: string): string {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const v = url.split("v=")[1]?.split("&")[0] || url.split("/").pop();
    return `https://www.youtube.com/embed/${v}`;
  }
  return url;
}
