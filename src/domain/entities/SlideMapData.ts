/**
 * Modelo persistido en `Slide.mapData` (JSON) para diapositivas tipo mapa Mapbox.
 */

export const SLIDE_MAP_DATA_VERSION = 1 as const;

export type SlideMapMarker = {
  id: string;
  lng: number;
  lat: number;
  /** Etiqueta opcional (popup al hacer clic en el editor). */
  label?: string;
  /** Color del marcador (p. ej. #ef4444). */
  color?: string;
};

export type SlideMapRoute = {
  id: string;
  name?: string;
  /** Color de la línea (#hex). */
  color?: string;
  /** Secuencia de puntos [lng, lat] (polilínea o ruta calculada). */
  coordinates: [number, number][];
};

export type SlideMapData = {
  version: typeof SLIDE_MAP_DATA_VERSION;
  /** URL de estilo Mapbox (p. ej. mapbox://styles/mapbox/streets-v12). */
  styleUrl: string;
  center: { lng: number; lat: number };
  zoom: number;
  bearing?: number;
  pitch?: number;
  markers: SlideMapMarker[];
  routes: SlideMapRoute[];
};

const DEFAULT_STYLE = "mapbox://styles/mapbox/streets-v12";

export function createDefaultSlideMapData(): SlideMapData {
  return {
    version: SLIDE_MAP_DATA_VERSION,
    styleUrl: DEFAULT_STYLE,
    center: { lng: -3.7038, lat: 40.4168 },
    zoom: 12,
    bearing: 0,
    pitch: 0,
    markers: [],
    routes: [],
  };
}

function isLngLat(v: unknown): v is { lng: number; lat: number } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.lng === "number" && typeof o.lat === "number";
}

function isMarker(v: unknown): v is SlideMapMarker {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.lng === "number" &&
    typeof o.lat === "number"
  );
}

function isRoute(v: unknown): v is SlideMapRoute {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || !Array.isArray(o.coordinates)) return false;
  return o.coordinates.every(
    (p) =>
      Array.isArray(p) &&
      p.length >= 2 &&
      typeof p[0] === "number" &&
      typeof p[1] === "number",
  );
}

export function parseSlideMapData(raw: string | undefined): SlideMapData {
  const fallback = createDefaultSlideMapData();
  if (!raw?.trim()) return fallback;
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return fallback;
    const rec = o as Record<string, unknown>;
    if (rec.version !== SLIDE_MAP_DATA_VERSION) return fallback;
    const styleUrl =
      typeof rec.styleUrl === "string" && rec.styleUrl.trim()
        ? rec.styleUrl.trim()
        : DEFAULT_STYLE;
    const center = isLngLat(rec.center)
      ? { lng: rec.center.lng, lat: rec.center.lat }
      : fallback.center;
    const zoom =
      typeof rec.zoom === "number" && Number.isFinite(rec.zoom)
        ? Math.min(22, Math.max(0, rec.zoom))
        : fallback.zoom;
    const bearing =
      typeof rec.bearing === "number" && Number.isFinite(rec.bearing)
        ? rec.bearing
        : 0;
    const pitch =
      typeof rec.pitch === "number" && Number.isFinite(rec.pitch)
        ? Math.min(85, Math.max(0, rec.pitch))
        : 0;
    const markers = Array.isArray(rec.markers)
      ? rec.markers.filter(isMarker)
      : [];
    const routes = Array.isArray(rec.routes)
      ? rec.routes.filter(isRoute).map((r) => ({
          ...r,
          coordinates: r.coordinates.map(
            (c) => [c[0], c[1]] as [number, number],
          ),
        }))
      : [];
    return {
      version: SLIDE_MAP_DATA_VERSION,
      styleUrl,
      center,
      zoom,
      bearing,
      pitch,
      markers,
      routes,
    };
  } catch {
    return fallback;
  }
}

export function serializeSlideMapData(data: SlideMapData): string {
  return JSON.stringify(data);
}
