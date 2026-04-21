import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Slide,
  ImageStyle,
  SavedCharacter,
  GeneratedResourceEntry,
  SavedPresentationMeta,
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
import { formatMarkdown } from "../utils/markdown";
import {
  AUTO_CLOUD_SYNC_STORAGE_KEY,
  DEFAULT_IMAGE_WIDTH_PERCENT,
  DEFAULT_PANEL_HEIGHT_PERCENT,
  MAX_SLIDES_UNDO,
} from "../presentation/state/presentationConstants";
import {
  LAST_OPENED_PRESENTATION_KEY,
  type HomeTab,
} from "../presentation/state/presentationTypes";
import {
  cloneSlideDeck,
  applyImageDataUrlToMediaPanelPayload,
  applyVideoUrlToMediaPanelPayload,
  applyGeneratedImageToMediaPanelPayload,
} from "../presentation/state/presentationMediaHelpers";
import { usePresentationSlideEditing } from "../presentation/state/usePresentationSlideEditing";
import { usePresentationEditorTabs } from "../presentation/state/usePresentationEditorTabs";
import { usePresentationDeckMutations } from "../presentation/state/usePresentationDeckMutations";
import { usePresentationEditorKeyboard } from "../presentation/state/usePresentationEditorKeyboard";
import { usePresentationSlideCanvasMutations } from "../presentation/state/usePresentationSlideCanvasMutations";
import { usePresentationSlideResizeGestures } from "../presentation/state/usePresentationSlideResizeGestures";
import { usePresentationHomeCards } from "../presentation/state/usePresentationHomeCards";
import { usePresentationSavePresentation } from "../presentation/state/usePresentationSavePresentation";
import { usePresentationManualSave } from "../presentation/state/usePresentationManualSave";
import {
  applySavedPresentationToEditorState,
  type ApplySavedPresentationEditorContext,
} from "../presentation/state/applySavedPresentationToEditorState";
import { presentationQueryKeys } from "../presentation/queryKeys";
import {
  useSavedPresentations,
  useSavedCharacters,
  useGeneratedResourcesList,
} from "../queries/presentationQueries";
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
  type SlideCanvasRect,
} from "../domain/entities";
import {
  normalizeSlidesCanvasScenes,
  ensureSlideCanvasScene,
} from "../domain/slideCanvas/ensureSlideCanvasScene";
import {
  defaultCanvasTextEditTargets,
  isSlidePatchedDifferentFromBuffers,
  patchSlideMediaPanelByElementId,
  replaceFirstMarkdownCanvasBody,
  type CanvasTextEditTargets,
} from "../domain/slideCanvas/slideCanvasApplyEditBuffers";
import {
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
  pullPresentationFromCloud,
  deleteOwnerPresentationFromCloud,
  CloudSyncConflictError,
  getCloudPresentationRevision,
  resolvePresentationCloudRef,
} from "../services/presentationCloud";
import { initFirebase } from "../services/firebase";
import { formatCloudSyncUserMessage } from "../utils/cloudSyncErrors";
import { useAuth } from "../context/AuthContext";
import { IMAGE_STYLES } from "../constants/imageStyles";
import { useUIStore, createUISetter } from "../store/useUIStore";
import { useSlidesStore, createSlidesSetter } from "../store/useSlidesStore";
import { useEditorStore, createEditorSetter } from "../store/useEditorStore";
import { useConfigStore, createConfigSetter } from "../store/useConfigStore";
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
import {
  PANEL_CONTENT_KIND,
  resolveMediaPanelDescriptor,
  Canvas3dMediaPanelDescriptor,
} from "../domain/panelContent";

/** Re-export público para consumidores que importaban desde este archivo. */
export {
  LAST_OPENED_PRESENTATION_KEY,
  type HomeTab,
  type EditorWorkspaceSnapshot,
  type EditorTab,
} from "../presentation/state/presentationTypes";

export function usePresentationState() {
  
  const slidesState = useSlidesStore();
  const topic = slidesState.topic;
  const setTopic = useCallback(createSlidesSetter("topic"), []);
  const slides = slidesState.slides;
  const setSlides = useCallback(createSlidesSetter("slides"), []);
  const currentIndex = slidesState.currentIndex;
  const setCurrentIndex = useCallback(createSlidesSetter("currentIndex"), []);

  const editorState = useEditorStore();
  const isEditing = editorState.isEditing;
  const setIsEditing = useCallback(createEditorSetter("isEditing"), []);
  const editTitle = editorState.editTitle;
  const setEditTitleState = useCallback(createEditorSetter("editTitle"), []);
  const editSubtitle = editorState.editSubtitle;
  const setEditSubtitleState = useCallback(createEditorSetter("editSubtitle"), []);
  const editContent = editorState.editContent;
  const setEditContentState = useCallback(createEditorSetter("editContent"), []);
  const editContentRichHtml = editorState.editContentRichHtml;
  const setEditContentRichHtmlState = useCallback(createEditorSetter("editContentRichHtml"), []);
  const editCode = editorState.editCode;
  const setEditCode = useCallback(createEditorSetter("editCode"), []);
  const editLanguage = editorState.editLanguage;
  const setEditLanguage = useCallback(createEditorSetter("editLanguage"), []);
  const editFontSize = editorState.editFontSize;
  const setEditFontSizeState = useCallback(createEditorSetter("editFontSize"), []);
  const editEditorHeight = editorState.editEditorHeight;
  const setEditEditorHeight = useCallback(createEditorSetter("editEditorHeight"), []);
  const clipboardElement = editorState.clipboardElement;
  const setClipboardElement = useCallback(createEditorSetter("clipboardElement"), []);
  const canvasMediaPanelElementId = editorState.canvasMediaPanelElementId;
  const setCanvasMediaPanelElementId = useCallback(createEditorSetter("canvasMediaPanelElementId"), []);

  const configState = useConfigStore();
  const deckVisualTheme = configState.deckVisualTheme;
  const setDeckVisualThemeState = useCallback(createConfigSetter("deckVisualTheme"), []);
  const deckNarrativePresetId = configState.deckNarrativePresetId;
  const setDeckNarrativePresetId = useCallback(createConfigSetter("deckNarrativePresetId"), []);
  const narrativeNotes = configState.narrativeNotes;
  const setNarrativeNotes = useCallback(createConfigSetter("narrativeNotes"), []);
  const presentationModelId = configState.presentationModelId;
  const setPresentationModelId = useCallback(createConfigSetter("presentationModelId"), []);
  const autoCloudSyncOnSave = configState.autoCloudSyncOnSave;
  const apiKeysVersion = configState.apiKeysVersion;
  const setApiKeysVersion = useCallback(createConfigSetter("apiKeysVersion"), []);

  const uiState = useUIStore();
  const showImageModal = uiState.showImageModal;
  const setShowImageModal = useCallback(createUISetter("showImageModal"), []);
  const showImageUploadModal = uiState.showImageUploadModal;
  const setShowImageUploadModal = useCallback(createUISetter("showImageUploadModal"), []);
  const showSplitModal = uiState.showSplitModal;
  const setShowSplitModal = useCallback(createUISetter("showSplitModal"), []);
  const showRewriteModal = uiState.showRewriteModal;
  const setShowRewriteModal = useCallback(createUISetter("showRewriteModal"), []);
  const showGenerateFullDeckModal = uiState.showGenerateFullDeckModal;
  const setShowGenerateFullDeckModal = useCallback(createUISetter("showGenerateFullDeckModal"), []);
  const showGenerateSlideContentModal = uiState.showGenerateSlideContentModal;
  const setShowGenerateSlideContentModal = useCallback(createUISetter("showGenerateSlideContentModal"), []);
  const showVideoModal = uiState.showVideoModal;
  const setShowVideoModal = useCallback(createUISetter("showVideoModal"), []);
  const showExportDeckVideoModal = uiState.showExportDeckVideoModal;
  const setShowExportDeckVideoModal = useCallback(createUISetter("showExportDeckVideoModal"), []);
  const showSavedListModal = uiState.showSavedListModal;
  const setShowSavedListModal = useCallback(createUISetter("showSavedListModal"), []);
  const showSpeechModal = uiState.showSpeechModal;
  const setShowSpeechModal = useCallback(createUISetter("showSpeechModal"), []);
  const isSidebarOpen = uiState.isSidebarOpen;
  const setIsSidebarOpen = useCallback(createUISetter("isSidebarOpen"), []);
  const isNotesPanelOpen = uiState.isNotesPanelOpen;
  const setIsNotesPanelOpen = useCallback(createUISetter("isNotesPanelOpen"), []);
  const showCodeGenModal = uiState.showCodeGenModal;
  const setShowCodeGenModal = useCallback(createUISetter("showCodeGenModal"), []);
  const showCharacterCreatorModal = uiState.showCharacterCreatorModal;
  const setShowCharacterCreatorModal = useCallback(createUISetter("showCharacterCreatorModal"), []);
  const showCharactersPanel = uiState.showCharactersPanel;
  const setShowCharactersPanel = useCallback(createUISetter("showCharactersPanel"), []);
  const showSlideStylePanel = uiState.showSlideStylePanel;
  const setShowSlideStylePanel = useCallback(createUISetter("showSlideStylePanel"), []);
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

  const queryClient = useQueryClient();
  const savedPresentationsQuery = useSavedPresentations(localAccountScope);
  const savedList = savedPresentationsQuery.data ?? [];
  const savedCharactersQuery = useSavedCharacters(localAccountScope);
  const savedCharacters = savedCharactersQuery.data ?? [];
  const generatedResourcesQuery = useGeneratedResourcesList(localAccountScope);
  const generatedResources = generatedResourcesQuery.data ?? [];

      const slidesRef = useRef<Slide[]>(slides);
  slidesRef.current = slides;

  /** Actualizado tras `usePresentationDeckMutations` para que el listener de teclado use la misma navegación que la UI. */
  const deckNavigationRef = useRef<{ nextSlide: () => void; prevSlide: () => void }>(
    {
      nextSlide: () => {},
      prevSlide: () => {},
    },
  );

  const deckNarrativeSlideOptions = useMemo(
    () => ({
      deckNarrativeContext: buildDeckNarrativeContextForPrompts(
        deckNarrativePresetId,
        narrativeNotes,
      ),
    }),
    [deckNarrativePresetId, narrativeNotes],
  );
    const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPromptAlternatives, setIsGeneratingPromptAlternatives] =
    useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generateFullDeckTopic, setGenerateFullDeckTopic] = useState("");
  const [homePromptAttachments, setHomePromptAttachments] = useState<
    PromptAttachment[]
  >([]);
  const [generateFullDeckAttachments, setGenerateFullDeckAttachments] =
    useState<PromptAttachment[]>([]);
  const [generateSlideContentPrompt, setGenerateSlideContentPrompt] =
    useState("");
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
            const [editContentBodyFontScale, setEditContentBodyFontScale] = useState(1);
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

  const setEditTitle = useCallback((value: string | ((prev: string) => string)) => {
    if (typeof value === "string") editTitleRef.current = value;
    setEditTitleState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      editTitleRef.current = next;
      return next;
    });
  }, []);

  const setEditSubtitle = useCallback((value: string | ((prev: string) => string)) => {
    if (typeof value === "string") editSubtitleRef.current = value;
    setEditSubtitleState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      editSubtitleRef.current = next;
      return next;
    });
  }, []);
  /** Destinos de edición por bloque en el lienzo (título/subtítulo/cuerpo/panel). */
  const canvasTextTargetsRef = useRef<CanvasTextEditTargets>({
    titleElementId: null,
    subtitleElementId: null,
    contentElementId: null,
    mediaPanelElementId: null,
  });

  const slideEditing = usePresentationSlideEditing({
    slidesRef,
    slidesUndoRef,
    slidesRedoRef,
    currentIndexRef,
    isEditingRef,
    editTitleRef,
    editSubtitleRef,
    editContentRef,
    editContentRichHtmlRef,
    editContentBodyFontScaleRef,
    editContentDraftDirtyRef,
    editCodeRef,
    editLanguageRef,
    editFontSizeRef,
    editEditorHeightRef,
    canvasTextTargetsRef,
    setSlides,
    setIsEditing,
    setEditTitle,
    setEditSubtitle,
    setEditContentState,
    setEditContentRichHtmlState,
    setEditContentBodyFontScale,
    setEditCode,
    setEditLanguage,
    setEditFontSizeState,
    setEditEditorHeight,
    setCanvasMediaPanelElementId,
    editContent,
    editContentRichHtml,
    editContentBodyFontScale,
    editCode,
    editLanguage,
    editFontSize,
    editEditorHeight,
    currentIndex,
    isEditing,
  });

  const {
    applyEditContentRichDraft,
    setEditContent,
    setEditContentRichHtml,
    setEditFontSize,
    setCanvasTextEditTarget,
    hydrateCodeEditFromSlide,
    setCanvasMediaPanelEditTarget,
    resolvePresenter3dMediaPatchElementId,
    flushEditsToSlideIndex,
    commitSlideEdits,
    syncEditFieldsFromSlide,
    syncCanvasTextEditTargetsFromSelection,
    applySlidesUndo,
    applySlidesRedo,
    handleSaveManualEdit,
  } = slideEditing;

      /** Panel `mediaPanel` objetivo mientras el modal de subida/generación está abierto (el ref puede quedar stale tras el file picker). */
  const pendingImageUploadMediaPanelIdRef = useRef<string | null>(null);
  const pendingImageGenerateMediaPanelIdRef = useRef<string | null>(null);
  const pendingVideoUrlMediaPanelIdRef = useRef<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingPanelHeight, setIsResizingPanelHeight] = useState(false);
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [homeTab, setHomeTab] = useState<HomeTab>("recent");
  const [speechGeneralPrompt, setSpeechGeneralPrompt] = useState("");
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
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
    const [cloudSyncConflict, setCloudSyncConflict] = useState<{
    localId: string;
    cloudId: string;
    expectedRevision: number;
    remoteRevision: number;
    localSlideCount?: number;
    remoteSlideCount?: number;
  } | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null,
  );

  const {
    editorTabs,
    activeEditorTabId,
    diagramFlushRef,
    isometricFlowFlushRef,
    diagramRemountToken,
    setDiagramRemountToken,
    presentationTitleDraftRef,
    captureWorkspaceSnapshot,
    applyWorkspaceSnapshot,
    setPresentationTitleDraft,
    flushDiagramPending,
    flushIsometricFlowPending,
    switchEditorTab,
    addEditorTab,
    closeEditorTab,
    clearEditorTabsForGoHome,
  } = usePresentationEditorTabs({
    localAccountScope,
    slides,
    setSlides,
    topic,
    setTopic,
    currentIndex,
    setCurrentIndex,
    currentSavedId,
    setCurrentSavedId,
    selectedCharacterId,
    setSelectedCharacterId,
    deckVisualTheme,
    setDeckVisualThemeState,
    deckNarrativePresetId,
    setDeckNarrativePresetId,
    narrativeNotes,
    setNarrativeNotes,
    slidesUndoRef,
    slidesRedoRef,
    editTitleRef,
    editSubtitleRef,
    editContentRef,
    editContentRichHtmlRef,
    editContentBodyFontScaleRef,
    editCodeRef,
    editLanguageRef,
    editFontSizeRef,
    editEditorHeightRef,
    canvasTextTargetsRef,
  });
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
    createConfigSetter("autoCloudSyncOnSave")(value);
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
    slidesUndoRef.current = [];
    slidesRedoRef.current = [];
    setSlides([]);
    setTopic("");
    setHomePromptAttachments([]);
    setCurrentSavedId(null);
    setSelectedCharacterId(null);
    setCurrentIndex(0);
    clearEditorTabsForGoHome();
  }, [localAccountScope, clearEditorTabsForGoHome]);

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
        void queryClient.invalidateQueries({
          queryKey: presentationQueryKeys.savedPresentations(localAccountScope),
        });
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
    queryClient,
  ]);

  usePresentationSlideResizeGestures({
    isResizing,
    setIsResizing,
    isResizingPanelHeight,
    setIsResizingPanelHeight,
    currentIndex,
    setSlides,
  });

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

  usePresentationEditorKeyboard({
    deckNavigationRef,
    isEditing,
    isPreviewMode,
    setIsPreviewMode,
    applySlidesUndo,
    applySlidesRedo,
  });

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

  const {
    patchCurrentSlideMatrix,
    patchCurrentSlideCanvasScene,
    cycleCodeEditorThemeForMediaPanel,
    addCanvasElementToCurrentSlide,
    setCurrentSlideExcalidrawData,
    setCurrentSlideIsometricFlowData,
    setCurrentSlideMindMapData,
    setCurrentSlideContentLayout,
    setCurrentSlideContentType,
    setCurrentSlidePresenter3dDeviceId,
    setCurrentSlidePresenter3dScreenMedia,
    setCurrentSlidePresenter3dViewState,
    setCurrentSlideCanvas3dGlbUrl,
    setCurrentSlideCanvas3dViewState,
    clearCurrentSlideCanvas3dViewState,
  } = usePresentationSlideCanvasMutations({
    setSlides,
    currentIndexRef,
    slidesRef,
    canvasTextTargetsRef,
    setCanvasMediaPanelEditTarget,
    resolvePresenter3dMediaPatchElementId,
  });

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
          .then(() =>
            queryClient.invalidateQueries({
              queryKey: presentationQueryKeys.generatedResources(
                localAccountScope,
              ),
            }),
          )
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

  const {
    homeCloudSharedListWarning,
    refreshCloudMineSnapshot,
    homePresentationCards,
  } = usePresentationHomeCards({
    user,
    firebaseReady,
    savedList,
  });

  const refreshSavedList = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: presentationQueryKeys.savedPresentations(localAccountScope),
    });
    void refreshCloudMineSnapshot();
  }, [queryClient, localAccountScope, refreshCloudMineSnapshot]);

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

  const { savePresentationNow } = usePresentationSavePresentation({
    currentSavedId,
    setCurrentSavedId,
    deckVisualTheme,
    deckNarrativePresetId,
    narrativeNotes,
    setSaveMessage,
    localAccountScope,
    lastOpenedSessionKey,
    autoCloudSyncOnSave,
    user,
    maybeAutoSyncAfterLocalSave,
  });

  const {
    toggleContentType,
    setCurrentSlideType,
    deleteSlideAt,
    insertSlideAfter,
    moveSlide,
    nextSlide,
    prevSlide,
  } = usePresentationDeckMutations({
    slides,
    setSlides,
    currentIndex,
    setCurrentIndex,
    topic,
    selectedCharacterId,
    canvasTextTargetsRef,
    savePresentationNow,
  });

  deckNavigationRef.current = { nextSlide, prevSlide };

  const refreshGeneratedResources = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: presentationQueryKeys.generatedResources(localAccountScope),
    });
  }, [queryClient, localAccountScope]);

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
      if (
        !slide ||
        (slide.type !== SLIDE_TYPE.CONTENT &&
          slide.type !== SLIDE_TYPE.CHAPTER)
      ) {
        alert(
          "Abre una diapositiva (Contenido o Capítulo) para aplicar una imagen desde Recursos.",
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
      if (
        !slide ||
        (slide.type !== SLIDE_TYPE.CONTENT &&
          slide.type !== SLIDE_TYPE.CHAPTER)
      ) {
        alert(
          "Abre una diapositiva (Contenido o Capítulo) para aplicar un modelo 3D desde Recursos.",
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

  const { handleSave } = usePresentationManualSave({
    slides,
    setSlides,
    topic,
    setTopic,
    selectedCharacterId,
    currentIndexRef,
    editTitleRef,
    editSubtitleRef,
    editContentRef,
    editContentRichHtmlRef,
    editContentBodyFontScaleRef,
    editCodeRef,
    editLanguageRef,
    editFontSizeRef,
    editEditorHeightRef,
    canvasTextTargetsRef,
    presentationTitleDraftRef,
    flushDiagramPending,
    flushIsometricFlowPending,
    savePresentationNow,
    setIsSaving,
    setSaveMessage,
  });

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
      await savedPresentationsQuery.refetch();
    } catch (e) {
      console.error(e);
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

  const applySavedEditorCtxRef = useRef(
    {} as ApplySavedPresentationEditorContext,
  );
  applySavedEditorCtxRef.current = {
    slidesUndoRef,
    slidesRedoRef,
    setTopic,
    setSlides,
    setCurrentIndex,
    setCurrentSavedId,
    setSelectedCharacterId,
    setDeckVisualThemeState,
    setDeckNarrativePresetId,
    setNarrativeNotes,
    coverPrefetchSavedAtRef,
    setCoverImageCache,
  };

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
        queryClient.setQueryData(
          presentationQueryKeys.savedPresentations(localAccountScope),
          listFresh,
        );
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
      applySavedPresentationToEditorState(saved, applySavedEditorCtxRef.current);
      setShowSavedListModal(false);
      try {
        sessionStorage.setItem(lastOpenedSessionKey, id);
      } catch {
        // ignore
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
        applySavedPresentationToEditorState(
          saved,
          applySavedEditorCtxRef.current,
        );
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
      queryClient.setQueryData(
        presentationQueryKeys.savedPresentations(localAccountScope),
        (prev: SavedPresentationMeta[] | undefined) =>
          (prev ?? []).filter((p) => p.id !== id),
      );
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
  }, [deletePresentationId, currentSavedId, queryClient, localAccountScope]);

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
      queryClient.setQueryData(
        presentationQueryKeys.savedPresentations(localAccountScope),
        (prev: SavedPresentationMeta[] | undefined) =>
          (prev ?? []).filter((p) => p.id !== id),
      );
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
  }, [
    deletePresentationId,
    user,
    currentSavedId,
    localAccountScope,
    queryClient,
  ]);

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
    clearEditorTabsForGoHome();
    try {
      sessionStorage.removeItem(lastOpenedSessionKey);
    } catch {
      // ignore
    }
  };

  const refreshSavedCharacters = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: presentationQueryKeys.savedCharacters(localAccountScope),
    });
  }, [queryClient, localAccountScope]);

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
          void queryClient.invalidateQueries({
            queryKey: presentationQueryKeys.savedCharacters(localAccountScope),
          });
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
    clipboardElement,
    setClipboardElement,
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
