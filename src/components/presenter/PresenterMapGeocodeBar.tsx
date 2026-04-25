import { useCallback, useState, type FormEvent } from "react";
import { MapPin, Search } from "lucide-react";
import { requestPresenterMapFlyTo } from "../../map/mapPresenterFlyToBridge";
import { mapboxGeocodeSearch } from "../../utils/mapboxGeocoding";
import { cn } from "../../utils/cn";

const TOKEN = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined)?.trim();

type PresenterMapGeocodeBarProps = {
  className?: string;
};

/**
 * Búsqueda de país, ciudad o dirección (geocodificación Mapbox) y vuelo de cámara en el mapa
 * mientras dura el modo presentación (no guarda nada en el slide).
 */
export function PresenterMapGeocodeBar({ className }: PresenterMapGeocodeBarProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const q = value.trim();
      if (!q) return;
      if (!TOKEN) {
        setMessage("Falta VITE_MAPBOX_ACCESS_TOKEN.");
        return;
      }
      setLoading(true);
      setMessage(null);
      const ac = new AbortController();
      const t = window.setTimeout(() => ac.abort(), 20_000);
      try {
        const result = await mapboxGeocodeSearch(q, TOKEN, ac.signal);
        if (!result) {
          setMessage("No encontré ese lugar. Prueba otra búsqueda.");
          return;
        }
        const ok = requestPresenterMapFlyTo(
          { lng: result.lng, lat: result.lat },
          result.suggestedZoom,
        );
        if (!ok) {
          setMessage("El mapa aún no está listo. Espera un segundo e inténtalo de nuevo.");
          return;
        }
        setMessage(result.placeName);
        setValue("");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setMessage("La búsqueda tardó demasiado.");
        } else {
          setMessage("Error de red al geocodificar. Revisa la conexión.");
        }
      } finally {
        window.clearTimeout(t);
        setLoading(false);
      }
    },
    [value],
  );

  if (!TOKEN) {
    return (
      <div
        className={cn(
          "shrink-0 border-b border-stone-800 bg-stone-900/80 px-3 py-2 text-left text-xs text-amber-500/95",
          className,
        )}
      >
        Mapa: configura <code className="rounded bg-stone-800 px-1">VITE_MAPBOX_ACCESS_TOKEN</code>{" "}
        para buscar lugares.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "shrink-0 border-b border-stone-800 bg-stone-900/60 px-3 py-2",
        className,
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
        <MapPin className="h-3.5 w-3.5 text-emerald-500/90" strokeWidth={2} />
        Ir en el mapa
      </div>
      <div className="flex gap-2">
        <input
          type="search"
          name="map-geocode"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="País, ciudad o dirección…"
          disabled={loading}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-stone-700 bg-stone-800/80 px-2.5 py-1.5 text-sm text-stone-100 placeholder:text-stone-500 focus:border-emerald-600/80 focus:outline-none focus:ring-1 focus:ring-emerald-600/50 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          aria-label="Buscar y centrar en el mapa"
          className="shrink-0 inline-flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <span className="h-4 w-4 animate-pulse rounded-sm bg-emerald-300/30" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Buscar</span>
        </button>
      </div>
      {message ? (
        <p className="mt-1.5 line-clamp-2 text-left text-xs text-stone-400" title={message}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
