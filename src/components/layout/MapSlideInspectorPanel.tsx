import { MapPin } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { SLIDE_TYPE } from "../../domain/entities";
import { MapSlideInspectorSection } from "./MapSlideInspectorSection";

export function MapSlideInspectorPanel() {
  const { currentSlide } = usePresentation();
  if (!currentSlide || currentSlide.type !== SLIDE_TYPE.MAPS) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white px-3 py-3 text-sm text-muted-foreground dark:bg-surface-elevated">
        Selecciona una diapositiva de mapa Mapbox.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white dark:bg-surface-elevated">
      <div className="shrink-0 border-b border-stone-100 px-3 py-2.5 dark:border-border">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-sky-600 dark:text-sky-400" strokeWidth={2} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mapa Mapbox
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-stone-500 dark:text-stone-400">
          Vista, estilo, marcadores y rutas.
        </p>
      </div>
      <MapSlideInspectorSection variant="inspectorPanel" />
    </div>
  );
}
