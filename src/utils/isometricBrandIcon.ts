/**
 * Codifica cada segmento del path (carpetas y archivo). Los assets en `public/`
 * evitan `&` en nombres de carpeta; igual conviene codificar espacios y caracteres especiales.
 */
function encodePublicAssetRelativePath(relativePath: string): string {
  const norm = relativePath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!norm) return "";
  return norm
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/** Ruta bajo `public/google-icons/`. */
export function hrefFromGoogleIconRelativePath(relativePath: string): string {
  const tail = encodePublicAssetRelativePath(relativePath);
  return tail ? `/google-icons/${tail}` : "/google-icons/";
}

/** Ruta bajo `public/amazon-icons/`. */
export function hrefFromAmazonIconRelativePath(relativePath: string): string {
  const tail = encodePublicAssetRelativePath(relativePath);
  return tail ? `/amazon-icons/${tail}` : "/amazon-icons/";
}

/** Ruta bajo `public/simple-icons/`. */
export function hrefFromSimpleIconRelativePath(relativePath: string): string {
  const tail = encodePublicAssetRelativePath(relativePath);
  return tail ? `/simple-icons/${tail}` : "/simple-icons/";
}

const LOBE_ICON_BASE = "/lobe-icons/icons";

/**
 * Resuelve la URL del SVG para nodos `brand`.
 * - Lobe Icons: `iconSlug` sin prefijo (ej. `openai`).
 * - Google Cloud pictograms: prefijo `g:` (`public/google-icons/manifest.json`).
 * - AWS / Amazon Architecture: prefijo `aws:` (`public/amazon-icons/manifest.json`).
 * - Simple Icons: prefijo `si:` (`public/simple-icons/manifest.json`).
 */
export function resolveBrandIconHref(
  iconSlug: string | undefined,
  googleIdToPath: Readonly<Record<string, string>>,
  amazonIdToPath: Readonly<Record<string, string>> = {},
  simpleIconIdToPath: Readonly<Record<string, string>> = {},
): string {
  const s = (iconSlug ?? "openai").trim().toLowerCase();
  if (s.startsWith("g:")) {
    const rel = googleIdToPath[s];
    if (rel) return hrefFromGoogleIconRelativePath(rel);
    return `${LOBE_ICON_BASE}/openai.svg`;
  }
  if (s.startsWith("aws:")) {
    const rel = amazonIdToPath[s];
    if (rel) return hrefFromAmazonIconRelativePath(rel);
    return `${LOBE_ICON_BASE}/openai.svg`;
  }
  if (s.startsWith("si:")) {
    const rel = simpleIconIdToPath[s];
    if (rel) return hrefFromSimpleIconRelativePath(rel);
    return `${LOBE_ICON_BASE}/openai.svg`;
  }
  return `${LOBE_ICON_BASE}/${s}.svg`;
}
