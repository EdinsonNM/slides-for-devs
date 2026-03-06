import { X } from "lucide-react";

export interface PresenterHeaderProps {
  topic: string;
  currentIndex: number;
  totalSlides: number;
  onClose: () => void;
}

/**
 * Cabecera del modo presentador: título, progreso y botón cerrar.
 */
export function PresenterHeader({
  topic,
  currentIndex,
  totalSlides,
  onClose,
}: PresenterHeaderProps) {
  return (
    <header className="shrink-0 px-4 py-2.5 border-b border-stone-700 flex items-center justify-between">
      <h1 className="font-serif italic text-sm text-stone-200 truncate max-w-[50%]">
        {topic}
      </h1>
      <div className="flex items-center gap-2">
        <span className="px-3 py-1 bg-stone-700 rounded-full text-xs font-medium text-stone-300">
          {currentIndex + 1} / {totalSlides}
        </span>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-stone-700 text-stone-400 hover:text-white transition-colors"
          title="Cerrar modo presentador"
        >
          <X size={20} />
        </button>
      </div>
    </header>
  );
}
