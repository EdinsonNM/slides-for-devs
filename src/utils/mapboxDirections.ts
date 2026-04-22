/**
 * Obtiene geometría GeoJSON de ruta entre waypoints usando Directions API de Mapbox.
 * @see https://docs.mapbox.com/api/navigation/directions/
 */
export async function fetchMapboxDirectionsCoordinates(
  waypoints: [number, number][],
  profile: "mapbox/driving" | "mapbox/walking" | "mapbox/cycling",
  accessToken: string,
): Promise<[number, number][] | null> {
  if (waypoints.length < 2 || !accessToken.trim()) return null;
  const coordPath = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = new URL(
    `https://api.mapbox.com/directions/v5/${profile}/${coordPath}`,
  );
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("access_token", accessToken.trim());
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const json = (await res.json()) as {
    routes?: { geometry?: { coordinates?: [number, number][] } }[];
  };
  const coords = json.routes?.[0]?.geometry?.coordinates;
  if (!coords?.length) return null;
  return coords.map((c) => [c[0], c[1]] as [number, number]);
}
