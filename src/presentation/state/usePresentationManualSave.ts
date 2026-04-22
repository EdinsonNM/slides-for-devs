import { useCallback } from "react";
import { useLatestRef } from "./useLatestRef";
import { SLIDE_TYPE } from "../../domain/entities";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import { applyEditBuffersToSlide } from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";
import type { PresentationManualSaveDeps } from "./presentationManualSaveDeps";

export function usePresentationManualSave(deps: PresentationManualSaveDeps) {
  const depsRef = useLatestRef(deps);

  const handleSave = useCallback(async () => {
    const d = depsRef.current;
    if (d.slides.length === 0) return;
    const pendingDiagram = d.flushDiagramPending();
    const pendingIsometric = d.flushIsometricFlowPending();
    const idx = d.currentIndexRef.current;
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
    const merged = d.slides.map((s, i) =>
      i === idx
        ? applyEditBuffersToSlide(
            ensureSlideCanvasScene(s),
            buffers,
            d.canvasTextTargetsRef.current,
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

    const hadTitleDraft = d.presentationTitleDraftRef.current !== null;
    const topicSource =
      hadTitleDraft ? d.presentationTitleDraftRef.current! : d.topic;
    if (hadTitleDraft) {
      d.presentationTitleDraftRef.current = null;
      d.setTopic(topicSource.trim() || "");
    }
    const topicToSave = topicSource.trim() || "Sin título";

    d.setIsSaving(true);
    d.setSaveMessage(null);
    try {
      await d.savePresentationNow({
        topic: topicToSave,
        slides: slidesToSave,
        characterId: d.selectedCharacterId ?? undefined,
      });
      d.setSlides(slidesToSave);
    } finally {
      d.setIsSaving(false);
    }
  }, []);

  return { handleSave };
}
