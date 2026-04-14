/** Ruta bajo `public/google-icons/` con segmentos codificados para URL. */
export function hrefFromGoogleIconRelativePath(relativePath: string): string {
  const parts = relativePath.split("/").filter(Boolean);
  return `/google-icons/${parts.map(encodeURIComponent).join("/")}`;
}

const LOBE_ICON_BASE = "/lobe-icons/icons";

/**
 * Resuelve la URL del SVG para nodos `brand`.
 * - Lobe Icons: `iconSlug` sin prefijo (ej. `openai`).
 * - Google Cloud pictograms: `iconSlug` con prefijo `g:` según `public/google-icons/manifest.json`.
 */
export function resolveBrandIconHref(
  iconSlug: string | undefined,
  googleIdToPath: Readonly<Record<string, string>>,
): string {
  const s = (iconSlug ?? "openai").trim().toLowerCase();
  if (s.startsWith("g:")) {
    const rel = googleIdToPath[s];
    if (rel) return hrefFromGoogleIconRelativePath(rel);
    return `${LOBE_ICON_BASE}/openai.svg`;
  }
  return `${LOBE_ICON_BASE}/${s}.svg`;
}
