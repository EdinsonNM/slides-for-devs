import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import type {
  Slide,
  SlideType,
  ImageStyle,
  SavedCharacter,
  SavedPresentationMeta,
  HomePresentationCard,
} from "../types";

const AUTO_CLOUD_SYNC_STORAGE_KEY = "slaim-auto-cloud-sync";
import { formatMarkdown } from "../utils/markdown";
import {
  composeFullDeckModelInput,
  type PromptAttachment,
} from "../utils/promptAttachments";
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
  generateSlideContent as generateSlideContentUseCase,
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
  clearPresentationLocalBody,
  migrateJsonPresentations,
  listCharacters,
  saveCharacter as saveCharacterStorage,
  deleteCharacter as deleteCharacterStorage,
  importSavedPresentation,
  setPresentationCloudState,
  setPresentationSharedCloudSource,
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
  deleteOwnerPresentationFromCloud,
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
const MAX_SLIDES_UNDO = 50;

function cloneSlideDeck(slides: Slide[]): Slide[] {
  if (typeof structuredClone === "function") {
    return structuredClone(slides) as Slide[];
  }
  return JSON.parse(JSON.stringify(slides)) as Slide[];
}

function slidePatchedFromEditBuffers(
  base: Slide,
  buffers: {
    title: string;
    subtitle: string;
    content: string;
    code: string;
    language: string;
    fontSize: number;
    editorHeight: number;
  },
): Slide {
  return {
    ...base,
    title: buffers.title,
    subtitle: buffers.subtitle.trim() || undefined,
    content: buffers.content,
    code: buffers.code,
    language: buffers.language,
    fontSize: buffers.fontSize,
    editorHeight: buffers.editorHeight,
  };
}

function isSlidePatchedDifferent(a: Slide, b: Slide): boolean {
  return (
    a.title !== b.title ||
    (a.subtitle ?? "") !== (b.subtitle ?? "") ||
    a.content !== b.content ||
    (a.code ?? "") !== (b.code ?? "") ||
    (a.language || "javascript") !== (b.language || "javascript") ||
    (a.fontSize ?? 14) !== (b.fontSize ?? 14) ||
    (a.editorHeight ?? 280) !== (b.editorHeight ?? 280)
  );
}

/** Clave para persistir el id de la última presentación abierta (restaurar al refrescar en /editor). */
export const LAST_OPENED_PRESENTATION_KEY = "slides-for-devs-last-opened";

export type HomeTab = "recent" | "mine" | "templates";

/** Estado de una pestaña del editor (varias presentaciones abiertas en memoria). */
export type EditorWorkspaceSnapshot = {
  topic: string;
  slides: Slide[];
  currentIndex: number;
  currentSavedId: string | null;
  selectedCharacterId: string | null;
};

export type EditorTab = {
  id: string;
  title: string;
};

export function usePresentationState() {
  const { user, firebaseReady } = useAuth();
  const localAccountScope = useMemo(
    () => localAccountScopeForUser(user?.uid),
    [user?.uid],
  );
  const lastOpenedSessionKey = `${LAST_OPENED_PRESENTATION_KEY}:${localAccountScope}`;
  const prevLocalAccountScopeRef = useRef<string | null>(null);
  /** Si falla la generación completa iniciada desde el editor, restaurar slides y título. */
  const generationErrorRestoreRef = useRef<{
    slides: Slide[];
    topic: string;
  } | null>(null);

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
  const [showGenerateFullDeckModal, setShowGenerateFullDeckModal] =
    useState(false);
  const [generateFullDeckTopic, setGenerateFullDeckTopic] = useState("");
  const [homePromptAttachments, setHomePromptAttachments] = useState<
    PromptAttachment[]
  >([]);
  const [generateFullDeckAttachments, setGenerateFullDeckAttachments] =
    useState<PromptAttachment[]>([]);
  const [showGenerateSlideContentModal, setShowGenerateSlideContentModal] =
    useState(false);
  const [generateSlideContentPrompt, setGenerateSlideContentPrompt] =
    useState("");
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [splitPrompt, setSplitPrompt] = useState("");
  const [rewritePrompt, setRewritePrompt] = useState("");
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>(
    IMAGE_STYLES[0],
  );
  const [imageProvider, setImageProvider] = useState<"gemini" | "openai">(
    "gemini",
  );
  const [geminiImageModelId, setGeminiImageModelId] = useState(
    DEFAULT_GEMINI_IMAGE_MODEL_ID,
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
  const slidesUndoRef = useRef<Slide[][]>([]);
  const slidesRedoRef = useRef<Slide[][]>([]);
  const currentIndexRef = useRef(0);
  const prevSlideIndexForFlushRef = useRef(0);
  const isEditingRef = useRef(false);
  const editTitleRef = useRef("");
  const editSubtitleRef = useRef("");
  const editContentRef = useRef("");
  const editCodeRef = useRef("");
  const editLanguageRef = useRef("javascript");
  const editFontSizeRef = useRef(14);
  const editEditorHeightRef = useRef(280);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingPanelHeight, setIsResizingPanelHeight] = useState(false);
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [showSavedListModal, setShowSavedListModal] = useState(false);
  const [savedList, setSavedList] = useState<SavedPresentationMeta[]>([]);
  const [cloudMineSnapshot, setCloudMineSnapshot] = useState<
    CloudPresentationListItem[]
  >([]);
  const [cloudSharedSnapshot, setCloudSharedSnapshot] = useState<
    CloudPresentationListItem[]
  >([]);
  const [homeCloudSharedListWarning, setHomeCloudSharedListWarning] = useState<
    string | null
  >(null);
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
  const [generatingCoverId, setGeneratingCoverId] = useState<string | null>(
    null,
  );
  const [coverImageCache, setCoverImageCache] = useState<
    Record<string, string>
  >({});
  /** `savedAt` de la última portada precargada por id (invalidación al guardar de nuevo). */
  const coverPrefetchSavedAtRef = useRef<Record<string, string>>({});
  const [syncingToCloudId, setSyncingToCloudId] = useState<string | null>(null);
  const [isSyncingCharactersCloud, setIsSyncingCharactersCloud] =
    useState(false);
  const [downloadingCloudKey, setDownloadingCloudKey] = useState<string | null>(
    null,
  );
  const [sharePresentationLocalId, setSharePresentationLocalId] = useState<
    string | null
  >(null);
  const [deletePresentationId, setDeletePresentationId] = useState<string | null>(
    null,
  );
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
  /**
   * Borrador del título de la presentación mientras el input del header está en edición.
   * Evita guardar un `topic` obsoleto si se pulsa Guardar antes de que React aplique el blur.
   */
  const presentationTitleDraftRef = useRef<string | null>(null);
  const [presentationModelId, setPresentationModelId] = useState(
    DEFAULT_PRESENTATION_MODEL_ID,
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  );
  const [savedCharacters, setSavedCharacters] = useState<SavedCharacter[]>([]);
  const [showCharacterCreatorModal, setShowCharacterCreatorModal] =
    useState(false);
  const [showCharactersPanel, setShowCharactersPanel] = useState(false);
  const [showSlideStylePanel, setShowSlideStylePanel] = useState(false);
  /** Pestaña activa del panel derecho estilo Figma. */
  const [inspectorSection, setInspectorSection] = useState<
    "slide" | "characters" | "notes"
  >("slide");
  const [isGeneratingCharacterPreview, setIsGeneratingCharacterPreview] =
    useState(false);
  /** Cuando está setado, la presentación se está generando en segundo plano; se muestra modal y al terminar se guarda. */
  const [pendingGeneration, setPendingGeneration] = useState<{
    topic: string;
    /** Texto completo para el modelo; si falta, se usa `topic`. */
    modelInput?: string;
    modelId: string;
    /** Si viene del editor con presentación ya guardada, actualizar este id en lugar de crear otra fila. */
    reuseSavedId?: string | null;
  } | null>(null);
  /** Bump para forzar re-lectura de API keys y actualizar listado de modelos al guardar en el modal. */
  const [apiKeysVersion, setApiKeysVersion] = useState(0);
  const runAutoSyncAfterSaveRef = useRef<(id: string) => Promise<void>>(
    async () => {},
  );

  /**
   * Serializa subidas por id local. Sin esto, dos autosync o un autosync + manual
   * en paralelo pueden leer `cloudId` aún null y crear dos documentos en «Mías».
   */
  const presentationCloudPushTailRef = useRef(
    new Map<string, Promise<void>>(),
  );

  const enqueuePresentationCloudPush = useCallback(
    (localId: string, task: () => Promise<void>): Promise<void> => {
      const map = presentationCloudPushTailRef.current;
      const prev = map.get(localId) ?? Promise.resolve();
      const next = prev.catch(() => {}).then(() => task());
      map.set(localId, next);
      return next;
    },
    [],
  );

  const tabSnapshotsRef = useRef<Record<string, EditorWorkspaceSnapshot>>({});
  const [editorTabs, setEditorTabs] = useState<EditorTab[]>([]);
  const [activeEditorTabId, setActiveEditorTabId] = useState<string | null>(null);

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
          (m.provider === "openrouter" && hasOpenRouter),
      ),
    [
      hasGemini,
      hasOpenAI,
      hasXai,
      hasGroq,
      hasCerebras,
      hasOpenRouter,
      apiKeysVersion,
    ],
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

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    editTitleRef.current = editTitle;
    editSubtitleRef.current = editSubtitle;
    editContentRef.current = editContent;
    editCodeRef.current = editCode;
    editLanguageRef.current = editLanguage;
    editFontSizeRef.current = editFontSize;
    editEditorHeightRef.current = editEditorHeight;
  }, [
    editTitle,
    editSubtitle,
    editContent,
    editCode,
    editLanguage,
    editFontSize,
    editEditorHeight,
  ]);

  const pushSlidesUndo = useCallback((snapshot: Slide[]) => {
    slidesUndoRef.current = [
      ...slidesUndoRef.current.slice(-(MAX_SLIDES_UNDO - 1)),
      cloneSlideDeck(snapshot),
    ];
    slidesRedoRef.current = [];
  }, []);

  const flushEditsToSlideIndex = useCallback(
    (slideIndex: number) => {
      setSlides((prevSlides) => {
        if (slideIndex < 0 || slideIndex >= prevSlides.length) {
          return prevSlides;
        }
        const cur = prevSlides[slideIndex];
        if (!cur) return prevSlides;
        const buffers = {
          title: editTitleRef.current,
          subtitle: editSubtitleRef.current,
          content: editContentRef.current,
          code: editCodeRef.current,
          language: editLanguageRef.current,
          fontSize: editFontSizeRef.current,
          editorHeight: editEditorHeightRef.current,
        };
        const next = slidePatchedFromEditBuffers(cur, buffers);
        if (!isSlidePatchedDifferent(cur, next)) return prevSlides;
        pushSlidesUndo(prevSlides);
        const updated = [...prevSlides];
        updated[slideIndex] = next;
        return updated;
      });
      setIsEditing(false);
    },
    [pushSlidesUndo],
  );

  const commitSlideEdits = useCallback(
    (options?: { keepEditing?: boolean }) => {
      setSlides((prevSlides) => {
        const slideIndex = currentIndexRef.current;
        if (slideIndex < 0 || slideIndex >= prevSlides.length) {
          return prevSlides;
        }
        const cur = prevSlides[slideIndex];
        if (!cur) return prevSlides;
        const buffers = {
          title: editTitleRef.current,
          subtitle: editSubtitleRef.current,
          content: editContentRef.current,
          code: editCodeRef.current,
          language: editLanguageRef.current,
          fontSize: editFontSizeRef.current,
          editorHeight: editEditorHeightRef.current,
        };
        const next = slidePatchedFromEditBuffers(cur, buffers);
        if (!isSlidePatchedDifferent(cur, next)) return prevSlides;
        pushSlidesUndo(prevSlides);
        const updated = [...prevSlides];
        updated[slideIndex] = next;
        return updated;
      });
      if (!options?.keepEditing) {
        setIsEditing(false);
      }
    },
    [pushSlidesUndo],
  );

  const syncEditFieldsFromSlide = useCallback((s: Slide) => {
    setEditTitle(s.title);
    setEditSubtitle(s.subtitle ?? "");
    setEditContent(formatMarkdown(s.content));
    setEditCode(s.code || "");
    setEditLanguage(s.language || "javascript");
    setEditFontSize(s.fontSize || 14);
    setEditEditorHeight(s.editorHeight ?? 280);
  }, []);

  const applySlidesUndo = useCallback(() => {
    const stack = slidesUndoRef.current;
    if (stack.length === 0) return;
    const snapshot = stack[stack.length - 1]!;
    slidesUndoRef.current = stack.slice(0, -1);
    setSlides((cur) => {
      slidesRedoRef.current.push(cloneSlideDeck(cur));
      return cloneSlideDeck(snapshot);
    });
    const restored = cloneSlideDeck(snapshot);
    const idx = Math.min(
      currentIndexRef.current,
      Math.max(0, restored.length - 1),
    );
    const s = restored[idx];
    if (s) syncEditFieldsFromSlide(s);
    setIsEditing(false);
  }, [syncEditFieldsFromSlide]);

  const applySlidesRedo = useCallback(() => {
    const stack = slidesRedoRef.current;
    if (stack.length === 0) return;
    const snapshot = stack[stack.length - 1]!;
    slidesRedoRef.current = stack.slice(0, -1);
    setSlides((cur) => {
      slidesUndoRef.current.push(cloneSlideDeck(cur));
      return cloneSlideDeck(snapshot);
    });
    const restored = cloneSlideDeck(snapshot);
    const idx = Math.min(
      currentIndexRef.current,
      Math.max(0, restored.length - 1),
    );
    const s = restored[idx];
    if (s) syncEditFieldsFromSlide(s);
    setIsEditing(false);
  }, [syncEditFieldsFromSlide]);

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
    slidesUndoRef.current = [];
    slidesRedoRef.current = [];
    setSlides([]);
    setTopic("");
    setHomePromptAttachments([]);
    setCurrentSavedId(null);
    setSelectedCharacterId(null);
    setCurrentIndex(0);
    setEditorTabs([]);
    setActiveEditorTabId(null);
    tabSnapshotsRef.current = {};
  }, [localAccountScope]);

  useEffect(() => {
    if (slides.length === 0) return;
    if (editorTabs.length > 0) return;
    const id = crypto.randomUUID();
    setEditorTabs([{ id, title: (topic || "Sin título").slice(0, 64) }]);
    setActiveEditorTabId(id);
  }, [slides.length, editorTabs.length, topic]);

  useEffect(() => {
    if (!activeEditorTabId || slides.length === 0) return;
    const label = (topic || "Sin título").slice(0, 64);
    setEditorTabs((tabs) =>
      tabs.map((t) =>
        t.id === activeEditorTabId ? { ...t, title: label } : t,
      ),
    );
  }, [topic, activeEditorTabId, slides.length]);

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
        const promptForApi = pending.modelInput ?? pending.topic;
        const generatedSlides = await generatePresentation.run(
          promptForApi,
          pending.modelId,
        );
        if (cancelled) return;
        const cleanedSlides = generatedSlides.map((slide) => ({
          ...slide,
          id: crypto.randomUUID(),
          content: formatMarkdown(slide.content),
        }));
        slidesUndoRef.current = [];
        slidesRedoRef.current = [];
        setSlides(cleanedSlides);
        setCurrentIndex(0);
        const presentation = {
          topic: pending.topic,
          slides: cleanedSlides,
          characterId: selectedCharacterId ?? undefined,
        };
        let id: string;
        if (pending.reuseSavedId) {
          await updatePresentation(
            pending.reuseSavedId,
            presentation,
            localAccountScope,
          );
          id = pending.reuseSavedId;
        } else {
          id = await savePresentation(presentation, localAccountScope);
        }
        if (cancelled) return;
        setCurrentSavedId(id);
        try {
          sessionStorage.setItem(lastOpenedSessionKey, id);
        } catch {
          // ignore
        }
        void listPresentations(localAccountScope)
          .then(setSavedList)
          .catch(() => setSavedList([]));
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
        const restore = generationErrorRestoreRef.current;
        generationErrorRestoreRef.current = null;
        if (restore) {
          setSlides(restore.slides);
          setTopic(restore.topic);
        } else {
          setSlides([]);
          setTopic("");
        }
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
      const percent = Math.min(Math.max(25, 100 - (y / rect.height) * 100), 95);
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
    const prevIdx = prevSlideIndexForFlushRef.current;
    if (prevIdx !== currentIndex && isEditingRef.current) {
      flushEditsToSlideIndex(prevIdx);
    }
    prevSlideIndexForFlushRef.current = currentIndex;
  }, [currentIndex, flushEditsToSlideIndex]);

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
      const target = e.target as HTMLElement | null;
      const inTextField =
        target != null &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (inTextField) return;
        e.preventDefault();
        applySlidesUndo();
        return;
      }
      if (
        (mod && e.shiftKey && e.key.toLowerCase() === "z") ||
        (e.ctrlKey && e.key.toLowerCase() === "y")
      ) {
        if (inTextField) return;
        e.preventDefault();
        applySlidesRedo();
        return;
      }

      if (inTextField || isEditing) {
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
  }, [
    currentIndex,
    slides.length,
    isEditing,
    isPreviewMode,
    applySlidesUndo,
    applySlidesRedo,
  ]);

  const handleSaveManualEdit = useCallback(() => {
    commitSlideEdits();
  }, [commitSlideEdits]);

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
              presenter3dDeviceId:
                base.presenter3dDeviceId ?? DEFAULT_DEVICE_3D_ID,
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
        if (type === "diagram" && !next.excalidrawData)
          next.excalidrawData = "{}";
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
  const setCurrentSlideContentLayout = (
    contentLayout: "split" | "full" | "panel-full",
  ) => {
    setSlides((prev) => {
      const slide = prev[currentIndex];
      if (!slide || slide.type !== "content") return prev;
      if (slide.contentLayout === contentLayout) return prev;
      const updated = [...prev];
      updated[currentIndex] = { ...slide, contentLayout };
      return updated;
    });
  };

  /** Cambia el tipo de contenido del panel derecho (solo para diapositivas de contenido con layout split). */
  const setCurrentSlideContentType = (
    contentType: NonNullable<Slide["contentType"]>,
  ) => {
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
    presenter3dScreenMedia: "image" | "video",
  ) => {
    if (!currentSlide || currentSlide.type !== "content") return;
    if (currentSlide.contentType !== "presenter3d") return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, presenter3dScreenMedia };
      return updated;
    });
  };

  const setCurrentSlidePresenter3dViewState = (
    presenter3dViewState: Presenter3dViewState,
  ) => {
    if (!currentSlide || currentSlide.type !== "content") return;
    if (currentSlide.contentType !== "presenter3d") return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, presenter3dViewState };
      return updated;
    });
  };

  const queueFullDeckGeneration = useCallback(
    (
      displayTopic: string,
      options?: {
        modelInput?: string;
        errorRestore?: { slides: Slide[]; topic: string };
        reuseSavedId?: string | null;
      },
    ) => {
      const saved = displayTopic.trim();
      const fullInput = (options?.modelInput ?? saved).trim();
      if (!fullInput) return;
      generationErrorRestoreRef.current = options?.errorRestore ?? null;
      setTopic(saved);
      const placeholderSlide: Slide = {
        id: crypto.randomUUID(),
        type: "content",
        title: "Generando…",
        content: "Preparando tu presentación.",
      };
      setSlides([placeholderSlide]);
      setCurrentIndex(0);
      setPendingGeneration({
        topic: saved,
        modelInput: fullInput !== saved ? fullInput : undefined,
        modelId: presentationModelId,
        reuseSavedId: options?.reuseSavedId ?? undefined,
      });
    },
    [presentationModelId],
  );

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const { modelInput, displayTopic } = composeFullDeckModelInput(
      topic,
      homePromptAttachments,
    );
    if (!modelInput) return;
    queueFullDeckGeneration(displayTopic, {
      modelInput: modelInput !== displayTopic ? modelInput : undefined,
    });
    setHomePromptAttachments([]);
  };

  const openGenerateFullDeckModal = useCallback(() => {
    setGenerateFullDeckTopic(topic.trim());
    setGenerateFullDeckAttachments([]);
    setShowGenerateFullDeckModal(true);
  }, [topic]);

  const handleConfirmGenerateFullDeck = useCallback(() => {
    const { modelInput, displayTopic } = composeFullDeckModelInput(
      generateFullDeckTopic,
      generateFullDeckAttachments,
    );
    if (!modelInput) return;
    const backupNeeded =
      slides.length > 1 ||
      slides.some((s) => {
        const c = (s.content ?? "").trim();
        if (c.length > 0) return true;
        const title = s.title.trim();
        if (title === "Generando…") return false;
        return title.length > 0 && title !== "Nueva diapositiva";
      });
    const errorRestore = backupNeeded
      ? { slides: slides.map((s) => ({ ...s })), topic }
      : undefined;
    setShowGenerateFullDeckModal(false);
    setGenerateFullDeckTopic("");
    setGenerateFullDeckAttachments([]);
    queueFullDeckGeneration(displayTopic, {
      modelInput: modelInput !== displayTopic ? modelInput : undefined,
      errorRestore,
      reuseSavedId: currentSavedId,
    });
  }, [
    generateFullDeckTopic,
    generateFullDeckAttachments,
    slides,
    topic,
    currentSavedId,
    queueFullDeckGeneration,
  ]);

  const addHomePromptAttachment = useCallback((a: PromptAttachment) => {
    setHomePromptAttachments((prev) => [...prev, a]);
  }, []);

  const removeHomePromptAttachment = useCallback((id: string) => {
    setHomePromptAttachments((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const addGenerateFullDeckAttachment = useCallback((a: PromptAttachment) => {
    setGenerateFullDeckAttachments((prev) => [...prev, a]);
  }, []);

  const removeGenerateFullDeckAttachment = useCallback((id: string) => {
    setGenerateFullDeckAttachments((prev) => prev.filter((x) => x.id !== id));
  }, []);

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
      imageProvider === "gemini"
        ? geminiImageModelId
        : DEFAULT_OPENAI_IMAGE_MODEL_ID;
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
    const modelId = usesChatCompletionSlideOps(
      presentationModelOption?.provider,
    )
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
        includeBackground,
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
    const modelId = usesChatCompletionSlideOps(
      presentationModelOption?.provider,
    )
      ? presentationModelId
      : effectiveGeminiModel;
    try {
      const newSlides = await splitSlideUseCase.run(
        currentSlide,
        splitPrompt,
        modelId,
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
    const modelId = usesChatCompletionSlideOps(
      presentationModelOption?.provider,
    )
      ? presentationModelId
      : effectiveGeminiModel;
    try {
      const result = await rewriteSlideUseCase.run(
        currentSlide,
        rewritePrompt,
        modelId,
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

  const handleGenerateSlideContentAi = async () => {
    if (!currentSlide || currentSlide.type !== "content") return;
    const instr = generateSlideContentPrompt.trim();
    if (!instr) return;
    setIsProcessing(true);
    const modelId = usesChatCompletionSlideOps(
      presentationModelOption?.provider,
    )
      ? presentationModelId
      : effectiveGeminiModel;
    try {
      const result = await generateSlideContentUseCase.run(
        topic.trim(),
        currentSlide,
        instr,
        modelId,
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
      setShowGenerateSlideContentModal(false);
      setGenerateSlideContentPrompt("");
      trackEvent(ANALYTICS_EVENTS.SLIDE_CONTENT_GENERATED);
    } catch (error) {
      console.error("Error generating slide content:", error);
      alert("No se pudo generar el contenido de la diapositiva.");
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

  const cloneSlidesForTab = useCallback((list: Slide[]) => {
    try {
      return structuredClone(list) as Slide[];
    } catch {
      return list.map((s) => ({ ...s }));
    }
  }, []);

  const captureWorkspaceSnapshot = useCallback((): EditorWorkspaceSnapshot => {
    const pending = flushDiagramPending();
    const idx = currentIndex;
    const buffers = {
      title: editTitleRef.current,
      subtitle: editSubtitleRef.current,
      content: editContentRef.current,
      code: editCodeRef.current,
      language: editLanguageRef.current,
      fontSize: editFontSizeRef.current,
      editorHeight: editEditorHeightRef.current,
    };
    const merged = slides.map((sl, i) =>
      i === idx ? slidePatchedFromEditBuffers(sl, buffers) : sl,
    );
    const s =
      pending != null && merged[idx]?.type === "diagram"
        ? merged.map((sl, i) =>
            i === idx ? { ...sl, excalidrawData: pending } : sl,
          )
        : merged;
    const snapTopic =
      presentationTitleDraftRef.current !== null
        ? presentationTitleDraftRef.current.trim() || ""
        : topic;
    return {
      topic: snapTopic,
      slides: cloneSlidesForTab(s),
      currentIndex,
      currentSavedId,
      selectedCharacterId,
    };
  }, [
    flushDiagramPending,
    slides,
    currentIndex,
    topic,
    currentSavedId,
    selectedCharacterId,
    cloneSlidesForTab,
  ]);

  const setPresentationTitleDraft = useCallback((value: string | null) => {
    presentationTitleDraftRef.current = value;
  }, []);

  const applyWorkspaceSnapshot = useCallback(
    (snap: EditorWorkspaceSnapshot) => {
      const sl = cloneSlidesForTab(snap.slides);
      const idx = Math.min(
        Math.max(0, snap.currentIndex),
        Math.max(0, sl.length - 1),
      );
      slidesUndoRef.current = [];
      slidesRedoRef.current = [];
      setTopic(snap.topic);
      setSlides(sl);
      setCurrentIndex(idx);
      setCurrentSavedId(snap.currentSavedId);
      setSelectedCharacterId(snap.selectedCharacterId);
    },
    [cloneSlidesForTab],
  );

  const refreshCloudMineSnapshot = useCallback(async () => {
    if (
      !user ||
      firebaseReady !== true ||
      typeof window === "undefined" ||
      (window as unknown as { __TAURI__?: unknown }).__TAURI__ === undefined
    ) {
      setCloudMineSnapshot([]);
      setCloudSharedSnapshot([]);
      setHomeCloudSharedListWarning(null);
      return;
    }
    setHomeCloudSharedListWarning(null);
    try {
      const mine = await listCloudPresentations(user.uid);
      setCloudMineSnapshot(mine);
    } catch {
      setCloudMineSnapshot([]);
    }
    try {
      const shared = await listCloudPresentationsSharedWithMe(user.uid);
      setCloudSharedSnapshot(shared);
    } catch (shareErr) {
      console.warn(
        "Listado de presentaciones compartidas (home):",
        shareErr,
      );
      setCloudSharedSnapshot([]);
      const cfg = await getFirebaseConfig();
      setHomeCloudSharedListWarning(
        formatCloudSharedListError(shareErr, cfg?.projectId),
      );
    }
  }, [user, firebaseReady]);

  const refreshSavedList = useCallback(async () => {
    try {
      const list = await listPresentations(localAccountScope);
      setSavedList(list);
    } catch {
      setSavedList([]);
    }
    void refreshCloudMineSnapshot();
  }, [localAccountScope, refreshCloudMineSnapshot]);

  const homePresentationCards = useMemo((): HomePresentationCard[] => {
    const hasAnyLocalForCloud = (cloudId: string) =>
      savedList.some((p) => p.cloudId === cloudId);

    const sharedSourceKey = (ownerUid: string, cloudId: string) =>
      `${ownerUid}::${cloudId}`;

    const hasLocalForSharedCloud = (ownerUid: string, cloudId: string) =>
      savedList.some(
        (p) => p.sharedCloudSource === sharedSourceKey(ownerUid, cloudId),
      );

    const locals: HomePresentationCard[] = savedList.map((meta) => ({
      kind: "local",
      meta,
    }));

    const cloudOnlyMine: HomePresentationCard[] = cloudMineSnapshot
      .filter(
        (item) =>
          item.source === "mine" && !hasAnyLocalForCloud(item.cloudId),
      )
      .map((item) => ({
        kind: "cloud_only_mine" as const,
        cloudId: item.cloudId,
        ownerUid: item.ownerUid,
        topic: item.topic,
        savedAt: item.savedAt,
        updatedAt: item.updatedAt,
      }));

    const cloudOnlyShared: HomePresentationCard[] = cloudSharedSnapshot
      .filter(
        (item) =>
          item.source === "shared" &&
          !hasLocalForSharedCloud(item.ownerUid, item.cloudId),
      )
      .map((item) => ({
        kind: "cloud_only_shared" as const,
        cloudId: item.cloudId,
        ownerUid: item.ownerUid,
        topic: item.topic,
        savedAt: item.savedAt,
        updatedAt: item.updatedAt,
      }));

    const merged = [...locals, ...cloudOnlyMine, ...cloudOnlyShared];
    merged.sort((a, b) => {
      const ta =
        a.kind === "local" ? a.meta.savedAt : a.updatedAt || a.savedAt;
      const tb =
        b.kind === "local" ? b.meta.savedAt : b.updatedAt || b.savedAt;
      return tb.localeCompare(ta);
    });
    return merged;
  }, [savedList, cloudMineSnapshot, cloudSharedSnapshot]);

  /** Portadas del carrusel: sin esto solo se rellenaba la caché al abrir la presentación. */
  useEffect(() => {
    let cancelled = false;
    const eligible = savedList.filter(
      (m) =>
        m.slideCount > 0 &&
        !m.localBodyCleared &&
        coverPrefetchSavedAtRef.current[m.id] !== m.savedAt,
    );
    if (eligible.length === 0) return;

    void (async () => {
      for (const meta of eligible) {
        if (cancelled) return;
        if (coverPrefetchSavedAtRef.current[meta.id] === meta.savedAt) continue;
        try {
          const saved = await loadPresentation(meta.id, localAccountScope);
          if (cancelled) return;
          if (saved.savedAt !== meta.savedAt) continue;
          coverPrefetchSavedAtRef.current[meta.id] = saved.savedAt;
          const firstImage = saved.slides[0]?.imageUrl;
          if (firstImage) {
            setCoverImageCache((prev) => ({ ...prev, [meta.id]: firstImage }));
          }
        } catch {
          /* listado ya mostró la tarjeta; fallo al leer portada no bloquea */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [savedList, localAccountScope]);

  useEffect(() => {
    if (slides.length !== 0) return;
    void refreshSavedList();
  }, [slides.length, localAccountScope, refreshSavedList]);

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
      void enqueuePresentationCloudPush(localId, async () => {
        let meta: SavedPresentationMeta | undefined;
        try {
          const list = await listPresentations(localAccountScope);
          meta = list.find((p) => p.id === localId);
          if (
            !meta ||
            meta.slideCount === 0 ||
            meta.localBodyCleared
          ) {
            return;
          }
          const saved = await loadPresentation(localId, localAccountScope);
          const existingCloudId = meta?.cloudId ?? null;
          const { cloudId, syncedAt, newRevision } =
            await pushPresentationToCloud(user.uid, saved, existingCloudId, {
              localExpectedRevision:
                existingCloudId != null ? (meta?.cloudRevision ?? 0) : null,
            });
          await setPresentationCloudState(
            localId,
            cloudId,
            syncedAt,
            newRevision,
            localAccountScope,
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
      });
    },
    [
      user,
      autoCloudSyncOnSave,
      refreshSavedList,
      localAccountScope,
      enqueuePresentationCloudPush,
    ],
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
            localAccountScope,
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
    ],
  );

  const createBlankPresentation = useCallback(async () => {
    generationErrorRestoreRef.current = null;
    setPendingGeneration(null);
    slidesUndoRef.current = [];
    slidesRedoRef.current = [];
    const blankSlide: Slide = {
      id: crypto.randomUUID(),
      type: "content",
      title: "Nueva diapositiva",
      content: "",
    };
    setTopic("");
    setSlides([blankSlide]);
    setCurrentIndex(0);
    setCurrentSavedId(null);
    setSelectedCharacterId(null);
    await savePresentationNow({
      topic: "",
      slides: [blankSlide],
      characterId: undefined,
    });
    await refreshSavedList();
  }, [savePresentationNow, refreshSavedList]);

  const handleSave = async () => {
    if (slides.length === 0) return;
    const pendingDiagram = flushDiagramPending();
    const idx = currentIndexRef.current;
    const buffers = {
      title: editTitleRef.current,
      subtitle: editSubtitleRef.current,
      content: editContentRef.current,
      code: editCodeRef.current,
      language: editLanguageRef.current,
      fontSize: editFontSizeRef.current,
      editorHeight: editEditorHeightRef.current,
    };
    const merged = slides.map((s, i) =>
      i === idx ? slidePatchedFromEditBuffers(s, buffers) : s,
    );
    const slidesToSave =
      pendingDiagram != null && merged[idx]?.type === "diagram"
        ? merged.map((s, i) =>
            i === idx ? { ...s, excalidrawData: pendingDiagram } : s,
          )
        : merged;

    const hadTitleDraft = presentationTitleDraftRef.current !== null;
    const topicSource =
      hadTitleDraft ? presentationTitleDraftRef.current! : topic;
    if (hadTitleDraft) {
      presentationTitleDraftRef.current = null;
      setTopic(topicSource.trim() || "");
    }
    const topicToSave = topicSource.trim() || "Sin título";

    setIsSaving(true);
    setSaveMessage(null);
    try {
      await savePresentationNow({
        topic: topicToSave,
        slides: slidesToSave,
        characterId: selectedCharacterId ?? undefined,
      });
      setSlides(slidesToSave);
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
      try {
        const listPre = await listPresentations(localAccountScope);
        const preMeta = listPre.find((p) => p.id === localId);
        if (preMeta?.localBodyCleared) {
          alert(
            "Recupera la copia local desde la nube (abre la tarjeta) antes de sincronizar.",
          );
          return;
        }
      } catch {
        /* continuar; el push volverá a leer */
      }
      try {
        await enqueuePresentationCloudPush(localId, async () => {
          setSyncingToCloudId(localId);
          try {
            const list = await listPresentations(localAccountScope);
            const meta = list.find((p) => p.id === localId);
            const saved = await loadPresentation(localId, localAccountScope);
            const existingCloudId = meta?.cloudId ?? null;
            const { cloudId, syncedAt, newRevision } =
              await pushPresentationToCloud(user.uid, saved, existingCloudId, {
                localExpectedRevision:
                  existingCloudId != null ? (meta?.cloudRevision ?? 0) : null,
              });
            await setPresentationCloudState(
              localId,
              cloudId,
              syncedAt,
              newRevision,
              localAccountScope,
            );
            await refreshSavedList();
          } catch (e) {
            if (e instanceof CloudSyncConflictError) {
              const list = await listPresentations(localAccountScope).catch(
                () => [],
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
              alert(
                `No se pudo sincronizar: ${formatCloudSyncUserMessage(e)}`,
              );
            }
          } finally {
            setSyncingToCloudId(null);
          }
        });
      } catch (e) {
        console.error(e);
      }
    },
    [user, refreshSavedList, localAccountScope, enqueuePresentationCloudPush],
  );

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

  const rehydratePresentationFromMyCloud = useCallback(
    async (localId: string, cloudId: string) => {
      if (!user) {
        throw new Error("Inicia sesión para recuperar desde la nube.");
      }
      const { presentation: pulled, cloudRevision } =
        await pullPresentationFromCloud(user.uid, cloudId);
      await importSavedPresentation(
        {
          ...pulled,
          id: localId,
        },
        localAccountScope,
      );
      await setPresentationCloudState(
        localId,
        cloudId,
        new Date().toISOString(),
        cloudRevision,
        localAccountScope,
      );
      await refreshSavedList();
    },
    [user, localAccountScope, refreshSavedList],
  );

  const handleOpenSaved = async (id: string) => {
    try {
      let metaOpen: SavedPresentationMeta | undefined;
      try {
        const listFresh = await listPresentations(localAccountScope);
        metaOpen = listFresh.find((p) => p.id === id);
        setSavedList(listFresh);
      } catch {
        metaOpen = savedList.find((p) => p.id === id);
      }
      if (metaOpen?.localBodyCleared && metaOpen.cloudId) {
        if (!user) {
          alert("Inicia sesión para recuperar la copia desde la nube.");
          return;
        }
        try {
          await rehydratePresentationFromMyCloud(id, metaOpen.cloudId);
        } catch (e) {
          console.error(e);
          alert(
            `No se pudo recuperar desde la nube: ${formatCloudSyncUserMessage(e)}`,
          );
          return;
        }
      }
      const saved = await loadPresentation(id, localAccountScope);
      slidesUndoRef.current = [];
      slidesRedoRef.current = [];
      setTopic(saved.topic);
      setSlides(
        saved.slides.map((s) => ({
          ...s,
          id: crypto.randomUUID(),
          content: formatMarkdown(s.content ?? ""),
        })),
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
      coverPrefetchSavedAtRef.current[saved.id] = saved.savedAt;
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
        if (existing.localBodyCleared && user) {
          try {
            await rehydratePresentationFromMyCloud(existing.id, cloudId);
          } catch (e) {
            console.error(e);
            alert(
              `No se pudo recuperar: ${formatCloudSyncUserMessage(e)}`,
            );
            return;
          }
        }
        await handleOpenSaved(existing.id);
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
          localAccountScope,
        );
        if (isSharedFromOther) {
          await setPresentationCloudState(
            localId,
            null,
            null,
            null,
            localAccountScope,
          );
          await setPresentationSharedCloudSource(
            localId,
            `${owner}::${cloudId}`,
            localAccountScope,
          );
        } else {
          await setPresentationCloudState(
            localId,
            cloudId,
            new Date().toISOString(),
            cloudRevision,
            localAccountScope,
          );
        }
        await refreshSavedList();
        await handleOpenSaved(localId);
      } catch (e) {
        console.error(e);
        alert(`Error al descargar: ${formatCloudSyncUserMessage(e)}`);
      } finally {
        setDownloadingCloudKey(null);
      }
    },
    [
      user,
      savedList,
      refreshSavedList,
      handleOpenSaved,
      localAccountScope,
      rehydratePresentationFromMyCloud,
    ],
  );

  const openSharePresentationModal = useCallback((localId: string) => {
    setSharePresentationLocalId(localId);
  }, []);

  const closeSharePresentationModal = useCallback(() => {
    setSharePresentationLocalId(null);
  }, []);

  /** Restaura la última presentación abierta (desde sessionStorage). Usado al cargar /editor tras refresco. */
  const restoreLastOpenedPresentation =
    useCallback(async (): Promise<boolean> => {
      let id: string | null = null;
      try {
        id = sessionStorage.getItem(lastOpenedSessionKey);
      } catch {
        return false;
      }
      if (!id) return false;
      try {
        const saved = await loadPresentation(id, localAccountScope);
        slidesUndoRef.current = [];
        slidesRedoRef.current = [];
        setTopic(saved.topic);
        setSlides(
          saved.slides.map((s) => ({
            ...s,
            id: crypto.randomUUID(),
            content: formatMarkdown(s.content ?? ""),
          })),
        );
        setCurrentIndex(0);
        setCurrentSavedId(saved.id);
        setSelectedCharacterId(saved.characterId ?? null);
        coverPrefetchSavedAtRef.current[saved.id] = saved.savedAt;
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

  const requestDeletePresentation = useCallback((id: string) => {
    setDeletePresentationId(id);
  }, []);

  const closeDeletePresentationModal = useCallback(() => {
    setDeletePresentationId(null);
  }, []);

  const deletePresentationTarget = useMemo((): SavedPresentationMeta | null => {
    if (!deletePresentationId) return null;
    return savedList.find((p) => p.id === deletePresentationId) ?? null;
  }, [savedList, deletePresentationId]);

  const confirmDeletePresentationLocalOnly = useCallback(async () => {
    const id = deletePresentationId;
    if (!id) return;
    try {
      await deletePresentation(id, localAccountScope);
      if (currentSavedId === id) {
        setCurrentSavedId(null);
        setTopic("");
        slidesUndoRef.current = [];
        slidesRedoRef.current = [];
        setSlides([]);
      }
      setSavedList((prev) => prev.filter((p) => p.id !== id));
      delete coverPrefetchSavedAtRef.current[id];
      setCoverImageCache((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      console.error(e);
      alert("Error al eliminar.");
    } finally {
      setDeletePresentationId(null);
    }
  }, [deletePresentationId, currentSavedId]);

  const confirmClearPresentationLocalKeepCloud = useCallback(async () => {
    const id = deletePresentationId;
    if (!id) return;
    try {
      await clearPresentationLocalBody(id, localAccountScope);
      await refreshSavedList();
      if (currentSavedId === id) {
        setCurrentSavedId(null);
        setTopic("");
        slidesUndoRef.current = [];
        slidesRedoRef.current = [];
        setSlides([]);
      }
      delete coverPrefetchSavedAtRef.current[id];
      setCoverImageCache((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      console.error(e);
      alert(
        e instanceof Error && e.message
          ? e.message
          : "No se pudo quitar la copia local.",
      );
    } finally {
      setDeletePresentationId(null);
    }
  }, [deletePresentationId, currentSavedId, refreshSavedList, localAccountScope]);

  const confirmDeletePresentationLocalAndCloud = useCallback(async () => {
    const id = deletePresentationId;
    if (!id) return;
    try {
      let cloudId: string | null = null;
      try {
        const list = await listPresentations(localAccountScope);
        cloudId = list.find((p) => p.id === id)?.cloudId?.trim() ?? null;
      } catch {
        /* ignore */
      }
      if (cloudId && user) {
        await deleteOwnerPresentationFromCloud(user.uid, cloudId);
      }
      await deletePresentation(id, localAccountScope);
      if (currentSavedId === id) {
        setCurrentSavedId(null);
        setTopic("");
        slidesUndoRef.current = [];
        slidesRedoRef.current = [];
        setSlides([]);
      }
      setSavedList((prev) => prev.filter((p) => p.id !== id));
      delete coverPrefetchSavedAtRef.current[id];
      setCoverImageCache((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      console.error(e);
      alert(`Error al eliminar: ${formatCloudSyncUserMessage(e)}`);
    } finally {
      setDeletePresentationId(null);
    }
  }, [deletePresentationId, user, currentSavedId, localAccountScope]);

  const handleGenerateCoverForPresentation = async (id: string) => {
    setGeneratingCoverId(id);
    try {
      try {
        const list = await listPresentations(localAccountScope);
        const meta = list.find((p) => p.id === id);
        if (meta?.localBodyCleared) {
          alert("Recupera la presentación desde la nube antes de generar la portada.");
          return;
        }
      } catch {
        /* ignore */
      }
      const saved = await loadPresentation(id, localAccountScope);
      if (!saved.slides.length) {
        alert("Esta presentación no tiene diapositivas.");
        return;
      }
      const firstSlide = saved.slides[0];
      const slideContext = `Título: ${firstSlide.title}. Contenido: ${firstSlide.content}. Presentación sobre: ${saved.topic}`;
      const coverPrompt =
        "Portada profesional y moderna para esta presentación, estilo minimalista y atractivo, sin texto.";
      const coverCharacter = saved.characterId
        ? savedCharacters.find((c) => c.id === saved.characterId)
        : undefined;
      const characterPrompt = coverCharacter?.description;
      const characterReferenceImageDataUrl =
        imageProvider === "gemini"
          ? coverCharacter?.referenceImageDataUrl
          : undefined;
      const coverCharacterImageForOpenAI =
        imageProvider === "openai"
          ? coverCharacter?.referenceImageDataUrl
          : undefined;
      const imageModelId =
        imageProvider === "gemini"
          ? geminiImageModelId
          : DEFAULT_OPENAI_IMAGE_MODEL_ID;
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
          localAccountScope,
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
        alert(
          "No se pudo generar la imagen. Comprueba tu API key de Gemini o OpenAI.",
        );
      }
    } catch (e) {
      console.error(e);
      alert(
        "Error al generar la portada. Comprueba la consola y tu configuración de API.",
      );
    } finally {
      setGeneratingCoverId(null);
    }
  };

  const dismissCloudSyncConflict = useCallback(
    () => setCloudSyncConflict(null),
    [],
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
        cloudId,
      );
      await updatePresentation(
        localId,
        {
          topic: presentation.topic,
          slides: presentation.slides,
          characterId: presentation.characterId,
        },
        localAccountScope,
      );
      await setPresentationCloudState(
        localId,
        cloudId,
        new Date().toISOString(),
        cloudRevision,
        localAccountScope,
      );
      if (currentSavedId === localId) {
        setTopic(presentation.topic);
        slidesUndoRef.current = [];
        slidesRedoRef.current = [];
        setSlides(
          presentation.slides.map((s) => ({
            ...s,
            id: crypto.randomUUID(),
            content: formatMarkdown(s.content ?? ""),
          })),
        );
        setSelectedCharacterId(presentation.characterId ?? null);
      }
      await refreshSavedList();
    } catch (e) {
      console.error(e);
      alert(
        `No se pudo traer la versión de la nube: ${formatCloudSyncUserMessage(e)}`,
      );
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
          (p) => p.id === localId,
        )?.cloudId;
      if (!cid) {
        alert("Falta vínculo con la nube.");
        return;
      }
      const {
        cloudId: outId,
        syncedAt,
        newRevision,
      } = await pushPresentationToCloud(user.uid, saved, cid, {
        localExpectedRevision: 0,
        force: true,
      });
      await setPresentationCloudState(
        localId,
        outId,
        syncedAt,
        newRevision,
        localAccountScope,
      );
      await refreshSavedList();
    } catch (e) {
      console.error(e);
      alert(`No se pudo forzar la subida: ${formatCloudSyncUserMessage(e)}`);
    }
  }, [cloudSyncConflict, user, refreshSavedList, localAccountScope]);

  const switchEditorTab = useCallback(
    (tabId: string) => {
      if (tabId === activeEditorTabId) return;
      if (activeEditorTabId) {
        tabSnapshotsRef.current[activeEditorTabId] =
          captureWorkspaceSnapshot();
      }
      const incoming = tabSnapshotsRef.current[tabId];
      if (incoming) {
        applyWorkspaceSnapshot(incoming);
        delete tabSnapshotsRef.current[tabId];
      }
      setActiveEditorTabId(tabId);
    },
    [
      activeEditorTabId,
      captureWorkspaceSnapshot,
      applyWorkspaceSnapshot,
    ],
  );

  const addEditorTab = useCallback(() => {
    if (activeEditorTabId) {
      tabSnapshotsRef.current[activeEditorTabId] =
        captureWorkspaceSnapshot();
    }
    const newId = crypto.randomUUID();
    const blankSlide: Slide = {
      id: crypto.randomUUID(),
      type: "content",
      title: "Nueva diapositiva",
      content: "",
    };
    setTopic("");
    slidesUndoRef.current = [];
    slidesRedoRef.current = [];
    setSlides([blankSlide]);
    setCurrentIndex(0);
    setCurrentSavedId(null);
    setSelectedCharacterId(null);
    setEditorTabs((tabs) => [...tabs, { id: newId, title: "Sin título" }]);
    setActiveEditorTabId(newId);
  }, [activeEditorTabId, captureWorkspaceSnapshot]);

  const closeEditorTab = useCallback(
    (tabId: string) => {
      const tabs = editorTabs;
      if (tabs.length <= 1) return;
      const idx = tabs.findIndex((t) => t.id === tabId);
      if (idx < 0) return;
      delete tabSnapshotsRef.current[tabId];
      const neighbor = tabs[idx + 1] ?? tabs[idx - 1];
      if (tabId === activeEditorTabId && neighbor) {
        const incoming = tabSnapshotsRef.current[neighbor.id];
        if (incoming) {
          applyWorkspaceSnapshot(incoming);
          delete tabSnapshotsRef.current[neighbor.id];
        }
        setActiveEditorTabId(neighbor.id);
      }
      setEditorTabs((t) => t.filter((x) => x.id !== tabId));
    },
    [editorTabs, activeEditorTabId, applyWorkspaceSnapshot],
  );

  const goHome = () => {
    slidesUndoRef.current = [];
    slidesRedoRef.current = [];
    setSlides([]);
    setTopic("");
    setHomePromptAttachments([]);
    setCurrentSavedId(null);
    setSelectedCharacterId(null);
    setEditorTabs([]);
    setActiveEditorTabId(null);
    tabSnapshotsRef.current = {};
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
        referenceImageDataUrl = await optimizeImageDataUrl(
          referenceImageDataUrl,
        );
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
            { localExpectedRevision: c.cloudRevision ?? null },
          );
          await setCharacterCloudState(
            c.id,
            syncedAt,
            newRevision,
            localAccountScope,
          );
          listCharacters(localAccountScope)
            .then(setSavedCharacters)
            .catch(() => undefined);
        } catch (e) {
          if (e instanceof CharacterCloudSyncConflictError) {
            console.warn(
              "Auto-sync personaje: conflicto de revisión",
              e.characterId,
            );
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
            { localExpectedRevision: c.cloudRevision ?? null },
          );
          await setCharacterCloudState(
            c.id,
            syncedAt,
            newRevision,
            localAccountScope,
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
          `Subidos ${ok} personaje(s). Conflicto de versión en: ${conflicts.join(", ")}. Trae desde la nube o vuelve a subir tras alinear.`,
        );
      } else if (ok > 0) {
        alert(`Subidos ${ok} personaje(s) a la nube.`);
      } else {
        alert("No hay personajes locales para subir.");
      }
    } catch (e) {
      console.error(e);
      alert(
        `Error al subir personajes: ${e instanceof Error ? e.message : String(e)}`,
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
          : "No hay personajes en la nube.",
      );
    } catch (e) {
      console.error(e);
      alert(
        `Error al traer personajes: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsSyncingCharactersCloud(false);
    }
  }, [user, refreshSavedCharacters, localAccountScope]);

  /** Genera una vista previa del personaje (solo la imagen, sin asignar a slide). Contexto fijo para personaje aislado. */
  const generateCharacterPreview = async (
    characterDescription: string,
  ): Promise<string | undefined> => {
    if (!characterDescription.trim()) return undefined;
    setIsGeneratingCharacterPreview(true);
    try {
      const context =
        "Personaje aislado (avatar) para presentaciones: un solo diseño coherente en todas las escenas. Fondo neutro; sin texto ni elementos decorativos de interfaz alrededor.";
      const imageModelId =
        imageProvider === "gemini"
          ? geminiImageModelId
          : DEFAULT_OPENAI_IMAGE_MODEL_ID;
      return generateImageUseCase.run({
        providerId: imageProvider,
        slideContext: context,
        userPrompt: characterDescription.trim(),
        stylePrompt: selectedStyle.prompt,
        includeBackground: true,
        modelId: imageModelId,
        characterPreviewOnly: true,
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
        modelForGeminiOps,
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
        modelForGeminiOps,
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
        modelForGeminiOps,
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
        modelForGeminiOps,
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
        modelForGeminiOps,
      );
      setSlides((prev) =>
        prev.map((s, i) => ({
          ...s,
          presenterNotes: results[i] ?? s.presenterNotes ?? "",
        })),
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
    setPresentationTitleDraft,
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
    inspectorSection,
    setInspectorSection,
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
    homePresentationCards,
    isSaving,
    saveMessage,
    homeTab,
    setHomeTab,
    formatMarkdown,
    handleSaveManualEdit,
    commitSlideEdits,
    toggleContentType,
    setCurrentSlideType,
    setCurrentSlideExcalidrawData,
    setCurrentSlideContentLayout,
    setCurrentSlideContentType,
    setCurrentSlidePresenter3dDeviceId,
    setCurrentSlidePresenter3dScreenMedia,
    setCurrentSlidePresenter3dViewState,
    handleGenerate,
    homePromptAttachments,
    addHomePromptAttachment,
    removeHomePromptAttachment,
    createBlankPresentation,
    openGenerateFullDeckModal,
    showGenerateFullDeckModal,
    setShowGenerateFullDeckModal,
    generateFullDeckTopic,
    setGenerateFullDeckTopic,
    generateFullDeckAttachments,
    addGenerateFullDeckAttachment,
    removeGenerateFullDeckAttachment,
    handleConfirmGenerateFullDeck,
    showGenerateSlideContentModal,
    setShowGenerateSlideContentModal,
    generateSlideContentPrompt,
    setGenerateSlideContentPrompt,
    handleGenerateSlideContentAi,
    handleImageGenerate,
    handleGeneratePromptAlternatives,
    handleSplitSlide,
    handleRewriteSlide,
    handleSaveVideoUrl,
    handleSave,
    openSavedListModal,
    handleOpenSaved,
    restoreLastOpenedPresentation,
    requestDeletePresentation,
    closeDeletePresentationModal,
    deletePresentationTarget,
    confirmDeletePresentationLocalOnly,
    confirmClearPresentationLocalKeepCloud,
    confirmDeletePresentationLocalAndCloud,
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
    homeCloudSharedListWarning,
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
    editorTabs,
    activeEditorTabId,
    switchEditorTab,
    addEditorTab,
    closeEditorTab,
  };
}

export type PresentationState = ReturnType<typeof usePresentationState>;
