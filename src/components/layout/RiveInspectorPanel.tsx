import { useRef } from "react";
import { Film, Trash2, Upload } from "lucide-react";
import { usePresentation } from "../../presentation/contexts/PresentationContext";
import { cn } from "../../utils/cn";
import {
  PANEL_CONTENT_KIND,
  resolveMediaPanelDescriptor,
} from "../../domain/panelContent";
import { SLIDE_TYPE } from "../../domain/entities";
import { RiveInspectorDiscoveredHints } from "./RiveInspectorDiscoveredHints";

export function RiveInspectorPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    currentSlide,
    ingestRiveFileOnCurrentSlide,
    clearRiveFromCurrentMediaPanel,
    setCurrentSlideRiveArtboard,
    setCurrentSlideRiveStateMachineNames,
  } = usePresentation();

  const usableSlide =
    currentSlide &&
    (currentSlide.type === SLIDE_TYPE.CONTENT ||
      currentSlide.type === SLIDE_TYPE.CHAPTER);

  const panelKind = currentSlide
    ? resolveMediaPanelDescriptor(currentSlide).kind
    : null;
  const isRivePanel = panelKind === PANEL_CONTENT_KIND.RIVE;
  const hasFile = Boolean(currentSlide?.riveUrl?.trim());

  const onPickFiles = (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    ingestRiveFileOnCurrentSlide(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-surface-elevated">
      <div className="flex shrink-0 flex-col gap-1 border-b border-stone-100 bg-stone-50/60 px-3 py-2.5 dark:border-border dark:bg-surface">
        <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          Rive
        </h2>
        <p className="text-[11px] leading-snug text-stone-500 dark:text-stone-400">
          Carga animaciones <span className="font-mono">.riv</span> en el panel de
          media seleccionado en el lienzo (blob local; ideal para pruebas en esta
          sesión).
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {!usableSlide ? (
          <p className="text-center text-xs text-stone-500 dark:text-stone-400">
            Abre una diapositiva de contenido o capítulo con panel de media.
          </p>
        ) : !isRivePanel ? (
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 text-[11px] text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
            El bloque activo no es de tipo Rive. En la barra inferior del editor,
            al añadir un panel o cambiar tipo, elige{" "}
            <span className="font-medium">Rive</span>; luego vuelve aquí para cargar
            el archivo.
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".riv,application/rive"
              className="sr-only"
              aria-hidden
              tabIndex={-1}
              onChange={(e) => onPickFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50/80 px-3 py-8 text-sm font-medium text-stone-700 transition-colors",
                "hover:border-rose-400/70 hover:bg-rose-50/40 dark:border-border dark:bg-white/5 dark:text-stone-200 dark:hover:border-rose-500/50 dark:hover:bg-rose-950/20",
              )}
            >
              <Upload size={18} className="text-rose-600 dark:text-rose-400" />
              Elegir archivo .riv
            </button>

            {hasFile ? (
              <div className="space-y-2 rounded-lg border border-stone-200 bg-white p-3 dark:border-border dark:bg-surface">
                <div className="flex items-start gap-2">
                  <Film
                    size={16}
                    className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400"
                    aria-hidden
                  />
                  <p className="min-w-0 flex-1 break-all text-[11px] text-stone-600 dark:text-stone-300">
                    {currentSlide.riveUrl}
                  </p>
                </div>
                <RiveInspectorDiscoveredHints
                  src={currentSlide.riveUrl}
                  onUseArtboardAndStateMachine={(ab, sm) => {
                    setCurrentSlideRiveArtboard(ab);
                    setCurrentSlideRiveStateMachineNames(sm);
                  }}
                />
                <button
                  type="button"
                  onClick={() => clearRiveFromCurrentMediaPanel()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-stone-200 px-2 py-1.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50 dark:border-border dark:text-stone-300 dark:hover:bg-white/5"
                >
                  <Trash2 size={12} aria-hidden />
                  Quitar animación
                </button>
              </div>
            ) : (
              <p className="text-center text-[11px] text-stone-500 dark:text-stone-400">
                Aún no hay archivo en este panel.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
