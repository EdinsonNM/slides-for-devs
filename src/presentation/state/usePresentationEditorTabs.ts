import { useCallback, useEffect, useRef, useState } from "react";
import { useLatestRef } from "./useLatestRef";
import { DEFAULT_DECK_VISUAL_THEME, SLIDE_TYPE } from "../../domain/entities";
import { DEFAULT_DECK_NARRATIVE_PRESET_ID } from "../../constants/presentationNarrativePresets";
import {
  applyEditBuffersToSlide,
} from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";
import { ensureSlideCanvasScene, normalizeSlidesCanvasScenes } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import type { Slide } from "../../types";
import type { EditorTab, EditorWorkspaceSnapshot } from "./presentationTypes";
import type { PresentationEditorTabsDeps } from "./presentationEditorTabsDeps";

function cloneSlidesForTab(list: Slide[]): Slide[] {
  try {
    return structuredClone(list) as Slide[];
  } catch {
    return list.map((s) => ({ ...s }));
  }
}

export function usePresentationEditorTabs(deps: PresentationEditorTabsDeps) {
  const depsRef = useLatestRef(deps);

  const tabSnapshotsRef = useRef<Record<string, EditorWorkspaceSnapshot>>({});
  const [editorTabs, setEditorTabs] = useState<EditorTab[]>([]);
  const [activeEditorTabId, setActiveEditorTabId] = useState<string | null>(null);

  const diagramFlushRef = useRef<(() => string | null) | null>(null);
  const isometricFlowFlushRef = useRef<(() => string | null) | null>(null);
  const [diagramRemountToken, setDiagramRemountToken] = useState(0);

  const presentationTitleDraftRef = useRef<string | null>(null);

  useEffect(() => {
    const { slides, topic } = depsRef.current;
    if (slides.length === 0) return;
    if (editorTabs.length > 0) return;
    const id = crypto.randomUUID();
    setEditorTabs([{ id, title: (topic || "Sin título").slice(0, 64) }]);
    setActiveEditorTabId(id);
  }, [deps.slides.length, editorTabs.length, deps.topic]);

  useEffect(() => {
    const { slides, topic } = depsRef.current;
    if (!activeEditorTabId || slides.length === 0) return;
    const label = (topic || "Sin título").slice(0, 64);
    setEditorTabs((tabs) =>
      tabs.map((t) =>
        t.id === activeEditorTabId ? { ...t, title: label } : t,
      ),
    );
  }, [deps.topic, activeEditorTabId, deps.slides.length]);

  const flushDiagramPending = useCallback((): string | null => {
    return diagramFlushRef.current?.() ?? null;
  }, []);

  const flushIsometricFlowPending = useCallback((): string | null => {
    return isometricFlowFlushRef.current?.() ?? null;
  }, []);

  const captureWorkspaceSnapshot = useCallback((): EditorWorkspaceSnapshot => {
    const d = depsRef.current;
    const pending = flushDiagramPending();
    const pendingIso = flushIsometricFlowPending();
    const idx = d.currentIndex;
    const buffers = {
      title: d.editTitleRef.current,
      subtitle: d.editSubtitleRef.current,
      content: d.editContentRef.current,
      contentRichHtml: d.editContentRichHtmlRef.current,
      contentBodyFontScale: d.editContentBodyFontScaleRef.current,
      code: d.editCodeRef.current,
      language: d.editLanguageRef.current,
      fontSize: d.editFontSizeRef.current,
      editorHeight: d.editEditorHeightRef.current,
    };
    const merged = d.slides.map((sl, i) =>
      i === idx
        ? applyEditBuffersToSlide(
            ensureSlideCanvasScene(sl),
            buffers,
            d.canvasTextTargetsRef.current,
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
        : d.topic;
    return {
      topic: snapTopic,
      slides: cloneSlidesForTab(s),
      currentIndex: d.currentIndex,
      currentSavedId: d.currentSavedId,
      selectedCharacterId: d.selectedCharacterId,
      deckVisualTheme: d.deckVisualTheme,
      deckNarrativePresetId: d.deckNarrativePresetId,
      narrativeNotes: d.narrativeNotes,
    };
  }, [
    flushDiagramPending,
    flushIsometricFlowPending,
    deps.slides,
    deps.currentIndex,
    deps.topic,
    deps.currentSavedId,
    deps.selectedCharacterId,
    deps.deckVisualTheme,
    deps.deckNarrativePresetId,
    deps.narrativeNotes,
  ]);

  const setPresentationTitleDraft = useCallback((value: string | null) => {
    presentationTitleDraftRef.current = value;
  }, []);

  const applyWorkspaceSnapshot = useCallback(
    (snap: EditorWorkspaceSnapshot) => {
      const d = depsRef.current;
      const sl = cloneSlidesForTab(snap.slides);
      const idx = Math.min(
        Math.max(0, snap.currentIndex),
        Math.max(0, sl.length - 1),
      );
      d.slidesUndoRef.current = [];
      d.slidesRedoRef.current = [];
      d.setTopic(snap.topic);
      d.setSlides(sl);
      d.setCurrentIndex(idx);
      d.setCurrentSavedId(snap.currentSavedId);
      d.setSelectedCharacterId(snap.selectedCharacterId);
      d.setDeckVisualThemeState(snap.deckVisualTheme ?? DEFAULT_DECK_VISUAL_THEME);
      d.setDeckNarrativePresetId(
        snap.deckNarrativePresetId ?? DEFAULT_DECK_NARRATIVE_PRESET_ID,
      );
      d.setNarrativeNotes(snap.narrativeNotes ?? "");
    },
    [],
  );

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
    [activeEditorTabId, captureWorkspaceSnapshot, applyWorkspaceSnapshot],
  );

  const addEditorTab = useCallback(() => {
    const d = depsRef.current;
    if (activeEditorTabId) {
      tabSnapshotsRef.current[activeEditorTabId] =
        captureWorkspaceSnapshot();
    }
    const newId = crypto.randomUUID();
    const blankSlide: Slide = {
      id: crypto.randomUUID(),
      type: SLIDE_TYPE.CONTENT,
      title: "Nueva diapositiva",
      content: "",
    };
    d.setTopic("");
    d.slidesUndoRef.current = [];
    d.slidesRedoRef.current = [];
    d.setSlides(normalizeSlidesCanvasScenes([blankSlide]));
    d.setCurrentIndex(0);
    d.setCurrentSavedId(null);
    d.setSelectedCharacterId(null);
    d.setDeckVisualThemeState(DEFAULT_DECK_VISUAL_THEME);
    d.setDeckNarrativePresetId(DEFAULT_DECK_NARRATIVE_PRESET_ID);
    d.setNarrativeNotes("");
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

  const clearEditorTabsForGoHome = useCallback(() => {
    setEditorTabs([]);
    setActiveEditorTabId(null);
    tabSnapshotsRef.current = {};
  }, []);

  return {
    tabSnapshotsRef,
    editorTabs,
    setEditorTabs,
    activeEditorTabId,
    setActiveEditorTabId,
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
  };
}
