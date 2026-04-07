import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type {
  Slide,
  SlideType,
  ImageStyle,
  SavedCharacter,
  SavedPresentationMeta,
} from "../types";

const AUTO_CLOUD_SYNC_STORAGE_KEY = "slaim-auto-cloud-sync";
import { formatMarkdown } from "../utils/markdown";
import { optimizeImageDataUrl } from "../utils/imageOptimize";
import {
  generateCodeForSlide as generateCodeForSlideApi,
  generatePresenterNotes as generatePresenterNotesApi,
  generateSpeechForSlide as generateSpeechForSlideApi,
  generateSpeechForAll as generateSpeechForAllApi,
  refinePresenterNotes as refinePresenterNotesApi,
} from "../services/gemini";
import {
  generatePresentation,
  splitSlide as splitSlideUseCase,
  rewriteSlide as rewriteSlideUseCase,
  generateImagePromptAlternatives,
  generateImage as generateImageUseCase,
} from "../composition/container";
import {
  getGeminiApiKey,
  getOpenAIApiKey,
  getXaiApiKey,
  getGroqApiKey,
  getCerebrasApiKey,
  getOpenRouterApiKey,
} from "../services/apiConfig";
import {
  savePresentation,
  updatePresentation,
  listPresentations,
  loadPresentation,
  deletePresentation,
  migrateJsonPresentations,
  listCharacters,
  saveCharacter as saveCharacterStorage,
  deleteCharacter as deleteCharacterStorage,
  importSavedPresentation,
  setPresentationCloudState,
  setCharacterCloudState,
  localAccountScopeForUser,
} from "../services/storage";
import {
  pushCharacterToCloud,
  pullAllCharactersFromCloud,
  deleteCharacterFromCloud,
  CharacterCloudSyncConflictError,
} from "../services/charactersCloud";
import {
  pushPresentationToCloud,
  listCloudPresentations,
  listCloudPresentationsSharedWithMe,
  pullPresentationFromCloud,
  CloudSyncConflictError,
  type CloudPresentationListItem,
} from "../services/presentationCloud";
import { getFirebaseConfig, initFirebase } from "../services/firebase";
import {
  formatCloudSharedListError,
  formatCloudSyncUserMessage,
} from "../utils/cloudSyncErrors";
import { useAuth } from "../context/AuthContext";
import { IMAGE_STYLES } from "../constants/imageStyles";
import {
  PRESENTATION_MODELS,
  DEFAULT_PRESENTATION_MODEL_ID,
  usesChatCompletionSlideOps,
} from "../constants/presentationModels";
import {
  GEMINI_IMAGE_MODELS,
  DEFAULT_GEMINI_IMAGE_MODEL_ID,
} from "../constants/geminiImageModels";
import { DEFAULT_OPENAI_IMAGE_MODEL_ID } from "../constants/openaiImageModels";
import { trackEvent, ANALYTICS_EVENTS } from "../services/analytics";
import { DEFAULT_DEVICE_3D_ID } from "../constants/device3d";
import type { Presenter3dViewState } from "../utils/presenter3dView";

const DEFAULT_IMAGE_WIDTH_PERCENT = 40;
const DEFAULT_PANEL_HEIGHT_PERCENT = 85;

/** Clave para persistir el id de la última presentación abierta (restaurar al refrescar en /editor). */
export const LAST_OPENED_PRESENTATION_KEY = "slides-for-devs-last-opened";

export type HomeTab = "recent" | "mine" | "templates";

export function usePresentationState() {
  const { user, firebaseReady } = useAuth();
  const localAccountScope = useMemo(
    () => localAccountScopeForUser(user?.uid),
    [user?.uid]
  );
  const lastOpenedSessionKey = `${LAST_OPENED_PRESENTATION_KEY}:${localAccountScope}`;
  const prevLocalAccountScopeRef = useRef<string | null>(null);

  const [topic, setTopic] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPromptAlternatives, setIsGeneratingPromptAlternatives] =
    useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showImageUploadModal, setShowImageUploadModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showRewriteModal, setShowRewriteModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [splitPrompt, setSplitPrompt] = useState("");
  const [rewritePrompt, setRewritePrompt] = useState("");
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>(
    IMAGE_STYLES[0]
  );
  const [imageProvider, setImageProvider] = useState<"gemini" | "openai">(
    "gemini"
  );
  const [geminiImageModelId, setGeminiImageModelId] = useState(
    DEFAULT_GEMINI_IMAGE_MODEL_ID
  );
  const [includeBackground, setIncludeBackground] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editLanguage, setEditLanguage] = useState("javascript");
  const [editFontSize, setEditFontSize] = useState(14);
  const [editEditorHeight, setEditEditorHeight] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingPanelHeight, setIsResizingPanelHeight] = useState(false);
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [showSavedListModal, setShowSavedListModal] = useState(false);
  const [savedList, setSavedList] = useState<SavedPresentationMeta[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [homeTab, setHomeTab] = useState<HomeTab>("recent");
  const [showSpeechModal, setShowSpeechModal] = useState(false);
  const [speechGeneralPrompt, setSpeechGeneralPrompt] = useState("");
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNotesPanelOpen, setIsNotesPanelOpen] = useState(false);
  const [showCodeGenModal, setShowCodeGenModal] = useState(false);
  const [codeGenPrompt, setCodeGenPrompt] = useState("");
  const [codeGenLanguage, setCodeGenLanguage] = useState("javascript");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [generatingCoverId, setGeneratingCoverId] = useState<string | null>(null);
  const [coverImageCache, setCoverImageCache] = useState<Record<string, string>>({});
  const [syncingToCloudId, setSyncingToCloudId] = useState<string | null>(null);
  const [isSyncingCharactersCloud, setIsSyncingCharactersCloud] = useState(false);
  const [showCloudPresentationsModal, setShowCloudPresentationsModal] =
    useState(false);
  const [cloudPresentationsItems, setCloudPresentationsItems] = useState<
    CloudPresentationListItem[]
  >([]);
  const [cloudModalLoading, setCloudModalLoading] = useState(false);
  const [cloudModalError, setCloudModalError] = useState<string | null>(null);
  const [cloudSharedWarning, setCloudSharedWarning] = useState<string | null>(
    null
  );
  const [downloadingCloudKey, setDownloadingCloudKey] = useState<string | null>(
    null
  );
  const [sharePresentationLocalId, setSharePresentationLocalId] = useState<
    string | null
  >(null);
  const [autoCloudSyncOnSave, setAutoCloudSyncOnSaveState] = useState(() => {
    try {
      return localStorage.getItem(AUTO_CLOUD_SYNC_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [cloudSyncConflict, setCloudSyncConflict] = useState<{
    localId: string;
    cloudId: string;
    expectedRevision: number;
    remoteRevision: number;
  } | null>(null);
  /** Ref que SlideContentDiagram rellena con una función que vacía el diagrama pendiente y devuelve los datos (para guardar/vista previa). */
  const diagramFlushRef = useRef<(() => string | null) | null>(null);
  const [presentationModelId, setPresentationModelId] = useState(
    DEFAULT_PRESENTATION_MODEL_ID
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>([]);
  const [showCharacterCreatorModal, setShowCharacterCreatorModal] = useState(false);
  const [showCharactersPanel, setShowCharactersPanel] = useState(false);
  const [showSlideStylePanel, setShowSlideStylePanel] = useState(false);
  const [isGeneratingCharacterPreview, setIsGeneratingCharacterPreview] = useState(false);
  /** Cuando está setado, la presentación se está generando en segundo plano; se muestra modal y al terminar se guarda. */
  const [pendingGeneration, setPendingGeneration] = useState<{
    topic: string;
    modelId: string;
  } | null>(null);
  /** Bump para forzar re-lectura de API keys y actualizar listado de modelos al guardar en el modal. */
  const [apiKeysVersion, setApiKeysVersion] = useState(0);
  const runAutoSyncAfterSaveRef = useRef<(id: string) => Promise<void>>(
    async () => {}
  );

  const hasGemini = !!getGeminiApiKey();
  const hasOpenAI = !!getOpenAIApiKey();
  const hasXai = !!getXaiApiKey();
  const hasGroq = !!getGroqApiKey();
  const hasCerebras = !!getCerebrasApiKey();
  const hasOpenRouter = !!getOpenRouterApiKey();
  const presentationModels = useMemo(
    () =>
      PRESENTATION_MODELS.filter(
        (m) =>
          (m.provider === "gemini" && hasGemini) ||
          (m.provider === "openai" && hasOpenAI) ||
          (m.provider === "xai" && hasXai) ||
          (m.provider === "groq" && hasGroq) ||
          (m.provider === "cerebras" && hasCerebras) ||
          (m.provider === "openrouter" && hasOpenRouter)
      ),
    [
      hasGemini,
      hasOpenAI,
      hasXai,
      hasGroq,
      hasCerebras,
      hasOpenRouter,
      apiKeysVersion,
    ]
  );

  const refreshApiKeys = useCallback(() => {
    setApiKeysVersion((v) => v + 1);
  }, []);

  const setAutoCloudSyncOnSave = useCallback((value: boolean) => {
    try {
      localStorage.setItem(AUTO_CLOUD_SYNC_STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
    setAutoCloudSyncOnSaveState(value);
  }, []);

  // Modelo para operaciones Gemini (dividir, reescribir, prompt de imagen, código, notas, chat).
  // Usar siempre el modelo seleccionado en el combo cuando sea Gemini; si el combo tiene OpenAI, usar fallback.
  const presentationModelOption =
    presentationModels.find((m) => m.id === presentationModelId) ??
    PRESENTATION_MODELS.find((m) => m.id === presentationModelId);
  // Modelo usado para speech, código, notas y chat (si el combo es Gemini; si no, fallback).
  const effectiveGeminiModel =
    presentationModelOption?.provider === "gemini"
      ? presentationModelId
      : "gemini-2.5-flash";
  const modelForGeminiOps = effectiveGeminiModel?.trim() || "gemini-2.5-flash";
  const effectiveGeminiModelLabel =
    PRESENTATION_MODELS.find((m) => m.id === modelForGeminiOps)?.label ??
    modelForGeminiOps;

  const currentSlide = slides[currentIndex];
  const imageWidthPercent =
    currentSlide?.imageWidthPercent ?? DEFAULT_IMAGE_WIDTH_PERCENT;
  const panelHeightPercent =
    currentSlide?.contentLayout === "panel-full"
      ? (currentSlide?.panelHeightPercent ?? DEFAULT_PANEL_HEIGHT_PERCENT)
      : DEFAULT_PANEL_HEIGHT_PERCENT;

  // Ajustar modelo seleccionado si no está entre los permitidos (solo APIs configuradas)
  useEffect(() => {
    const allowedIds = presentationModels.map((m) => m.id);
    if (
      presentationModels.length > 0 &&
      !allowedIds.includes(presentationModelId)
    ) {
      setPresentationModelId(presentationModels[0].id);
    }
  }, [presentationModels, presentationModelId]);

  // Sincronizar proveedor de imagen con API keys disponibles (no mostrar opción sin key)
  useEffect(() => {
    if (imageProvider === "openai" && !hasOpenAI) setImageProvider("gemini");
    if (imageProvider === "gemini" && !hasGemini) setImageProvider("openai");
  }, [hasGemini, hasOpenAI]);

  // Migrar presentaciones en JSON (formato antiguo) a SQLite una vez al cargar
  useEffect(() => {
    migrateJsonPresentations().catch(() => {});
  }, []);

  /** Al iniciar/cerrar sesión, vaciar el editor: el listado local es distinto por ámbito. */
  useEffect(() => {
    if (prevLocalAccountScopeRef.current === null) {
      prevLocalAccountScopeRef.current = localAccountScope;
      return;
    }
    if (prevLocalAccountScopeRef.current === localAccountScope) return;
    prevLocalAccountScopeRef.current = localAccountScope;
    setSlides([]);
    setTopic("");
    setCurrentSavedId(null);
    setSelectedCharacterId(null);
    setCurrentIndex(0);
  }, [localAccountScope]);

  useEffect(() => {
    if (slides.length === 0) {
      listPresentations(localAccountScope)
        .then(setSavedList)
        .catch(() => setSavedList([]));
    }
  }, [slides.length, localAccountScope]);

  useEffect(() => {
    listCharacters(localAccountScope)
      .then(setSavedCharacters)
      .catch(() => setSavedCharacters([]));
  }, [localAccountScope]);

  // Generación en segundo plano: al tener pendingGeneration, llamar API, actualizar slides y guardar.
  useEffect(() => {
    const pending = pendingGeneration;
    if (!pending) return;

    let cancelled = false;
    const run = async () => {
      try {
        const generatedSlides = await generatePresentation.run(
          pending.topic,
          pending.modelId
        );
        if (cancelled) return;
        const cleanedSlides = generatedSlides.map((slide) => ({
          ...slide,
          id: crypto.randomUUID(),
          content: formatMarkdown(slide.content),
        }));
        setSlides(cleanedSlides);
        setCurrentIndex(0);
        const presentation = {
          topic: pending.topic,
          slides: cleanedSlides,
          characterId: selectedCharacterId ?? undefined,
        };
        const id = await savePresentation(presentation, localAccountScope);
        if (cancelled) return;
        setCurrentSavedId(id);
        if (
          autoCloudSyncOnSave &&
          user &&
          typeof window !== "undefined" &&
          (window as unknown as { __TAURI__?: unknown }).__TAURI__
        ) {
          void runAutoSyncAfterSaveRef.current(id);
        }
        setPendingGeneration(null);
        trackEvent(ANALYTICS_EVENTS.PRESENTATION_GENERATED, {
          slide_count: cleanedSlides.length,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Error generating presentation:", error);
        const errorMessage =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Hubo un error al generar la presentación. Por favor intenta de nuevo.";
        alert(`Error al generar la presentación:\n${errorMessage}`);
        setPendingGeneration(null);
        setSlides([]);
        setTopic("");
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [pendingGeneration, autoCloudSyncOnSave, user, localAccountScope]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const container = document.getElementById("slide-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.min(Math.max(15, 100 - (x / rect.width) * 100), 85);
      setSlides((prev) => {
        const idx = currentIndex;
        if (idx < 0 || idx >= prev.length) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], imageWidthPercent: percent };
        return updated;
      });
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
    } else {
      document.body.style.cursor = "default";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, currentIndex]);

  // Resize panel height (layout panel-full): arrastrar el borde entre título y panel
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingPanelHeight) return;
      const container = document.getElementById("slide-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percent = Math.min(
        Math.max(25, 100 - (y / rect.height) * 100),
        95
      );
      setSlides((prev) => {
        const idx = currentIndex;
        if (idx < 0 || idx >= prev.length) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], panelHeightPercent: percent };
        return updated;
      });
    };
    const handleMouseUp = () => setIsResizingPanelHeight(false);

    if (isResizingPanelHeight) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "row-resize";
    } else {
      document.body.style.cursor = "";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingPanelHeight, currentIndex]);

  useEffect(() => {
    if (currentSlide) {
      setEditTitle(currentSlide.title);
      setEditSubtitle(currentSlide.subtitle ?? "");
      setEditContent(formatMarkdown(currentSlide.content));
      setEditCode(currentSlide.code || "");
      setEditLanguage(currentSlide.language || "javascript");
      setEditFontSize(currentSlide.fontSize || 14);
      setEditEditorHeight(currentSlide.editorHeight ?? 280);
      setIsEditing(false);
    }
  }, [currentIndex, currentSlide?.id]);

  // Al cambiar de diapositiva con el modal de imagen abierto, resetear el prompt al del slide actual
  useEffect(() => {
    if (showImageModal && currentSlide) {
      setImagePrompt(currentSlide.imagePrompt || "");
    }
  }, [showImageModal, currentIndex, currentSlide?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        isEditing
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        if (currentIndex < slides.length - 1) setCurrentIndex(currentIndex + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
      } else if (e.key === "Escape" && isPreviewMode) {
        setIsPreviewMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, slides.length, isEditing, isPreviewMode]);

  const handleSaveManualEdit = () => {
    if (!currentSlide) return;
    setSlides((prevSlides) => {
      const updated = [...prevSlides];
      updated[currentIndex] = {
        ...updated[currentIndex],
        title: editTitle,
        subtitle: editSubtitle.trim() || undefined,
        content: editContent,
        code: editCode,
        language: editLanguage,
        fontSize: editFontSize,
        editorHeight: editEditorHeight,
      };
      return updated;
    });
    setIsEditing(false);
  };

  const setEditorHeightForCurrentSlide = (height: number) => {
    const clamped = Math.min(560, Math.max(120, height));
    setEditEditorHeight(clamped);
    if (currentSlide == null) return;
    setSlides((prev) => {
      const updated = [...prev];
      if (currentIndex >= 0 && currentIndex < updated.length) {
        updated[currentIndex] = {
          ...updated[currentIndex],
          editorHeight: clamped,
        };
      }
      return updated;
    });
  };

  const toggleContentType = () => {
    if (!currentSlide) return;
    let newType: NonNullable<Slide["contentType"]> = "code";
    if (currentSlide.contentType === "code") newType = "video";
    else if (currentSlide.contentType === "video") newType = "image";
    else if (currentSlide.contentType === "image") newType = "presenter3d";
    else newType = "code";

    setSlides((prev) => {
      const updated = [...prev];
      const base = { ...currentSlide, contentType: newType };
      updated[currentIndex] =
        newType === "presenter3d"
          ? {
              ...base,
              presenter3dDeviceId: base.presenter3dDeviceId ?? DEFAULT_DEVICE_3D_ID,
              presenter3dScreenMedia: base.presenter3dScreenMedia ?? "image",
            }
          : base;
      return updated;
    });
  };

  /** Cambia el tipo de la diapositiva actual: capítulo, contenido o diagrama. */
  const setCurrentSlideType = (type: SlideType) => {
    if (!currentSlide || currentSlide.type === type) return;
    setSlides((prev) => {
      const updated = [...prev];
      const next = { ...currentSlide, type };
      if (type === "chapter" || type === "diagram") {
        delete (next as Slide).contentType;
        delete (next as Slide).contentLayout;
        if (type === "diagram" && !next.excalidrawData) next.excalidrawData = "{}";
      } else {
        if (!next.contentType) next.contentType = "image";
        if (!next.contentLayout) next.contentLayout = "split";
      }
      updated[currentIndex] = next;
      return updated;
    });
  };

  /** Actualiza los datos del diagrama Excalidraw de la diapositiva actual. Solo para type "diagram". */
  const setCurrentSlideExcalidrawData = (data: string) => {
    if (!currentSlide || currentSlide.type !== "diagram") return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, excalidrawData: data };
      return updated;
    });
  };

  /** Cambia la distribución del contenido: split = con panel derecho; full = solo texto; panel-full = título + subtítulo arriba y panel a ancho completo. Solo para type "content". */
  const setCurrentSlideContentLayout = (contentLayout: "split" | "full" | "panel-full") => {
    if (!currentSlide || currentSlide.type !== "content") return;
    if (currentSlide.contentLayout === contentLayout) return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, contentLayout };
      return updated;
    });
  };

  /** Cambia el tipo de contenido del panel derecho (solo para diapositivas de contenido con layout split). */
  const setCurrentSlideContentType = (contentType: NonNullable<Slide["contentType"]>) => {
    if (!currentSlide || currentSlide.type !== "content") return;
    if (currentSlide.contentType === contentType) return;
    setSlides((prev) => {
      const updated = [...prev];
      let next: Slide = { ...currentSlide, contentType };
      if (contentType === "presenter3d") {
        next = {
          ...next,
          presenter3dDeviceId: next.presenter3dDeviceId ?? DEFAULT_DEVICE_3D_ID,
          presenter3dScreenMedia: next.presenter3dScreenMedia ?? "image",
        };
      }
      updated[currentIndex] = next;
      return updated;
    });
  };

  const setCurrentSlidePresenter3dDeviceId = (presenter3dDeviceId: string) => {
    if (!currentSlide || currentSlide.type !== "content") return;
    if (currentSlide.contentType !== "presenter3d") return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, presenter3dDeviceId };
      return updated;
    });
  };

  const setCurrentSlidePresenter3dScreenMedia = (
    presenter3dScreenMedia: "image" | "video"
  ) => {
    if (!currentSlide || currentSlide.type !== "content") return;
    if (currentSlide.contentType !== "presenter3d") return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, presenter3dScreenMedia };
      return updated;
    });
  };

  const setCurrentSlidePresenter3dViewState = (presenter3dViewState: Presenter3dViewState) => {
    if (!currentSlide || currentSlide.type !== "content") return;
    if (currentSlide.contentType !== "presenter3d") return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, presenter3dViewState };
      return updated;
    });
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) return;
    const placeholderSlide: Slide = {
      id: crypto.randomUUID(),
      type: "content",
      title: "Generando…",
      content: "Preparando tu presentación.",
    };
    setTopic(trimmedTopic);
    setSlides([placeholderSlide]);
    setCurrentIndex(0);
    setPendingGeneration({ topic: trimmedTopic, modelId: presentationModelId });
  };

  const handleImageGenerate = async () => {
    if (!imagePrompt.trim() || !currentSlide) return;
    setIsGeneratingImage(true);
    const slideContext = `Título: ${currentSlide.title}. Contenido: ${currentSlide.content}`;
    const character = selectedCharacterId
      ? savedCharacters.find((c) => c.id === selectedCharacterId)
      : undefined;
    const characterPrompt = character?.description;
    const characterReferenceImageDataUrl =
      imageProvider === "gemini" ? character?.referenceImageDataUrl : undefined;
    const characterReferenceImageForOpenAI =
      imageProvider === "openai" ? character?.referenceImageDataUrl : undefined;
    const imageModelId =
      imageProvider === "gemini" ? geminiImageModelId : DEFAULT_OPENAI_IMAGE_MODEL_ID;
    try {
      const imageUrl = await generateImageUseCase.run({
        providerId: imageProvider,
        slideContext,
        userPrompt: imagePrompt,
        stylePrompt: selectedStyle.prompt,
        includeBackground,
        modelId: imageModelId,
        characterPrompt,
        characterReferenceImageDataUrl:
          imageProvider === "openai"
            ? characterReferenceImageForOpenAI
            : characterReferenceImageDataUrl,
      });
      if (imageUrl) {
        const promptUsed = imagePrompt.trim();
        setSlides((prev) => {
          const updated = [...prev];
          updated[currentIndex] = {
            ...currentSlide,
            imageUrl,
            imagePrompt: promptUsed,
          };
          return updated;
        });
        setShowImageModal(false);
        setImagePrompt("");
        trackEvent(ANALYTICS_EVENTS.IMAGE_GENERATED);
      }
    } catch (error) {
      console.error("Error generating image:", error);
      alert("Error al generar la imagen.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleGeneratePromptAlternatives = async () => {
    if (!currentSlide) return;
    setIsGeneratingPromptAlternatives(true);
    const slideContext = `Título: ${currentSlide.title}. Contenido: ${currentSlide.content}`;
    const characterPrompt = selectedCharacterId
      ? savedCharacters.find((c) => c.id === selectedCharacterId)?.description
      : undefined;
    const modelId = usesChatCompletionSlideOps(presentationModelOption?.provider)
      ? presentationModelId
      : effectiveGeminiModel;
    try {
      const alternative = await generateImagePromptAlternatives.run(
        slideContext,
        imagePrompt,
        selectedStyle.name,
        selectedStyle.prompt,
        modelId,
        characterPrompt,
        includeBackground
      );
      if (alternative) setImagePrompt(alternative);
    } catch (error) {
      console.error("Error generating prompt alternatives:", error);
      alert("No se pudo generar una alternativa de prompt.");
    } finally {
      setIsGeneratingPromptAlternatives(false);
    }
  };

  const handleSplitSlide = async () => {
    if (!splitPrompt.trim() || !currentSlide) return;
    setIsProcessing(true);
    const modelId = usesChatCompletionSlideOps(presentationModelOption?.provider)
      ? presentationModelId
      : effectiveGeminiModel;
    try {
      const newSlides = await splitSlideUseCase.run(
        currentSlide,
        splitPrompt,
        modelId
      );
      if (newSlides.length > 0) {
        const cleanedNewSlides = newSlides.map((slide) => ({
          ...slide,
          id: crypto.randomUUID(),
          content: formatMarkdown(slide.content),
        }));
        setSlides((prev) => {
          const updated = [...prev];
          updated.splice(currentIndex, 1, ...cleanedNewSlides);
          return updated;
        });
        setShowSplitModal(false);
        setSplitPrompt("");
        trackEvent(ANALYTICS_EVENTS.SLIDE_SPLIT, {
          new_slides_count: cleanedNewSlides.length,
        });
      }
    } catch (error) {
      console.error("Error splitting slide:", error);
      alert("Error al dividir la diapositiva.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRewriteSlide = async () => {
    if (!rewritePrompt.trim() || !currentSlide) return;
    setIsProcessing(true);
    const modelId = usesChatCompletionSlideOps(presentationModelOption?.provider)
      ? presentationModelId
      : effectiveGeminiModel;
    try {
      const result = await rewriteSlideUseCase.run(
        currentSlide,
        rewritePrompt,
        modelId
      );
      const formattedContent = formatMarkdown(result.content);
      setSlides((prev) => {
        const updated = [...prev];
        const slide = updated[currentIndex];
        if (!slide) return prev;
        updated[currentIndex] = {
          ...slide,
          title: result.title,
          content: formattedContent,
        };
        return updated;
      });
      setEditTitle(result.title);
      setEditContent(formattedContent);
      setShowRewriteModal(false);
      setRewritePrompt("");
      trackEvent(ANALYTICS_EVENTS.SLIDE_REWRITTEN);
    } catch (error) {
      console.error("Error rewriting slide:", error);
      alert("Error al replantear la diapositiva.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveVideoUrl = () => {
    if (!videoUrlInput.trim() || !currentSlide) return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...currentSlide,
        videoUrl: videoUrlInput.trim(),
        contentType: "video",
      };
      return updated;
    });
    setShowVideoModal(false);
    setVideoUrlInput("");
    trackEvent(ANALYTICS_EVENTS.VIDEO_ADDED);
  };

  const flushDiagramPending = useCallback((): string | null => {
    return diagramFlushRef.current?.() ?? null;
  }, []);

  const refreshSavedList = useCallback(async () => {
    try {
      const list = await listPresentations(localAccountScope);
      setSavedList(list);
    } catch {
      setSavedList([]);
    }
  }, [localAccountScope]);

  const maybeAutoSyncAfterLocalSave = useCallback(
    async (localId: string) => {
      if (!autoCloudSyncOnSave || !user) return;
      if (
        typeof window === "undefined" ||
        (window as unknown as { __TAURI__?: unknown }).__TAURI__ === undefined
      )
        return;
      const fb = await initFirebase();
      if (!fb?.firestore) return;
      let meta: SavedPresentationMeta | undefined;
      try {
        const list = await listPresentations(localAccountScope);
        meta = list.find((p) => p.id === localId);
        const saved = await loadPresentation(localId, localAccountScope);
        const existingCloudId = meta?.cloudId ?? null;
        const { cloudId, syncedAt, newRevision } = await pushPresentationToCloud(
          user.uid,
          saved,
          existingCloudId,
          {
            localExpectedRevision:
              existingCloudId != null ? (meta?.cloudRevision ?? 0) : null,
          }
        );
        await setPresentationCloudState(
          localId,
          cloudId,
          syncedAt,
          newRevision,
          localAccountScope
        );
        await refreshSavedList();
      } catch (e) {
        if (e instanceof CloudSyncConflictError) {
          setCloudSyncConflict({
            localId,
            cloudId: meta?.cloudId ?? "",
            expectedRevision: e.expectedRevision,
            remoteRevision: e.remoteRevision,
          });
        } else {
          console.error("Auto-sync nube:", e);
        }
      }
    },
    [user, autoCloudSyncOnSave, refreshSavedList, localAccountScope]
  );

  runAutoSyncAfterSaveRef.current = maybeAutoSyncAfterLocalSave;

  /** Guarda una presentación con el payload dado; si no hay currentSavedId, crea uno y lo asigna. Devuelve el id guardado. */
  const savePresentationNow = useCallback(
    async (presentation: {
      topic: string;
      slides: Slide[];
      characterId?: string;
    }): Promise<string | null> => {
      if (presentation.slides.length === 0) return null;
      let savedId: string | null = null;
      try {
        if (currentSavedId) {
          await updatePresentation(
            currentSavedId,
            presentation,
            localAccountScope
          );
          savedId = currentSavedId;
          setSaveMessage("Guardado");
          try {
            sessionStorage.setItem(lastOpenedSessionKey, currentSavedId);
          } catch {
            // ignore
          }
        } else {
          const id = await savePresentation(presentation, localAccountScope);
          setCurrentSavedId(id);
          savedId = id;
          setSaveMessage("Guardado");
          try {
            sessionStorage.setItem(lastOpenedSessionKey, id);
          } catch {
            // ignore
          }
        }
        trackEvent(ANALYTICS_EVENTS.PRESENTATION_SAVED);
        setTimeout(() => setSaveMessage(null), 2000);
        if (
          savedId &&
          autoCloudSyncOnSave &&
          user &&
          typeof window !== "undefined" &&
          (window as unknown as { __TAURI__?: unknown }).__TAURI__
        ) {
          void maybeAutoSyncAfterLocalSave(savedId);
        }
      } catch (e) {
        console.error(e);
        setSaveMessage("Error al guardar");
        return null;
      }
      return savedId;
    },
    [
      currentSavedId,
      autoCloudSyncOnSave,
      user,
      maybeAutoSyncAfterLocalSave,
      localAccountScope,
      lastOpenedSessionKey,
    ]
  );

  const handleSave = async () => {
    if (slides.length === 0) return;
    const pendingDiagram = flushDiagramPending();
    const slidesToSave =
      pendingDiagram != null && currentSlide?.type === "diagram"
        ? slides.map((s, i) =>
            i === currentIndex ? { ...s, excalidrawData: pendingDiagram } : s
          )
        : slides;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await savePresentationNow({
        topic: topic || "Sin título",
        slides: slidesToSave,
        characterId: selectedCharacterId ?? undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncPresentationToCloud = useCallback(
    async (localId: string) => {
      if (!user) {
        alert("Inicia sesión para sincronizar con la nube.");
        return;
      }
      const fb = await initFirebase();
      if (!fb?.firestore) {
        alert("Firebase no está configurado.");
        return;
      }
      setSyncingToCloudId(localId);
      try {
        const list = await listPresentations(localAccountScope);
        const meta = list.find((p) => p.id === localId);
        const saved = await loadPresentation(localId, localAccountScope);
        const existingCloudId = meta?.cloudId ?? null;
        const { cloudId, syncedAt, newRevision } = await pushPresentationToCloud(
          user.uid,
          saved,
          existingCloudId,
          {
            localExpectedRevision:
              existingCloudId != null ? (meta?.cloudRevision ?? 0) : null,
          }
        );
        await setPresentationCloudState(
          localId,
          cloudId,
          syncedAt,
          newRevision,
          localAccountScope
        );
        await refreshSavedList();
      } catch (e) {
        if (e instanceof CloudSyncConflictError) {
          const list = await listPresentations(localAccountScope).catch(
            () => []
          );
          const meta = list.find((p) => p.id === localId);
          setCloudSyncConflict({
            localId,
            cloudId: meta?.cloudId ?? "",
            expectedRevision: e.expectedRevision,
            remoteRevision: e.remoteRevision,
          });
        } else {
          console.error(e);
          alert(`No se pudo sincronizar: ${formatCloudSyncUserMessage(e)}`);
        }
      } finally {
        setSyncingToCloudId(null);
      }
    },
    [user, refreshSavedList, localAccountScope]
  );

  const openCloudPresentationsModal = useCallback(async () => {
    if (!user) {
      alert("Inicia sesión para ver la nube.");
      return;
    }
    const fb = await initFirebase();
    if (!fb?.firestore) {
      alert("Firebase no está configurado.");
      return;
    }
    setShowCloudPresentationsModal(true);
    setCloudModalError(null);
    setCloudSharedWarning(null);
    setCloudModalLoading(true);
    setCloudPresentationsItems([]);
    try {
      const mine = await listCloudPresentations(user.uid);
      let shared: CloudPresentationListItem[] = [];
      try {
        shared = await listCloudPresentationsSharedWithMe(user.uid);
      } catch (shareErr) {
        console.warn(
          "Listado de presentaciones compartidas omitido (reglas, índice o permisos):",
          shareErr
        );
        const cfg = await getFirebaseConfig();
        setCloudSharedWarning(
          formatCloudSharedListError(shareErr, cfg?.projectId)
        );
      }
      setCloudPresentationsItems([...mine, ...shared]);
    } catch (e) {
      console.error(e);
      setCloudModalError(formatCloudSyncUserMessage(e));
    } finally {
      setCloudModalLoading(false);
    }
  }, [user]);

  const openSavedListModal = async () => {
    setShowSavedListModal(true);
    try {
      const list = await listPresentations(localAccountScope);
      setSavedList(list);
    } catch (e) {
      console.error(e);
      setSavedList([]);
    }
  };

  const handleOpenSaved = async (id: string) => {
    try {
      const saved = await loadPresentation(id, localAccountScope);
      setTopic(saved.topic);
      setSlides(
        saved.slides.map((s) => ({
          ...s,
          id: crypto.randomUUID(),
          content: formatMarkdown(s.content ?? ""),
        }))
      );
      setCurrentIndex(0);
      setCurrentSavedId(saved.id);
      setSelectedCharacterId(saved.characterId ?? null);
      setShowSavedListModal(false);
      try {
        sessionStorage.setItem(lastOpenedSessionKey, id);
      } catch {
        // ignore
      }
      const firstImage = saved.slides[0]?.imageUrl;
      if (firstImage) {
        setCoverImageCache((prev) => ({ ...prev, [saved.id]: firstImage }));
      }
      trackEvent(ANALYTICS_EVENTS.PRESENTATION_OPENED);
    } catch (e) {
      console.error(e);
      alert("No se pudo abrir la presentación.");
    }
  };

  const handleDownloadFromCloud = useCallback(
    async (cloudId: string, ownerUid?: string) => {
      if (!user) return;
      const owner = ownerUid ?? user.uid;
      const isSharedFromOther = owner !== user.uid;
      const existing =
        !isSharedFromOther && savedList.find((p) => p.cloudId === cloudId);
      if (existing) {
        await handleOpenSaved(existing.id);
        setShowCloudPresentationsModal(false);
        return;
      }
      const dlKey = `${owner}::${cloudId}`;
      setDownloadingCloudKey(dlKey);
      try {
        const { presentation: pulled, cloudRevision } =
          await pullPresentationFromCloud(owner, cloudId);
        const localId = crypto.randomUUID();
        await importSavedPresentation(
          {
            ...pulled,
            id: localId,
          },
          localAccountScope
        );
        if (isSharedFromOther) {
          await setPresentationCloudState(
            localId,
            null,
            null,
            null,
            localAccountScope
          );
        } else {
          await setPresentationCloudState(
            localId,
            cloudId,
            new Date().toISOString(),
            cloudRevision,
            localAccountScope
          );
        }
        await refreshSavedList();
        setShowCloudPresentationsModal(false);
        await handleOpenSaved(localId);
      } catch (e) {
        console.error(e);
        alert(`Error al descargar: ${formatCloudSyncUserMessage(e)}`);
      } finally {
        setDownloadingCloudKey(null);
      }
    },
    [user, savedList, refreshSavedList, handleOpenSaved, localAccountScope]
  );

  const openSharePresentationModal = useCallback((localId: string) => {
    setSharePresentationLocalId(localId);
  }, []);

  const closeSharePresentationModal = useCallback(() => {
    setSharePresentationLocalId(null);
  }, []);

  /** Restaura la última presentación abierta (desde sessionStorage). Usado al cargar /editor tras refresco. */
  const restoreLastOpenedPresentation = useCallback(async (): Promise<boolean> => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem(lastOpenedSessionKey);
    } catch {
      return false;
    }
    if (!id) return false;
    try {
      const saved = await loadPresentation(id, localAccountScope);
      setTopic(saved.topic);
      setSlides(
        saved.slides.map((s) => ({
          ...s,
          id: crypto.randomUUID(),
          content: formatMarkdown(s.content ?? ""),
        }))
      );
      setCurrentIndex(0);
      setCurrentSavedId(saved.id);
      setSelectedCharacterId(saved.characterId ?? null);
      const firstImage = saved.slides[0]?.imageUrl;
      if (firstImage) {
        setCoverImageCache((prev) => ({ ...prev, [saved.id]: firstImage }));
      }
      return true;
    } catch {
      try {
        sessionStorage.removeItem(lastOpenedSessionKey);
      } catch {
        // ignore
      }
      return false;
    }
  }, [formatMarkdown, lastOpenedSessionKey, localAccountScope]);

  const handleDeleteSaved = async (id: string) => {
    if (!confirm("¿Eliminar esta presentación guardada?")) return;
    try {
      await deletePresentation(id, localAccountScope);
      if (currentSavedId === id) {
        setCurrentSavedId(null);
        setTopic("");
        setSlides([]);
      }
      setSavedList((prev) => prev.filter((p) => p.id !== id));
      setCoverImageCache((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      console.error(e);
      alert("Error al eliminar.");
    }
  };

  const handleGenerateCoverForPresentation = async (id: string) => {
    setGeneratingCoverId(id);
    try {
      const saved = await loadPresentation(id, localAccountScope);
      if (!saved.slides.length) {
        alert("Esta presentación no tiene diapositivas.");
        return;
      }
      const firstSlide = saved.slides[0];
      const slideContext = `Título: ${firstSlide.title}. Contenido: ${firstSlide.content}. Presentación sobre: ${saved.topic}`;
      const coverPrompt = "Portada profesional y moderna para esta presentación, estilo minimalista y atractivo, sin texto.";
      const coverCharacter = saved.characterId
        ? savedCharacters.find((c) => c.id === saved.characterId)
        : undefined;
      const characterPrompt = coverCharacter?.description;
      const characterReferenceImageDataUrl =
        imageProvider === "gemini" ? coverCharacter?.referenceImageDataUrl : undefined;
      const coverCharacterImageForOpenAI =
        imageProvider === "openai" ? coverCharacter?.referenceImageDataUrl : undefined;
      const imageModelId =
        imageProvider === "gemini" ? geminiImageModelId : DEFAULT_OPENAI_IMAGE_MODEL_ID;
      const imageUrl = await generateImageUseCase.run({
        providerId: imageProvider,
        slideContext,
        userPrompt: coverPrompt,
        stylePrompt: selectedStyle.prompt,
        includeBackground,
        modelId: imageModelId,
        characterPrompt,
        characterReferenceImageDataUrl:
          imageProvider === "openai"
            ? coverCharacterImageForOpenAI
            : characterReferenceImageDataUrl,
      });
      if (imageUrl) {
        const updatedSlides = [...saved.slides];
        updatedSlides[0] = {
          ...firstSlide,
          imageUrl,
          imagePrompt: coverPrompt,
        };
        await updatePresentation(
          id,
          {
            topic: saved.topic,
            slides: updatedSlides,
            characterId: saved.characterId,
          },
          localAccountScope
        );
        if (
          autoCloudSyncOnSave &&
          user &&
          typeof window !== "undefined" &&
          (window as unknown as { __TAURI__?: unknown }).__TAURI__
        ) {
          void runAutoSyncAfterSaveRef.current(id);
        }
        setCoverImageCache((prev) => ({ ...prev, [id]: imageUrl }));
        trackEvent(ANALYTICS_EVENTS.COVER_GENERATED);
      } else {
        alert("No se pudo generar la imagen. Comprueba tu API key de Gemini o OpenAI.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al generar la portada. Comprueba la consola y tu configuración de API.");
    } finally {
      setGeneratingCoverId(null);
    }
  };

  const dismissCloudSyncConflict = useCallback(
    () => setCloudSyncConflict(null),
    []
  );

  const resolveCloudConflictUseRemote = useCallback(async () => {
    if (!cloudSyncConflict || !user) return;
    const { localId, cloudId } = cloudSyncConflict;
    if (!cloudId) {
      alert("No hay vínculo con la nube. Sincroniza manualmente primero.");
      setCloudSyncConflict(null);
      return;
    }
    setCloudSyncConflict(null);
    try {
      const { presentation, cloudRevision } = await pullPresentationFromCloud(
        user.uid,
        cloudId
      );
      await updatePresentation(
        localId,
        {
          topic: presentation.topic,
          slides: presentation.slides,
          characterId: presentation.characterId,
        },
        localAccountScope
      );
      await setPresentationCloudState(
        localId,
        cloudId,
        new Date().toISOString(),
        cloudRevision,
        localAccountScope
      );
      if (currentSavedId === localId) {
        setTopic(presentation.topic);
        setSlides(
          presentation.slides.map((s) => ({
            ...s,
            id: crypto.randomUUID(),
            content: formatMarkdown(s.content ?? ""),
          }))
        );
        setSelectedCharacterId(presentation.characterId ?? null);
      }
      await refreshSavedList();
    } catch (e) {
      console.error(e);
      alert(`No se pudo traer la versión de la nube: ${formatCloudSyncUserMessage(e)}`);
    }
  }, [
    cloudSyncConflict,
    user,
    currentSavedId,
    formatMarkdown,
    refreshSavedList,
    localAccountScope,
  ]);

  const resolveCloudConflictForceLocal = useCallback(async () => {
    if (!cloudSyncConflict || !user) return;
    const { localId, cloudId } = cloudSyncConflict;
    setCloudSyncConflict(null);
    try {
      const saved = await loadPresentation(localId, localAccountScope);
      const cid =
        cloudId ||
        (await listPresentations(localAccountScope)).find(
          (p) => p.id === localId
        )?.cloudId;
      if (!cid) {
        alert("Falta vínculo con la nube.");
        return;
      }
      const { cloudId: outId, syncedAt, newRevision } =
        await pushPresentationToCloud(user.uid, saved, cid, {
          localExpectedRevision: 0,
          force: true,
        });
      await setPresentationCloudState(
        localId,
        outId,
        syncedAt,
        newRevision,
        localAccountScope
      );
      await refreshSavedList();
    } catch (e) {
      console.error(e);
      alert(`No se pudo forzar la subida: ${formatCloudSyncUserMessage(e)}`);
    }
  }, [cloudSyncConflict, user, refreshSavedList, localAccountScope]);

  const goHome = () => {
    setSlides([]);
    setTopic("");
    setCurrentSavedId(null);
    setSelectedCharacterId(null);
    try {
      sessionStorage.removeItem(lastOpenedSessionKey);
    } catch {
      // ignore
    }
  };

  const refreshSavedCharacters = useCallback(() => {
    listCharacters(localAccountScope)
      .then(setSavedCharacters)
      .catch(() => setSavedCharacters([]));
  }, [localAccountScope]);

  const handleSaveCharacter = async (incoming: SavedCharacter) => {
    const existing = savedCharacters.find((c) => c.id === incoming.id);
    let referenceImageDataUrl = incoming.referenceImageDataUrl;
    if (referenceImageDataUrl?.startsWith("data:")) {
      try {
        referenceImageDataUrl = await optimizeImageDataUrl(referenceImageDataUrl);
      } catch {
        /* mantener */
      }
    }
    const toSave: SavedCharacter = {
      ...incoming,
      referenceImageDataUrl,
      cloudRevision: incoming.cloudRevision ?? existing?.cloudRevision,
      cloudSyncedAt: incoming.cloudSyncedAt ?? existing?.cloudSyncedAt,
    };
    await saveCharacterStorage(toSave, localAccountScope);
    refreshSavedCharacters();
    trackEvent(ANALYTICS_EVENTS.CHARACTER_SAVED);

    if (
      autoCloudSyncOnSave &&
      user &&
      typeof window !== "undefined" &&
      (window as unknown as { __TAURI__?: unknown }).__TAURI__
    ) {
      const fb = await initFirebase();
      if (fb?.firestore) {
        try {
          const list = await listCharacters(localAccountScope);
          const c = list.find((x) => x.id === toSave.id) ?? toSave;
          const { syncedAt, newRevision } = await pushCharacterToCloud(
            user.uid,
            c,
            { localExpectedRevision: c.cloudRevision ?? null }
          );
          await setCharacterCloudState(
            c.id,
            syncedAt,
            newRevision,
            localAccountScope
          );
          listCharacters(localAccountScope)
            .then(setSavedCharacters)
            .catch(() => undefined);
        } catch (e) {
          if (e instanceof CharacterCloudSyncConflictError) {
            console.warn("Auto-sync personaje: conflicto de revisión", e.characterId);
          } else {
            console.error("Auto-sync personaje:", e);
          }
        }
      }
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    const char = savedCharacters.find((c) => c.id === id);
    if (
      user &&
      (char?.cloudRevision != null || char?.cloudSyncedAt) &&
      typeof window !== "undefined" &&
      (window as unknown as { __TAURI__?: unknown }).__TAURI__
    ) {
      try {
        await deleteCharacterFromCloud(user.uid, id);
      } catch (e) {
        console.error("Eliminar personaje en la nube:", e);
      }
    }
    await deleteCharacterStorage(id, localAccountScope);
    if (selectedCharacterId === id) setSelectedCharacterId(null);
    refreshSavedCharacters();
  };

  const handlePushAllCharactersToCloud = useCallback(async () => {
    if (!user) return;
    setIsSyncingCharactersCloud(true);
    try {
      const chars = await listCharacters(localAccountScope);
      let ok = 0;
      const conflicts: string[] = [];
      for (const c of chars) {
        try {
          const { syncedAt, newRevision } = await pushCharacterToCloud(
            user.uid,
            c,
            { localExpectedRevision: c.cloudRevision ?? null }
          );
          await setCharacterCloudState(
            c.id,
            syncedAt,
            newRevision,
            localAccountScope
          );
          ok++;
        } catch (e) {
          if (e instanceof CharacterCloudSyncConflictError) {
            conflicts.push(c.name);
          } else {
            throw e;
          }
        }
      }
      refreshSavedCharacters();
      if (conflicts.length) {
        alert(
          `Subidos ${ok} personaje(s). Conflicto de versión en: ${conflicts.join(", ")}. Trae desde la nube o vuelve a subir tras alinear.`
        );
      } else if (ok > 0) {
        alert(`Subidos ${ok} personaje(s) a la nube.`);
      } else {
        alert("No hay personajes locales para subir.");
      }
    } catch (e) {
      console.error(e);
      alert(
        `Error al subir personajes: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setIsSyncingCharactersCloud(false);
    }
  }, [user, refreshSavedCharacters, localAccountScope]);

  const handlePullCharactersFromCloud = useCallback(async () => {
    if (!user) return;
    setIsSyncingCharactersCloud(true);
    try {
      const remote = await pullAllCharactersFromCloud(user.uid);
      for (const r of remote) {
        await saveCharacterStorage(r, localAccountScope);
      }
      refreshSavedCharacters();
      alert(
        remote.length
          ? `Actualizados ${remote.length} personaje(s) desde la nube (por id). Los que solo existían localmente se mantienen.`
          : "No hay personajes en la nube."
      );
    } catch (e) {
      console.error(e);
      alert(
        `Error al traer personajes: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setIsSyncingCharactersCloud(false);
    }
  }, [user, refreshSavedCharacters, localAccountScope]);

  /** Genera una vista previa del personaje (solo la imagen, sin asignar a slide). Contexto fijo para personaje aislado. */
  const generateCharacterPreview = async (
    characterDescription: string
  ): Promise<string | undefined> => {
    if (!characterDescription.trim()) return undefined;
    setIsGeneratingCharacterPreview(true);
    try {
      const context =
        "Personaje aislado para usar en presentaciones. Debe ser el mismo personaje en todas las escenas. Fondo limpio.";
      const imageModelId =
        imageProvider === "gemini" ? geminiImageModelId : DEFAULT_OPENAI_IMAGE_MODEL_ID;
      return generateImageUseCase.run({
        providerId: imageProvider,
        slideContext: context,
        userPrompt: characterDescription.trim(),
        stylePrompt: selectedStyle.prompt,
        includeBackground: true,
        modelId: imageModelId,
      });
    } finally {
      setIsGeneratingCharacterPreview(false);
    }
  };

  const deleteSlideAt = (index: number) => {
    if (index < 0 || index >= slides.length || slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, i) => i !== index));
    setCurrentIndex((prev) => {
      if (prev === index) return Math.max(0, index - 1);
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  const insertSlideAfter = (index: number) => {
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      type: "content",
      title: "Nueva diapositiva",
      content: "",
    };
    const next = [
      ...slides.slice(0, index + 1),
      newSlide,
      ...slides.slice(index + 1),
    ];
    setSlides(next);
    setCurrentIndex(index + 1);
    savePresentationNow({
      topic: topic || "Sin título",
      slides: next,
      characterId: selectedCharacterId ?? undefined,
    });
  };

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const prevSlide = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const openImageModal = () => {
    setImagePrompt(currentSlide?.imagePrompt || "");
    setShowImageModal(true);
  };

  const openImageUploadModal = () => {
    setShowImageUploadModal(true);
  };

  const handleImageUpload = (file: File) => {
    if (!currentSlide) return;
    const index = currentIndex;
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        let dataUrl = reader.result as string;
        try {
          dataUrl = await optimizeImageDataUrl(dataUrl);
        } catch {
          /* mantener original */
        }
        setSlides((prev) => {
          const updated = [...prev];
          const cur = updated[index];
          if (!cur) return prev;
          updated[index] = { ...cur, imageUrl: dataUrl };
          return updated;
        });
        setShowImageUploadModal(false);
      })();
    };
    reader.readAsDataURL(file);
  };

  const openCodeGenModal = () => {
    setCodeGenLanguage(currentSlide?.language || "javascript");
    setCodeGenPrompt("");
    setShowCodeGenModal(true);
  };

  const handleGenerateCode = async () => {
    if (!currentSlide) return;
    setIsGeneratingCode(true);
    try {
      const { code } = await generateCodeForSlideApi(
        currentSlide,
        codeGenLanguage,
        codeGenPrompt.trim() || undefined,
        modelForGeminiOps
      );
      setSlides((prev) => {
        const updated = [...prev];
        updated[currentIndex] = {
          ...currentSlide,
          code,
          language: codeGenLanguage,
          contentType: "code",
        };
        return updated;
      });
      setEditCode(code);
      setEditLanguage(codeGenLanguage);
      setShowCodeGenModal(false);
      setCodeGenPrompt("");
      trackEvent(ANALYTICS_EVENTS.CODE_GENERATED);
    } catch (error) {
      console.error("Error generating code:", error);
      alert("Error al generar el código. Intenta de nuevo.");
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const setPresenterNotesForCurrentSlide = (notes: string) => {
    if (!currentSlide) return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = {
        ...updated[currentIndex],
        presenterNotes: notes,
      };
      return updated;
    });
  };

  const handleGeneratePresenterNotes = async () => {
    if (!currentSlide) return;
    setIsProcessing(true);
    try {
      const notes = await generatePresenterNotesApi(
        currentSlide,
        modelForGeminiOps
      );
      setPresenterNotesForCurrentSlide(notes);
      trackEvent(ANALYTICS_EVENTS.PRESENTER_NOTES_GENERATED);
    } catch (e) {
      console.error(e);
      alert("Error al generar las notas del presentador.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateSpeechForCurrentSlide = async (prompt?: string) => {
    if (!currentSlide) return;
    setIsGeneratingSpeech(true);
    try {
      const text = await generateSpeechForSlideApi(
        currentSlide,
        prompt,
        modelForGeminiOps
      );
      setPresenterNotesForCurrentSlide(text);
      trackEvent(ANALYTICS_EVENTS.SPEECH_SLIDE_GENERATED);
    } catch (e) {
      console.error(e);
      alert("Error al generar el contenido.");
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const handleRefinePresenterNotes = async () => {
    if (!currentSlide) return;
    const current = (currentSlide.presenterNotes ?? "").trim();
    if (!current) {
      alert("Escribe o genera primero el contenido para refinar.");
      return;
    }
    setIsGeneratingSpeech(true);
    try {
      const refined = await refinePresenterNotesApi(
        currentSlide,
        current,
        modelForGeminiOps
      );
      setPresenterNotesForCurrentSlide(refined);
    } catch (e) {
      console.error(e);
      alert("Error al refinar las notas.");
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const handleGenerateSpeechForAll = async () => {
    if (slides.length === 0 || !speechGeneralPrompt.trim()) return;
    setIsGeneratingSpeech(true);
    try {
      const results = await generateSpeechForAllApi(
        slides,
        speechGeneralPrompt,
        modelForGeminiOps
      );
      setSlides((prev) =>
        prev.map((s, i) => ({
          ...s,
          presenterNotes: results[i] ?? s.presenterNotes ?? "",
        }))
      );
      setShowSpeechModal(false);
      setSpeechGeneralPrompt("");
      trackEvent(ANALYTICS_EVENTS.SPEECH_ALL_GENERATED, {
        slide_count: slides.length,
      });
    } catch (e) {
      console.error(e);
      alert("Error al generar para todas las diapositivas.");
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  return {
    topic,
    setTopic,
    presentationModelId,
    setPresentationModelId,
    presentationModels,
    effectiveGeminiModel,
    effectiveGeminiModelLabel,
    slides,
    setSlides,
    currentIndex,
    setCurrentIndex,
    currentSlide,
    imageWidthPercent,
    DEFAULT_IMAGE_WIDTH_PERCENT,
    panelHeightPercent,
    isResizingPanelHeight,
    setIsResizingPanelHeight,
    isLoading,
    isGeneratingImage,
    isGeneratingPromptAlternatives,
    isProcessing,
    showImageModal,
    setShowImageModal,
    showImageUploadModal,
    setShowImageUploadModal,
    showSplitModal,
    setShowSplitModal,
    showRewriteModal,
    setShowRewriteModal,
    showVideoModal,
    setShowVideoModal,
    imagePrompt,
    setImagePrompt,
    splitPrompt,
    setSplitPrompt,
    rewritePrompt,
    setRewritePrompt,
    videoUrlInput,
    setVideoUrlInput,
    selectedStyle,
    setSelectedStyle,
    imageProvider,
    setImageProvider,
    geminiImageModelId,
    setGeminiImageModelId,
    geminiImageModels: GEMINI_IMAGE_MODELS,
    includeBackground,
    setIncludeBackground,
    selectedCharacterId,
    setSelectedCharacterId,
    savedCharacters,
    refreshSavedCharacters,
    saveCharacter: handleSaveCharacter,
    deleteCharacter: handleDeleteCharacter,
    showCharacterCreatorModal,
    setShowCharacterCreatorModal,
    showCharactersPanel,
    setShowCharactersPanel,
    showSlideStylePanel,
    setShowSlideStylePanel,
    isGeneratingCharacterPreview,
    generateCharacterPreview,
    isPreviewMode,
    setIsPreviewMode,
    diagramFlushRef,
    flushDiagramPending,
    isEditing,
    setIsEditing,
    editTitle,
    setEditTitle,
    editSubtitle,
    setEditSubtitle,
    editContent,
    setEditContent,
    editCode,
    setEditCode,
    editLanguage,
    setEditLanguage,
    editFontSize,
    setEditFontSize,
    editEditorHeight,
    setEditEditorHeight,
    setEditorHeightForCurrentSlide,
    isResizing,
    setIsResizing,
    currentSavedId,
    showSavedListModal,
    setShowSavedListModal,
    savedList,
    isSaving,
    saveMessage,
    homeTab,
    setHomeTab,
    formatMarkdown,
    handleSaveManualEdit,
    toggleContentType,
    setCurrentSlideType,
    setCurrentSlideExcalidrawData,
    setCurrentSlideContentLayout,
    setCurrentSlideContentType,
    setCurrentSlidePresenter3dDeviceId,
    setCurrentSlidePresenter3dScreenMedia,
    setCurrentSlidePresenter3dViewState,
    handleGenerate,
    handleImageGenerate,
    handleGeneratePromptAlternatives,
    handleSplitSlide,
    handleRewriteSlide,
    handleSaveVideoUrl,
    handleSave,
    openSavedListModal,
    handleOpenSaved,
    restoreLastOpenedPresentation,
    handleDeleteSaved,
    generatingCoverId,
    handleGenerateCoverForPresentation,
    coverImageCache,
    cloudSyncAvailable:
      !!user &&
      firebaseReady === true &&
      typeof window !== "undefined" &&
      (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined,
    syncingToCloudId,
    handleSyncPresentationToCloud,
    showCloudPresentationsModal,
    setShowCloudPresentationsModal,
    cloudPresentationsItems,
    cloudModalLoading,
    cloudModalError,
    cloudSharedWarning,
    openCloudPresentationsModal,
    handleDownloadFromCloud,
    downloadingCloudKey,
    sharePresentationLocalId,
    openSharePresentationModal,
    closeSharePresentationModal,
    autoCloudSyncOnSave,
    setAutoCloudSyncOnSave,
    cloudSyncConflict,
    dismissCloudSyncConflict,
    resolveCloudConflictUseRemote,
    resolveCloudConflictForceLocal,
    goHome,
    deleteSlideAt,
    insertSlideAfter,
    nextSlide,
    prevSlide,
    openImageModal,
    openImageUploadModal,
    handleImageUpload,
    hasGemini,
    hasOpenAI,
    hasXai,
    refreshApiKeys,
    showCodeGenModal,
    setShowCodeGenModal,
    codeGenPrompt,
    setCodeGenPrompt,
    codeGenLanguage,
    setCodeGenLanguage,
    isGeneratingCode,
    openCodeGenModal,
    handleGenerateCode,
    setPresenterNotesForCurrentSlide,
    handleGeneratePresenterNotes,
    handleGenerateSpeechForCurrentSlide,
    handleRefinePresenterNotes,
    handleGenerateSpeechForAll,
    showSpeechModal,
    setShowSpeechModal,
    speechGeneralPrompt,
    setSpeechGeneralPrompt,
    isGeneratingSpeech,
    isSidebarOpen,
    setIsSidebarOpen,
    isNotesPanelOpen,
    setIsNotesPanelOpen,
    pendingGeneration,
    isSyncingCharactersCloud,
    handlePushAllCharactersToCloud,
    handlePullCharactersFromCloud,
  };
}

export type PresentationState = ReturnType<typeof usePresentationState>;
