import { X, Monitor, Maximize2, Minimize2 } from "lucide-react";
import type { PresenterMode } from "../../constants/presenterModes";

export interface PreviewToolbarProps {
  onOpenPresenter: () => void;
  onClose: () => void;
  presenterMode: PresenterMode;
  onPresenterModeChange: (mode: PresenterMode) => void;
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
  nativeFullscreen,
}: PreviewToolbarProps) {
  return (
    <div className="group/bar pointer-events-auto fixed right-2 top-2 z-110 flex h-16 min-w-[18rem] items-start justify-end rounded-bl-xl">
      <div className="pointer-events-none flex items-center gap-2 pr-1 pt-1 opacity-0 transition-opacity duration-200 group-hover/bar:pointer-events-auto group-hover/bar:opacity-100">
        <label className="sr-only" htmlFor="presenter-mode-select">
          Estilo de presentación
        </label>
        <select
          id="presenter-mode-select"
          value={presenterMode}
          onChange={(e) => onPresenterModeChange(e.target.value as PresenterMode)}
          className="h-10 rounded-full border border-white/20 bg-stone-700/90 px-4 text-sm text-white shadow-lg outline-none transition-colors hover:bg-stone-700 focus-visible:ring-2 focus-visible:ring-white/45"
          title="Seleccionar estilo de transición"
        >
          <option value="powerpoint">PowerPoint (clásico)</option>
          <option value="camera">Cámara continua</option>
          <option value="jarvis">Jarvis IA</option>
        </select>
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
