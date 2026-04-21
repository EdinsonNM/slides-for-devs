import { useCallback } from "react";
import { useUIStore, createUISetter } from "../../store/useUIStore";
import { useSlidesStore, createSlidesSetter } from "../../store/useSlidesStore";
import { useEditorStore, createEditorSetter } from "../../store/useEditorStore";
import { useConfigStore, createConfigSetter } from "../../store/useConfigStore";

/**
 * Selectores y setters estables hacia los stores de presentación (slides, editor, config, UI).
 * Centraliza el boilerplate de `create*Setter` para mantener fino `usePresentationState`.
 */
export function usePresentationStoreBridge() {
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
  const setEditContentRichHtmlState = useCallback(
    createEditorSetter("editContentRichHtml"),
    [],
  );
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
  const setCanvasMediaPanelElementId = useCallback(
    createEditorSetter("canvasMediaPanelElementId"),
    [],
  );

  const configState = useConfigStore();
  const deckVisualTheme = configState.deckVisualTheme;
  const setDeckVisualThemeState = useCallback(createConfigSetter("deckVisualTheme"), []);
  const deckNarrativePresetId = configState.deckNarrativePresetId;
  const setDeckNarrativePresetId = useCallback(
    createConfigSetter("deckNarrativePresetId"),
    [],
  );
  const narrativeNotes = configState.narrativeNotes;
  const setNarrativeNotes = useCallback(createConfigSetter("narrativeNotes"), []);
  const presentationModelId = configState.presentationModelId;
  const setPresentationModelId = useCallback(
    createConfigSetter("presentationModelId"),
    [],
  );
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
  const setShowGenerateFullDeckModal = useCallback(
    createUISetter("showGenerateFullDeckModal"),
    [],
  );
  const showGenerateSlideContentModal = uiState.showGenerateSlideContentModal;
  const setShowGenerateSlideContentModal = useCallback(
    createUISetter("showGenerateSlideContentModal"),
    [],
  );
  const showVideoModal = uiState.showVideoModal;
  const setShowVideoModal = useCallback(createUISetter("showVideoModal"), []);
  const showExportDeckVideoModal = uiState.showExportDeckVideoModal;
  const setShowExportDeckVideoModal = useCallback(
    createUISetter("showExportDeckVideoModal"),
    [],
  );
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
  const setShowCharacterCreatorModal = useCallback(
    createUISetter("showCharacterCreatorModal"),
    [],
  );
  const showCharactersPanel = uiState.showCharactersPanel;
  const setShowCharactersPanel = useCallback(createUISetter("showCharactersPanel"), []);
  const showSlideStylePanel = uiState.showSlideStylePanel;
  const setShowSlideStylePanel = useCallback(createUISetter("showSlideStylePanel"), []);

  return {
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
  };
}
