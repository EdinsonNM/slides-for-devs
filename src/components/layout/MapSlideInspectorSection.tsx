import { useCallback, useMemo, useState } from "react";
import { MapPin, Navigation, Plus, Route, Trash2 } from "lucide-react";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { SLIDE_TYPE } from "../../domain/entities";
import {
  parseSlideMapData,
  serializeSlideMapData,
  type SlideMapData,
  type SlideMapMarker,
  type SlideMapRoute,
} from "../../domain/entities/SlideMapData";
import { requestMapSlideViewportCapture } from "../../map/mapSlideCaptureBridge";
import { fetchMapboxDirectionsCoordinates } from "../../utils/mapboxDirections";
import { cn } from "../../utils/cn";

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined)?.trim();

export interface MapSlideInspectorSectionProps {
  /** En panel dedicado: sin borde superior ni título (lo pone el contenedor). */
  variant?: "inSlideStyle" | "inspectorPanel";
}

export function MapSlideInspectorSection({ variant = "inSlideStyle" }: MapSlideInspectorSectionProps) {
  const { currentSlide, setCurrentSlideMapData } = usePresentation();
  const [directionsBusy, setDirectionsBusy] = useState(false);
  const [directionsError, setDirectionsError] = useState<string | null>(null);

  const data = useMemo(
    () =>
      currentSlide?.type === SLIDE_TYPE.MAPS
        ? parseSlideMapData(currentSlide.mapData)
        : null,
    [currentSlide?.mapData, currentSlide?.type],
  );

  const persist = useCallback(
    (next: SlideMapData) => {
      setCurrentSlideMapData(serializeSlideMapData(next));
    },
    [setCurrentSlideMapData],
  );

  if (!currentSlide || currentSlide.type !== SLIDE_TYPE.MAPS || !data) {
    return null;
  }

  const applyNumericView = (form: FormData) => {
    const lng = Number(form.get("lng"));
    const lat = Number(form.get("lat"));
    const zoom = Number(form.get("zoom"));
    const styleUrl = String(form.get("styleUrl") ?? "").trim();
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(zoom)) return;
    persist({
      ...data,
      center: { lng, lat },
      zoom: Math.min(22, Math.max(0, zoom)),
      styleUrl: styleUrl || data.styleUrl,
    });
  };

  const addMarker = () => {
    const m: SlideMapMarker = {
      id: crypto.randomUUID(),
      lng: data.center.lng,
      lat: data.center.lat,
      label: "",
      color: "#3b82f6",
    };
    persist({ ...data, markers: [...data.markers, m] });
  };

  const updateMarker = (id: string, patch: Partial<SlideMapMarker>) => {
    persist({
      ...data,
      markers: data.markers.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    });
  };

  const removeMarker = (id: string) => {
    persist({ ...data, markers: data.markers.filter((x) => x.id !== id) });
  };

  const addRouteFromMarkers = () => {
    if (data.markers.length < 2) return;
    const coords: [number, number][] = data.markers.map((m) => [m.lng, m.lat]);
    const route: SlideMapRoute = {
      id: crypto.randomUUID(),
      name: "Marcadores",
      color: "#10b981",
      coordinates: coords,
    };
    persist({ ...data, routes: [...data.routes, route] });
  };

  const removeRoute = (id: string) => {
    persist({ ...data, routes: data.routes.filter((r) => r.id !== id) });
  };

  const computeDrivingRoute = async () => {
    setDirectionsError(null);
    if (data.markers.length < 2) {
      setDirectionsError("Añade al menos dos marcadores.");
      return;
    }
    if (!MAPBOX_TOKEN) {
      setDirectionsError("Falta VITE_MAPBOX_ACCESS_TOKEN para la API de rutas.");
      return;
    }
    setDirectionsBusy(true);
    try {
      const waypoints = data.markers.map((m) => [m.lng, m.lat] as [number, number]);
      const line = await fetchMapboxDirectionsCoordinates(
        waypoints,
        "mapbox/driving",
        MAPBOX_TOKEN,
      );
      if (!line?.length) {
        setDirectionsError("No se pudo calcular la ruta (revisa el token y los puntos).");
        return;
      }
      const route: SlideMapRoute = {
        id: crypto.randomUUID(),
        name: "Ruta (conducción)",
        color: "#6366f1",
        coordinates: line,
      };
      persist({ ...data, routes: [...data.routes, route] });
    } finally {
      setDirectionsBusy(false);
    }
  };

  return (
    <div
      key={currentSlide.id}
      className={
        variant === "inSlideStyle"
          ? "border-t border-stone-100 px-3 py-3 dark:border-border"
          : "px-3 py-1 dark:border-border"
      }
    >
      {variant === "inSlideStyle" ? (
        <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <MapPin size={14} className="shrink-0" />
          Mapa Mapbox
        </div>
      ) : null}

      {!MAPBOX_TOKEN ? (
        <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
          Sin token no se verá el mapa ni las rutas por API. Configura{" "}
          <code className="rounded bg-stone-100 px-1 dark:bg-stone-800">VITE_MAPBOX_ACCESS_TOKEN</code>.
        </p>
      ) : null}

      <form
        className="mb-4 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          applyNumericView(new FormData(e.currentTarget));
        }}
      >
        <label className="text-[11px] font-medium text-stone-600 dark:text-stone-300">
          Estilo (URL Mapbox)
        </label>
        <input
          name="styleUrl"
          defaultValue={data.styleUrl}
          className="rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs dark:border-border dark:bg-surface"
        />
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-1 text-[11px] font-medium text-stone-600 dark:text-stone-300">
            Lng
            <input
              name="lng"
              type="number"
              step="any"
              defaultValue={data.center.lng}
              className="mt-0.5 w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-xs dark:border-border dark:bg-surface"
            />
          </label>
          <label className="col-span-1 text-[11px] font-medium text-stone-600 dark:text-stone-300">
            Lat
            <input
              name="lat"
              type="number"
              step="any"
              defaultValue={data.center.lat}
              className="mt-0.5 w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-xs dark:border-border dark:bg-surface"
            />
          </label>
          <label className="col-span-1 text-[11px] font-medium text-stone-600 dark:text-stone-300">
            Zoom
            <input
              name="zoom"
              type="number"
              step="0.1"
              defaultValue={data.zoom}
              className="mt-0.5 w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-xs dark:border-border dark:bg-surface"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-900"
          >
            Aplicar vista
          </button>
          <button
            type="button"
            onClick={() => requestMapSlideViewportCapture()}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium dark:border-border"
          >
            Capturar vista actual
          </button>
        </div>
      </form>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-200">
          Marcadores
        </span>
        <button
          type="button"
          onClick={addMarker}
          className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-medium dark:border-border"
        >
          <Plus size={12} />
          Añadir
        </button>
      </div>
      <ul className="mb-4 max-h-40 space-y-2 overflow-y-auto">
        {data.markers.length === 0 ? (
          <li className="text-xs text-muted-foreground">Sin marcadores.</li>
        ) : (
          data.markers.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-stone-100 p-2 dark:border-border"
            >
              <div className="mb-1 grid grid-cols-2 gap-1">
                <input
                  type="number"
                  step="any"
                  value={m.lng}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) updateMarker(m.id, { lng: v });
                  }}
                  className="w-full rounded border border-stone-200 px-1 py-0.5 text-[11px] dark:border-border dark:bg-surface"
                />
                <input
                  type="number"
                  step="any"
                  value={m.lat}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) updateMarker(m.id, { lat: v });
                  }}
                  className="w-full rounded border border-stone-200 px-1 py-0.5 text-[11px] dark:border-border dark:bg-surface"
                />
              </div>
              <input
                type="text"
                placeholder="Etiqueta"
                value={m.label ?? ""}
                onChange={(e) => updateMarker(m.id, { label: e.target.value })}
                className="mb-1 w-full rounded border border-stone-200 px-1 py-0.5 text-[11px] dark:border-border dark:bg-surface"
              />
              <div className="flex items-center justify-between gap-1">
                <input
                  type="color"
                  value={m.color ?? "#3b82f6"}
                  onChange={(e) => updateMarker(m.id, { color: e.target.value })}
                  className="h-7 w-10 cursor-pointer rounded border border-stone-200 dark:border-border"
                  title="Color"
                />
                <button
                  type="button"
                  onClick={() => removeMarker(m.id)}
                  className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  title="Quitar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-200">
          Rutas
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRouteFromMarkers}
          disabled={data.markers.length < 2}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium",
            data.markers.length < 2
              ? "cursor-not-allowed opacity-50"
              : "border-stone-200 dark:border-border",
          )}
        >
          <Route size={12} />
          Línea por marcadores
        </button>
        <button
          type="button"
          onClick={() => void computeDrivingRoute()}
          disabled={directionsBusy || data.markers.length < 2}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-medium dark:border-border",
            (directionsBusy || data.markers.length < 2) && "opacity-50",
          )}
        >
          <Navigation size={12} />
          {directionsBusy ? "Calculando…" : "Ruta en coche (API)"}
        </button>
      </div>
      {directionsError ? (
        <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">{directionsError}</p>
      ) : null}
      <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
        {data.routes.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 rounded border border-stone-100 px-2 py-1 dark:border-border"
          >
            <span className="min-w-0 truncate">{r.name || r.id.slice(0, 8)}</span>
            <span className="shrink-0 text-[10px]">
              {r.coordinates.length} pts
            </span>
            <button
              type="button"
              onClick={() => removeRoute(r.id)}
              className="shrink-0 rounded p-0.5 text-rose-600"
              title="Quitar ruta"
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
