import { useCallback, useMemo } from "react";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { useThemeOptional } from "@/presentation/contexts/ThemeContext";
import {
  parseSlideMapData,
  serializeSlideMapData,
  type SlideMapData,
} from "../../domain/entities/SlideMapData";
import { SlideMapboxCanvas, type SlideMapboxViewport } from "../shared/SlideMapboxCanvas";

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;

export function SlideContentMapbox() {
  const { currentSlide, setCurrentSlideMapData } = usePresentation();
  const theme = useThemeOptional();
  const appearance = theme?.isDark ? "dark" : "light";

  const mapData = useMemo(
    () => parseSlideMapData(currentSlide?.mapData),
    [currentSlide?.mapData],
  );

  const persistViewport = useCallback(
    (v: SlideMapboxViewport) => {
      if (!currentSlide) return;
      const base = parseSlideMapData(currentSlide.mapData);
      const next: SlideMapData = {
        ...base,
        ...v,
      };
      setCurrentSlideMapData(serializeSlideMapData(next));
    },
    [currentSlide, setCurrentSlideMapData],
  );

  const token = (TOKEN ?? "").trim();

  if (!token) {
    return (
      <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-2 bg-slate-900 px-6 text-center text-sm text-slate-200">
        <p className="font-medium">Mapbox sin token</p>
        <p className="max-w-md text-slate-400">
          Define{" "}
          <code className="rounded bg-slate-800 px-1 py-0.5 text-xs">
            VITE_MAPBOX_ACCESS_TOKEN
          </code>{" "}
          en tu entorno (p. ej. <code className="text-xs">.env.local</code>) y
          reinicia Vite. Crea un token en{" "}
          <a
            href="https://account.mapbox.com/access-tokens/"
            className="text-sky-400 underline"
            target="_blank"
            rel="noreferrer"
          >
            Mapbox Account
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-0 flex min-h-0 min-w-0 flex-col">
      <SlideMapboxCanvas
        className="h-full w-full"
        mapData={mapData}
        accessToken={token}
        appearance={appearance}
        readOnly={false}
        persistViewportOnMoveEnd
        onPersistViewport={persistViewport}
        registerViewportCaptureBridge
      />
    </div>
  );
}
