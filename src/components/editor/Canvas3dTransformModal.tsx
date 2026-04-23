import { useEffect, useState } from "react";
import { Box, Move3d, RotateCw, Settings2 } from "lucide-react";
import { BaseModal } from "../modals/BaseModal";
import { Canvas3DViewport } from "../shared/Canvas3DViewport";
import { Canvas3dAnimationClipSelect } from "./Canvas3dAnimationClipSelect";
import type { Presenter3dViewState } from "../../utils/presenter3dView";
import type { Canvas3dModelTransform } from "../../utils/canvas3dModelTransform";
import { DEFAULT_CANVAS_3D_MODEL_TRANSFORM } from "../../utils/canvas3dModelTransform";
import { cn } from "../../utils/cn";

type TransformMode = "translate" | "rotate";

export interface Canvas3dTransformModalProps {
  isOpen: boolean;
  onClose: () => void;
  slideId: string;
  glbUrl?: string | null;
  viewState?: Presenter3dViewState | null;
  modelTransform?: Canvas3dModelTransform | null;
  animationClipName?: string;
  animationClipNames?: string[];
  onAnimationClipChange?: (clipName: string | undefined) => void;
  onModelTransformCommit: (next: Canvas3dModelTransform) => void;
}

export function Canvas3dTransformModal({
  isOpen,
  onClose,
  slideId,
  glbUrl,
  viewState,
  modelTransform,
  animationClipName,
  animationClipNames = [],
  onAnimationClipChange,
  onModelTransformCommit,
}: Canvas3dTransformModalProps) {
  const [draft, setDraft] = useState<Canvas3dModelTransform>(
    modelTransform ?? DEFAULT_CANVAS_3D_MODEL_TRANSFORM,
  );
  const [mode, setMode] = useState<TransformMode>("translate");

  useEffect(() => {
    if (!isOpen) return;
    setDraft(modelTransform ?? DEFAULT_CANVAS_3D_MODEL_TRANSFORM);
    setMode("translate");
  }, [isOpen, modelTransform]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurar modelo"
      subtitle="Centro con el gizmo (mover / rotar), animación GLB y vista previa."
      icon={
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
          <Settings2 size={20} />
        </div>
      }
      className="max-w-5xl"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-lg border border-stone-200 bg-white p-1 dark:border-border dark:bg-surface">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === "translate"
                  ? "bg-emerald-600 text-white"
                  : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10",
              )}
              onClick={() => setMode("translate")}
            >
              <Move3d size={14} />
              Mover
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                mode === "rotate"
                  ? "bg-emerald-600 text-white"
                  : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10",
              )}
              onClick={() => setMode("rotate")}
            >
              <RotateCw size={14} />
              Rotar
            </button>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-border dark:text-stone-200 dark:hover:bg-white/5"
            onClick={() => {
              const reset = DEFAULT_CANVAS_3D_MODEL_TRANSFORM;
              setDraft(reset);
              onModelTransformCommit(reset);
            }}
          >
            <Box size={14} />
            Reset
          </button>
        </div>
        {animationClipNames.length > 0 && onAnimationClipChange ? (
          <div className="flex flex-wrap items-center gap-2">
            <Canvas3dAnimationClipSelect
              clipNames={animationClipNames}
              value={animationClipName}
              onChange={onAnimationClipChange}
              className="max-w-full sm:max-w-[min(100%,14rem)]"
            />
          </div>
        ) : null}
        <div className="h-[58vh] min-h-[360px] rounded-xl border border-stone-200 dark:border-border">
          <Canvas3DViewport
            slideId={slideId}
            glbUrl={glbUrl}
            viewState={viewState}
            animationClipName={animationClipName}
            modelTransform={draft}
            transformControlsMode={mode}
            onModelTransformChange={setDraft}
            onModelTransformCommit={onModelTransformCommit}
            showInteractionHint={false}
            className="h-full rounded-xl"
          />
        </div>
      </div>
    </BaseModal>
  );
}
