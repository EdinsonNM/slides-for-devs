import { Loader2 } from "lucide-react";

interface GeneratingPresentationModalProps {
  isOpen: boolean;
}

/**
 * Modal que se muestra mientras se genera la presentación desde el home.
 * No se puede cerrar hasta que termine la generación.
 */
export function GeneratingPresentationModal({
  isOpen,
}: GeneratingPresentationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60">
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full p-8 flex flex-col items-center gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-emerald-600">
          <Loader2 size={48} className="animate-spin" aria-hidden />
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-medium text-stone-900 text-lg">
            Generando presentación
          </h3>
          <p className="text-stone-500 text-sm">
            Espera mientras creamos tu presentación. Se guardará automáticamente
            al terminar.
          </p>
        </div>
      </div>
    </div>
  );
}
