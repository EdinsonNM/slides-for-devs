/**
 * Geocodificación directa (Mapbox Geocoding API).
 * @see https://docs.mapbox.com/api/search/geocoding/
 */

export type GeocodeResult = {
  lng: number;
  lat: number;
  /** Nombre resuelto (p. ej. país, ciudad, dirección). */
  placeName: string;
  /** Zoom aproximado según el tipo de resultado. */
  suggestedZoom: number;
};

function zoomForPlaceType(types: string[] | undefined): number {
  const t = types?.[0] ?? "";
  if (t === "country") return 4;
  if (t === "region" || t === "district") return 5.5;
  if (t === "place" || t === "locality") return 9;
  if (t === "neighborhood") return 12;
  if (t === "address" || t === "poi") return 15;
  return 11;
}

export async function mapboxGeocodeSearch(
  query: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q || !accessToken.trim()) return null;
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
  );
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("limit", "1");
  url.searchParams.set("language", "es");

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features?: Array<{
      place_name: string;
      place_type: string[];
      center: [number, number];
    }>;
  };
  const f = data.features?.[0];
  if (!f?.center) return null;
  const [lng, lat] = f.center;
  return {
    lng,
    lat,
    placeName: f.place_name,
    suggestedZoom: zoomForPlaceType(f.place_type),
  };
}
