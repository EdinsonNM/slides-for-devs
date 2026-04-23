import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ChevronDown,
  Image as ImageIcon,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { Device3DViewport } from "../shared/Device3DViewport";
import {
  DEVICE_3D_CATALOG,
  DEFAULT_DEVICE_3D_ID,
  type Device3dId,
} from "../../constants/device3d";
import { isDirectVideoTextureUrl } from "../../utils/directVideoUrl";
import type { Presenter3dViewState } from "../../utils/presenter3dView";
import { useMinWidthLg } from "../../hooks/useMatchMedia";
import type { Slide } from "../../types";
import { presenter3dDisplayPropsFromCanvasElement } from "../../domain/slideCanvas/slideCanvasPayload";

const CANVAS_MEDIA_BOUNDS_MARGIN = 1.08;

export interface Presenter3DPanelProps {
  embeddedInCanvas?: boolean;
  canvasPanelSlide?: Slide;
  /** Id del bloque `mediaPanel` en el lienzo (varios presentadores en un mismo slide). */
  canvasMediaElementId?: string;
  /** Lienzo: fuerza re-medición del host WebGL (p. ej. tras cambiar orden z). */
  hostMeasureKey?: string;
}

export function Presenter3DPanel({
  embeddedInCanvas = false,
  canvasPanelSlide,
  canvasMediaElementId,
  hostMeasureKey,
}: Presenter3DPanelProps = {}) {
  const {
    currentSlide,
    openImageModal,
    openImageUploadModal,
    openVideoModal,
    setCurrentSlidePresenter3dDeviceId,
    setCurrentSlidePresenter3dScreenMedia,
    setCurrentSlidePresenter3dViewState,
  } = usePresentation();

  const isLgUp = useMinWidthLg();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const patchTargetElementId = canvasMediaElementId ?? undefined;

  const handleViewCommit = useCallback(
    (s: Presenter3dViewState) => {
      setCurrentSlidePresenter3dViewState(s, patchTargetElementId);
    },
    [setCurrentSlidePresenter3dViewState, patchTargetElementId],
  );

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  if (!currentSlide) return null;

  const deckSlide = canvasPanelSlide ?? currentSlide;

  const blockEl = useMemo(() => {
    if (!canvasMediaElementId || !currentSlide.canvasScene?.elements) {
      return undefined;
    }
    return currentSlide.canvasScene.elements.find(
      (e) => e.id === canvasMediaElementId,
    );
  }, [canvasMediaElementId, currentSlide]);

  const fromBlock =
    blockEl?.kind === "mediaPanel"
      ? presenter3dDisplayPropsFromCanvasElement(currentSlide, blockEl)
      : null;

  const canvasPresenterBlock = fromBlock != null;

  const deviceId = (
    canvasPresenterBlock
      ? fromBlock.deviceId
      : ((deckSlide.presenter3dDeviceId as Device3dId | undefined) ??
        DEFAULT_DEVICE_3D_ID)
  ) as Device3dId;
  const screenMedia = canvasPresenterBlock
    ? fromBlock.screenMedia
    : (deckSlide.presenter3dScreenMedia ?? "image");
  const textureVideoUrl = canvasPresenterBlock
    ? fromBlock.videoUrl
    : deckSlide.videoUrl;
  const textureImageUrl = canvasPresenterBlock
    ? fromBlock.imageUrl
    : deckSlide.imageUrl;
  const orbitViewState = canvasPresenterBlock
    ? fromBlock.viewState
    : deckSlide.presenter3dViewState;

  const videoOk =
    Boolean(textureVideoUrl?.trim()) &&
    isDirectVideoTextureUrl(textureVideoUrl!.trim());

  const toolbar = !isLgUp && (
    <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-stone-200 dark:border-border px-4 py-2 bg-stone-50/80 dark:bg-stone-900/40">
      <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
        <span className="font-medium">Dispositivo</span>
        <select
          value={deviceId}
          onChange={(e) =>
            setCurrentSlidePresenter3dDeviceId(
              e.target.value as Device3dId,
              patchTargetElementId,
            )
          }
          className="rounded-lg border border-stone-200 dark:border-border bg-white dark:bg-surface px-2 py-1 text-xs"
        >
          {DEVICE_3D_CATALOG.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex rounded-lg border border-stone-200 dark:border-border overflow-hidden text-xs">
        <button
          type="button"
          onClick={() =>
            setCurrentSlidePresenter3dScreenMedia("image", patchTargetElementId)
          }
          className={cn(
            "px-2.5 py-1.5 font-medium transition-colors",
            screenMedia === "image"
              ? "bg-emerald-600 text-white"
              : "bg-white dark:bg-surface text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800",
          )}
        >
          Textura imagen
        </button>
        <button
          type="button"
          onClick={() =>
            setCurrentSlidePresenter3dScreenMedia("video", patchTargetElementId)
          }
          className={cn(
            "px-2.5 py-1.5 font-medium transition-colors border-l border-stone-200 dark:border-border",
            screenMedia === "video"
              ? "bg-emerald-600 text-white"
              : "bg-white dark:bg-surface text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800",
          )}
        >
          Textura video
        </button>
      </div>
      {screenMedia === "image" ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-stone-200 dark:border-border bg-white dark:bg-surface px-2.5 py-1.5 text-xs font-medium text-stone-700 dark:text-foreground hover:border-emerald-300"
          >
            <ImageIcon size={14} />
            {textureImageUrl ? "Cambiar imagen" : "Añadir imagen"}
            <ChevronDown size={14} />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-xl border border-stone-200 dark:border-border bg-white dark:bg-surface-elevated py-1 shadow-xl">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                onClick={() => {
                  setMenuOpen(false);
                  openImageModal(
                    canvasMediaElementId
                      ? { mediaPanelElementId: canvasMediaElementId }
                      : undefined,
                  );
                }}
              >
                <Sparkles size={16} className="text-emerald-500" />
                Generar imagen
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                onClick={() => {
                  setMenuOpen(false);
                  openImageUploadModal(
                    canvasMediaElementId
                      ? { mediaPanelElementId: canvasMediaElementId }
                      : undefined,
                  );
                }}
              >
                <Upload size={16} />
                Subir imagen
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            openVideoModal(
              canvasMediaElementId
                ? {
                    mediaPanelElementId: canvasMediaElementId,
                    initialVideoUrl: textureVideoUrl || "",
                  }
                : { initialVideoUrl: textureVideoUrl || "" },
            );
          }}
          className="flex items-center gap-1 rounded-lg border border-stone-200 dark:border-border bg-white dark:bg-surface px-2.5 py-1.5 text-xs font-medium text-stone-700 dark:text-foreground hover:border-emerald-300"
        >
          <Video size={14} />
          {textureVideoUrl ? "Cambiar video" : "Añadir video (URL directa)"}
        </button>
      )}
    </div>
  );

  const warnMobile =
    !isLgUp && screenMedia === "video" && textureVideoUrl && !videoOk ? (
      <p className="shrink-0 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900">
        Para la pantalla 3D hace falta una URL directa a vídeo (p. ej.
        MP4/WebM). Los enlaces de YouTube o Vimeo siguen funcionando en el modo
        panel &quot;Video&quot; clásico.
      </p>
    ) : null;

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {toolbar}
      {warnMobile}
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col",
          embeddedInCanvas ? "bg-white p-0 dark:bg-surface-elevated" : "p-2",
        )}
      >
        <Device3DViewport
          slideId={deckSlide.id}
          orbitScopeSuffix={canvasMediaElementId}
          deviceId={deviceId}
          screenMedia={screenMedia}
          imageUrl={textureImageUrl}
          videoUrl={textureVideoUrl}
          viewState={orbitViewState}
          onViewStateCommit={handleViewCommit}
          hostMeasureKey={hostMeasureKey}
          boundsMargin={
            embeddedInCanvas ? CANVAS_MEDIA_BOUNDS_MARGIN : undefined
          }
          showInteractionHint={!embeddedInCanvas}
          className={cn("min-h-0 flex-1", embeddedInCanvas ? "" : "rounded-xl")}
        />
      </div>
    </div>
  );
}
