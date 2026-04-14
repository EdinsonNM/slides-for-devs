import { useCallback, useRef } from "react";
import { Link2, RotateCcw, Upload } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { Canvas3DViewport } from "../shared/Canvas3DViewport";
import type { Presenter3dViewState } from "../../utils/presenter3dView";
import type { Slide } from "../../types";

const CANVAS_MEDIA_BOUNDS_MARGIN = 1.08;

export interface Canvas3DPanelProps {
  embeddedInCanvas?: boolean;
  canvasPanelSlide?: Slide;
}

export function Canvas3DPanel({
  embeddedInCanvas = false,
  canvasPanelSlide,
}: Canvas3DPanelProps = {}) {
  const {
    currentSlide,
    setCurrentSlideCanvas3dGlbUrl,
    setCurrentSlideCanvas3dViewState,
    clearCurrentSlideCanvas3dViewState,
  } = usePresentation();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const handleViewCommit = useCallback(
    (s: Presenter3dViewState) => {
      setCurrentSlideCanvas3dViewState(s);
    },
    [setCurrentSlideCanvas3dViewState],
  );

  const applyUrlFromField = useCallback(() => {
    const raw = urlInputRef.current?.value?.trim() ?? "";
    setCurrentSlideCanvas3dGlbUrl(raw);
  }, [setCurrentSlideCanvas3dGlbUrl]);

  const onPickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (dataUrl) setCurrentSlideCanvas3dGlbUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    },
    [setCurrentSlideCanvas3dGlbUrl],
  );

  if (!currentSlide) return null;

  const slide = canvasPanelSlide ?? currentSlide;
  const glbUrl = slide.canvas3dGlbUrl;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className={cn(
          "flex shrink-0 flex-wrap items-center gap-2 border-b border-stone-200 px-3 py-2 dark:border-border",
          embeddedInCanvas ? "bg-white dark:bg-surface-elevated" : "",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf,model/gltf-binary,application/octet-stream"
          className="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={onPickFile}
          className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 dark:border-border dark:bg-surface dark:text-foreground hover:border-emerald-300"
        >
          <Upload size={14} />
          Subir .glb
        </button>
        <div className="flex min-w-[140px] flex-1 items-center gap-1">
          <input
            ref={urlInputRef}
            type="url"
            name="canvas3d-glb-url"
            defaultValue={glbUrl?.startsWith("http") ? glbUrl : ""}
            key={glbUrl?.startsWith("http") ? glbUrl : "no-http-url"}
            placeholder="https://…/modelo.glb"
            className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs dark:border-border dark:bg-surface dark:text-foreground"
          />
          <button
            type="button"
            onClick={applyUrlFromField}
            className="shrink-0 rounded-lg border border-stone-200 bg-white p-1.5 text-stone-700 dark:border-border dark:bg-surface dark:text-foreground hover:border-emerald-300"
            title="Cargar desde URL"
          >
            <Link2 size={14} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => clearCurrentSlideCanvas3dViewState()}
          className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-600 dark:border-border dark:bg-surface dark:text-stone-300 hover:border-emerald-300"
          title="Vuelve a encuadrar el modelo automáticamente"
        >
          <RotateCcw size={14} />
          Vista
        </button>
      </div>
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col",
          embeddedInCanvas
            ? "bg-white p-0 dark:bg-surface-elevated"
            : "p-2",
        )}
      >
        <Canvas3DViewport
          slideId={currentSlide.id}
          glbUrl={glbUrl}
          viewState={slide.canvas3dViewState}
          onViewStateCommit={handleViewCommit}
          showInteractionHint={!embeddedInCanvas}
          boundsMargin={
            embeddedInCanvas ? CANVAS_MEDIA_BOUNDS_MARGIN : undefined
          }
          className={cn("min-h-0 flex-1", embeddedInCanvas ? "" : "rounded-xl")}
        />
      </div>
    </div>
  );
}
