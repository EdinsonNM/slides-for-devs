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
  GeneratedResourceEntry,
  SavedPresentationMeta,
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
import { formatMarkdown } from "../utils/markdown";
import {
  AUTO_CLOUD_SYNC_STORAGE_KEY,
  DEFAULT_IMAGE_WIDTH_PERCENT,
  DEFAULT_PANEL_HEIGHT_PERCENT,
} from "../presentation/state/presentationConstants";
import {
  LAST_OPENED_PRESENTATION_KEY,
  type HomeTab,
} from "../presentation/state/presentationTypes";
import { usePresentationSlideEditing } from "../presentation/state/usePresentationSlideEditing";
import { usePresentationEditorTabs } from "../presentation/state/usePresentationEditorTabs";
import { usePresentationDeckMutations } from "../presentation/state/usePresentationDeckMutations";
import { usePresentationEditorKeyboard } from "../presentation/state/usePresentationEditorKeyboard";
import { usePresentationSlideCanvasMutations } from "../presentation/state/usePresentationSlideCanvasMutations";
import { usePresentationSlideResizeGestures } from "../presentation/state/usePresentationSlideResizeGestures";
import { usePresentationHomeCards } from "../presentation/state/usePresentationHomeCards";
import { usePresentationSavePresentation } from "../presentation/state/usePresentationSavePresentation";
import { usePresentationManualSave } from "../presentation/state/usePresentationManualSave";
import { usePresentationCloudPresentation } from "../presentation/state/usePresentationCloudPresentation";
import type { PresentationCloudResolveRemoteEditorDeps } from "../presentation/state/presentationCloudPresentationDeps";
import { usePresentationSavedLibrary } from "../presentation/state/usePresentationSavedLibrary";
import { usePresentationDeckCovers } from "../presentation/state/usePresentationDeckCovers";
import { presentationQueryKeys } from "../presentation/queryKeys";
import {
  useSavedPresentations,
  useSavedCharacters,
  useGeneratedResourcesList,
} from "../queries/presentationQueries";
import {
  normalizeSlidesCanvasScenes,
} from "../domain/slideCanvas/ensureSlideCanvasScene";
import {
  isSlidePatchedDifferentFromBuffers,
  patchSlideMediaPanelByElementId,
  type CanvasTextEditTargets,
} from "../domain/slideCanvas/slideCanvasApplyEditBuffers";
import {
  readTextMarkdownFromElement,
  slideAppearanceForMediaElement,
  type SlideCanvasMediaPayload,
} from "../domain/slideCanvas/slideCanvasPayload";
import { isSlideCanvasTextPayload } from "../domain/entities/SlideCanvas";
import { plainTextFromRichHtml } from "../utils/slideRichText";
import {
  getGeminiApiKey,
  getOpenAIApiKey,
  getXaiApiKey,
  getGroqApiKey,
  getCerebrasApiKey,
  getOpenRouterApiKey,
} from "../services/apiConfig";
import {
  migrateJsonPresentations,
  localAccountScopeForUser,
} from "../services/storage";
import { useAuth } from "../context/AuthContext";
import { IMAGE_STYLES } from "../constants/imageStyles";
import { useUIStore, createUISetter } from "../store/useUIStore";
import { useSlidesStore, createSlidesSetter } from "../store/useSlidesStore";
import { useEditorStore, createEditorSetter } from "../store/useEditorStore";
import { useConfigStore, createConfigSetter } from "../store/useConfigStore";
import {
  PRESENTATION_MODELS,
  DEFAULT_PRESENTATION_MODEL_ID,
} from "../constants/presentationModels";
import {
  GEMINI_IMAGE_MODELS,
  DEFAULT_GEMINI_IMAGE_MODEL_ID,
} from "../constants/geminiImageModels";
import { usePresentationAiModals } from "../presentation/state/usePresentationAiModals";
import { usePresentationCharactersResources } from "../presentation/state/usePresentationCharactersResources";
import { DEFAULT_DEVICE_3D_ID } from "../constants/device3d";

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

  const queryClient = useQueryClient();
  const savedPresentationsQuery = useSavedPresentations(localAccountScope);
  const savedList = savedPresentationsQuery.data ?? [];
  const openSavedPresentationRef = useRef<(id: string) => Promise<void>>(
    async () => {},
  );
  const cloudResolveRemoteEditorDepsRef =
    useRef<PresentationCloudResolveRemoteEditorDeps | null>(null);
  const runAutoSyncAfterSaveRef = useRef<(id: string) => Promise<void>>(
    async () => {},
  );

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

  const cloudPresentation = usePresentationCloudPresentation({
    user,
    localAccountScope,
    autoCloudSyncOnSave,
    savedList,
    refreshSavedList,
    openSavedPresentationRef,
    resolveRemoteEditorDepsRef: cloudResolveRemoteEditorDepsRef,
  });

  const {
    maybeAutoSyncAfterLocalSave,
    handleSyncPresentationToCloud,
    maybePullCloudPresentationBeforeLoad,
    handleDownloadFromCloud,
    openSharePresentationModal,
    closeSharePresentationModal,
    dismissCloudSyncConflict,
    resolveCloudConflictUseRemote,
    resolveCloudConflictForceLocal,
    syncingToCloudId,
    downloadingCloudKey,
    sharePresentationLocalId,
    cloudSyncConflict,
  } = cloudPresentation;

  runAutoSyncAfterSaveRef.current = maybeAutoSyncAfterLocalSave;

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
  const {
    generatingCoverId,
    coverImageCache,
    setCoverImageCache,
    coverPrefetchSavedAtRef,
    handleGenerateCoverForPresentation,
  } = usePresentationDeckCovers({
    savedList,
    localAccountScope,
    geminiImageModelId,
    user,
    autoCloudSyncOnSave,
    runAutoSyncAfterSaveRef,
  });

  const [deletePresentationId, setDeletePresentationId] = useState<string | null>(
    null,
  );
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

  const savedLibrary = usePresentationSavedLibrary({
    queryClient,
    localAccountScope,
    savedList,
    user,
    lastOpenedSessionKey,
    maybePullCloudPresentationBeforeLoad,
    openSavedPresentationRef,
    refetchSavedPresentationsForModal: () =>
      savedPresentationsQuery.refetch(),
    setShowSavedListModal,
    deletePresentationId,
    setDeletePresentationId,
    currentSavedId,
    setCurrentSavedId,
    setTopic,
    setSlides,
    slidesUndoRef,
    slidesRedoRef,
    setCurrentIndex,
    setSelectedCharacterId,
    setDeckVisualThemeState,
    setDeckNarrativePresetId,
    setNarrativeNotes,
    coverPrefetchSavedAtRef,
    setCoverImageCache,
    refreshSavedList,
  });

  const {
    openSavedListModal,
    handleOpenSaved,
    restoreLastOpenedPresentation,
    requestDeletePresentation,
    closeDeletePresentationModal,
    deletePresentationTarget,
    confirmDeletePresentationLocalOnly,
    confirmClearPresentationLocalKeepCloud,
    confirmDeletePresentationLocalAndCloud,
  } = savedLibrary;

  /** Pestaña activa del panel derecho estilo Figma. */
  const [inspectorSection, setInspectorSection] = useState<
    "slide" | "characters" | "notes" | "theme" | "resources" | null
  >("slide");

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

  const openExportDeckVideoModal = useCallback(() => {
    setShowExportDeckVideoModal(true);
  }, []);

  useEffect(() => {
    if (slides.length !== 0) return;
    void refreshSavedList();
  }, [slides.length, localAccountScope, refreshSavedList]);

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
    pendingGeneration,
    clearPendingGeneration,
    resetHomePromptAttachments,
    isGeneratingImage,
    isGeneratingPromptAlternatives,
    isProcessing,
    generateFullDeckTopic,
    setGenerateFullDeckTopic,
    homePromptAttachments,
    generateFullDeckAttachments,
    setGenerateFullDeckAttachments,
    generateSlideContentPrompt,
    setGenerateSlideContentPrompt,
    imagePrompt,
    setImagePrompt,
    splitPrompt,
    setSplitPrompt,
    rewritePrompt,
    setRewritePrompt,
    videoUrlInput,
    setVideoUrlInput,
    speechGeneralPrompt,
    setSpeechGeneralPrompt,
    isGeneratingSpeech,
    codeGenPrompt,
    setCodeGenPrompt,
    codeGenLanguage,
    setCodeGenLanguage,
    isGeneratingCode,
    handleGenerate,
    openGenerateFullDeckModal,
    handleConfirmGenerateFullDeck,
    addHomePromptAttachment,
    removeHomePromptAttachment,
    addGenerateFullDeckAttachment,
    removeGenerateFullDeckAttachment,
    handleImageGenerate,
    handleGeneratePromptAlternatives,
    handleSplitSlide,
    handleRewriteSlide,
    handleGenerateSlideContentAi,
    handleSaveVideoUrl,
    openImageModal,
    openImageUploadModal,
    openVideoModal,
    ingestImageFileOnCurrentSlide,
    handleImageUpload,
    openCodeGenModal,
    handleGenerateCode,
    setPresenterNotesForCurrentSlide,
    handleGeneratePresenterNotes,
    handleGenerateSpeechForCurrentSlide,
    handleRefinePresenterNotes,
    handleGenerateSpeechForAll,
  } = usePresentationAiModals({
    queryClient,
    localAccountScope,
    lastOpenedSessionKey,
    slides,
    setSlides,
    slidesUndoRef,
    slidesRedoRef,
    topic,
    setTopic,
    currentIndex,
    setCurrentIndex,
    currentSavedId,
    setCurrentSavedId,
    selectedCharacterId,
    deckVisualTheme,
    deckNarrativePresetId,
    narrativeNotes,
    setDeckNarrativePresetId,
    setNarrativeNotes,
    presentationModelId,
    presentationModelOption,
    effectiveGeminiModel,
    modelForGeminiOps,
    deckNarrativeSlideOptions,
    currentSlide,
    slidesRef,
    currentIndexRef,
    canvasTextTargetsRef,
    pendingImageGenerateMediaPanelIdRef,
    pendingImageUploadMediaPanelIdRef,
    pendingVideoUrlMediaPanelIdRef,
    setDiagramRemountToken,
    setEditTitle,
    setEditSubtitle,
    setEditContent,
    setEditContentRichHtml,
    setEditContentBodyFontScale,
    setEditCode,
    setEditLanguage,
    savePresentationNow,
    runAutoSyncAfterSaveRef,
    user,
    autoCloudSyncOnSave,
    showImageModal,
    setShowImageModal,
    setShowImageUploadModal,
    setShowSplitModal,
    setShowRewriteModal,
    setShowVideoModal,
    setShowGenerateFullDeckModal,
    setShowGenerateSlideContentModal,
    setShowCodeGenModal,
    setShowSpeechModal,
    geminiImageModelId,
    imageProvider,
    selectedStyle,
    includeBackground,
    savedCharacters,
    setCanvasMediaPanelEditTarget,
  });

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
    resetHomePromptAttachments();
    setCurrentSavedId(null);
    setSelectedCharacterId(null);
    setCurrentIndex(0);
    clearEditorTabsForGoHome();
  }, [localAccountScope, clearEditorTabsForGoHome, resetHomePromptAttachments]);

  const {
    isSyncingCharactersCloud,
    isGeneratingCharacterPreview,
    refreshGeneratedResources,
    refreshSavedCharacters,
    deleteGeneratedResourceFromLibrary,
    recordGeneratedModel3d,
    applyLibraryImageResource,
    applyLibraryModel3dResource,
    saveCharacter: handleSaveCharacter,
    deleteCharacter: handleDeleteCharacter,
    handlePushAllCharactersToCloud,
    handlePullCharactersFromCloud,
    generateCharacterPreview,
  } = usePresentationCharactersResources({
    queryClient,
    localAccountScope,
    user,
    autoCloudSyncOnSave,
    savedCharacters,
    setSlides,
    slidesRef,
    currentIndexRef,
    canvasTextTargetsRef,
    topic,
    selectedCharacterId,
    setSelectedCharacterId,
    savePresentationNow,
    hasGemini,
    imageProvider,
    geminiImageModelId,
    selectedStyle,
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
    clearPendingGeneration();
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
  }, [savePresentationNow, refreshSavedList, clearPendingGeneration]);

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

  const goHome = () => {
    slidesUndoRef.current = [];
    slidesRedoRef.current = [];
    setSlides([]);
    setTopic("");
    resetHomePromptAttachments();
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

  cloudResolveRemoteEditorDepsRef.current = {
    currentSavedId,
    setTopic,
    slidesUndoRef,
    slidesRedoRef,
    setSlides,
    setSelectedCharacterId,
    setDeckVisualThemeState,
    setDeckNarrativePresetId,
    setNarrativeNotes,
    formatMarkdown,
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
