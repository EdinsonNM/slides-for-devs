import { create } from "zustand";

export interface UIState {
  showImageModal: boolean;
  showVideoModal: boolean;
  showIframeEmbedModal: boolean;
  showSpeechModal: boolean;
  showCodeGenModal: boolean;
  showSplitModal: boolean;
  showRewriteModal: boolean;
  showImageUploadModal: boolean;
  showExportDeckVideoModal: boolean;
  showGenerateFullDeckModal: boolean;
  showGenerateSlideContentModal: boolean;
  showCharacterCreatorModal: boolean;
  showSavedListModal: boolean;
  
  isSidebarOpen: boolean;
  isNotesPanelOpen: boolean;
  showCharactersPanel: boolean;
  showSlideStylePanel: boolean;

  setUIState: (state: Partial<UIState>) => void;
}

export const useUIStore = create<UIState>((set) => ({
  showImageModal: false,
  showVideoModal: false,
  showIframeEmbedModal: false,
  showSpeechModal: false,
  showCodeGenModal: false,
  showSplitModal: false,
  showRewriteModal: false,
  showImageUploadModal: false,
  showExportDeckVideoModal: false,
  showGenerateFullDeckModal: false,
  showGenerateSlideContentModal: false,
  showCharacterCreatorModal: false,
  showSavedListModal: false,

  isSidebarOpen: true,
  isNotesPanelOpen: false,
  showCharactersPanel: false,
  showSlideStylePanel: false,

  setUIState: (newState) => set((state) => ({ ...state, ...newState })),
}));

export function createUISetter<K extends keyof UIState>(key: K) {
  return (val: UIState[K] | ((prev: UIState[K]) => UIState[K])) => {
    useUIStore.setState((prev) => ({
      ...prev,
      [key]: typeof val === 'function' ? (val as any)(prev[key]) : val
    }));
  };
}
