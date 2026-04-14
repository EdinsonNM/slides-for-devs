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
    <div className="fixed top-0 left-0 right-0 h-20 z-[110] group/bar">
      <div className="absolute inset-0 flex items-center justify-end gap-2 pr-6 opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200">
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
