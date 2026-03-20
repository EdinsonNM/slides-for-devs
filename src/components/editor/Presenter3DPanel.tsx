import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Image as ImageIcon, Sparkles, Upload, Video } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { Device3DViewport } from "../shared/Device3DViewport";
import { DEVICE_3D_CATALOG, DEFAULT_DEVICE_3D_ID, type Device3dId } from "../../constants/device3d";
import { isDirectVideoTextureUrl } from "../../utils/directVideoUrl";
import type { Presenter3dViewState } from "../../utils/presenter3dView";

export function Presenter3DPanel() {
  const {
    currentSlide,
    openImageModal,
    openImageUploadModal,
    setVideoUrlInput,
    setShowVideoModal,
    setCurrentSlidePresenter3dDeviceId,
    setCurrentSlidePresenter3dScreenMedia,
    setCurrentSlidePresenter3dViewState,
  } = usePresentation();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleViewCommit = useCallback(
    (s: Presenter3dViewState) => {
      setCurrentSlidePresenter3dViewState(s);
    },
    [setCurrentSlidePresenter3dViewState]
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

  const deviceId = (currentSlide.presenter3dDeviceId as Device3dId) ?? DEFAULT_DEVICE_3D_ID;
  const screenMedia = currentSlide.presenter3dScreenMedia ?? "image";
  const videoOk =
    Boolean(currentSlide.videoUrl?.trim()) &&
    isDirectVideoTextureUrl(currentSlide.videoUrl!.trim());

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-stone-200 dark:border-border px-4 py-2 bg-stone-50/80 dark:bg-stone-900/40">
        <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
          <span className="font-medium">Dispositivo</span>
          <select
            value={deviceId}
            onChange={(e) =>
              setCurrentSlidePresenter3dDeviceId(e.target.value as Device3dId)
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
            onClick={() => setCurrentSlidePresenter3dScreenMedia("image")}
            className={cn(
              "px-2.5 py-1.5 font-medium transition-colors",
              screenMedia === "image"
                ? "bg-emerald-600 text-white"
                : "bg-white dark:bg-surface text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
            )}
          >
            Textura imagen
          </button>
          <button
            type="button"
            onClick={() => setCurrentSlidePresenter3dScreenMedia("video")}
            className={cn(
              "px-2.5 py-1.5 font-medium transition-colors border-l border-stone-200 dark:border-border",
              screenMedia === "video"
                ? "bg-emerald-600 text-white"
                : "bg-white dark:bg-surface text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
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
              {currentSlide.imageUrl ? "Cambiar imagen" : "Añadir imagen"}
              <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-xl border border-stone-200 dark:border-border bg-white dark:bg-surface-elevated py-1 shadow-xl">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                  onClick={() => {
                    setMenuOpen(false);
                    openImageModal();
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
                    openImageUploadModal();
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
              setVideoUrlInput(currentSlide.videoUrl || "");
              setShowVideoModal(true);
            }}
            className="flex items-center gap-1 rounded-lg border border-stone-200 dark:border-border bg-white dark:bg-surface px-2.5 py-1.5 text-xs font-medium text-stone-700 dark:text-foreground hover:border-emerald-300"
          >
            <Video size={14} />
            {currentSlide.videoUrl ? "Cambiar video" : "Añadir video (URL directa)"}
          </button>
        )}
      </div>
      {screenMedia === "video" && currentSlide.videoUrl && !videoOk && (
        <p className="shrink-0 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-900">
          Para la pantalla 3D hace falta una URL directa a vídeo (p. ej. MP4/WebM). Los enlaces de YouTube o
          Vimeo siguen funcionando en el modo panel &quot;Video&quot; clásico.
        </p>
      )}
      <div className="flex-1 min-h-0 p-2">
        <Device3DViewport
          slideId={currentSlide.id}
          deviceId={deviceId}
          screenMedia={screenMedia}
          imageUrl={currentSlide.imageUrl}
          videoUrl={currentSlide.videoUrl}
          viewState={currentSlide.presenter3dViewState}
          onViewStateCommit={handleViewCommit}
          className="rounded-xl"
        />
      </div>
    </div>
  );
}
