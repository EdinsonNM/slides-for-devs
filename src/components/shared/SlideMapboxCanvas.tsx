import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { SlideMapData, SlideMapRoute } from "../../domain/entities/SlideMapData";
import { registerMapSlideViewportCapture } from "../../map/mapSlideCaptureBridge";
import {
  registerPresenterMapFlyTo,
  requestPresenterMapFlyTo,
} from "../../map/mapPresenterFlyToBridge";
import { mapboxGeocodeSearch } from "../../utils/mapboxGeocoding";
import { cn } from "../../utils/cn";

export type MapboxCanvasAppearance = "light" | "dark";

export type SlideMapboxViewport = Pick<
  SlideMapData,
  "center" | "zoom" | "bearing" | "pitch"
>;

const SLIDE_MAPBOX_SKY_LAYER = "slide-mapbox-sky";

function findBeforeIdForSky(map: mapboxgl.Map): string | undefined {
  const style = map.getStyle();
  if (!style?.layers?.length) return undefined;
  for (const layer of style.layers) {
    if (layer.type === "symbol") return layer.id;
  }
  return style.layers[0]?.id;
}

function applyMapAtmosphere(map: mapboxgl.Map, appearance: MapboxCanvasAppearance) {
  if (!map.isStyleLoaded()) return;
  const dark = appearance === "dark";
  try {
    map.setFog(
      dark
        ? {
            range: [-0.5, 2.6],
            color: "rgb(22, 30, 52)",
            "high-color": "rgb(14, 20, 42)",
            "space-color": "rgb(6, 10, 26)",
            "horizon-blend": 0.38,
            "star-intensity": 0.14,
          }
        : {
            range: [-0.5, 2.6],
            color: "rgb(190, 208, 232)",
            "high-color": "rgb(120, 175, 228)",
            "space-color": "rgb(214, 228, 248)",
            "horizon-blend": 0.26,
            "star-intensity": 0,
          },
    );
  } catch {
    /* Estilos que no soportan niebla: se ignora. */
  }

  const sun: [number, number] = dark ? [0, -12] : [0, 78];
  const sunIntensity = dark ? 6 : 18;
  const atmosphereColor = dark ? "rgb(28, 36, 58)" : "rgb(130, 175, 225)";
  const haloColor = dark ? "rgb(55, 72, 108)" : "rgb(190, 215, 245)";

  if (!map.getLayer(SLIDE_MAPBOX_SKY_LAYER)) {
    const beforeId = findBeforeIdForSky(map);
    try {
      map.addLayer(
        {
          id: SLIDE_MAPBOX_SKY_LAYER,
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": sun,
            "sky-atmosphere-sun-intensity": sunIntensity,
            "sky-atmosphere-color": atmosphereColor,
            "sky-atmosphere-halo-color": haloColor,
          },
        },
        beforeId,
      );
    } catch {
      /* WebGL/estilo sin capa sky */
    }
  } else {
    try {
      map.setPaintProperty(SLIDE_MAPBOX_SKY_LAYER, "sky-type", "atmosphere");
      map.setPaintProperty(SLIDE_MAPBOX_SKY_LAYER, "sky-atmosphere-sun", sun);
      map.setPaintProperty(
        SLIDE_MAPBOX_SKY_LAYER,
        "sky-atmosphere-sun-intensity",
        sunIntensity,
      );
      map.setPaintProperty(
        SLIDE_MAPBOX_SKY_LAYER,
        "sky-atmosphere-color",
        atmosphereColor,
      );
      map.setPaintProperty(
        SLIDE_MAPBOX_SKY_LAYER,
        "sky-atmosphere-halo-color",
        haloColor,
      );
    } catch {
      /* capa presente pero sin pintura compatible */
    }
  }
}

/**
 * Mercator se ve como un plano inclinado; con globo se puede orbitar y “girar el mundo”
 * de forma continua. Si el estilo/entorno no lo soporta, se ignora.
 */
function trySetGlobeProjection(map: mapboxgl.Map) {
  if (!map.isStyleLoaded()) return;
  try {
    map.setProjection("globe");
  } catch {
    /* sin WebGL2 o estilo incompatible */
  }
}

export interface SlideMapboxCanvasProps {
  mapData: SlideMapData;
  accessToken: string;
  /**
   * Apariencia del cielo y niebla; se alinea con el tema de la app (claro/oscuro).
   * @default "light"
   */
  appearance?: MapboxCanvasAppearance;
  /**
   * No persiste cambios de cámara (panel «capturar» / desplazamiento) ni registra
   * el bridge del inspector. En presentador/vista previa suele ir a `true`.
   */
  readOnly?: boolean;
  /**
   * Controles de Mapbox: arrastre, zoom, rotación, etc. Independiente de
   * `readOnly` para que en presentador se pueda explorar el mapa sin guardar.
   * @default true
   */
  interactive?: boolean;
  persistViewportOnMoveEnd?: boolean;
  onPersistViewport?: (v: SlideMapboxViewport) => void;
  registerViewportCaptureBridge?: boolean;
  /**
   * Registra el mapa para `requestPresenterMapFlyTo` (ventana de presentación: buscar país/dirección).
   * @default false
   */
  registerPresenterFlyToBridge?: boolean;
  /**
   * Muestra buscador sobre el mapa (dentro del propio slide) para centrar por país/dirección.
   * @default false
   */
  showPresenterSearchInput?: boolean;
  className?: string;
}

function syncRoutes(map: mapboxgl.Map, routes: SlideMapRoute[]) {
  if (!map.isStyleLoaded()) return;
  const want = new Set(routes.map((r) => r.id));
  for (const id of Array.from(want)) {
    const route = routes.find((r) => r.id === id)!;
    const sid = `slide-map-route-${route.id}`;
    const lid = `slide-map-route-layer-${route.id}`;
    const coords =
      route.coordinates.length >= 2
        ? route.coordinates
        : route.coordinates.length === 1
          ? [route.coordinates[0]!, route.coordinates[0]!]
          : [];
    if (coords.length < 2) continue;
    const geo: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    };
    const color = route.color?.trim() || "#10b981";
    if (map.getSource(sid)) {
      (map.getSource(sid) as mapboxgl.GeoJSONSource).setData(geo);
      if (map.getLayer(lid)) map.setPaintProperty(lid, "line-color", color);
    } else {
      map.addSource(sid, { type: "geojson", data: geo });
      map.addLayer({
        id: lid,
        type: "line",
        source: sid,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": color,
          "line-width": 4,
          "line-opacity": 0.92,
        },
      });
    }
  }
  /* Quitar rutas que ya no existen */
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    if (!layer.id.startsWith("slide-map-route-layer-")) continue;
    const rid = layer.id.replace("slide-map-route-layer-", "");
    if (!want.has(rid)) {
      const sid = `slide-map-route-${rid}`;
      if (map.getLayer(layer.id)) map.removeLayer(layer.id);
      if (map.getSource(sid)) map.removeSource(sid);
    }
  }
}

function syncMarkers(
  map: mapboxgl.Map,
  markers: SlideMapData["markers"],
  byId: Map<string, mapboxgl.Marker>,
) {
  const want = new Set(markers.map((m) => m.id));
  for (const [id, mk] of byId) {
    if (!want.has(id)) {
      mk.remove();
      byId.delete(id);
    }
  }
  for (const m of markers) {
    const color = m.color?.trim() || "#3b82f6";
    const el =
      document.createElement("div");
    el.style.width = "14px";
    el.style.height = "14px";
    el.style.borderRadius = "9999px";
    el.style.background = color;
    el.style.border = "2px solid white";
    el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.35)";
    const existing = byId.get(m.id);
    if (existing) {
      existing.setLngLat([m.lng, m.lat]);
      const elOld = existing.getElement();
      if (elOld) {
        elOld.style.background = color;
      }
      continue;
    }
    const mk = new mapboxgl.Marker({ element: el }).setLngLat([m.lng, m.lat]);
    if (m.label?.trim()) {
      mk.setPopup(new mapboxgl.Popup({ offset: 12 }).setText(m.label.trim()));
    }
    mk.addTo(map);
    byId.set(m.id, mk);
  }
}

export function SlideMapboxCanvas({
  mapData,
  accessToken,
  readOnly = false,
  interactive: interactiveProp,
  persistViewportOnMoveEnd = true,
  onPersistViewport,
  registerViewportCaptureBridge = false,
  registerPresenterFlyToBridge = false,
  showPresenterSearchInput = false,
  className,
  appearance: appearanceProp = "light",
}: SlideMapboxCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const registerFlyToRef = useRef(registerPresenterFlyToBridge);
  registerFlyToRef.current = registerPresenterFlyToBridge;
  const [searchValue, setSearchValue] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const appearanceRef = useRef<MapboxCanvasAppearance>(appearanceProp);
  appearanceRef.current = appearanceProp;
  const markersByIdRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const styleUrlRef = useRef<string>("");
  const programmaticRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const lastViewportSigRef = useRef("");
  const lastGeometrySigRef = useRef("");
  const onPersistRef = useRef(onPersistViewport);
  onPersistRef.current = onPersistViewport;
  const mapInteractive = interactiveProp !== false;

  const schedulePersistViewport = useCallback(() => {
    if (readOnly || !onPersistRef.current) return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      const m = mapRef.current;
      if (!m) return;
      const c = m.getCenter();
      onPersistRef.current?.({
        center: { lng: c.lng, lat: c.lat },
        zoom: m.getZoom(),
        bearing: m.getBearing(),
        pitch: m.getPitch(),
      });
    }, 650);
  }, [readOnly]);

  const flushPersistViewport = useCallback(() => {
    const m = mapRef.current;
    if (!m || !onPersistRef.current) return;
    const c = m.getCenter();
    onPersistRef.current({
      center: { lng: c.lng, lat: c.lat },
      zoom: m.getZoom(),
      bearing: m.getBearing(),
      pitch: m.getPitch(),
    });
  }, []);

  const syncPresenterFlyToBridge = useCallback((_map: mapboxgl.Map) => {
    if (!registerFlyToRef.current) {
      registerPresenterMapFlyTo(null);
      return;
    }
    registerPresenterMapFlyTo((center, zoom) => {
      const m = mapRef.current;
      if (!m?.isStyleLoaded()) return;
      try {
        m.flyTo({
          center: [center.lng, center.lat],
          zoom: zoom ?? 12,
          duration: 1800,
          essential: true,
        });
      } catch {
        /* */
      }
    });
  }, []);

  useEffect(() => {
    mapboxgl.accessToken = accessToken;
  }, [accessToken]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || !accessToken.trim()) return;

    const map = new mapboxgl.Map({
      container: el,
      style: mapData.styleUrl,
      center: [mapData.center.lng, mapData.center.lat],
      zoom: mapData.zoom,
      bearing: mapData.bearing ?? 0,
      pitch: mapData.pitch ?? 0,
      interactive: mapInteractive,
      attributionControl: true,
      /* Rotación e inclinación: máximo pitch permitido; sin snap al norte. */
      maxPitch: 85,
      pitchWithRotate: true,
      bearingSnap: 0,
    });
    mapRef.current = map;
    styleUrlRef.current = mapData.styleUrl;

    const onMoveEnd = () => {
      if (programmaticRef.current) return;
      if (persistViewportOnMoveEnd && !readOnly) schedulePersistViewport();
    };
    map.on("moveend", onMoveEnd);

    const paint = () => {
      syncRoutes(map, mapData.routes);
      syncMarkers(map, mapData.markers, markersByIdRef.current);
      applyMapAtmosphere(map, appearanceRef.current);
      trySetGlobeProjection(map);
      syncPresenterFlyToBridge(map);
    };

    map.on("load", paint);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      map.off("moveend", onMoveEnd);
      map.off("load", paint);
      registerPresenterMapFlyTo(null);
      for (const mk of markersByIdRef.current.values()) mk.remove();
      markersByIdRef.current.clear();
      const m = mapRef.current;
      if (m) {
        /* No llamar a getStyle() aquí: si el estilo aún no cargó, Mapbox lanza
         * "Style is not done loading". remove() libera capas y fuentes. */
        m.remove();
      }
      mapRef.current = null;
      lastViewportSigRef.current = "";
      lastGeometrySigRef.current = "";
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    };
  }, [
    accessToken,
    readOnly,
    persistViewportOnMoveEnd,
    mapInteractive,
    schedulePersistViewport,
    syncPresenterFlyToBridge,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const viewportSig = JSON.stringify({
      lng: mapData.center.lng,
      lat: mapData.center.lat,
      z: mapData.zoom,
      b: mapData.bearing ?? 0,
      p: mapData.pitch ?? 0,
      s: mapData.styleUrl,
    });
    const geometrySig = JSON.stringify({
      markers: mapData.markers,
      routes: mapData.routes,
    });

    const applyGeometry = () => {
      syncRoutes(map, mapData.routes);
      syncMarkers(map, mapData.markers, markersByIdRef.current);
    };

    const applyCamera = () => {
      programmaticRef.current = true;
      map.jumpTo({
        center: [mapData.center.lng, mapData.center.lat],
        zoom: mapData.zoom,
        bearing: mapData.bearing ?? 0,
        pitch: mapData.pitch ?? 0,
      });
      requestAnimationFrame(() => {
        programmaticRef.current = false;
      });
    };

    const runWhenStyleReady = (fn: () => void) => {
      if (map.isStyleLoaded()) fn();
      else map.once("style.load", fn);
    };

    if (mapData.styleUrl !== styleUrlRef.current) {
      styleUrlRef.current = mapData.styleUrl;
      map.setStyle(mapData.styleUrl);
      map.once("style.load", () => {
        applyGeometry();
        applyMapAtmosphere(map, appearanceRef.current);
        trySetGlobeProjection(map);
        syncPresenterFlyToBridge(map);
        lastGeometrySigRef.current = geometrySig;
        applyCamera();
        lastViewportSigRef.current = viewportSig;
      });
      return;
    }

    if (geometrySig !== lastGeometrySigRef.current) {
      lastGeometrySigRef.current = geometrySig;
      runWhenStyleReady(applyGeometry);
    }
    if (viewportSig !== lastViewportSigRef.current) {
      lastViewportSigRef.current = viewportSig;
      runWhenStyleReady(applyCamera);
    }
  }, [mapData, syncPresenterFlyToBridge]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const run = () => applyMapAtmosphere(map, appearanceProp);
    if (map.isStyleLoaded()) run();
    else map.once("style.load", run);
  }, [appearanceProp]);

  useEffect(() => {
    if (readOnly || !registerViewportCaptureBridge) {
      registerMapSlideViewportCapture(null);
      return;
    }
    registerMapSlideViewportCapture(() => {
      flushPersistViewport();
    });
    return () => registerMapSlideViewportCapture(null);
  }, [readOnly, registerViewportCaptureBridge, flushPersistViewport]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    syncPresenterFlyToBridge(map);
  }, [registerPresenterFlyToBridge, syncPresenterFlyToBridge]);

  const submitSearch = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const q = searchValue.trim();
      if (!q || !showPresenterSearchInput) return;
      if (!accessToken.trim()) {
        setSearchMessage("Falta token de Mapbox.");
        return;
      }
      setSearchLoading(true);
      setSearchMessage(null);
      const ac = new AbortController();
      const t = window.setTimeout(() => ac.abort(), 20_000);
      try {
        const result = await mapboxGeocodeSearch(q, accessToken, ac.signal);
        if (!result) {
          setSearchMessage("No encontré ese lugar.");
          return;
        }
        const ok = requestPresenterMapFlyTo(
          { lng: result.lng, lat: result.lat },
          result.suggestedZoom,
        );
        if (!ok) {
          setSearchMessage("El mapa aún está cargando.");
          return;
        }
        setSearchMessage(result.placeName);
        setSearchValue("");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setSearchMessage("La búsqueda tardó demasiado.");
        } else {
          setSearchMessage("Error de red al buscar.");
        }
      } finally {
        window.clearTimeout(t);
        setSearchLoading(false);
      }
    },
    [accessToken, searchValue, showPresenterSearchInput],
  );

  const searchDark = appearanceProp === "dark";
  const searchShellClass = cn(
    "pointer-events-auto absolute top-2 z-20 w-[min(560px,calc(100%-1rem))] rounded-xl border px-2.5 py-2 shadow-lg backdrop-blur-md md:top-3 md:w-[min(620px,calc(100%-1.5rem))]",
    "left-1/2 -translate-x-1/2",
    searchDark
      ? "border-white/12 bg-black/42 shadow-black/30"
      : "border-stone-300/70 bg-white/88 shadow-stone-300/35",
  );
  const searchInputClass = cn(
    "min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none",
    searchDark
      ? "border-white/14 bg-black/35 text-stone-100 placeholder:text-stone-400 focus:border-emerald-400/70"
      : "border-stone-300/80 bg-white/90 text-stone-900 placeholder:text-stone-500 focus:border-emerald-600/70",
  );
  const searchMessageClass = cn(
    "mt-1.5 line-clamp-2 text-xs",
    searchDark ? "text-stone-300" : "text-stone-600",
  );

  return (
    <div className={cn("relative min-h-0 min-w-0 flex-1", className)}>
      <div
        ref={rootRef}
        className="min-h-0 min-w-0 flex-1 h-full w-full"
        aria-hidden={!mapInteractive}
      />
      {showPresenterSearchInput ? (
        <form
          onSubmit={submitSearch}
          className={searchShellClass}
        >
          <div className="relative flex items-center">
            <Search
              className={cn(
                "pointer-events-none absolute left-3 h-4 w-4",
                searchDark ? "text-stone-400" : "text-stone-500",
              )}
            />
            <input
              type="search"
              value={searchValue}
              onChange={(ev) => setSearchValue(ev.target.value)}
              placeholder="Buscar país o dirección..."
              autoComplete="off"
              disabled={searchLoading}
              className={cn(searchInputClass, "pl-9 pr-3")}
            />
            {searchLoading ? (
              <span
                className={cn(
                  "pointer-events-none absolute right-3 h-4 w-4 animate-pulse rounded-sm",
                  searchDark ? "bg-emerald-300/35" : "bg-emerald-500/35",
                )}
              />
            ) : null}
          </div>
          {searchMessage ? (
            <p className={searchMessageClass}>{searchMessage}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
