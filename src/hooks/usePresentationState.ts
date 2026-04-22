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
import { DEFAULT_DECK_NARRATIVE_PRESET_ID } from "../constants/presentationNarrativePresets";
import { formatMarkdown } from "../utils/markdown";
import {
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
import { localAccountScopeForUser } from "../services/storage";
import { cleanupDuplicatePresentations } from "../services/storage";
import { useAuth } from "../context/AuthContext";
import { IMAGE_STYLES } from "../constants/imageStyles";
import {
  GEMINI_IMAGE_MODELS,
  DEFAULT_GEMINI_IMAGE_MODEL_ID,
} from "../constants/geminiImageModels";
import { usePresentationAiModals } from "../presentation/state/usePresentationAiModals";
import { usePresentationCharactersResources } from "../presentation/state/usePresentationCharactersResources";
import { usePresentationStoreBridge } from "../presentation/state/usePresentationStoreBridge";
import { usePresentationModelCatalog } from "../presentation/state/usePresentationModelCatalog";
import { usePresentationBootstrapPersistence } from "../presentation/state/usePresentationBootstrapPersistence";
import { usePresentationEditorLifecycleEffects } from "../presentation/state/usePresentationEditorLifecycleEffects";
import { useDeckNarrativeSlideOptions } from "../presentation/state/useDeckNarrativeSlideOptions";
import { usePresentationOrchestratorRefSync } from "../presentation/state/usePresentationOrchestratorRefSync";
import type { ApplySavedPresentationEditorContext } from "../presentation/state/applySavedPresentationToEditorState";
import type { WebCloudEditSession } from "../presentation/state/webCloudSession";
import { DEFAULT_DEVICE_3D_ID } from "../constants/device3d";
import {
  PRESENTER_MODE_STORAGE_KEY,
  PRESENTER_MODES,
  isPresenterMode,
} from "../constants/presenterModes";

/** Re-export público para consumidores que importaban desde este archivo. */
export {
  LAST_OPENED_PRESENTATION_KEY,
  type HomeTab,
  type EditorWorkspaceSnapshot,
  type EditorTab,
} from "../presentation/state/presentationTypes";

export function usePresentationState() {
  const {
    topic,
    setTopic,
    slides,
    setSlides,
    currentIndex,
    setCurrentIndex,
    isEditing,
    setIsEditing,
    editTitle,
    setEditTitleState,
    editSubtitle,
    setEditSubtitleState,
    editContent,
    setEditContentState,
    editContentRichHtml,
    setEditContentRichHtmlState,
    editCode,
    setEditCode,
    editLanguage,
    setEditLanguage,
    editFontSize,
    setEditFontSizeState,
    editEditorHeight,
    setEditEditorHeight,
    clipboardElement,
    setClipboardElement,
    canvasMediaPanelElementId,
    setCanvasMediaPanelElementId,
    deckVisualTheme,
    setDeckVisualThemeState,
    deckNarrativePresetId,
    setDeckNarrativePresetId,
    narrativeNotes,
    setNarrativeNotes,
    presentationModelId,
    setPresentationModelId,
    autoCloudSyncOnSave,
    apiKeysVersion,
    setApiKeysVersion,
    showImageModal,
    setShowImageModal,
    showImageUploadModal,
    setShowImageUploadModal,
    showSplitModal,
    setShowSplitModal,
    showRewriteModal,
    setShowRewriteModal,
    showGenerateFullDeckModal,
    setShowGenerateFullDeckModal,
    showGenerateSlideContentModal,
    setShowGenerateSlideContentModal,
    showVideoModal,
    setShowVideoModal,
    showIframeEmbedModal,
    setShowIframeEmbedModal,
    showExportDeckVideoModal,
    setShowExportDeckVideoModal,
    showSavedListModal,
    setShowSavedListModal,
    showSpeechModal,
    setShowSpeechModal,
    isSidebarOpen,
    setIsSidebarOpen,
    isNotesPanelOpen,
    setIsNotesPanelOpen,
    showCodeGenModal,
    setShowCodeGenModal,
    showCharacterCreatorModal,
    setShowCharacterCreatorModal,
    showCharactersPanel,
    setShowCharactersPanel,
    showSlideStylePanel,
    setShowSlideStylePanel,
  } = usePresentationStoreBridge();

  const { setAutoCloudSyncOnSave } = usePresentationBootstrapPersistence();

  const { user, firebaseReady } = useAuth();
  const localAccountScope = useMemo(
    () => localAccountScopeForUser(user?.uid),
    [user?.uid],
  );
  const webCloudSessionRef = useRef<WebCloudEditSession | null>(null);
  const applySavedPresentationForCloudWebRef = useRef<
    ApplySavedPresentationEditorContext | null
  >(null);
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
    await refreshCloudMineSnapshot();
  }, [queryClient, localAccountScope, refreshCloudMineSnapshot]);

  const cleanedScopesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (cleanedScopesRef.current.has(localAccountScope)) return;
    cleanedScopesRef.current.add(localAccountScope);
    cleanupDuplicatePresentations(localAccountScope)
      .then((removed) => {
        if (removed > 0) {
          void refreshSavedList();
        }
      })
      .catch((e) => {
        console.warn("Cleanup de duplicados de presentaciones:", e);
      });
  }, [localAccountScope, refreshSavedList]);

  const cloudPresentation = usePresentationCloudPresentation({
    user,
    localAccountScope,
    autoCloudSyncOnSave,
    savedList,
    refreshSavedList,
    openSavedPresentationRef,
    resolveRemoteEditorDepsRef: cloudResolveRemoteEditorDepsRef,
    applySavedPresentationForCloudWebRef,
    webCloudSessionRef,
  });

  const {
    maybeAutoSyncAfterLocalSave,
    handleSyncPresentationToCloud,
    maybePullCloudPresentationBeforeLoad,
    handleDownloadFromCloud,
    handleDeleteCloudOnlyMine,
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

  const savedCharactersQuery = useSavedCharacters(localAccountScope);
  const savedCharacters = savedCharactersQuery.data ?? [];
  const generatedResourcesQuery = useGeneratedResourcesList(localAccountScope);
  const generatedResources = generatedResourcesQuery.data ?? [];

  const slidesRef = useRef<Slide[]>(slides);

  /** Actualizado tras `usePresentationDeckMutations` para que el listener de teclado use la misma navegación que la UI. */
  const deckNavigationRef = useRef<{ nextSlide: () => void; prevSlide: () => void }>(
    {
      nextSlide: () => {},
      prevSlide: () => {},
    },
  );

  const deckNarrativeSlideOptions = useDeckNarrativeSlideOptions(
    deckNarrativePresetId,
    narrativeNotes,
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
  const [presenterMode, setPresenterMode] = useState(() => {
    if (typeof window === "undefined") return PRESENTER_MODES.POWERPOINT;
    const stored = window.localStorage.getItem(PRESENTER_MODE_STORAGE_KEY);
    return isPresenterMode(stored) ? stored : PRESENTER_MODES.POWERPOINT;
  });
  const [editContentBodyFontScale, setEditContentBodyFontScale] = useState(1);

  const {
    hasGemini,
    hasOpenAI,
    hasXai,
    presentationModels,
    presentationModelOption,
    effectiveGeminiModel,
    modelForGeminiOps,
    effectiveGeminiModelLabel,
    refreshApiKeys,
  } = usePresentationModelCatalog({
    presentationModelId,
    setPresentationModelId,
    apiKeysVersion,
    setApiKeysVersion,
    imageProvider,
    setImageProvider,
  });

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
  const pendingIframeEmbedUrlMediaPanelIdRef = useRef<string | null>(null);
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
    homeFirstSlideReplicaBySavedId,
    setHomeFirstSlideReplicaBySavedId,
    homeFirstSlideReplicaDeckThemeBySavedId,
    setHomeFirstSlideReplicaDeckThemeBySavedId,
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
  const [deletePresentationSnapshot, setDeletePresentationSnapshot] =
    useState<SavedPresentationMeta | null>(null);
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
    deletePresentationSnapshot,
    setDeletePresentationSnapshot,
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
    setHomeFirstSlideReplicaBySavedId,
    setHomeFirstSlideReplicaDeckThemeBySavedId,
    refreshSavedList,
    webCloudSessionRef,
  });

  const {
    openSavedListModal,
    handleOpenSaved,
    restoreLastOpenedPresentation,
    requestDeletePresentation,
    closeDeletePresentationModal,
    deletePresentationTarget,
    confirmDeletePresentationEverywhere,
  } = savedLibrary;

  /** Pestaña activa del panel derecho estilo Figma. */
  const [inspectorSection, setInspectorSection] = useState<
    | "slide"
    | "characters"
    | "notes"
    | "theme"
    | "resources"
    | "dataRing"
    | null
  >("slide");

  const currentSlide = slides[currentIndex];
  const imageWidthPercent =
    currentSlide?.imageWidthPercent ?? DEFAULT_IMAGE_WIDTH_PERCENT;
  const panelHeightPercent =
    currentSlide?.contentLayout === "panel-full"
      ? (currentSlide?.panelHeightPercent ?? DEFAULT_PANEL_HEIGHT_PERCENT)
      : DEFAULT_PANEL_HEIGHT_PERCENT;

  usePresentationSlideResizeGestures({
    isResizing,
    setIsResizing,
    isResizingPanelHeight,
    setIsResizingPanelHeight,
    currentIndex,
    setSlides,
  });

  usePresentationEditorLifecycleEffects({
    currentIndex,
    prevSlideIndexForFlushRef,
    isEditingRef,
    flushEditsToSlideIndex,
    currentSlide,
    syncEditFieldsFromSlide,
    setIsEditing,
    slidesLength: slides.length,
    localAccountScope,
    refreshSavedList,
  });

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PRESENTER_MODE_STORAGE_KEY, presenterMode);
  }, [presenterMode]);

  const {
    patchCurrentSlideMatrix,
    patchCurrentSlideCanvasScene,
    cycleCodeEditorThemeForMediaPanel,
    addCanvasElementToCurrentSlide,
    setCurrentSlideExcalidrawData,
    setCurrentSlideIsometricFlowData,
    setCurrentSlideMindMapData,
    setCurrentSlideMapData,
    setCurrentSlideContentLayout,
    setCurrentSlideContentType,
    setCurrentSlidePresenter3dDeviceId,
    setCurrentSlidePresenter3dScreenMedia,
    setCurrentSlidePresenter3dViewState,
    setCurrentSlideCanvas3dGlbUrl,
    setCurrentSlideCanvas3dViewState,
    clearCurrentSlideCanvas3dViewState,
    setCurrentSlideDataMotionRing,
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
    webCloudSessionRef,
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
    iframeEmbedUrlInput,
    setIframeEmbedUrlInput,
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
    handleSaveIframeEmbedUrl,
    openImageModal,
    openImageUploadModal,
    openVideoModal,
    openIframeEmbedModal,
    ingestImageFileOnCurrentSlide,
    ingestRiveFileOnCurrentSlide,
    clearRiveFromCurrentMediaPanel,
    setCurrentSlideRiveArtboard,
    setCurrentSlideRiveStateMachineNames,
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
    pendingIframeEmbedUrlMediaPanelIdRef,
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
    setShowIframeEmbedModal,
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

  usePresentationOrchestratorRefSync({
    slidesRef,
    slides,
    openSavedPresentationRef,
    handleOpenSaved,
    runAutoSyncAfterSaveRef,
    maybeAutoSyncAfterLocalSave,
    deckNavigationRef,
    nextSlide,
    prevSlide,
    cloudResolveRemoteEditorDepsRef,
    applySavedPresentationForCloudWebRef,
    setCurrentIndex,
    coverPrefetchSavedAtRef,
    setCoverImageCache,
    setHomeFirstSlideReplicaBySavedId,
    setHomeFirstSlideReplicaDeckThemeBySavedId,
    currentSavedId,
    setTopic,
    setCurrentSavedId,
    slidesUndoRef,
    slidesRedoRef,
    setSlides,
    setSelectedCharacterId,
    setDeckVisualThemeState,
    setDeckNarrativePresetId,
    setNarrativeNotes,
    formatMarkdown,
  });

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
    webCloudSessionRef.current = null;
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
    webCloudSessionRef.current = null;
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
    showIframeEmbedModal,
    setShowIframeEmbedModal,
    openIframeEmbedModal,
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
    iframeEmbedUrlInput,
    setIframeEmbedUrlInput,
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
    presenterMode,
    setPresenterMode,
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
    setCurrentSlideMapData,
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
    setCurrentSlideDataMotionRing,
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
    handleSaveIframeEmbedUrl,
    handleSave,
    openSavedListModal,
    handleOpenSaved,
    restoreLastOpenedPresentation,
    requestDeletePresentation,
    closeDeletePresentationModal,
    deletePresentationTarget,
    confirmDeletePresentationEverywhere,
    generatingCoverId,
    handleGenerateCoverForPresentation,
    coverImageCache,
    homeFirstSlideReplicaBySavedId,
    homeFirstSlideReplicaDeckThemeBySavedId,
    cloudSyncAvailable:
      !!user &&
      firebaseReady === true &&
      typeof window !== "undefined",
    syncingToCloudId,
    handleSyncPresentationToCloud,
    homeCloudSharedListWarning,
    handleDownloadFromCloud,
    handleDeleteCloudOnlyMine,
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
    ingestRiveFileOnCurrentSlide,
    clearRiveFromCurrentMediaPanel,
    setCurrentSlideRiveArtboard,
    setCurrentSlideRiveStateMachineNames,
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
