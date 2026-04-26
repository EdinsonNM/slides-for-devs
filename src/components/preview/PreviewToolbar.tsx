import { useEffect, useState } from "react";
import { cn } from "../../utils/cn";
import { X, Monitor, Maximize2, Minimize2, Keyboard } from "lucide-react";
import {
  FIRST_PERSON_LAYOUTS,
  FIRST_PERSON_LAYOUT_LABELS,
  type FirstPersonLayout,
} from "../../constants/firstPersonLayout";
import { FirstPersonKeyOrderList } from "./FirstPersonKeyOrderList";
import {
  PRESENTER_MODES,
  type PresenterMode,
} from "../../constants/presenterModes";

export interface PreviewToolbarProps {
  onOpenPresenter: () => void;
  onClose: () => void;
  presenterMode: PresenterMode;
  onPresenterModeChange: (mode: PresenterMode) => void;
  firstPersonLayout: FirstPersonLayout;
  onFirstPersonLayoutChange: (layout: FirstPersonLayout) => void;
  firstPersonKeyOrder: FirstPersonLayout[];
  onFirstPersonKeyOrderChange: (order: FirstPersonLayout[]) => void;
  /** Pantalla completa nativa del navegador (distinta del overlay de vista presentador). */
  nativeFullscreen: {
    supported: boolean;
    active: boolean;
    onToggle: () => void;
  };
}

/**
 * Barra superior del overlay de vista previa (visible al hover).
 */
export function PreviewToolbar({
  onOpenPresenter,
  onClose,
  presenterMode,
  onPresenterModeChange,
  firstPersonLayout,
  onFirstPersonLayoutChange,
  firstPersonKeyOrder,
  onFirstPersonKeyOrderChange,
  nativeFullscreen,
}: PreviewToolbarProps) {
  const [openKeyOrder, setOpenKeyOrder] = useState(false);
  useEffect(() => {
    if (presenterMode !== PRESENTER_MODES.FIRST_PERSON) {
      setOpenKeyOrder(false);
    }
  }, [presenterMode]);
  return (
    <div className="group/bar pointer-events-auto fixed right-2 top-2 z-110 flex min-h-16 min-w-[20rem] max-w-[min(100vw-1rem,46rem)] flex-col items-end gap-1 rounded-bl-xl md:min-w-[24rem]">
      <div
        className={cn(
          "flex max-w-full flex-wrap items-end justify-end gap-2 pr-1 pt-1 opacity-0 transition-opacity duration-200 group-hover/bar:pointer-events-auto group-hover/bar:opacity-100",
          openKeyOrder
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none",
        )}
      >
        <label className="sr-only" htmlFor="presenter-mode-select">
          Estilo de presentación
        </label>
        <select
          id="presenter-mode-select"
          value={presenterMode}
          onChange={(e) => onPresenterModeChange(e.target.value as PresenterMode)}
          className="h-10 max-w-full rounded-full border border-white/20 bg-stone-700/90 px-3 text-sm text-white shadow-lg outline-none transition-colors hover:bg-stone-700 focus-visible:ring-2 focus-visible:ring-white/45 sm:px-4"
          title="Modo de vista previa / presentación"
        >
          <option value={PRESENTER_MODES.POWERPOINT}>
            PowerPoint (clásico)
          </option>
          <option value={PRESENTER_MODES.CAMERA}>Carrusel continuo</option>
          <option value={PRESENTER_MODES.FIRST_PERSON}>
            First person (cámara viva)
          </option>
          <option value={PRESENTER_MODES.JARVIS}>Jarvis IA</option>
        </select>
        {presenterMode === PRESENTER_MODES.FIRST_PERSON ? (
          <>
            <label className="sr-only" htmlFor="first-person-layout-select">
              Reparto cámara y diapositiva
            </label>
            <select
              id="first-person-layout-select"
              value={firstPersonLayout}
              onChange={(e) =>
                onFirstPersonLayoutChange(e.target.value as FirstPersonLayout)
              }
              className="h-10 max-w-full rounded-full border border-amber-400/35 bg-amber-950/80 px-3 text-sm text-amber-50 shadow-lg outline-none transition-colors hover:bg-amber-900/80 focus-visible:ring-2 focus-visible:ring-amber-300/50 sm:px-4"
              title="Cámara grande, contenido grande o mitad y mitad"
            >
              <option value={FIRST_PERSON_LAYOUTS.CAMERA_PRIMARY}>
                {FIRST_PERSON_LAYOUT_LABELS[FIRST_PERSON_LAYOUTS.CAMERA_PRIMARY]}
              </option>
              <option value={FIRST_PERSON_LAYOUTS.CONTENT_PRIMARY}>
                {FIRST_PERSON_LAYOUT_LABELS[FIRST_PERSON_LAYOUTS.CONTENT_PRIMARY]}
              </option>
              <option value={FIRST_PERSON_LAYOUTS.SPLIT_50}>
                {FIRST_PERSON_LAYOUT_LABELS[FIRST_PERSON_LAYOUTS.SPLIT_50]}
              </option>
              <option value={FIRST_PERSON_LAYOUTS.SPLIT_65_SLIDE_LEFT}>
                {FIRST_PERSON_LAYOUT_LABELS[FIRST_PERSON_LAYOUTS.SPLIT_65_SLIDE_LEFT]}
              </option>
              <option value={FIRST_PERSON_LAYOUTS.SPLIT_65_SLIDE_RIGHT}>
                {FIRST_PERSON_LAYOUT_LABELS[FIRST_PERSON_LAYOUTS.SPLIT_65_SLIDE_RIGHT]}
              </option>
            </select>
            <button
              type="button"
              onClick={() => setOpenKeyOrder((o) => !o)}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-950/70 px-2.5 text-amber-100 shadow-lg transition-colors hover:bg-amber-900/80 focus-visible:ring-2 focus-visible:ring-amber-300/50"
              title="Atajos de teclado 1–0 (orden arrastrable)"
              aria-expanded={openKeyOrder}
            >
              <Keyboard size={18} aria-hidden />
            </button>
            {openKeyOrder ? (
              <div className="pointer-events-auto w-full max-w-sm pr-1">
                <FirstPersonKeyOrderList
                  order={firstPersonKeyOrder}
                  onOrderChange={onFirstPersonKeyOrderChange}
                />
              </div>
            ) : null}
          </>
        ) : null}
        <button
          type="button"
          onClick={onOpenPresenter}
          className="p-2.5 bg-stone-600/90 backdrop-blur text-white rounded-full hover:bg-stone-700 transition-colors shadow-lg"
          title="Abrir ventana de modo presentador"
        >
          <Monitor size={20} />
        </button>
        {nativeFullscreen.supported ? (
          <button
            type="button"
            onClick={nativeFullscreen.onToggle}
            className="p-2.5 bg-stone-600/90 backdrop-blur text-white rounded-full hover:bg-stone-700 transition-colors shadow-lg"
            title={
              nativeFullscreen.active
                ? "Salir de pantalla completa del navegador"
                : "Pantalla completa del navegador (proyector / sin barras del sistema)"
            }
            aria-pressed={nativeFullscreen.active}
            aria-label={
              nativeFullscreen.active
                ? "Salir de pantalla completa del navegador"
                : "Pantalla completa del navegador"
            }
          >
            {nativeFullscreen.active ? (
              <Minimize2 size={20} aria-hidden />
            ) : (
              <Maximize2 size={20} aria-hidden />
            )}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 bg-stone-800/90 backdrop-blur text-white rounded-full hover:bg-stone-900 transition-colors shadow-lg"
          title="Salir de vista presentador"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
