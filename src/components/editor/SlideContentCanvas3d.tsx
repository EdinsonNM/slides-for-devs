import { useCallback, useEffect, useMemo, useState } from "react";
import { usePresentation } from "../../context/PresentationContext";
import { SLIDE_TYPE } from "../../domain/entities";
import { parseCanvas3dSceneData } from "../../domain/entities/Canvas3dSceneData";
import type { Canvas3dModelTransform } from "../../utils/canvas3dModelTransform";
import type { Presenter3dViewState } from "../../utils/presenter3dView";
import { Canvas3dSceneViewport } from "../shared/Canvas3dSceneViewport";

export function SlideContentCanvas3d() {
  const { currentSlide, patchCurrentSlideCanvas3dScene } = usePresentation();
  const [transformMode, setTransformMode] = useState<"translate" | "rotate">(
    "translate",
  );
  const [clipNamesByInstanceId, setClipNamesByInstanceId] = useState<
    Record<string, string[]>
  >({});

  const scene = useMemo(
    () =>
      currentSlide?.type === SLIDE_TYPE.CANVAS_3D
        ? parseCanvas3dSceneData(currentSlide.canvas3dSceneData)
        : null,
    [currentSlide?.canvas3dSceneData, currentSlide?.type],
  );

  const handleViewCommit = useCallback(
    (vs: Presenter3dViewState) => {
      patchCurrentSlideCanvas3dScene((data) => ({ ...data, viewState: vs }));
    },
    [patchCurrentSlideCanvas3dScene],
  );

  const handleInstanceTransformCommit = useCallback(
    (id: string, t: Canvas3dModelTransform) => {
      patchCurrentSlideCanvas3dScene((data) => ({
        ...data,
        instances: data.instances.map((i) =>
          i.id === id ? { ...i, modelTransform: t } : i,
        ),
      }));
    },
    [patchCurrentSlideCanvas3dScene],
  );

  const handleAnimationClipNames = useCallback((instanceId: string, names: string[]) => {
    setClipNamesByInstanceId((prev) => {
      const prevN = prev[instanceId];
      if (
        prevN &&
        prevN.length === names.length &&
        prevN.every((x, i) => x === names[i])
      ) {
        return prev;
      }
      return { ...prev, [instanceId]: names };
    });
  }, []);

  if (!currentSlide || currentSlide.type !== SLIDE_TYPE.CANVAS_3D || !scene) {
    return null;
  }

  const selectedId = scene.selectedInstanceId ?? null;
  const hasSelection = Boolean(
    selectedId && scene.instances.some((i) => i.id === selectedId),
  );

  return (
    <div className="absolute inset-0 z-0 flex min-h-0 min-w-0 flex-col">
      <Canvas3dSceneViewport
        slideId={currentSlide.id}
        instances={scene.instances}
        viewState={scene.viewState}
        onViewStateCommit={handleViewCommit}
        selectedInstanceId={hasSelection ? selectedId : null}
        transformControlsMode={hasSelection ? transformMode : null}
        onInstanceTransformCommit={handleInstanceTransformCommit}
        onAnimationClipNames={handleAnimationClipNames}
        showInteractionHint
        showGroundGrid
        className="h-full w-full min-h-[120px]"
      />
      {hasSelection ? (
        <div className="pointer-events-auto absolute right-2 top-2 z-[2] flex gap-1 rounded-lg border border-stone-200/80 bg-white/90 p-0.5 shadow-sm dark:border-border dark:bg-surface-elevated/95">
          <button
            type="button"
            onClick={() => setTransformMode("translate")}
            className={
              transformMode === "translate"
                ? "rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white"
                : "rounded-md px-2 py-1 text-[10px] font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10"
            }
          >
            Mover
          </button>
          <button
            type="button"
            onClick={() => setTransformMode("rotate")}
            className={
              transformMode === "rotate"
                ? "rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white"
                : "rounded-md px-2 py-1 text-[10px] font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10"
            }
          >
            Girar
          </button>
        </div>
      ) : null}
      {/* Expone nombres de clips al inspector vía evento (mismo patrón que varios mediaPanel 3D). */}
      <Canvas3dSceneClipNamesBridge clipNamesByInstanceId={clipNamesByInstanceId} />
    </div>
  );
}

/** Sincroniza nombres de animación descubiertos en el visor con `window` para el inspector sin prop drilling masivo. */
function Canvas3dSceneClipNamesBridge({
  clipNamesByInstanceId,
}: {
  clipNamesByInstanceId: Record<string, string[]>;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("slide:canvas3dSceneClipNames", {
        detail: clipNamesByInstanceId,
      }),
    );
  }, [clipNamesByInstanceId]);
  return null;
}
