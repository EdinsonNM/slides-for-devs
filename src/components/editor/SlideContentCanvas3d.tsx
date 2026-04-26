import { useCallback, useEffect, useMemo, useState } from "react";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { SLIDE_TYPE } from "../../domain/entities";
import { parseCanvas3dSceneData } from "../../domain/entities/Canvas3dSceneData";
import {
  CANVAS3D_TRANSFORM_MODE_EVENT,
  type Canvas3dTransformModeEventDetail,
} from "../../utils/canvas3dEditorBridge";
import type {
  Canvas3dModelTransform,
  Canvas3dTransformGizmoMode,
} from "../../utils/canvas3dModelTransform";
import type { Presenter3dViewState } from "../../utils/presenter3dView";
import { Canvas3dSceneViewport } from "../shared/Canvas3dSceneViewport";

export function SlideContentCanvas3d() {
  const { currentSlide, patchCurrentSlideCanvas3dScene } = usePresentation();
  const [transformMode, setTransformMode] = useState<Canvas3dTransformGizmoMode>(
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

  const handleSelectInstance = useCallback(
    (id: string | null) => {
      patchCurrentSlideCanvas3dScene((data) => {
        if (id == null) {
          return { ...data, selectedInstanceId: undefined };
        }
        if (!data.instances.some((i) => i.id === id)) return data;
        return { ...data, selectedInstanceId: id };
      });
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

  useEffect(() => {
    const onSetMode = (e: Event) => {
      const ce = e as CustomEvent<Canvas3dTransformModeEventDetail>;
      const m = ce.detail?.mode;
      if (m === "translate" || m === "rotate" || m === "scale") {
        setTransformMode(m);
      }
    };
    window.addEventListener(
      CANVAS3D_TRANSFORM_MODE_EVENT,
      onSetMode as EventListener,
    );
    return () =>
      window.removeEventListener(
        CANVAS3D_TRANSFORM_MODE_EVENT,
        onSetMode as EventListener,
      );
  }, []);

  if (!currentSlide || currentSlide.type !== SLIDE_TYPE.CANVAS_3D || !scene) {
    return null;
  }

  const selectedId = scene.selectedInstanceId ?? null;
  const hasSelection = Boolean(
    selectedId && scene.instances.some((i) => i.id === selectedId),
  );

  const bg = scene.backgroundImageUrl?.trim();

  return (
    <div className="absolute inset-0 z-0 flex min-h-0 min-w-0 flex-col">
      {bg ? (
        <img
          src={bg}
          alt=""
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
        />
      ) : null}
      <div className="relative z-[1] min-h-0 flex-1">
        <Canvas3dSceneViewport
          slideId={currentSlide.id}
          instances={scene.instances}
          viewState={scene.viewState}
          onViewStateCommit={handleViewCommit}
          selectedInstanceId={hasSelection ? selectedId : null}
          transformControlsMode={hasSelection ? transformMode : null}
          onInstanceTransformCommit={handleInstanceTransformCommit}
          onSelectInstance={handleSelectInstance}
          onAnimationClipNames={handleAnimationClipNames}
          showInteractionHint
          showGroundGrid
          className="h-full w-full min-h-[120px]"
        />
      </div>
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
