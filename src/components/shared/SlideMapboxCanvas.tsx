import { useCallback, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { SlideMapData, SlideMapRoute } from "../../domain/entities/SlideMapData";
import { registerMapSlideViewportCapture } from "../../map/mapSlideCaptureBridge";
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
  className,
  appearance: appearanceProp = "light",
}: SlideMapboxCanvasProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
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
    };

    map.on("load", paint);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      map.off("moveend", onMoveEnd);
      map.off("load", paint);
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
  }, [mapData]);

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

  return (
    <div
      ref={rootRef}
      className={cn("min-h-0 min-w-0 flex-1", className)}
      aria-hidden={!mapInteractive}
    />
  );
}
