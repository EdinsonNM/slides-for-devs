import { create } from "zustand";
import type { SlideCanvasElement } from "../domain/entities";

export interface EditorState {
  isEditing: boolean;
  editTitle: string;
  editSubtitle: string;
  editContent: string;
  editContentRichHtml: string;
  editCode: string;
  editLanguage: string;
  editFontSize: number;
  editEditorHeight: number;
  clipboardElement: SlideCanvasElement | null;
  canvasMediaPanelElementId: string | null;

  setIsEditing: (val: boolean | ((prev: boolean) => boolean)) => void;
  setEditTitle: (val: string | ((prev: string) => string)) => void;
  setEditContent: (val: string | ((prev: string) => string)) => void;
  setEditContentRichHtml: (val: string | ((prev: string) => string)) => void;
  setClipboardElement: (val: SlideCanvasElement | null) => void;
  setCanvasMediaPanelElementId: (val: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  isEditing: false,
  editTitle: "",
  editSubtitle: "",
  editContent: "",
  editContentRichHtml: "",
  editCode: "",
  editLanguage: "javascript",
  editFontSize: 14,
  editEditorHeight: 280,
  clipboardElement: null,
  canvasMediaPanelElementId: null,

  setIsEditing: (val) => set((state) => ({ isEditing: typeof val === "function" ? val(state.isEditing) : val })),
  setEditTitle: (val) => set((state) => ({ editTitle: typeof val === "function" ? val(state.editTitle) : val })),
  setEditContent: (val) => set((state) => ({ editContent: typeof val === "function" ? val(state.editContent) : val })),
  setEditContentRichHtml: (val) => set((state) => ({ editContentRichHtml: typeof val === "function" ? val(state.editContentRichHtml) : val })),
  setClipboardElement: (val) => set({ clipboardElement: val }),
  setCanvasMediaPanelElementId: (val) => set({ canvasMediaPanelElementId: val }),
}));
