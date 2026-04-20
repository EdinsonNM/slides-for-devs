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
  GeneratedResourceEntry,
  SavedPresentationMeta,
  HomePresentationCard,
  Presentation,
} from "../types";
import {
  DEFAULT_DECK_VISUAL_THEME,
  normalizeDeckVisualTheme,
  type DeckVisualTheme,
} from "../domain/entities";
import {
  DEFAULT_DECK_NARRATIVE_PRESET_ID,
  buildDeckNarrativeContextForPrompts,
} from "../constants/presentationNarrativePresets";
import {
  DECK_COVER_IMAGE_PROMPT,
  DECK_COVER_STYLE_PROMPT,
  buildDeckCoverImageUserPrompt,
  firstSlideDeckCoverImageUrl,
  loadSlaimMascotCoverReferenceDataUrl,
  SLAIM_MASCOT_COVER_CHARACTER_PROMPT,
} from "../constants/deckCover";
import { resolveGeneratedPresentationTitle } from "../utils/presentationTitle";

const AUTO_CLOUD_SYNC_STORAGE_KEY = "slaim-auto-cloud-sync";
import { formatMarkdown } from "../utils/markdown";
import {
  composeFullDeckModelInput,
  type PromptAttachment,
} from "../utils/promptAttachments";
import { optimizeImageDataUrl } from "../utils/imageOptimize";
import {
  coerceImageDataUrlForSlideFile,
  isUsableSlideImageFile,
} from "../utils/slideImageFile";
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
  generateSlideMatrix as generateSlideMatrixUseCase,
  generateSlideDiagram as generateSlideDiagramUseCase,
  generateImagePromptAlternatives,
  generateImage as generateImageUseCase,
} from "../composition/container";
import {
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
  SLIDE_TYPE,
  type SlideCanvasElement,
  type SlideCanvasElementKind,
  type SlideCanvasRect,
  type SlideCanvasScene,
  type SlideCodeEditorTheme,
  type SlideMatrixData,
} from "../domain/entities";
import {
  createDefaultIsometricFlowDiagram,
  serializeIsometricFlowDiagram,
} from "../domain/entities/IsometricFlowDiagram";
import {
  normalizeSlidesCanvasScenes,
  ensureSlideCanvasScene,
} from "../domain/slideCanvas/ensureSlideCanvasScene";
import {
  applyEditBuffersToSlide,
  defaultCanvasTextEditTargets,
  isSlidePatchedDifferentFromBuffers,
  patchSlideMediaPanelByElementId,
  replaceFirstMarkdownCanvasBody,
  type CanvasTextEditTargets,
} from "../domain/slideCanvas/slideCanvasApplyEditBuffers";
import {
  patchElementPayload,
  readMediaPayloadFromElement,
  readTextMarkdownFromElement,
  slideAppearanceForMediaElement,
  type SlideCanvasMediaPayload,
} from "../domain/slideCanvas/slideCanvasPayload";
import { isSlideCanvasTextPayload } from "../domain/entities/SlideCanvas";
import { plainTextFromRichHtml } from "../utils/slideRichText";
import { syncSlideRootFromCanvas } from "../domain/slideCanvas/syncSlideRootFromCanvas";
import {
  appendCanvasElementToScene,
  type AppendCanvasElementOptions,
} from "../domain/slideCanvas/insertCanvasElement";
import { readPersistedCodeEditorTheme } from "./useCodeEditorTheme";
import {
  getGeminiApiKey,
  getOpenAIApiKey,
  getXaiApiKey,
  getGroqApiKey,
  getCerebrasApiKey,
  getOpenRouterApiKey,
  hasAnyApiConfiguredSync,
} from "../services/apiConfig";
import { notifyApiConfigurationRequired } from "../services/apiConfigurationGate";
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
  listGeneratedResources,
  addGeneratedResource,
  deleteGeneratedResource,
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
  getCloudPresentationRevision,
  resolvePresentationCloudRef,
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
import {
  PANEL_CONTENT_KIND,
  PANEL_CONTENT_TOGGLE_ORDER,
  normalizePanelContentKind,
  resolveMediaPanelDescriptor,
  Canvas3dMediaPanelDescriptor,
} from "../domain/panelContent";

const DEFAULT_IMAGE_WIDTH_PERCENT = 40;
const DEFAULT_PANEL_HEIGHT_PERCENT = 85;
const MAX_SLIDES_UNDO = 50;

function cloneSlideDeck(slides: Slide[]): Slide[] {
  if (typeof structuredClone === "function") {
    return structuredClone(slides) as Slide[];
  }
  return JSON.parse(JSON.stringify(slides)) as Slide[];
}

function applyImageDataUrlToMediaPanelPayload(
  m: SlideCanvasMediaPayload,
  dataUrl: string,
): SlideCanvasMediaPayload {
  if (normalizePanelContentKind(m.contentType) === PANEL_CONTENT_KIND.PRESENTER_3D) {
    return {
      ...m,
      imageUrl: dataUrl,
      presenter3dScreenMedia: "image",
    };
  }
  return {
    ...m,
    imageUrl: dataUrl,
    contentType: PANEL_CONTENT_KIND.IMAGE,
  };
}

function applyVideoUrlToMediaPanelPayload(
  m: SlideCanvasMediaPayload,
  videoUrl: string,
): SlideCanvasMediaPayload {
  if (normalizePanelContentKind(m.contentType) === PANEL_CONTENT_KIND.PRESENTER_3D) {
    return {
      ...m,
      videoUrl,
      presenter3dScreenMedia: "video",
    };
  }
  return {
    ...m,
    videoUrl,
    contentType: PANEL_CONTENT_KIND.VIDEO,
  };
}

function applyGeneratedImageToMediaPanelPayload(
  m: SlideCanvasMediaPayload,
  imageUrl: string,
  imagePrompt: string,
): SlideCanvasMediaPayload {
  if (normalizePanelContentKind(m.contentType) === PANEL_CONTENT_KIND.PRESENTER_3D) {
    return {
      ...m,
      imageUrl,
      imagePrompt,
      presenter3dScreenMedia: "image",
    };
  }
  return {
    ...m,
    imageUrl,
    imagePrompt,
    contentType: PANEL_CONTENT_KIND.IMAGE,
  };
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
  deckVisualTheme: DeckVisualTheme;
  deckNarrativePresetId?: string;
  narrativeNotes?: string;
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
  const slidesRef = useRef<Slide[]>(slides);
  slidesRef.current = slides;
  const [deckVisualTheme, setDeckVisualThemeState] = useState<DeckVisualTheme>(
    DEFAULT_DECK_VISUAL_THEME,
  );
  const [deckNarrativePresetId, setDeckNarrativePresetId] = useState(
    DEFAULT_DECK_NARRATIVE_PRESET_ID,
  );
  const [narrativeNotes, setNarrativeNotes] = useState("");
  const deckNarrativeSlideOptions = useMemo(
    () => ({
      deckNarrativeContext: buildDeckNarrativeContextForPrompts(
        deckNarrativePresetId,
        narrativeNotes,
      ),
    }),
    [deckNarrativePresetId, narrativeNotes],
  );
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
  const [showExportDeckVideoModal, setShowExportDeckVideoModal] =
    useState(false);
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
  const [editContent, setEditContentState] = useState("");
  const [editContentRichHtml, setEditContentRichHtmlState] = useState("");
  const [editContentBodyFontScale, setEditContentBodyFontScale] = useState(1);
  const [editCode, setEditCode] = useState("");
  const [editLanguage, setEditLanguage] = useState("javascript");
  const [editFontSize, setEditFontSizeState] = useState(14);
  const [editEditorHeight, setEditEditorHeight] = useState(280);
  const slidesUndoRef = useRef<Slide[][]>([]);
  const slidesRedoRef = useRef<Slide[][]>([]);
  const currentIndexRef = useRef(0);
  const prevSlideIndexForFlushRef = useRef(0);
  const isEditingRef = useRef(false);
  const editTitleRef = useRef("");
  const editSubtitleRef = useRef("");
  const editContentRef = useRef("");
  const editContentRichHtmlRef = useRef("");
  const editContentBodyFontScaleRef = useRef(1);
  /**
   * Mientras se escribe en el WYSIWYG del lienzo, los buffers viven en refs (`applyEditContentRichDraft`)
   * para no disparar un re-render global por tecla. `commitSlideEdits` vuelca a estado antes de persistir.
   */
  const editContentDraftDirtyRef = useRef(false);
  const editCodeRef = useRef("");
  const editLanguageRef = useRef("javascript");
  const editFontSizeRef = useRef(14);
  const editEditorHeightRef = useRef(280);
  /** Destinos de edición por bloque en el lienzo (título/subtítulo/cuerpo/panel). */
  const canvasTextTargetsRef = useRef<CanvasTextEditTargets>({
    titleElementId: null,
    subtitleElementId: null,
    contentElementId: null,
    mediaPanelElementId: null,
  });
  const [canvasMediaPanelElementId, setCanvasMediaPanelElementId] = useState<
    string | null
  >(null);
  /** Panel `mediaPanel` objetivo mientras el modal de subida/generación está abierto (el ref puede quedar stale tras el file picker). */
  const pendingImageUploadMediaPanelIdRef = useRef<string | null>(null);
  const pendingImageGenerateMediaPanelIdRef = useRef<string | null>(null);
  const pendingVideoUrlMediaPanelIdRef = useRef<string | null>(null);
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
  /**
   * Invalida precargas in-flight al cambiar lista/ámbito. Evita `return` tras `await`, que
   * abandonaba el resto del bucle y dejaba sin portada (p. ej. la tarjeta más reciente al final del `for`).
   */
  const coverPrefetchGenerationRef = useRef(0);
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
    localSlideCount?: number;
    remoteSlideCount?: number;
  } | null>(null);
  /** Ref que SlideContentDiagram rellena con una función que vacía el diagrama pendiente y devuelve los datos (para guardar/vista previa). */
  const diagramFlushRef = useRef<(() => string | null) | null>(null);
  /** Ref que SlideContentIsometricFlow rellena para persistir JSON antes de guardar o capturar pestaña. */
  const isometricFlowFlushRef = useRef<(() => string | null) | null>(null);
  /** Incrementar para forzar remount de Excalidraw tras sustituir la escena (p. ej. IA). */
  const [diagramRemountToken, setDiagramRemountToken] = useState(0);
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
  const [generatedResources, setGeneratedResources] = useState<
    GeneratedResourceEntry[]
  >([]);
  const [showCharacterCreatorModal, setShowCharacterCreatorModal] =
    useState(false);
  const [showCharactersPanel, setShowCharactersPanel] = useState(false);
  const [showSlideStylePanel, setShowSlideStylePanel] = useState(false);
  /** Pestaña activa del panel derecho estilo Figma. */
  const [inspectorSection, setInspectorSection] = useState<
    "slide" | "characters" | "notes" | "theme" | "resources" | null
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
    deckNarrativePresetId: string;
    narrativeNotes?: string;
  } | null>(null);
  /** Bump para forzar re-lectura de API keys y actualizar listado de modelos al guardar en el modal. */
  const [apiKeysVersion, setApiKeysVersion] = useState(0);
  const runAutoSyncAfterSaveRef = useRef<(id: string) => Promise<void>>(
    async () => {},
  );
  /** Suprime auto-sync mientras se resuelve un conflicto para evitar re-conflicto por race condition. */
  const conflictResolvingRef = useRef(false);

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

  /** Actualiza solo refs: sin re-render por tecla en el WYSIWYG del cuerpo enriquecido. */
  const applyEditContentRichDraft = useCallback((plain: string, richHtml: string) => {
    editContentDraftDirtyRef.current = true;
    editContentRef.current = plain;
    editContentRichHtmlRef.current = richHtml;
  }, []);

  const setEditContent = useCallback(
    (value: string | ((prev: string) => string)) => {
      editContentDraftDirtyRef.current = false;
      setEditContentState(value);
    },
    [],
  );

  const setEditContentRichHtml = useCallback(
    (value: string | ((prev: string) => string)) => {
      editContentDraftDirtyRef.current = false;
      setEditContentRichHtmlState(value);
    },
    [],
  );

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    editTitleRef.current = editTitle;
    editSubtitleRef.current = editSubtitle;
    if (!editContentDraftDirtyRef.current) {
      editContentRef.current = editContent;
      editContentRichHtmlRef.current = editContentRichHtml;
    }
    editContentBodyFontScaleRef.current = editContentBodyFontScale;
    editCodeRef.current = editCode;
    editLanguageRef.current = editLanguage;
    editFontSizeRef.current = editFontSize;
    editEditorHeightRef.current = editEditorHeight;
  }, [
    editTitle,
    editSubtitle,
    editContent,
    editContentRichHtml,
    editContentBodyFontScale,
    editCode,
    editLanguage,
    editFontSize,
    editEditorHeight,
  ]);

  /** Sincroniza el slide actual; usar `setEditFontSizeState` al hidratar desde el slide para no reescribir el deck. */
  const setEditFontSize = useCallback(
    (value: number | ((prev: number) => number)) => {
      setEditFontSizeState((prev) => {
        const raw = typeof value === "function" ? value(prev) : value;
        const next = Math.min(64, Math.max(8, raw));
        queueMicrotask(() => {
          setSlides((prevSlides) => {
            const i = currentIndexRef.current;
            if (i < 0 || i >= prevSlides.length) return prevSlides;
            const cur = prevSlides[i];
            if (!cur || (cur.fontSize ?? 14) === next) return prevSlides;
            const updated = [...prevSlides];
            updated[i] = patchSlideMediaPanelByElementId(
              cur,
              canvasTextTargetsRef.current.mediaPanelElementId,
              (m) => ({ ...m, fontSize: next }),
            );
            return updated;
          });
        });
        return next;
      });
    },
    [],
  );

  const pushSlidesUndo = useCallback((snapshot: Slide[]) => {
    slidesUndoRef.current = [
      ...slidesUndoRef.current.slice(-(MAX_SLIDES_UNDO - 1)),
      cloneSlideDeck(snapshot),
    ];
    slidesRedoRef.current = [];
  }, []);

  const setCanvasTextEditTarget = useCallback(
    (field: "title" | "subtitle" | "content", elementId: string) => {
      const key =
        field === "title"
          ? "titleElementId"
          : field === "subtitle"
            ? "subtitleElementId"
            : "contentElementId";
      canvasTextTargetsRef.current = {
        ...canvasTextTargetsRef.current,
        [key]: elementId,
      };
    },
    [],
  );

  /** Rellena los buffers de código desde un slide (p. ej. un `mediaPanel` concreto del lienzo). */
  const hydrateCodeEditFromSlide = useCallback((s: Slide) => {
    setEditCode(s.code ?? "");
    setEditLanguage(s.language || "javascript");
    setEditFontSizeState(s.fontSize ?? 14);
    setEditEditorHeight(s.editorHeight ?? 280);
  }, []);

  const setCanvasMediaPanelEditTarget = useCallback(
    (
      elementId: string | null,
      options?: { rehydrateCodeBuffers?: boolean },
    ) => {
      canvasTextTargetsRef.current = {
        ...canvasTextTargetsRef.current,
        mediaPanelElementId: elementId,
      };
      setCanvasMediaPanelElementId(elementId);
      /** Tras `flushSync(commit)` al cambiar de panel con edición activa, el buffer debe ser del `mediaPanel` seleccionado. */
      if (!elementId || !options?.rehydrateCodeBuffers) return;
      const idx = currentIndexRef.current;
      const cur = slidesRef.current[idx];
      if (!cur) return;
      const ensured = ensureSlideCanvasScene(cur);
      const panelEl = ensured.canvasScene?.elements.find(
        (e) => e.id === elementId,
      );
      if (!panelEl || panelEl.kind !== "mediaPanel") return;
      hydrateCodeEditFromSlide(
        slideAppearanceForMediaElement(ensured, panelEl),
      );
    },
    [hydrateCodeEditFromSlide],
  );

  /** Id del `mediaPanel` Presentador 3D a parchear: `explicit` (p. ej. lienzo) o ref del panel activo. */
  const resolvePresenter3dMediaPatchElementId = useCallback(
    (slide: Slide, explicitMediaPanelElementId?: string | null) => {
      if (slide.type !== SLIDE_TYPE.CONTENT) return null;
      const candidateId =
        explicitMediaPanelElementId != null &&
        explicitMediaPanelElementId !== ""
          ? explicitMediaPanelElementId
          : canvasTextTargetsRef.current.mediaPanelElementId;
      if (!candidateId) return null;
      const ensured = ensureSlideCanvasScene(slide);
      const el = ensured.canvasScene?.elements.find((e) => e.id === candidateId);
      if (!el || el.kind !== "mediaPanel") return null;
      const media = readMediaPayloadFromElement(ensured, el);
      if (
        normalizePanelContentKind(media.contentType) !==
        PANEL_CONTENT_KIND.PRESENTER_3D
      ) {
        return null;
      }
      return candidateId;
    },
    [],
  );

  const flushEditsToSlideIndex = useCallback(
    (slideIndex: number) => {
      if (editContentDraftDirtyRef.current) {
        setEditContent(editContentRef.current);
        setEditContentRichHtml(editContentRichHtmlRef.current);
      }
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
          contentRichHtml: editContentRichHtmlRef.current,
          contentBodyFontScale: editContentBodyFontScaleRef.current,
          code: editCodeRef.current,
          language: editLanguageRef.current,
          fontSize: editFontSizeRef.current,
          editorHeight: editEditorHeightRef.current,
        };
        const ensured = ensureSlideCanvasScene(cur);
        const next = applyEditBuffersToSlide(
          ensured,
          buffers,
          canvasTextTargetsRef.current,
        );
        if (!isSlidePatchedDifferentFromBuffers(cur, next)) return prevSlides;
        pushSlidesUndo(prevSlides);
        const updated = [...prevSlides];
        updated[slideIndex] = next;
        return updated;
      });
      setIsEditing(false);
    },
    [pushSlidesUndo, setEditContent, setEditContentRichHtml],
  );

  const commitSlideEdits = useCallback(
    (options?: { keepEditing?: boolean }) => {
      if (editContentDraftDirtyRef.current) {
        setEditContent(editContentRef.current);
        setEditContentRichHtml(editContentRichHtmlRef.current);
      }
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
          contentRichHtml: editContentRichHtmlRef.current,
          contentBodyFontScale: editContentBodyFontScaleRef.current,
          code: editCodeRef.current,
          language: editLanguageRef.current,
          fontSize: editFontSizeRef.current,
          editorHeight: editEditorHeightRef.current,
        };
        const ensured = ensureSlideCanvasScene(cur);
        const next = applyEditBuffersToSlide(
          ensured,
          buffers,
          canvasTextTargetsRef.current,
        );
        if (!isSlidePatchedDifferentFromBuffers(cur, next)) return prevSlides;
        pushSlidesUndo(prevSlides);
        const updated = [...prevSlides];
        updated[slideIndex] = next;
        return updated;
      });
      if (!options?.keepEditing) {
        setIsEditing(false);
      }
    },
    [pushSlidesUndo, setEditContent, setEditContentRichHtml],
  );

  const syncEditFieldsFromSlide = useCallback((s: Slide) => {
    const s2 = ensureSlideCanvasScene(s);
    const tr = defaultCanvasTextEditTargets(s2);
    canvasTextTargetsRef.current = tr;
    setCanvasMediaPanelElementId(tr.mediaPanelElementId);
    const scene = s2.canvasScene!;
    const titleEl = tr.titleElementId
      ? scene.elements.find((e) => e.id === tr.titleElementId)
      : undefined;
    const subtitleEl = tr.subtitleElementId
      ? scene.elements.find((e) => e.id === tr.subtitleElementId)
      : undefined;
    const contentEl = tr.contentElementId
      ? scene.elements.find((e) => e.id === tr.contentElementId)
      : undefined;
    setEditTitle(
      titleEl ? readTextMarkdownFromElement(s2, titleEl) : s2.title,
    );
    setEditSubtitle(
      subtitleEl
        ? readTextMarkdownFromElement(s2, subtitleEl)
        : (s2.subtitle ?? ""),
    );
    if (contentEl?.kind === "markdown") {
      const p = contentEl.payload;
      if (isSlideCanvasTextPayload(p) && p.richHtml?.trim()) {
        setEditContentRichHtml(p.richHtml);
        setEditContentBodyFontScale(
          Math.min(2.5, Math.max(0.5, p.bodyFontScale ?? 1)),
        );
        const fromRichSync = plainTextFromRichHtml(p.richHtml);
        setEditContent(
          p.markdown.trim()
            ? p.markdown
            : fromRichSync.trim()
              ? fromRichSync
              : readTextMarkdownFromElement(s2, contentEl),
        );
      } else {
        setEditContentRichHtml("");
        setEditContentBodyFontScale(1);
        setEditContent(
          formatMarkdown(
            contentEl
              ? readTextMarkdownFromElement(s2, contentEl)
              : (s2.content ?? ""),
          ),
        );
      }
    } else {
      setEditContentRichHtml("");
      setEditContentBodyFontScale(1);
      setEditContent(
        formatMarkdown(
          contentEl ? readTextMarkdownFromElement(s2, contentEl) : s2.content,
        ),
      );
    }
    setEditCode(s2.code || "");
    setEditLanguage(s2.language || "javascript");
    setEditFontSizeState(s2.fontSize || 14);
    setEditEditorHeight(s2.editorHeight ?? 280);
  }, []);

  /**
   * Alinea `titleElementId`, `subtitleElementId`, `contentElementId` y los buffers de edición
   * al bloque del lienzo seleccionado. Si el tipo no coincide, cada id vuelve al “primero en z”
   * de `defaultCanvasTextEditTargets` (misma convención que `syncSlideRootFromCanvas`).
   */
  const syncCanvasTextEditTargetsFromSelection = useCallback(
    (slide: Slide, selectedElement: SlideCanvasElement) => {
      const s2 = ensureSlideCanvasScene(slide);
      const defaults = defaultCanvasTextEditTargets(s2);
      const scene = s2.canvasScene!;

      const isTitle =
        selectedElement.kind === "title" ||
        selectedElement.kind === "chapterTitle";
      const isSubtitle =
        selectedElement.kind === "subtitle" ||
        selectedElement.kind === "chapterSubtitle";
      const isBody =
        selectedElement.kind === "markdown" ||
        selectedElement.kind === "matrixNotes";

      const titleElementId = isTitle
        ? selectedElement.id
        : defaults.titleElementId;
      const subtitleElementId = isSubtitle
        ? selectedElement.id
        : defaults.subtitleElementId;
      const contentElementId = isBody
        ? selectedElement.id
        : defaults.contentElementId;

      canvasTextTargetsRef.current = {
        ...canvasTextTargetsRef.current,
        titleElementId,
        subtitleElementId,
        contentElementId,
      };

      const titleEl = titleElementId
        ? scene.elements.find((e) => e.id === titleElementId)
        : undefined;
      setEditTitle(
        titleEl &&
          (titleEl.kind === "title" || titleEl.kind === "chapterTitle")
          ? readTextMarkdownFromElement(s2, titleEl)
          : s2.title,
      );

      const subtitleEl = subtitleElementId
        ? scene.elements.find((e) => e.id === subtitleElementId)
        : undefined;
      setEditSubtitle(
        subtitleEl &&
          (subtitleEl.kind === "subtitle" ||
            subtitleEl.kind === "chapterSubtitle")
          ? readTextMarkdownFromElement(s2, subtitleEl)
          : (s2.subtitle ?? ""),
      );

      const contentEl =
        contentElementId != null && contentElementId !== ""
          ? scene.elements.find((e) => e.id === contentElementId)
          : undefined;

      if (contentEl?.kind === "markdown") {
        const p = contentEl.payload;
        if (isSlideCanvasTextPayload(p) && p.richHtml?.trim()) {
          setEditContentRichHtml(p.richHtml);
          setEditContentBodyFontScale(
            Math.min(2.5, Math.max(0.5, p.bodyFontScale ?? 1)),
          );
          const fromRich = plainTextFromRichHtml(p.richHtml);
          setEditContent(
            p.markdown.trim()
              ? p.markdown
              : fromRich.trim()
                ? fromRich
                : readTextMarkdownFromElement(s2, contentEl),
          );
        } else {
          setEditContentRichHtml("");
          setEditContentBodyFontScale(1);
          setEditContent(
            formatMarkdown(readTextMarkdownFromElement(s2, contentEl)),
          );
        }
      } else if (contentEl?.kind === "matrixNotes") {
        setEditContentRichHtml("");
        setEditContentBodyFontScale(1);
        setEditContent(
          formatMarkdown(readTextMarkdownFromElement(s2, contentEl)),
        );
      } else {
        setEditContentRichHtml("");
        setEditContentBodyFontScale(1);
        setEditContent(formatMarkdown(s2.content ?? ""));
      }
    },
    [formatMarkdown],
  );

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
        const generated = await generatePresentation.run(
          promptForApi,
          pending.modelId,
          {
            narrativePresetId: pending.deckNarrativePresetId,
            narrativeNotes: pending.narrativeNotes,
          },
        );
        if (cancelled) return;
        const cleanedSlides = normalizeSlidesCanvasScenes(
          generated.slides.map((slide) => ({
            ...slide,
            id: crypto.randomUUID(),
            content: formatMarkdown(slide.content),
          })),
        );
        const resolvedTopic = resolveGeneratedPresentationTitle({
          presentationTitle: generated.presentationTitle,
          slides: cleanedSlides,
          fallbackBrief: pending.topic,
        });
        slidesUndoRef.current = [];
        slidesRedoRef.current = [];
        setSlides(cleanedSlides);
        setCurrentIndex(0);
        setTopic(resolvedTopic);
        setDeckNarrativePresetId(pending.deckNarrativePresetId);
        setNarrativeNotes(pending.narrativeNotes ?? "");
        const presentation: Presentation = {
          topic: resolvedTopic,
          slides: cleanedSlides,
          characterId: selectedCharacterId ?? undefined,
          deckVisualTheme,
          deckNarrativePresetId: pending.deckNarrativePresetId,
          narrativeNotes: pending.narrativeNotes?.trim() || undefined,
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
  }, [
    pendingGeneration,
    autoCloudSyncOnSave,
    user,
    localAccountScope,
    deckVisualTheme,
  ]);

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
      syncEditFieldsFromSlide(currentSlide);
      setIsEditing(false);
    }
  }, [currentIndex, currentSlide?.id, syncEditFieldsFromSlide]);

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
        const cur = updated[currentIndex];
        if (!cur) return prev;
        updated[currentIndex] = patchSlideMediaPanelByElementId(
          cur,
          canvasTextTargetsRef.current.mediaPanelElementId,
          (m) => ({ ...m, editorHeight: clamped }),
        );
      }
      return updated;
    });
  };

  const toggleContentType = () => {
    if (!currentSlide) return;
    const curKind = normalizePanelContentKind(currentSlide.contentType);
    let idx = PANEL_CONTENT_TOGGLE_ORDER.indexOf(curKind);
    if (idx < 0) idx = 0;
    const newType =
      PANEL_CONTENT_TOGGLE_ORDER[(idx + 1) % PANEL_CONTENT_TOGGLE_ORDER.length]!;

    setSlides((prev) => {
      const updated = [...prev];
      const cur = updated[currentIndex];
      if (!cur) return prev;
      let next = patchSlideMediaPanelByElementId(
        cur,
        canvasTextTargetsRef.current.mediaPanelElementId,
        (m) => ({ ...m, contentType: newType }),
      );
      if (newType === PANEL_CONTENT_KIND.PRESENTER_3D) {
        next = patchSlideMediaPanelByElementId(
          next,
          canvasTextTargetsRef.current.mediaPanelElementId,
          (m) => ({
            ...m,
            presenter3dDeviceId: m.presenter3dDeviceId ?? DEFAULT_DEVICE_3D_ID,
            presenter3dScreenMedia: m.presenter3dScreenMedia ?? "image",
          }),
        );
      }
      updated[currentIndex] = next;
      return updated;
    });
  };

  /** Cambia el tipo de la diapositiva actual: capítulo, contenido, diagrama o matriz. */
  const setCurrentSlideType = (type: SlideType) => {
    if (!currentSlide || currentSlide.type === type) return;
    setSlides((prev) => {
      const updated = [...prev];
      const next: Slide = { ...currentSlide, type };
      delete (next as Slide).canvasScene;

      if (type === SLIDE_TYPE.DIAGRAM) {
        delete (next as Slide).contentType;
        delete (next as Slide).contentLayout;
        delete (next as Slide).matrixData;
        delete (next as Slide).isometricFlowData;
        if (!next.excalidrawData) next.excalidrawData = "{}";
      } else if (type === SLIDE_TYPE.ISOMETRIC) {
        delete (next as Slide).contentType;
        delete (next as Slide).contentLayout;
        delete (next as Slide).matrixData;
        delete (next as Slide).excalidrawData;
        if (!next.isometricFlowData) {
          next.isometricFlowData = serializeIsometricFlowDiagram(
            createDefaultIsometricFlowDiagram(),
          );
        }
      } else {
        delete (next as Slide).excalidrawData;
        delete (next as Slide).isometricFlowData;
      }

      if (type === SLIDE_TYPE.CHAPTER) {
        delete (next as Slide).contentType;
        delete (next as Slide).contentLayout;
        delete (next as Slide).matrixData;
      } else if (type === SLIDE_TYPE.MATRIX) {
        delete (next as Slide).contentType;
        delete (next as Slide).contentLayout;
        next.matrixData = normalizeSlideMatrixData(
          next.matrixData ?? createEmptySlideMatrixData(),
        );
      } else if (type === SLIDE_TYPE.CONTENT) {
        delete (next as Slide).matrixData;
        if (!next.contentType) next.contentType = PANEL_CONTENT_KIND.IMAGE;
        if (!next.contentLayout) next.contentLayout = "split";
      }

      updated[currentIndex] = next;
      return updated;
    });
  };

  const patchCurrentSlideMatrix = useCallback(
    (updater: (prev: SlideMatrixData) => SlideMatrixData) => {
      setSlides((prev) => {
        const idx = currentIndexRef.current;
        const cur = prev[idx];
        if (!cur || cur.type !== SLIDE_TYPE.MATRIX) return prev;
        const raw = cur.matrixData ?? createEmptySlideMatrixData();
        const nextMatrix = normalizeSlideMatrixData(updater(raw));
        const out = [...prev];
        out[idx] = { ...cur, matrixData: nextMatrix };
        return out;
      });
    },
    [],
  );

  const patchCurrentSlideCanvasScene = useCallback(
    (updater: (scene: SlideCanvasScene) => SlideCanvasScene) => {
      setSlides((prev) => {
        const idx = currentIndexRef.current;
        const cur = prev[idx];
        if (!cur?.canvasScene) return prev;
        const nextScene = updater(cur.canvasScene);
        const out = [...prev];
        out[idx] = syncSlideRootFromCanvas({
          ...cur,
          canvasScene: nextScene,
        });
        return out;
      });
    },
    [],
  );

  /** Tema claro/oscuro del editor de código solo para un `mediaPanel` del lienzo (payload). */
  const cycleCodeEditorThemeForMediaPanel = useCallback((elementId: string) => {
    setSlides((prev) => {
      const idx = currentIndexRef.current;
      const cur = prev[idx];
      if (!cur?.canvasScene || cur.type !== SLIDE_TYPE.CONTENT) return prev;
      const el = cur.canvasScene.elements.find((e) => e.id === elementId);
      if (!el || el.kind !== "mediaPanel") return prev;
      const media = readMediaPayloadFromElement(cur, el);
      const persisted = readPersistedCodeEditorTheme();
      const effective: SlideCodeEditorTheme =
        media.codeEditorTheme ?? persisted;
      const flipped: SlideCodeEditorTheme =
        effective === "dark" ? "light" : "dark";
      const nextMedia = { ...media, codeEditorTheme: flipped };
      const scene = patchElementPayload(cur.canvasScene, elementId, nextMedia);
      const out = [...prev];
      out[idx] = syncSlideRootFromCanvas({ ...cur, canvasScene: scene });
      return out;
    });
  }, []);

  const addCanvasElementToCurrentSlide = useCallback(
    (
      kind: SlideCanvasElementKind,
      options?: AppendCanvasElementOptions,
    ) => {
      let newMediaPanelId: string | null = null;
      setSlides((prev) => {
        const idx = currentIndexRef.current;
        const raw = prev[idx];
        if (!raw) return prev;
        const cur = ensureSlideCanvasScene(raw);
        const scene = cur.canvasScene;
        if (!scene) return prev;
        const appended = appendCanvasElementToScene(
          cur,
          scene.elements,
          kind,
          options,
        );
        if (!appended) return prev;
        const { elements: nextElements, created } = appended;
        if (created.kind === "mediaPanel") {
          newMediaPanelId = created.id;
        }
        const nextSlide = syncSlideRootFromCanvas({
          ...cur,
          canvasScene: { ...scene, elements: nextElements },
        });
        const out = [...prev];
        out[idx] = nextSlide;
        return out;
      });
      if (newMediaPanelId != null) {
        window.setTimeout(() => {
          setCanvasMediaPanelEditTarget(newMediaPanelId, {
            rehydrateCodeBuffers: true,
          });
        }, 0);
      }
    },
    [setCanvasMediaPanelEditTarget],
  );

  /** Actualiza los datos del diagrama Excalidraw de la diapositiva actual. Solo para type "diagram". */
  const setCurrentSlideExcalidrawData = (data: string) => {
    if (!currentSlide || currentSlide.type !== SLIDE_TYPE.DIAGRAM) return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, excalidrawData: data };
      return updated;
    });
  };

  const setCurrentSlideIsometricFlowData = (data: string) => {
    if (!currentSlide || currentSlide.type !== SLIDE_TYPE.ISOMETRIC) return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, isometricFlowData: data };
      return updated;
    });
  };

  const setCurrentSlideMindMapData = (data: string) => {
    if (!currentSlide || currentSlide.type !== SLIDE_TYPE.MIND_MAP) return;
    setSlides((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...currentSlide, mindMapData: data };
      return updated;
    });
  };

  /** Cambia la distribución del contenido: split = con panel derecho; full = solo texto; panel-full = título + subtítulo arriba y panel a ancho completo. Solo para type "content". */
  const setCurrentSlideContentLayout = (
    contentLayout: "split" | "full" | "panel-full",
  ) => {
    setSlides((prev) => {
      const slide = prev[currentIndex];
      if (!slide || slide.type !== SLIDE_TYPE.CONTENT) return prev;
      if (slide.contentLayout === contentLayout) return prev;
      const updated = [...prev];
      const next: Slide = { ...slide, contentLayout };
      delete (next as Slide).canvasScene;
      updated[currentIndex] = next;
      return updated;
    });
  };

  const setCurrentSlideContentType = (
    contentType: NonNullable<Slide["contentType"]>,
  ) => {
    if (!currentSlide || currentSlide.type !== SLIDE_TYPE.CONTENT) return;
    if (currentSlide.contentType === contentType) return;
    setSlides((prev) => {
      const updated = [...prev];
      const cur = updated[currentIndex];
      if (!cur) return prev;
      let next = patchSlideMediaPanelByElementId(
        cur,
        canvasTextTargetsRef.current.mediaPanelElementId,
        (m) => ({ ...m, contentType }),
      );
      if (contentType === PANEL_CONTENT_KIND.PRESENTER_3D) {
        next = patchSlideMediaPanelByElementId(
          next,
          canvasTextTargetsRef.current.mediaPanelElementId,
          (m) => ({
            ...m,
            presenter3dDeviceId: m.presenter3dDeviceId ?? DEFAULT_DEVICE_3D_ID,
            presenter3dScreenMedia: m.presenter3dScreenMedia ?? "image",
          }),
        );
      }
      updated[currentIndex] = next;
      return updated;
    });
  };

  const setCurrentSlidePresenter3dDeviceId = (
    presenter3dDeviceId: string,
    explicitMediaPanelElementId?: string | null,
  ) => {
    const cur = slidesRef.current[currentIndexRef.current];
    if (!cur || cur.type !== SLIDE_TYPE.CONTENT) return;
    const targetId = resolvePresenter3dMediaPatchElementId(
      cur,
      explicitMediaPanelElementId,
    );
    if (!targetId) return;
    setSlides((prev) => {
      const updated = [...prev];
      const slide = updated[currentIndexRef.current];
      if (!slide) return prev;
      updated[currentIndexRef.current] = patchSlideMediaPanelByElementId(
        slide,
        targetId,
        (m) => ({ ...m, presenter3dDeviceId }),
      );
      return updated;
    });
  };

  const setCurrentSlidePresenter3dScreenMedia = (
    presenter3dScreenMedia: "image" | "video",
    explicitMediaPanelElementId?: string | null,
  ) => {
    const cur = slidesRef.current[currentIndexRef.current];
    if (!cur || cur.type !== SLIDE_TYPE.CONTENT) return;
    const targetId = resolvePresenter3dMediaPatchElementId(
      cur,
      explicitMediaPanelElementId,
    );
    if (!targetId) return;
    setSlides((prev) => {
      const updated = [...prev];
      const slide = updated[currentIndexRef.current];
      if (!slide) return prev;
      updated[currentIndexRef.current] = patchSlideMediaPanelByElementId(
        slide,
        targetId,
        (m) => ({ ...m, presenter3dScreenMedia }),
      );
      return updated;
    });
  };

  const setCurrentSlidePresenter3dViewState = (
    presenter3dViewState: Presenter3dViewState,
    explicitMediaPanelElementId?: string | null,
  ) => {
    const cur = slidesRef.current[currentIndexRef.current];
    if (!cur || cur.type !== SLIDE_TYPE.CONTENT) return;
    const targetId = resolvePresenter3dMediaPatchElementId(
      cur,
      explicitMediaPanelElementId,
    );
    if (!targetId) return;
    setSlides((prev) => {
      const updated = [...prev];
      const slide = updated[currentIndexRef.current];
      if (!slide) return prev;
      updated[currentIndexRef.current] = patchSlideMediaPanelByElementId(
        slide,
        targetId,
        (m) => ({ ...m, presenter3dViewState }),
      );
      return updated;
    });
  };

  const setCurrentSlideCanvas3dGlbUrl = (canvas3dGlbUrl: string) => {
    if (!currentSlide || currentSlide.type !== SLIDE_TYPE.CONTENT) return;
    if (!(resolveMediaPanelDescriptor(currentSlide) instanceof Canvas3dMediaPanelDescriptor)) {
      return;
    }
    setSlides((prev) => {
      const updated = [...prev];
      const cur = updated[currentIndex];
      if (!cur) return prev;
      const trimmed = canvas3dGlbUrl.trim();
      updated[currentIndex] = patchSlideMediaPanelByElementId(
        cur,
        canvasTextTargetsRef.current.mediaPanelElementId,
        (m) => ({
          ...m,
          canvas3dGlbUrl: trimmed || undefined,
          canvas3dViewState: undefined,
        }),
      );
      return updated;
    });
  };

  const setCurrentSlideCanvas3dViewState = (
    canvas3dViewState: Presenter3dViewState,
  ) => {
    if (!currentSlide || currentSlide.type !== SLIDE_TYPE.CONTENT) return;
    if (!(resolveMediaPanelDescriptor(currentSlide) instanceof Canvas3dMediaPanelDescriptor)) {
      return;
    }
    setSlides((prev) => {
      const updated = [...prev];
      const cur = updated[currentIndex];
      if (!cur) return prev;
      updated[currentIndex] = patchSlideMediaPanelByElementId(
        cur,
        canvasTextTargetsRef.current.mediaPanelElementId,
        (m) => ({ ...m, canvas3dViewState }),
      );
      return updated;
    });
  };

  const clearCurrentSlideCanvas3dViewState = () => {
    if (!currentSlide || currentSlide.type !== SLIDE_TYPE.CONTENT) return;
    if (!(resolveMediaPanelDescriptor(currentSlide) instanceof Canvas3dMediaPanelDescriptor)) {
      return;
    }
    setSlides((prev) => {
      const updated = [...prev];
      const cur = updated[currentIndex];
      if (!cur) return prev;
      updated[currentIndex] = patchSlideMediaPanelByElementId(
        cur,
        canvasTextTargetsRef.current.mediaPanelElementId,
        (m) => ({ ...m, canvas3dViewState: undefined }),
      );
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
        deckNarrativePresetId?: string;
        narrativeNotes?: string;
      },
    ): boolean => {
      const saved = displayTopic.trim();
      const fullInput = (options?.modelInput ?? saved).trim();
      if (!fullInput) return false;
      if (!hasAnyApiConfiguredSync()) {
        notifyApiConfigurationRequired();
        return false;
      }
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
        deckNarrativePresetId:
          options?.deckNarrativePresetId ?? deckNarrativePresetId,
        narrativeNotes:
          options?.narrativeNotes !== undefined
            ? options.narrativeNotes
            : narrativeNotes.trim() || undefined,
      });
      return true;
    },
    [presentationModelId, deckNarrativePresetId, narrativeNotes],
  );

  const handleGenerate = (e: React.FormEvent): boolean => {
    e.preventDefault();
    const { modelInput, displayTopic } = composeFullDeckModelInput(
      topic,
      homePromptAttachments,
    );
    if (!modelInput) return false;
    const queued = queueFullDeckGeneration(displayTopic, {
      modelInput: modelInput !== displayTopic ? modelInput : undefined,
    });
    if (queued) setHomePromptAttachments([]);
    return queued;
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
    const queued = queueFullDeckGeneration(displayTopic, {
      modelInput: modelInput !== displayTopic ? modelInput : undefined,
      errorRestore,
      reuseSavedId: currentSavedId,
    });
    if (!queued) return;
    setShowGenerateFullDeckModal(false);
    setGenerateFullDeckTopic("");
    setGenerateFullDeckAttachments([]);
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
    const patchMediaPanelElementId =
      pendingImageGenerateMediaPanelIdRef.current ??
      canvasTextTargetsRef.current.mediaPanelElementId;
    pendingImageGenerateMediaPanelIdRef.current = null;
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
        let nextDeck: Slide[] | null = null;
        setSlides((prev) => {
          const updated = [...prev];
          const cur = updated[currentIndex];
          if (!cur) return prev;
          updated[currentIndex] = patchSlideMediaPanelByElementId(
            cur,
            patchMediaPanelElementId,
            (m) => applyGeneratedImageToMediaPanelPayload(m, imageUrl, promptUsed),
          );
          nextDeck = updated;
          return updated;
        });
        if (nextDeck && nextDeck.length > 0) {
          const savedId = await savePresentationNow({
            topic: topic || "Sin título",
            slides: nextDeck,
            characterId: selectedCharacterId ?? undefined,
          });
          if (!savedId) {
            alert(
              "La imagen se aplicó al lienzo pero no se pudo guardar en el almacenamiento local. Revisa el mensaje de estado o pulsa Guardar.",
            );
          }
        }
        setShowImageModal(false);
        setImagePrompt("");
        trackEvent(ANALYTICS_EVENTS.IMAGE_GENERATED);
        void addGeneratedResource(
          {
            kind: "image",
            payload: imageUrl,
            prompt: promptUsed,
            source: imageProvider,
          },
          localAccountScope,
        )
          .then(() => listGeneratedResources(localAccountScope))
          .then(setGeneratedResources)
          .catch((err) => console.error("Biblioteca de recursos:", err));
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
        const cleanedNewSlides = normalizeSlidesCanvasScenes(
          newSlides.map((slide) => ({
            ...slide,
            id: crypto.randomUUID(),
            content: formatMarkdown(slide.content),
          })),
        );
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
        deckNarrativeSlideOptions,
      );
      const formattedContent = formatMarkdown(result.content);
      setSlides((prev) => {
        const updated = [...prev];
        const slide = updated[currentIndex];
        if (!slide) return prev;
        updated[currentIndex] = replaceFirstMarkdownCanvasBody(
          {
            ...slide,
            title: result.title,
            content: formattedContent,
          },
          formattedContent,
        );
        return updated;
      });
      setEditTitle(result.title);
      setEditContent(formattedContent);
      setEditContentRichHtml("");
      setEditContentBodyFontScale(1);
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
    if (!currentSlide) return;
    const instr = generateSlideContentPrompt.trim();
    if (!instr) return;
    const modelId = usesChatCompletionSlideOps(
      presentationModelOption?.provider,
    )
      ? presentationModelId
      : effectiveGeminiModel;

    if (currentSlide.type === SLIDE_TYPE.MATRIX) {
      setIsProcessing(true);
      try {
        const result = await generateSlideMatrixUseCase.run(
          topic.trim(),
          currentSlide,
          instr,
          modelId,
          deckNarrativeSlideOptions,
        );
        const formattedContent = formatMarkdown(result.content);
        const matrixData = normalizeSlideMatrixData({
          columnHeaders: result.columnHeaders,
          rows: result.rows,
        });
        setSlides((prev) => {
          const updated = [...prev];
          const slide = updated[currentIndex];
          if (!slide || slide.type !== SLIDE_TYPE.MATRIX) return prev;
          updated[currentIndex] = {
            ...slide,
            title: result.title,
            subtitle: result.subtitle.trim() || undefined,
            content: formattedContent,
            matrixData,
          };
          return updated;
        });
        setEditTitle(result.title);
        setEditSubtitle(result.subtitle);
        setEditContent(formattedContent);
        setShowGenerateSlideContentModal(false);
        setGenerateSlideContentPrompt("");
        trackEvent(ANALYTICS_EVENTS.SLIDE_MATRIX_GENERATED);
      } catch (error) {
        console.error("Error generating matrix slide:", error);
        alert("No se pudo generar la tabla con IA.");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (currentSlide.type === SLIDE_TYPE.DIAGRAM) {
      setIsProcessing(true);
      try {
        const result = await generateSlideDiagramUseCase.run(
          topic.trim(),
          currentSlide,
          instr,
          modelId,
          deckNarrativeSlideOptions,
        );
        const notesText = result.content.trim();
        const formattedNotes = notesText ? formatMarkdown(notesText) : "";
        setSlides((prev) => {
          const updated = [...prev];
          const slide = updated[currentIndex];
          if (!slide || slide.type !== SLIDE_TYPE.DIAGRAM) return prev;
          updated[currentIndex] = {
            ...slide,
            title: result.title,
            ...(formattedNotes ? { content: formattedNotes } : {}),
            excalidrawData: result.excalidrawData,
          };
          return updated;
        });
        setEditTitle(result.title);
        if (formattedNotes) setEditContent(formattedNotes);
        setDiagramRemountToken((n) => n + 1);
        setShowGenerateSlideContentModal(false);
        setGenerateSlideContentPrompt("");
        trackEvent(ANALYTICS_EVENTS.SLIDE_DIAGRAM_GENERATED);
      } catch (error) {
        console.error("Error generating diagram slide:", error);
        const detail =
          error instanceof Error && error.message
            ? ` ${error.message}`
            : "";
        alert(
          `No se pudo generar el diagrama con IA.${detail} Prueba un prompt más simple (flujo, arquitectura en cajas y flechas).`,
        );
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (currentSlide.type !== SLIDE_TYPE.CONTENT) return;
    setIsProcessing(true);
    try {
      const result = await generateSlideContentUseCase.run(
        topic.trim(),
        currentSlide,
        instr,
        modelId,
        deckNarrativeSlideOptions,
      );
      const formattedContent = formatMarkdown(result.content);
      setSlides((prev) => {
        const updated = [...prev];
        const slide = updated[currentIndex];
        if (!slide) return prev;
        updated[currentIndex] = replaceFirstMarkdownCanvasBody(
          {
            ...slide,
            title: result.title,
            content: formattedContent,
          },
          formattedContent,
        );
        return updated;
      });
      setEditTitle(result.title);
      setEditContent(formattedContent);
      setEditContentRichHtml("");
      setEditContentBodyFontScale(1);
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
    const patchId =
      pendingVideoUrlMediaPanelIdRef.current ??
      canvasTextTargetsRef.current.mediaPanelElementId;
    pendingVideoUrlMediaPanelIdRef.current = null;
    setSlides((prev) => {
      const updated = [...prev];
      const cur = updated[currentIndex];
      if (!cur) return prev;
      updated[currentIndex] = patchSlideMediaPanelByElementId(
        cur,
        patchId,
        (m) => applyVideoUrlToMediaPanelPayload(m, videoUrlInput.trim()),
      );
      return updated;
    });
    setShowVideoModal(false);
    setVideoUrlInput("");
    trackEvent(ANALYTICS_EVENTS.VIDEO_ADDED);
  };

  const openExportDeckVideoModal = useCallback(() => {
    setShowExportDeckVideoModal(true);
  }, []);

  const flushDiagramPending = useCallback((): string | null => {
    return diagramFlushRef.current?.() ?? null;
  }, []);

  const flushIsometricFlowPending = useCallback((): string | null => {
    return isometricFlowFlushRef.current?.() ?? null;
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
    const pendingIso = flushIsometricFlowPending();
    const idx = currentIndex;
    const buffers = {
      title: editTitleRef.current,
      subtitle: editSubtitleRef.current,
      content: editContentRef.current,
      contentRichHtml: editContentRichHtmlRef.current,
      contentBodyFontScale: editContentBodyFontScaleRef.current,
      code: editCodeRef.current,
      language: editLanguageRef.current,
      fontSize: editFontSizeRef.current,
      editorHeight: editEditorHeightRef.current,
    };
    const merged = slides.map((sl, i) =>
      i === idx
        ? applyEditBuffersToSlide(
            ensureSlideCanvasScene(sl),
            buffers,
            canvasTextTargetsRef.current,
          )
        : sl,
    );
    let s =
      pending != null && merged[idx]?.type === SLIDE_TYPE.DIAGRAM
        ? merged.map((sl, i) =>
            i === idx ? { ...sl, excalidrawData: pending } : sl,
          )
        : merged;
    s =
      pendingIso != null && s[idx]?.type === SLIDE_TYPE.ISOMETRIC
        ? s.map((sl, i) =>
            i === idx ? { ...sl, isometricFlowData: pendingIso } : sl,
          )
        : s;
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
      deckVisualTheme,
      deckNarrativePresetId,
      narrativeNotes,
    };
  }, [
    flushDiagramPending,
    flushIsometricFlowPending,
    slides,
    currentIndex,
    topic,
    currentSavedId,
    selectedCharacterId,
    deckVisualTheme,
    deckNarrativePresetId,
    narrativeNotes,
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
      setDeckVisualThemeState(snap.deckVisualTheme ?? DEFAULT_DECK_VISUAL_THEME);
      setDeckNarrativePresetId(
        snap.deckNarrativePresetId ?? DEFAULT_DECK_NARRATIVE_PRESET_ID,
      );
      setNarrativeNotes(snap.narrativeNotes ?? "");
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
    const generation = ++coverPrefetchGenerationRef.current;
    const scope = localAccountScope;
    const eligible = savedList.filter(
      (m) =>
        m.slideCount > 0 &&
        !m.localBodyCleared &&
        coverPrefetchSavedAtRef.current[m.id] !== m.savedAt,
    );
    if (eligible.length === 0) return;

    void (async () => {
      for (const meta of eligible) {
        if (coverPrefetchSavedAtRef.current[meta.id] === meta.savedAt) continue;
        try {
          const saved = await loadPresentation(meta.id, scope);
          if (coverPrefetchGenerationRef.current !== generation) break;
          if (saved.savedAt !== meta.savedAt) continue;
          coverPrefetchSavedAtRef.current[meta.id] = saved.savedAt;
          const coverUrl = firstSlideDeckCoverImageUrl(saved.slides[0]);
          if (coverUrl) {
            setCoverImageCache((prev) => ({ ...prev, [meta.id]: coverUrl }));
          }
        } catch {
          /* listado ya mostró la tarjeta; fallo al leer portada no bloquea */
        }
      }
    })();

    return () => {
      coverPrefetchGenerationRef.current += 1;
    };
  }, [savedList, localAccountScope]);

  useEffect(() => {
    if (slides.length !== 0) return;
    void refreshSavedList();
  }, [slides.length, localAccountScope, refreshSavedList]);

  const maybeAutoSyncAfterLocalSave = useCallback(
    async (localId: string) => {
      if (!autoCloudSyncOnSave || !user) return;
      if (conflictResolvingRef.current) return;
      if (
        typeof window === "undefined" ||
        (window as unknown as { __TAURI__?: unknown }).__TAURI__ === undefined
      )
        return;
      const fb = await initFirebase();
      if (!fb?.firestore) return;
      void enqueuePresentationCloudPush(localId, async () => {
        try {
          const list = await listPresentations(localAccountScope);
          const meta = list.find((p) => p.id === localId);
          if (!meta || meta.slideCount === 0 || meta.localBodyCleared) return;
          const saved = await loadPresentation(localId, localAccountScope);
          const existingCloudId = meta?.cloudId ?? null;
          const { cloudId, syncedAt, newRevision } =
            await pushPresentationToCloud(user.uid, saved, existingCloudId, {
              localExpectedRevision:
                existingCloudId != null ? (meta?.cloudRevision ?? 0) : null,
            });
          await setPresentationCloudState(localId, cloudId, syncedAt, newRevision, localAccountScope);
          await refreshSavedList();
        } catch (e) {
          if (e instanceof CloudSyncConflictError) {
            try {
              const list2 = await listPresentations(localAccountScope);
              const meta2 = list2.find((p) => p.id === localId);
              const cid = meta2?.cloudId;
              if (!cid) return;
              const saved = await loadPresentation(localId, localAccountScope);
              const { cloudId, syncedAt, newRevision } =
                await pushPresentationToCloud(user.uid, saved, cid, {
                  localExpectedRevision: 0,
                  force: true,
                });
              await setPresentationCloudState(localId, cloudId, syncedAt, newRevision, localAccountScope);
              await refreshSavedList();
            } catch (retryErr) {
              console.error("Auto-sync retry tras conflicto:", retryErr);
            }
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
      deckVisualTheme?: DeckVisualTheme;
      deckNarrativePresetId?: string;
      narrativeNotes?: string;
    }): Promise<string | null> => {
      if (presentation.slides.length === 0) return null;
      const full: Presentation = {
        topic: presentation.topic,
        slides: presentation.slides,
        characterId: presentation.characterId,
        deckVisualTheme:
          presentation.deckVisualTheme ?? deckVisualTheme,
        deckNarrativePresetId:
          presentation.deckNarrativePresetId ?? deckNarrativePresetId,
        narrativeNotes:
          presentation.narrativeNotes !== undefined
            ? presentation.narrativeNotes?.trim() || undefined
            : narrativeNotes.trim() || undefined,
      };
      let savedId: string | null = null;
      try {
        if (currentSavedId) {
          await updatePresentation(
            currentSavedId,
            full,
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
          const id = await savePresentation(full, localAccountScope);
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
      deckVisualTheme,
      deckNarrativePresetId,
      narrativeNotes,
    ],
  );

  const refreshGeneratedResources = useCallback(async () => {
    try {
      const list = await listGeneratedResources(localAccountScope);
      setGeneratedResources(list);
    } catch (e) {
      console.error(e);
      setGeneratedResources([]);
    }
  }, [localAccountScope]);

  useEffect(() => {
    void refreshGeneratedResources();
  }, [refreshGeneratedResources]);

  const deleteGeneratedResourceFromLibrary = useCallback(
    async (id: string) => {
      await deleteGeneratedResource(id, localAccountScope);
      await refreshGeneratedResources();
    },
    [localAccountScope, refreshGeneratedResources],
  );

  const recordGeneratedModel3d = useCallback(
    async (glbDataUrl: string, prompt: string | null) => {
      try {
        await addGeneratedResource(
          {
            kind: "model3d",
            payload: glbDataUrl,
            ...(prompt?.trim() ? { prompt: prompt.trim() } : {}),
            source: "meshy",
          },
          localAccountScope,
        );
        await refreshGeneratedResources();
      } catch (e) {
        console.error(e);
      }
    },
    [localAccountScope, refreshGeneratedResources],
  );

  const applyLibraryImageResource = useCallback(
    async (imageUrl: string, imagePromptLabel?: string) => {
      const slide = slidesRef.current[currentIndexRef.current];
      if (!slide || slide.type !== SLIDE_TYPE.CONTENT) {
        alert(
          "Abre una diapositiva de contenido para aplicar una imagen desde Recursos.",
        );
        return;
      }
      if (
        resolveMediaPanelDescriptor(slide) instanceof
        Canvas3dMediaPanelDescriptor
      ) {
        alert(
          "El bloque seleccionado es Canvas 3D. Cambia a imagen (o otro panel) o usa un modelo 3D desde la sección inferior de Recursos.",
        );
        return;
      }
      const patchMediaPanelElementId =
        canvasTextTargetsRef.current.mediaPanelElementId;
      const label = (imagePromptLabel?.trim() || "Desde biblioteca").slice(
        0,
        2000,
      );
      let nextDeck: Slide[] | null = null;
      setSlides((prev) => {
        const updated = [...prev];
        const cur = updated[currentIndexRef.current];
        if (!cur) return prev;
        updated[currentIndexRef.current] = patchSlideMediaPanelByElementId(
          cur,
          patchMediaPanelElementId,
          (m) => applyGeneratedImageToMediaPanelPayload(m, imageUrl, label),
        );
        nextDeck = updated;
        return updated;
      });
      if (nextDeck && nextDeck.length > 0) {
        const savedId = await savePresentationNow({
          topic: topic || "Sin título",
          slides: nextDeck,
          characterId: selectedCharacterId ?? undefined,
        });
        if (!savedId) {
          alert(
            "La imagen se aplicó pero no se pudo guardar la presentación. Pulsa Guardar si lo necesitas.",
          );
        }
      }
    },
    [savePresentationNow, topic, selectedCharacterId],
  );

  const applyLibraryModel3dResource = useCallback(
    async (glbUrl: string) => {
      const slide = slidesRef.current[currentIndexRef.current];
      if (!slide || slide.type !== SLIDE_TYPE.CONTENT) {
        alert(
          "Abre una diapositiva de contenido para aplicar un modelo 3D desde Recursos.",
        );
        return;
      }
      if (
        !(
          resolveMediaPanelDescriptor(slide) instanceof
          Canvas3dMediaPanelDescriptor
        )
      ) {
        alert(
          "Selecciona un bloque Canvas 3D (o cambia el panel a Canvas 3D) para cargar un modelo guardado.",
        );
        return;
      }
      const trimmed = glbUrl.trim();
      let nextDeck: Slide[] | null = null;
      setSlides((prev) => {
        const updated = [...prev];
        const cur = updated[currentIndexRef.current];
        if (!cur) return prev;
        updated[currentIndexRef.current] = patchSlideMediaPanelByElementId(
          cur,
          canvasTextTargetsRef.current.mediaPanelElementId,
          (m) => ({
            ...m,
            canvas3dGlbUrl: trimmed || undefined,
            canvas3dViewState: undefined,
          }),
        );
        nextDeck = updated;
        return updated;
      });
      if (nextDeck && nextDeck.length > 0) {
        const savedId = await savePresentationNow({
          topic: topic || "Sin título",
          slides: nextDeck,
          characterId: selectedCharacterId ?? undefined,
        });
        if (!savedId) {
          alert(
            "El modelo se aplicó pero no se pudo guardar la presentación. Pulsa Guardar si lo necesitas.",
          );
        }
      }
    },
    [savePresentationNow, topic, selectedCharacterId],
  );

  const applyDeckVisualTheme = useCallback(
    async (theme: DeckVisualTheme) => {
      const t = normalizeDeckVisualTheme(theme);
      setDeckVisualThemeState(t);
      if (slides.length === 0) return;
      await savePresentationNow({
        topic: topic || "Sin título",
        slides,
        characterId: selectedCharacterId ?? undefined,
        deckVisualTheme: t,
      });
    },
    [
      slides,
      topic,
      selectedCharacterId,
      savePresentationNow,
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
    const deck = normalizeSlidesCanvasScenes([blankSlide]);
    setTopic("");
    setSlides(deck);
    setCurrentIndex(0);
    setCurrentSavedId(null);
    setSelectedCharacterId(null);
    setDeckVisualThemeState(DEFAULT_DECK_VISUAL_THEME);
    setDeckNarrativePresetId(DEFAULT_DECK_NARRATIVE_PRESET_ID);
    setNarrativeNotes("");
    await savePresentationNow({
      topic: "",
      slides: deck,
      characterId: undefined,
      deckVisualTheme: DEFAULT_DECK_VISUAL_THEME,
      deckNarrativePresetId: DEFAULT_DECK_NARRATIVE_PRESET_ID,
      narrativeNotes: undefined,
    });
    await refreshSavedList();
  }, [savePresentationNow, refreshSavedList]);

  const handleSave = async () => {
    if (slides.length === 0) return;
    const pendingDiagram = flushDiagramPending();
    const pendingIsometric = flushIsometricFlowPending();
    const idx = currentIndexRef.current;
    const buffers = {
      title: editTitleRef.current,
      subtitle: editSubtitleRef.current,
      content: editContentRef.current,
      contentRichHtml: editContentRichHtmlRef.current,
      contentBodyFontScale: editContentBodyFontScaleRef.current,
      code: editCodeRef.current,
      language: editLanguageRef.current,
      fontSize: editFontSizeRef.current,
      editorHeight: editEditorHeightRef.current,
    };
    const merged = slides.map((s, i) =>
      i === idx
        ? applyEditBuffersToSlide(
            ensureSlideCanvasScene(s),
            buffers,
            canvasTextTargetsRef.current,
          )
        : s,
    );
    let slidesToSave =
      pendingDiagram != null && merged[idx]?.type === SLIDE_TYPE.DIAGRAM
        ? merged.map((s, i) =>
            i === idx ? { ...s, excalidrawData: pendingDiagram } : s,
          )
        : merged;
    slidesToSave =
      pendingIsometric != null && slidesToSave[idx]?.type === SLIDE_TYPE.ISOMETRIC
        ? slidesToSave.map((s, i) =>
            i === idx ? { ...s, isometricFlowData: pendingIsometric } : s,
          )
        : slidesToSave;

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
                localSlideCount: meta?.slideCount,
                remoteSlideCount: e.remoteSlideCount,
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
    async (localId: string, cloudId: string, presentationOwnerUid?: string) => {
      if (!user) {
        throw new Error("Inicia sesión para recuperar desde la nube.");
      }
      const owner = presentationOwnerUid ?? user.uid;
      const { presentation: pulled, cloudRevision } =
        await pullPresentationFromCloud(owner, cloudId);
      await importSavedPresentation(
        {
          ...pulled,
          id: localId,
        },
        localAccountScope,
      );
      if (owner !== user.uid) {
        await setPresentationCloudState(
          localId,
          null,
          new Date().toISOString(),
          cloudRevision,
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
    },
    [user, localAccountScope, refreshSavedList],
  );

  const maybePullCloudPresentationBeforeLoad = useCallback(
    async (localId: string, meta: SavedPresentationMeta | undefined) => {
      if (!user || !meta) return;
      const ref = resolvePresentationCloudRef(meta, user.uid);
      if (!ref) return;
      try {
        if (meta.localBodyCleared) {
          await rehydratePresentationFromMyCloud(
            localId,
            ref.cloudId,
            ref.ownerUid === user.uid ? undefined : ref.ownerUid,
          );
          return;
        }
        const remoteRev = await getCloudPresentationRevision(
          ref.ownerUid,
          ref.cloudId,
        );
        const localRev = meta.cloudRevision ?? 0;
        if (remoteRev > localRev) {
          await rehydratePresentationFromMyCloud(
            localId,
            ref.cloudId,
            ref.ownerUid === user.uid ? undefined : ref.ownerUid,
          );
        }
      } catch (e) {
        if (meta.localBodyCleared) throw e;
        console.warn("No se pudo comprobar o bajar la versión en la nube al abrir:", e);
      }
    },
    [user, rehydratePresentationFromMyCloud],
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
      if (metaOpen?.localBodyCleared && !user) {
        alert("Inicia sesión para recuperar la copia desde la nube.");
        return;
      }
      try {
        await maybePullCloudPresentationBeforeLoad(id, metaOpen);
      } catch (e) {
        if (metaOpen?.localBodyCleared) {
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
        normalizeSlidesCanvasScenes(
          saved.slides.map((s) => ({
            ...s,
            id: crypto.randomUUID(),
            content: formatMarkdown(s.content ?? ""),
          })),
        ),
      );
      setCurrentIndex(0);
      setCurrentSavedId(saved.id);
      setSelectedCharacterId(saved.characterId ?? null);
      setDeckVisualThemeState(
        normalizeDeckVisualTheme(saved.deckVisualTheme),
      );
      setDeckNarrativePresetId(
        saved.deckNarrativePresetId ?? DEFAULT_DECK_NARRATIVE_PRESET_ID,
      );
      setNarrativeNotes(saved.narrativeNotes ?? "");
      setShowSavedListModal(false);
      try {
        sessionStorage.setItem(lastOpenedSessionKey, id);
      } catch {
        // ignore
      }
      coverPrefetchSavedAtRef.current[saved.id] = saved.savedAt;
      const coverUrl = firstSlideDeckCoverImageUrl(saved.slides[0]);
      if (coverUrl) {
        setCoverImageCache((prev) => ({ ...prev, [saved.id]: coverUrl }));
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
        try {
          await rehydratePresentationFromMyCloud(existing.id, cloudId);
        } catch (e) {
          console.error(e);
          alert(
            `No se pudo recuperar: ${formatCloudSyncUserMessage(e)}`,
          );
          return;
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
        if (user) {
          let metaRestore: SavedPresentationMeta | undefined;
          try {
            const list = await listPresentations(localAccountScope);
            metaRestore = list.find((p) => p.id === id);
          } catch {
            metaRestore = undefined;
          }
          try {
            await maybePullCloudPresentationBeforeLoad(id, metaRestore);
          } catch {
            /* cuerpo vacío: sin sesión o fallo de red; se sigue con copia local si existe */
          }
        }
        const saved = await loadPresentation(id, localAccountScope);
        slidesUndoRef.current = [];
        slidesRedoRef.current = [];
        setTopic(saved.topic);
        setSlides(
          normalizeSlidesCanvasScenes(
            saved.slides.map((s) => ({
              ...s,
              id: crypto.randomUUID(),
              content: formatMarkdown(s.content ?? ""),
            })),
          ),
        );
        setCurrentIndex(0);
        setCurrentSavedId(saved.id);
        setSelectedCharacterId(saved.characterId ?? null);
        setDeckVisualThemeState(
          normalizeDeckVisualTheme(saved.deckVisualTheme),
        );
        setDeckNarrativePresetId(
          saved.deckNarrativePresetId ?? DEFAULT_DECK_NARRATIVE_PRESET_ID,
        );
        setNarrativeNotes(saved.narrativeNotes ?? "");
        coverPrefetchSavedAtRef.current[saved.id] = saved.savedAt;
        const coverUrlRestore = firstSlideDeckCoverImageUrl(saved.slides[0]);
        if (coverUrlRestore) {
          setCoverImageCache((prev) => ({ ...prev, [saved.id]: coverUrlRestore }));
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
    }, [
      formatMarkdown,
      lastOpenedSessionKey,
      localAccountScope,
      user,
      maybePullCloudPresentationBeforeLoad,
    ]);

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
        setDeckVisualThemeState(DEFAULT_DECK_VISUAL_THEME);
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
        setDeckVisualThemeState(DEFAULT_DECK_VISUAL_THEME);
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
        setDeckVisualThemeState(DEFAULT_DECK_VISUAL_THEME);
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
      if (!getGeminiApiKey()?.trim()) {
        alert(
          "La portada Slaim se genera con Gemini. Configura tu API key de Gemini en Ajustes de la app.",
        );
        return;
      }
      const mascotReferenceImageDataUrl =
        await loadSlaimMascotCoverReferenceDataUrl();
      const imageUrl = await generateImageUseCase.run({
        providerId: "gemini",
        slideContext,
        userPrompt: buildDeckCoverImageUserPrompt(),
        stylePrompt: DECK_COVER_STYLE_PROMPT,
        includeBackground: true,
        modelId: geminiImageModelId,
        characterPrompt: SLAIM_MASCOT_COVER_CHARACTER_PROMPT,
        characterReferenceImageDataUrl: mascotReferenceImageDataUrl,
        aspectRatio: "16:9",
      });
      if (imageUrl) {
        const updatedSlides = [...saved.slides];
        updatedSlides[0] = {
          ...firstSlide,
          imageUrl,
          imagePrompt: DECK_COVER_IMAGE_PROMPT,
        };
        await updatePresentation(
          id,
          {
            topic: saved.topic,
            slides: updatedSlides,
            characterId: saved.characterId,
            deckVisualTheme: normalizeDeckVisualTheme(saved.deckVisualTheme),
            deckNarrativePresetId: saved.deckNarrativePresetId,
            narrativeNotes: saved.narrativeNotes,
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
          "No se pudo generar la portada con Gemini. Comprueba tu API key y el modelo de imagen en Ajustes.",
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
    conflictResolvingRef.current = true;
    try {
      const { presentation, cloudRevision } =
        await pullPresentationFromCloud(user.uid, cloudId);
      await updatePresentation(
        localId,
        {
          topic: presentation.topic,
          slides: presentation.slides,
          characterId: presentation.characterId,
          deckVisualTheme: normalizeDeckVisualTheme(
            presentation.deckVisualTheme,
          ),
          deckNarrativePresetId: presentation.deckNarrativePresetId,
          narrativeNotes: presentation.narrativeNotes,
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
          normalizeSlidesCanvasScenes(
            presentation.slides.map((s) => ({
              ...s,
              id: crypto.randomUUID(),
              content: formatMarkdown(s.content ?? ""),
            })),
          ),
        );
        setSelectedCharacterId(presentation.characterId ?? null);
        setDeckVisualThemeState(
          normalizeDeckVisualTheme(presentation.deckVisualTheme),
        );
        setDeckNarrativePresetId(
          presentation.deckNarrativePresetId ??
            DEFAULT_DECK_NARRATIVE_PRESET_ID,
        );
        setNarrativeNotes(presentation.narrativeNotes ?? "");
      }
      await refreshSavedList();
    } catch (e) {
      console.error(e);
      alert(
        `No se pudo traer la versión de la nube: ${formatCloudSyncUserMessage(e)}`,
      );
    } finally {
      conflictResolvingRef.current = false;
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
    conflictResolvingRef.current = true;
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
    } finally {
      conflictResolvingRef.current = false;
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
    setSlides(normalizeSlidesCanvasScenes([blankSlide]));
    setCurrentIndex(0);
    setCurrentSavedId(null);
    setSelectedCharacterId(null);
    setDeckVisualThemeState(DEFAULT_DECK_VISUAL_THEME);
    setDeckNarrativePresetId(DEFAULT_DECK_NARRATIVE_PRESET_ID);
    setNarrativeNotes("");
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
    setDeckVisualThemeState(DEFAULT_DECK_VISUAL_THEME);
    setDeckNarrativePresetId(DEFAULT_DECK_NARRATIVE_PRESET_ID);
    setNarrativeNotes("");
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
        "Personaje aislado (avatar de referencia) para presentaciones: un solo diseño coherente en todas las escenas. Imagen sobre fondo blanco liso (sin rejilla de transparencia ni cuadritos); sin texto ni elementos decorativos de interfaz alrededor.";
      const providerId = hasGemini ? "gemini" : imageProvider;
      const imageModelId =
        providerId === "gemini"
          ? geminiImageModelId
          : DEFAULT_OPENAI_IMAGE_MODEL_ID;
      return generateImageUseCase.run({
        providerId,
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
    const next = normalizeSlidesCanvasScenes([
      ...slides.slice(0, index + 1),
      newSlide,
      ...slides.slice(index + 1),
    ]);
    setSlides(next);
    setCurrentIndex(index + 1);
    savePresentationNow({
      topic: topic || "Sin título",
      slides: next,
      characterId: selectedCharacterId ?? undefined,
    });
  };

  const moveSlide = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    let nextDeck: Slide[] | null = null;
    setSlides((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length
      ) {
        return prev;
      }
      const copy = [...prev];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      nextDeck = normalizeSlidesCanvasScenes(copy);
      return nextDeck;
    });
    if (!nextDeck) return;
    setCurrentIndex((prev) => {
      if (prev === fromIndex) return toIndex;
      if (fromIndex < toIndex) {
        if (prev > fromIndex && prev <= toIndex) return prev - 1;
      } else if (fromIndex > toIndex) {
        if (prev >= toIndex && prev < fromIndex) return prev + 1;
      }
      return prev;
    });
    void savePresentationNow({
      topic: topic || "Sin título",
      slides: nextDeck,
      characterId: selectedCharacterId ?? undefined,
    });
  };

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const prevSlide = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const openImageModal = useCallback(
    (options?: { mediaPanelElementId?: string | null }) => {
      const explicit = options?.mediaPanelElementId;
      pendingImageGenerateMediaPanelIdRef.current =
        explicit != null && explicit !== ""
          ? explicit
          : canvasTextTargetsRef.current.mediaPanelElementId;
      const slide = slidesRef.current[currentIndexRef.current];
      setImagePrompt(slide?.imagePrompt || "");
      setShowImageModal(true);
    },
    [],
  );

  const openImageUploadModal = useCallback(
    (options?: { mediaPanelElementId?: string | null }) => {
      const explicit = options?.mediaPanelElementId;
      pendingImageUploadMediaPanelIdRef.current =
        explicit != null && explicit !== ""
          ? explicit
          : canvasTextTargetsRef.current.mediaPanelElementId;
      setShowImageUploadModal(true);
    },
    [],
  );

  const openVideoModal = useCallback(
    (options?: { mediaPanelElementId?: string | null; initialVideoUrl?: string }) => {
      const explicit = options?.mediaPanelElementId;
      pendingVideoUrlMediaPanelIdRef.current =
        explicit != null && explicit !== ""
          ? explicit
          : canvasTextTargetsRef.current.mediaPanelElementId;
      const slide = slidesRef.current[currentIndexRef.current];
      setVideoUrlInput(options?.initialVideoUrl ?? slide?.videoUrl ?? "");
      setShowVideoModal(true);
    },
    [],
  );

  /**
   * Incrusta una imagen en el slide de contenido actual: actualiza el panel de media
   * objetivo (seleccionado o por defecto), o crea un `mediaPanel` nuevo con rect opcional.
   */
  const ingestImageFileOnCurrentSlide = useCallback(
    (
      file: File,
      placement: "patchTargetPanel" | "newPanel",
      newPanelRect?: SlideCanvasRect,
      callbacks?: {
        onAfterApply?: () => void;
        /** Drop sobre un `mediaPanel` concreto: actualizar ese bloque en lugar del ref. */
        patchMediaPanelElementId?: string;
      },
    ) => {
      if (!isUsableSlideImageFile(file)) return;
      const reader = new FileReader();
      reader.onload = () => {
        void (async () => {
          let dataUrl = coerceImageDataUrlForSlideFile(
            reader.result as string,
            file,
          );
          try {
            dataUrl = await optimizeImageDataUrl(dataUrl);
          } catch {
            /* mantener original */
          }
          setSlides((prev) => {
            const index = currentIndexRef.current;
            const raw = prev[index];
            if (!raw || raw.type !== SLIDE_TYPE.CONTENT) return prev;
            const cur = ensureSlideCanvasScene(raw);
            const scene = cur.canvasScene;
            if (!scene) return prev;

            if (placement === "newPanel") {
              const appendOpts: AppendCanvasElementOptions = {
                mediaContentType: PANEL_CONTENT_KIND.IMAGE,
                mediaPanelPayloadOverrides: {
                  imageUrl: dataUrl,
                  contentType: PANEL_CONTENT_KIND.IMAGE,
                },
              };
              if (newPanelRect) {
                appendOpts.insertRectOverride = newPanelRect;
              }
              const appended = appendCanvasElementToScene(
                cur,
                scene.elements,
                "mediaPanel",
                appendOpts,
              );
              if (!appended) return prev;
              const { elements: nextElements, created } = appended;
              const updated = [...prev];
              updated[index] = syncSlideRootFromCanvas({
                ...cur,
                canvasScene: { ...scene, elements: nextElements },
              });
              if (created.kind === "mediaPanel") {
                window.setTimeout(() => {
                  setCanvasMediaPanelEditTarget(created.id, {
                    rehydrateCodeBuffers: true,
                  });
                }, 0);
              }
              return updated;
            }

            const explicitPatchId = callbacks?.patchMediaPanelElementId?.trim();
            if (explicitPatchId) {
              const el = scene.elements.find((x) => x.id === explicitPatchId);
              if (el?.kind === "mediaPanel") {
                const updated = [...prev];
                updated[index] = patchSlideMediaPanelByElementId(
                  cur,
                  explicitPatchId,
                  (m) => applyImageDataUrlToMediaPanelPayload(m, dataUrl),
                );
                return updated;
              }
            }

            const targetId =
              canvasTextTargetsRef.current.mediaPanelElementId ??
              defaultCanvasTextEditTargets(cur).mediaPanelElementId;

            const updated = [...prev];
            if (targetId) {
              updated[index] = patchSlideMediaPanelByElementId(
                cur,
                targetId,
                (m) => applyImageDataUrlToMediaPanelPayload(m, dataUrl),
              );
              return updated;
            }

            const appended = appendCanvasElementToScene(
              cur,
              scene.elements,
              "mediaPanel",
              {
                mediaContentType: PANEL_CONTENT_KIND.IMAGE,
                mediaPanelPayloadOverrides: {
                  imageUrl: dataUrl,
                  contentType: PANEL_CONTENT_KIND.IMAGE,
                },
              },
            );
            if (!appended) return prev;
            const { elements: nextElements, created } = appended;
            updated[index] = syncSlideRootFromCanvas({
              ...cur,
              canvasScene: { ...scene, elements: nextElements },
            });
            if (created.kind === "mediaPanel") {
              window.setTimeout(() => {
                setCanvasMediaPanelEditTarget(created.id, {
                  rehydrateCodeBuffers: true,
                });
              }, 0);
            }
            return updated;
          });
          callbacks?.onAfterApply?.();
        })();
      };
      reader.readAsDataURL(file);
    },
    [setCanvasMediaPanelEditTarget],
  );

  const handleImageUpload = (file: File) => {
    if (!currentSlide) return;
    const patchId = pendingImageUploadMediaPanelIdRef.current;
    pendingImageUploadMediaPanelIdRef.current = null;
    ingestImageFileOnCurrentSlide(file, "patchTargetPanel", undefined, {
      onAfterApply: () => setShowImageUploadModal(false),
      patchMediaPanelElementId: patchId ?? undefined,
    });
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
        const cur = updated[currentIndex];
        if (!cur) return prev;
        updated[currentIndex] = patchSlideMediaPanelByElementId(
          cur,
          canvasTextTargetsRef.current.mediaPanelElementId,
          (m) => ({
            ...m,
            code,
            language: codeGenLanguage,
            contentType: PANEL_CONTENT_KIND.CODE,
          }),
        );
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
    deckVisualTheme,
    applyDeckVisualTheme,
    deckNarrativePresetId,
    setDeckNarrativePresetId,
    narrativeNotes,
    setNarrativeNotes,
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
    openVideoModal,
    showExportDeckVideoModal,
    setShowExportDeckVideoModal,
    openExportDeckVideoModal,
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
    generatedResources,
    refreshGeneratedResources,
    deleteGeneratedResourceFromLibrary,
    applyLibraryImageResource,
    applyLibraryModel3dResource,
    recordGeneratedModel3d,
    isGeneratingCharacterPreview,
    generateCharacterPreview,
    isPreviewMode,
    setIsPreviewMode,
    diagramFlushRef,
    isometricFlowFlushRef,
    diagramRemountToken,
    captureWorkspaceSnapshot,
    flushDiagramPending,
    flushIsometricFlowPending,
    isEditing,
    setIsEditing,
    editTitle,
    setEditTitle,
    editSubtitle,
    setEditSubtitle,
    editContent,
    setEditContent,
    applyEditContentRichDraft,
    editContentRichHtml,
    setEditContentRichHtml,
    editContentBodyFontScale,
    setEditContentBodyFontScale,
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
    setCanvasTextEditTarget,
    syncCanvasTextEditTargetsFromSelection,
    setCanvasMediaPanelEditTarget,
    hydrateCodeEditFromSlide,
    canvasMediaPanelElementId,
    toggleContentType,
    setCurrentSlideType,
    setCurrentSlideExcalidrawData,
    setCurrentSlideIsometricFlowData,
    setCurrentSlideMindMapData,
    patchCurrentSlideMatrix,
    patchCurrentSlideCanvasScene,
    cycleCodeEditorThemeForMediaPanel,
    addCanvasElementToCurrentSlide,
    setCurrentSlideContentLayout,
    setCurrentSlideContentType,
    setCurrentSlidePresenter3dDeviceId,
    setCurrentSlidePresenter3dScreenMedia,
    setCurrentSlidePresenter3dViewState,
    setCurrentSlideCanvas3dGlbUrl,
    setCurrentSlideCanvas3dViewState,
    clearCurrentSlideCanvas3dViewState,
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
    moveSlide,
    nextSlide,
    prevSlide,
    openImageModal,
    openImageUploadModal,
    handleImageUpload,
    ingestImageFileOnCurrentSlide,
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
