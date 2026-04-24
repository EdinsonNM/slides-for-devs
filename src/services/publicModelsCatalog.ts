/**
 * Catálogo opcional en `public/models/catalog.json` (URLs públicas a .glb).
 */
export interface PublicModelsCatalogEntry {
  id: string;
  label: string;
  /** Ruta absoluta desde el origen, p. ej. `/models/foo.glb` */
  url: string;
}

export interface PublicModelsCatalog {
  version: number;
  entries: PublicModelsCatalogEntry[];
}

function isEntry(v: unknown): v is PublicModelsCatalogEntry {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.id.trim().length > 0 &&
    typeof o.label === "string" &&
    typeof o.url === "string" &&
    (o.url.startsWith("/") ||
      o.url.startsWith("http://") ||
      o.url.startsWith("https://"))
  );
}

export async function fetchPublicModelsCatalog(): Promise<PublicModelsCatalogEntry[]> {
  try {
    const res = await fetch("/models/catalog.json", { cache: "no-store" });
    if (!res.ok) return [];
    const j = (await res.json()) as unknown;
    if (!j || typeof j !== "object") return [];
    const entries = (j as PublicModelsCatalog).entries;
    if (!Array.isArray(entries)) return [];
    return entries.filter(isEntry);
  } catch {
    return [];
  }
}
