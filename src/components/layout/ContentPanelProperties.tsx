import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  ChevronDown,
  Image as ImageIcon,
  Moon,
  Sparkles,
  Sun,
  Upload,
  Video,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { LANGUAGES } from "../../constants/languages";
import {
  DEVICE_3D_CATALOG,
  DEFAULT_DEVICE_3D_ID,
  type Device3dId,
} from "../../constants/device3d";
import { isDirectVideoTextureUrl } from "../../utils/directVideoUrl";
import { useCodeEditorTheme } from "../../hooks/useCodeEditorTheme";
import { SLIDE_TYPE } from "../../domain/entities";
import {
  PANEL_CONTENT_KIND,
  resolveMediaPanelDescriptor,
} from "../../domain/panelContent";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import { slideAppearanceForMediaElement } from "../../domain/slideCanvas/slideCanvasPayload";

/**
 * Controles del panel lateral (imagen / vídeo / código / 3D) en el inspector derecho.
 * En viewport &lt; lg el inspector no se muestra; los paneles del lienzo conservan sus controles.
 */
export function ContentPanelProperties() {
  const {
    currentSlide,
    openImageModal,
    openImageUploadModal,
    setVideoUrlInput,
    setShowVideoModal,
    setCurrentSlidePresenter3dDeviceId,
    setCurrentSlidePresenter3dScreenMedia,
    setCurrentSlideCanvas3dGlbUrl,
    clearCurrentSlideCanvas3dViewState,
    editLanguage,
    setEditLanguage,
    editFontSize,
    setEditFontSize,
    openCodeGenModal,
    canvasMediaPanelElementId,
    cycleCodeEditorThemeForMediaPanel,
  } = usePresentation();

  const globalCodeTheme = useCodeEditorTheme();

  const [imgMenuOpen, setImgMenuOpen] = useState(false);
  const imgMenuRef = useRef<HTMLDivElement>(null);
  const canvas3dFileInputRef = useRef<HTMLInputElement>(null);
  const canvas3dUrlInputRef = useRef<HTMLInputElement>(null);

  const applyCanvas3dUrl = useCallback(() => {
    const raw = canvas3dUrlInputRef.current?.value?.trim() ?? "";
    setCurrentSlideCanvas3dGlbUrl(raw);
  }, [setCurrentSlideCanvas3dGlbUrl]);

  const onCanvas3dFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
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

  useEffect(() => {
    if (!imgMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (imgMenuRef.current && !imgMenuRef.current.contains(e.target as Node)) {
        setImgMenuOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [imgMenuOpen]);

  /** Controles del inspector: siempre alineados con el tema de la app (dark:), no con el tema del bloque de código. */
  const controlBtn =
    "border-stone-300 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-500 dark:bg-stone-800/80 dark:text-stone-100 dark:hover:border-stone-400 dark:hover:bg-stone-700";
  const languageSelect =
    "border-stone-300 bg-white text-stone-900 dark:border-stone-500 dark:bg-stone-900 dark:text-stone-100";

  if (!currentSlide) return null;

  if (currentSlide.type !== SLIDE_TYPE.CONTENT) return null;

  const ensured = ensureSlideCanvasScene(currentSlide);
  const mediaEl = canvasMediaPanelElementId
    ? ensured.canvasScene?.elements.find((e) => e.id === canvasMediaPanelElementId)
    : undefined;
  const panelModel =
    mediaEl?.kind === "mediaPanel"
      ? slideAppearanceForMediaElement(ensured, mediaEl)
      : ensured;

  const mediaPanelKind = resolveMediaPanelDescriptor(panelModel).kind;
  const inspectorCodeTheme =
    panelModel.codeEditorTheme ?? globalCodeTheme.theme;
  const deviceId = (panelModel.presenter3dDeviceId as Device3dId) ?? DEFAULT_DEVICE_3D_ID;
  const screenMedia = panelModel.presenter3dScreenMedia ?? "image";
  const videoOk =
    Boolean(panelModel.videoUrl?.trim()) &&
    isDirectVideoTextureUrl(panelModel.videoUrl!.trim());

  const sectionTitle = (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      Propiedades del panel
    </span>
  );

  return (
    <div className="space-y-3 border-t border-stone-100 px-3 py-3 dark:border-border">
      {sectionTitle}

      {mediaPanelKind === PANEL_CONTENT_KIND.IMAGE && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => openImageModal()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition-colors hover:border-emerald-400 hover:text-emerald-700 dark:border-border dark:bg-surface dark:text-foreground dark:hover:border-emerald-600 dark:hover:text-emerald-300"
          >
            <Sparkles size={14} className="text-emerald-500" />
            Generar imagen
          </button>
          <button
            type="button"
            onClick={() => openImageUploadModal()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition-colors hover:border-emerald-400 hover:text-emerald-700 dark:border-border dark:bg-surface dark:text-foreground dark:hover:border-emerald-600 dark:hover:text-emerald-300"
          >
            <Upload size={14} />
            Subir imagen
          </button>
        </div>
      )}

      {mediaPanelKind === PANEL_CONTENT_KIND.VIDEO && (
        <button
          type="button"
          onClick={() => {
            setVideoUrlInput(panelModel.videoUrl || "");
            setShowVideoModal(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition-colors hover:border-emerald-400 hover:text-emerald-700 dark:border-border dark:bg-surface dark:text-foreground dark:hover:border-emerald-600 dark:hover:text-emerald-300"
        >
          <Video size={14} />
          {panelModel.videoUrl ? "Cambiar URL de vídeo" : "Añadir vídeo"}
        </button>
      )}

      {mediaPanelKind === PANEL_CONTENT_KIND.CANVAS_3D && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] leading-snug text-stone-500 dark:text-stone-400">
            Carga un GLB desde URL (CORS en el origen) o desde tu equipo. En vista previa y presentador
            puedes girar, hacer zoom y paneo (clic derecho o botón central).
          </p>
          <input
            ref={canvas3dFileInputRef}
            type="file"
            accept=".glb,.gltf,model/gltf-binary,application/octet-stream"
            className="hidden"
            onChange={onCanvas3dFile}
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-stone-600 dark:text-stone-300">
              URL del modelo
            </span>
            <div className="flex gap-1">
              <input
                ref={canvas3dUrlInputRef}
                type="url"
                name="canvas3d-url-inspector"
                defaultValue={
                  panelModel.canvas3dGlbUrl?.startsWith("http")
                    ? panelModel.canvas3dGlbUrl
                    : ""
                }
                key={
                  panelModel.canvas3dGlbUrl?.startsWith("http")
                    ? panelModel.canvas3dGlbUrl
                    : "canvas3d-no-http"
                }
                placeholder="https://ejemplo.com/modelo.glb"
                className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs dark:border-border dark:bg-surface dark:text-foreground"
              />
              <button
                type="button"
                onClick={applyCanvas3dUrl}
                className="shrink-0 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-medium dark:border-border dark:bg-surface"
              >
                Aplicar
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => canvas3dFileInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-medium text-stone-700 dark:border-border dark:bg-surface dark:text-foreground"
            >
              <Upload size={14} />
              Subir .glb
            </button>
            <button
              type="button"
              onClick={() => clearCurrentSlideCanvas3dViewState()}
              className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs dark:border-border dark:bg-surface"
            >
              Encuadrar
            </button>
            <button
              type="button"
              onClick={() => setCurrentSlideCanvas3dGlbUrl("")}
              className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-600 dark:border-border dark:bg-surface dark:text-stone-300"
            >
              Quitar modelo
            </button>
          </div>
        </div>
      )}

      {mediaPanelKind === PANEL_CONTENT_KIND.PRESENTER_3D && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-stone-600 dark:text-stone-300">
            <span className="font-medium">Dispositivo</span>
            <select
              value={deviceId}
              onChange={(e) =>
                setCurrentSlidePresenter3dDeviceId(e.target.value as Device3dId)
              }
              className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs dark:border-border dark:bg-surface"
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
                "flex-1 px-2 py-1.5 font-medium transition-colors",
                screenMedia === "image"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-stone-600 dark:bg-surface dark:text-stone-300",
              )}
            >
              Textura imagen
            </button>
            <button
              type="button"
              onClick={() => setCurrentSlidePresenter3dScreenMedia("video")}
              className={cn(
                "flex-1 px-2 py-1.5 font-medium transition-colors border-l border-stone-200 dark:border-border",
                screenMedia === "video"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-stone-600 dark:bg-surface dark:text-stone-300",
              )}
            >
              Textura vídeo
            </button>
          </div>
          {screenMedia === "image" ? (
            <div className="relative" ref={imgMenuRef}>
              <button
                type="button"
                onClick={() => setImgMenuOpen((v) => !v)}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 dark:border-border dark:bg-surface dark:text-foreground"
              >
                <ImageIcon size={14} />
                {panelModel.imageUrl ? "Cambiar imagen" : "Añadir imagen"}
                <ChevronDown size={14} />
              </button>
              {imgMenuOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-stone-200 bg-white py-1 shadow-lg dark:border-border dark:bg-surface-elevated">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                    onClick={() => {
                      setImgMenuOpen(false);
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
                      setImgMenuOpen(false);
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
                setVideoUrlInput(panelModel.videoUrl || "");
                setShowVideoModal(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 dark:border-border dark:bg-surface dark:text-foreground"
            >
              <Video size={14} />
              {panelModel.videoUrl ? "Cambiar vídeo (URL directa)" : "Añadir vídeo (URL directa)"}
            </button>
          )}
          {screenMedia === "video" && panelModel.videoUrl && !videoOk && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
              Para la pantalla 3D hace falta una URL directa (p. ej. MP4/WebM). YouTube o Vimeo siguen
              funcionando en el panel «Vídeo» clásico.
            </p>
          )}
        </div>
      )}

      {mediaPanelKind === PANEL_CONTENT_KIND.CODE && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Fuente</span>
            <div className="flex flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => setEditFontSize((p) => Math.max(8, p - 2))}
                className={cn(
                  "flex h-8 w-8 flex-none items-center justify-center rounded-md border text-xs font-bold",
                  controlBtn,
                )}
                title="Disminuir"
              >
                −
              </button>
              <span className="min-w-10 text-center text-xs font-bold text-emerald-800 dark:text-emerald-400">
                {editFontSize}px
              </span>
              <button
                type="button"
                onClick={() => setEditFontSize((p) => Math.min(64, p + 2))}
                className={cn(
                  "flex h-8 w-8 flex-none items-center justify-center rounded-md border text-xs font-bold",
                  controlBtn,
                )}
                title="Aumentar"
              >
                +
              </button>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-xs text-stone-600 dark:text-stone-300">
            <span className="font-medium">Lenguaje</span>
            <select
              value={editLanguage}
              onChange={(e) => setEditLanguage(e.target.value)}
              className={cn("rounded-lg border px-2 py-1.5 text-xs", languageSelect)}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (
                  canvasMediaPanelElementId &&
                  mediaPanelKind === PANEL_CONTENT_KIND.CODE
                ) {
                  cycleCodeEditorThemeForMediaPanel(canvasMediaPanelElementId);
                } else {
                  globalCodeTheme.toggleTheme();
                }
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                controlBtn,
              )}
              title={
                inspectorCodeTheme === "dark" ? "Tema claro" : "Tema oscuro"
              }
            >
              {inspectorCodeTheme === "dark" ? (
                <Sun size={14} />
              ) : (
                <Moon size={14} />
              )}
              Tema
            </button>
            <button
              type="button"
              onClick={() => openCodeGenModal()}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-600/50 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/60 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/55"
            >
              <Sparkles size={14} />
              IA
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Con el bloque del panel seleccionado en el lienzo, tema e IA también están en la barra flotante.
            Doble clic en el código para editar; al salir del campo los cambios se guardan solos (ya no hay botón
            Guardar).
          </p>
        </div>
      )}
    </div>
  );
}
