import { useMemo } from "react";
import { Video, Camera as CameraIcon, FlipHorizontal2 } from "lucide-react";
import { usePresentation } from "../../presentation/contexts/PresentationContext";
import { cn } from "../../utils/cn";
import {
  PANEL_CONTENT_KIND,
  normalizePanelContentKind,
} from "../../domain/panelContent";
import { readMediaPayloadFromElement } from "../../domain/slideCanvas/slideCanvasPayload";
import { isSlideCanvasMediaPayload } from "../../domain/entities/SlideCanvas";
import {
  WEBCAM_INTENSITY_MAX,
  WEBCAM_MASK_SHAPE,
  type WebcamMaskShape,
  normalizeWebcamPanelState,
} from "../../domain/webcam/webcamPanelModel";

const MASK_OPTIONS: { id: WebcamMaskShape; label: string }[] = [
  { id: WEBCAM_MASK_SHAPE.ROUNDED_RECT, label: "Rectángulo redondeado" },
  { id: WEBCAM_MASK_SHAPE.CIRCLE, label: "Círculo" },
  { id: WEBCAM_MASK_SHAPE.PILL, label: "Píldora" },
  { id: WEBCAM_MASK_SHAPE.HEXAGON, label: "Hexágono" },
  { id: WEBCAM_MASK_SHAPE.DIAMOND, label: "Rombo" },
];

export function CameraInspectorPanel() {
  const { currentSlide, canvasMediaPanelElementId, setCurrentSlideWebcam } =
    usePresentation();
  const { isCameraTarget, state } = useMemo(() => {
    const slide = currentSlide;
    if (!slide?.canvasScene) {
      return { isCameraTarget: false, state: normalizeWebcamPanelState(null) };
    }
    const id = canvasMediaPanelElementId;
    const el = id
      ? slide.canvasScene.elements.find((e) => e.id === id)
      : null;
    if (!el || el.kind !== "mediaPanel") {
      return { isCameraTarget: false, state: normalizeWebcamPanelState(null) };
    }
    const p = el.payload;
    if (!isSlideCanvasMediaPayload(p)) {
      return { isCameraTarget: false, state: normalizeWebcamPanelState(null) };
    }
    const media = readMediaPayloadFromElement(slide, el);
    const cam =
      normalizePanelContentKind(media.contentType) === PANEL_CONTENT_KIND.CAMERA;
    return {
      isCameraTarget: cam,
      state: normalizeWebcamPanelState(media.webcam),
    };
  }, [currentSlide, currentSlide?.canvasScene, canvasMediaPanelElementId]);

  if (!currentSlide) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-white px-3 py-3 text-sm text-muted-foreground dark:bg-surface-elevated">
        No hay diapositiva activa.
      </div>
    );
  }

  if (!isCameraTarget) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white px-3 py-3 text-sm text-muted-foreground dark:bg-surface-elevated">
        <div className="shrink-0 border-b border-stone-100 pb-2.5 dark:border-border">
          <div className="flex items-center gap-2">
            <Video className="size-4 text-violet-600 dark:text-violet-400" strokeWidth={2} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cámara
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
          Añade un panel <span className="font-medium">Cámara</span> desde la barra inferior
          (botón <span className="font-medium">Panel</span>) o selecciona en el lienzo un bloque
          que ya sea de tipo cámara para ajustar máscara y espejo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-surface-elevated">
      <div className="shrink-0 border-b border-stone-100 px-3 py-2.5 dark:border-border">
        <div className="flex items-center gap-2">
          <CameraIcon className="size-4 text-fuchsia-600 dark:text-fuchsia-400" strokeWidth={2} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cámara
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-stone-500 dark:text-stone-400">
          La imagen en vivo se muestra en el bloque del lienzo. El desenfoque de fondo y la suavidad
          (smoothness) actúan sobre la silueta detectada, no solo sobre el rostro.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Forma de máscara
          </p>
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Forma de máscara">
            {MASK_OPTIONS.map(({ id, label }) => {
              const active = state.maskShape === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() =>
                    setCurrentSlideWebcam({ ...state, maskShape: id })
                  }
                  className={cn(
                    "w-full rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition",
                    active
                      ? "border-violet-500/70 bg-violet-50/90 text-violet-950 dark:border-violet-500/50 dark:bg-violet-950/40 dark:text-violet-100"
                      : "border-stone-200/90 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-surface-elevated dark:text-stone-200 dark:hover:bg-stone-900/50",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label
                htmlFor="webcam-bg-blur"
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Desenfoque del fondo
              </label>
              <span className="text-[10px] tabular-nums text-stone-500 dark:text-stone-400">
                {state.backgroundBlurStrength}
              </span>
            </div>
            <input
              id="webcam-bg-blur"
              type="range"
              min={0}
              max={WEBCAM_INTENSITY_MAX}
              value={state.backgroundBlurStrength}
              onChange={(e) =>
                setCurrentSlideWebcam({
                  ...state,
                  backgroundBlurStrength: Number(e.target.value),
                })
              }
              className="h-2 w-full cursor-pointer accent-violet-600 dark:accent-violet-500"
            />
            <p className="mt-0.5 text-[10px] text-stone-500 dark:text-stone-400">
              Requiere carga de segmentación; si falla, se muestra cámara sin efecto.
            </p>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label
                htmlFor="webcam-fg-smooth"
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Suavidad (primer plano)
              </label>
              <span className="text-[10px] tabular-nums text-stone-500 dark:text-stone-400">
                {state.faceSmoothStrength}
              </span>
            </div>
            <input
              id="webcam-fg-smooth"
              type="range"
              min={0}
              max={WEBCAM_INTENSITY_MAX}
              value={state.faceSmoothStrength}
              onChange={(e) =>
                setCurrentSlideWebcam({
                  ...state,
                  faceSmoothStrength: Number(e.target.value),
                })
              }
              className="h-2 w-full cursor-pointer accent-violet-600 dark:accent-violet-500"
            />
            <p className="mt-0.5 text-[10px] text-stone-500 dark:text-stone-400">
              El segmentador distingue persona/fondo; la suavidad se limita al óvalo del rostro (y ojos
              nítidos). Brazos, cuerpo y manos fuera de ese óvalo se mantienen nítidos.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg border border-stone-200/80 bg-stone-50/50 px-2.5 py-2 dark:border-stone-700/80 dark:bg-stone-900/20">
          <span className="text-xs text-stone-700 dark:text-stone-300">Espejo (selfie)</span>
          <button
            type="button"
            onClick={() => setCurrentSlideWebcam({ ...state, mirrored: !state.mirrored })}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition",
              state.mirrored
                ? "bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100"
                : "bg-stone-200/60 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
            )}
            aria-pressed={state.mirrored}
          >
            <FlipHorizontal2 className="size-3.5" />
            {state.mirrored ? "Sí" : "No"}
          </button>
        </div>
      </div>
    </div>
  );
}
