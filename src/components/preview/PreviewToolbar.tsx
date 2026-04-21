import { X, Monitor } from "lucide-react";

export interface PreviewToolbarProps {
  onOpenPresenter: () => void;
  onClose: () => void;
}

/**
 * Barra superior del overlay de vista previa (visible al hover).
 */
export function PreviewToolbar({
  onOpenPresenter,
  onClose,
}: PreviewToolbarProps) {
  return (
    <div className="group/bar pointer-events-auto fixed right-2 top-2 z-[110] flex h-16 w-44 items-start justify-end rounded-bl-xl">
      <div className="pointer-events-none flex items-center gap-2 pr-1 pt-1 opacity-0 transition-opacity duration-200 group-hover/bar:pointer-events-auto group-hover/bar:opacity-100">
        <button
          type="button"
          onClick={onOpenPresenter}
          className="p-2.5 bg-stone-600/90 backdrop-blur text-white rounded-full hover:bg-stone-700 transition-colors shadow-lg"
          title="Abrir ventana de modo presentador"
        >
          <Monitor size={20} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 bg-stone-800/90 backdrop-blur text-white rounded-full hover:bg-stone-900 transition-colors shadow-lg"
          title="Salir de vista previa"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
