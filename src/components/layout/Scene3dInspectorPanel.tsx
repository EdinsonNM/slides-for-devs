import { useCallback, useMemo } from "react";
import { Box } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { SLIDE_TYPE } from "../../domain/entities";
import {
  parseCanvas3dSceneData,
  serializeCanvas3dSceneData,
  type Canvas3dSceneData,
} from "../../domain/entities/Canvas3dSceneData";
import { Scene3dEditorCore } from "./Scene3dEditorCore";

export function Scene3dInspectorPanel() {
  const {
    currentSlide,
    setCurrentSlideType,
    setCurrentSlideCanvas3dSceneData,
    setInspectorSection,
    savedCharacters,
    generatedResources,
  } = usePresentation();

  const scene = useMemo(
    () =>
      currentSlide?.type === SLIDE_TYPE.CANVAS_3D
        ? parseCanvas3dSceneData(currentSlide.canvas3dSceneData)
        : null,
    [currentSlide?.canvas3dSceneData, currentSlide?.type],
  );

  const persist = useCallback(
    (next: Canvas3dSceneData) => {
      setCurrentSlideCanvas3dSceneData(serializeCanvas3dSceneData(next));
    },
    [setCurrentSlideCanvas3dSceneData],
  );

  const activateCanvas3dSlide = () => {
    setCurrentSlideType(SLIDE_TYPE.CANVAS_3D);
    setInspectorSection("scene3d");
  };

  if (!currentSlide) return null;

  if (currentSlide.type !== SLIDE_TYPE.CANVAS_3D || !scene) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white px-3 py-3 dark:bg-surface-elevated">
        <div className="mb-2 flex items-center gap-2 border-b border-stone-100 pb-2 dark:border-border">
          <Box className="size-4 text-violet-600 dark:text-violet-400" strokeWidth={2} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Escena 3D
          </span>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
          Convierte esta diapositiva en una escena 3D: formas básicas, modelos de{" "}
          <code className="rounded bg-stone-100 px-1 text-[11px] dark:bg-stone-800">
            public/models
          </code>{" "}
          (vía <code className="rounded bg-stone-100 px-1 text-[11px] dark:bg-stone-800">catalog.json</code>
          ), biblioteca Recursos o tus propios archivos <code className="text-[11px]">.glb</code>.
        </p>
        <button
          type="button"
          onClick={activateCanvas3dSlide}
          className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          Activar escena 3D en esta diapositiva
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white dark:bg-surface-elevated">
      <div className="shrink-0 border-b border-stone-100 px-3 py-2.5 dark:border-border">
        <div className="flex items-center gap-2">
          <Box className="size-4 text-violet-600 dark:text-violet-400" strokeWidth={2} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Escena 3D
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-stone-500 dark:text-stone-400">
          Añade formas, modelos de la carpeta pública, Recursos o un GLB local.
        </p>
      </div>
      <Scene3dEditorCore
        scene={scene}
        onPersist={persist}
        savedCharacters={savedCharacters}
        generatedResources={generatedResources}
      />
    </div>
  );
}
