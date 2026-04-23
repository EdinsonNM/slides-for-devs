import { useCallback, useRef, useState } from "react";
import { Box, Link2, RotateCcw, Upload } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import {
  CANVAS_3D_GLB_FILE_ACCEPT,
  Canvas3dUrlModal,
} from "./Canvas3dUrlModal";
import { Canvas3dMeshyAiModal } from "./Canvas3dMeshyAiModal";

export interface Canvas3dModelSourceActionsProps {
  /** URL .glb http(s) actual (para rellenar el modal). */
  httpGlbUrl: string;
  /** Id explícito del mediaPanel cuando hay varios en el lienzo. */
  canvasMediaElementId?: string;
  className?: string;
}

/** Controles flotantes sobre el visor del panel lateral (no lienzo). */
export function Canvas3dModelSourceActions({
  httpGlbUrl,
  canvasMediaElementId,
  className,
}: Canvas3dModelSourceActionsProps) {
  const {
    setCurrentSlideCanvas3dGlbUrl,
    clearCurrentSlideCanvas3dViewState,
    recordGeneratedModel3d,
  } = usePresentation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [meshyModalOpen, setMeshyModalOpen] = useState(false);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (dataUrl) {
          setCurrentSlideCanvas3dGlbUrl(dataUrl, canvasMediaElementId);
        }
      };
      reader.readAsDataURL(file);
    },
    [canvasMediaElementId, setCurrentSlideCanvas3dGlbUrl],
  );

  const overlayBtn =
    "rounded-lg border border-stone-200 bg-white/95 px-2 py-1 text-[11px] font-medium text-stone-700 shadow-sm backdrop-blur-sm transition-colors hover:border-emerald-300 dark:border-border dark:bg-stone-900/90 dark:text-stone-200 dark:hover:border-emerald-600";

  return (
    <>
      <div
        className={cn(
          "pointer-events-auto absolute right-2 top-2 z-20 flex flex-wrap items-center justify-end gap-1",
          className,
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={CANVAS_3D_GLB_FILE_ACCEPT}
          className="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          className={overlayBtn}
          title="Subir modelo .glb desde tu equipo"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="inline-flex items-center gap-1">
            <Upload size={14} aria-hidden />
            Subir modelo
          </span>
        </button>
        <button
          type="button"
          className={overlayBtn}
          title="Cargar modelo desde una URL (https… .glb)"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setUrlModalOpen(true)}
        >
          <span className="inline-flex items-center gap-1">
            <Link2 size={14} aria-hidden />
            Cargar desde URL
          </span>
        </button>
        <button
          type="button"
          className={overlayBtn}
          title="Generar modelo 3D con IA (Meshy: texto o imagen)"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setMeshyModalOpen(true)}
        >
          <span className="inline-flex items-center gap-1">
            <Box size={14} aria-hidden />
            IA Meshy
          </span>
        </button>
        <button
          type="button"
          className={overlayBtn}
          title="Vuelve a encuadrar el modelo automáticamente"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() =>
            clearCurrentSlideCanvas3dViewState(canvasMediaElementId)
          }
        >
          <span className="inline-flex items-center gap-1">
            <RotateCcw size={14} aria-hidden />
            Vista
          </span>
        </button>
      </div>

      <Canvas3dUrlModal
        isOpen={urlModalOpen}
        onClose={() => setUrlModalOpen(false)}
        initialUrl={httpGlbUrl}
        onApply={(url) => setCurrentSlideCanvas3dGlbUrl(url, canvasMediaElementId)}
      />
      <Canvas3dMeshyAiModal
        isOpen={meshyModalOpen}
        onClose={() => setMeshyModalOpen(false)}
        onAppliedGlbUrl={(url, meta) => {
          setCurrentSlideCanvas3dGlbUrl(url, canvasMediaElementId);
          void recordGeneratedModel3d(url, meta?.prompt ?? null);
        }}
      />
    </>
  );
}
