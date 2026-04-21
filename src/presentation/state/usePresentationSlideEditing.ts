import { useCallback, useEffect, useRef } from "react";
import type { Slide } from "../../types";
import { formatMarkdown } from "../../utils/markdown";
import { plainTextFromRichHtml } from "../../utils/slideRichText";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import {
  applyEditBuffersToSlide,
  defaultCanvasTextEditTargets,
  isSlidePatchedDifferentFromBuffers,
  patchSlideMediaPanelByElementId,
} from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";
import {
  readMediaPayloadFromElement,
  readTextMarkdownFromElement,
  slideAppearanceForMediaElement,
} from "../../domain/slideCanvas/slideCanvasPayload";
import { isSlideCanvasTextPayload } from "../../domain/entities/SlideCanvas";
import { SLIDE_TYPE, type SlideCanvasElement } from "../../domain/entities";
import {
  PANEL_CONTENT_KIND,
  normalizePanelContentKind,
} from "../../domain/panelContent";
import { cloneSlideDeck } from "./presentationMediaHelpers";
import { MAX_SLIDES_UNDO } from "./presentationConstants";
import type { PresentationSlideEditingDeps } from "./presentationSlideEditingDeps";

export function usePresentationSlideEditing(deps: PresentationSlideEditingDeps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    depsRef.current.currentIndexRef.current = deps.currentIndex;
  }, [deps.currentIndex]);

  useEffect(() => {
    depsRef.current.isEditingRef.current = deps.isEditing;
  }, [deps.isEditing]);

  useEffect(() => {
    const d = depsRef.current;
    if (!d.editContentDraftDirtyRef.current) {
      d.editContentRef.current = d.editContent;
      d.editContentRichHtmlRef.current = d.editContentRichHtml;
    }
    d.editContentBodyFontScaleRef.current = d.editContentBodyFontScale;
    d.editCodeRef.current = d.editCode;
    d.editLanguageRef.current = d.editLanguage;
    d.editFontSizeRef.current = d.editFontSize;
    d.editEditorHeightRef.current = d.editEditorHeight;
  }, [
    deps.editContent,
    deps.editContentRichHtml,
    deps.editContentBodyFontScale,
    deps.editCode,
    deps.editLanguage,
    deps.editFontSize,
    deps.editEditorHeight,
  ]);

  const applyEditContentRichDraft = useCallback((plain: string, richHtml: string) => {
    const d = depsRef.current;
    d.editContentDraftDirtyRef.current = true;
    d.editContentRef.current = plain;
    d.editContentRichHtmlRef.current = richHtml;
  }, []);

  const setEditContent = useCallback(
    (value: string | ((prev: string) => string)) => {
      const d = depsRef.current;
      d.editContentDraftDirtyRef.current = false;
      if (typeof value === "string") d.editContentRef.current = value;
      d.setEditContentState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        d.editContentRef.current = next;
        return next;
      });
    },
    [],
  );

  const setEditContentRichHtml = useCallback(
    (value: string | ((prev: string) => string)) => {
      const d = depsRef.current;
      d.editContentDraftDirtyRef.current = false;
      if (typeof value === "string") d.editContentRichHtmlRef.current = value;
      d.setEditContentRichHtmlState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        d.editContentRichHtmlRef.current = next;
        return next;
      });
    },
    [],
  );

  const setEditFontSize = useCallback((value: number | ((prev: number) => number)) => {
    const d = depsRef.current;
    d.setEditFontSizeState((prev) => {
      const raw = typeof value === "function" ? value(prev) : value;
      const next = Math.min(64, Math.max(8, raw));
      queueMicrotask(() => {
        d.setSlides((prevSlides) => {
          const i = d.currentIndexRef.current;
          if (i < 0 || i >= prevSlides.length) return prevSlides;
          const cur = prevSlides[i];
          if (!cur || (cur.fontSize ?? 14) === next) return prevSlides;
          const updated = [...prevSlides];
          updated[i] = patchSlideMediaPanelByElementId(
            cur,
            d.canvasTextTargetsRef.current.mediaPanelElementId,
            (m) => ({ ...m, fontSize: next }),
          );
          return updated;
        });
      });
      return next;
    });
  }, []);

  const pushSlidesUndo = useCallback((snapshot: Slide[]) => {
    const d = depsRef.current;
    d.slidesUndoRef.current = [
      ...d.slidesUndoRef.current.slice(-(MAX_SLIDES_UNDO - 1)),
      cloneSlideDeck(snapshot),
    ];
    d.slidesRedoRef.current = [];
  }, []);

  const setCanvasTextEditTarget = useCallback(
    (field: "title" | "subtitle" | "content", elementId: string) => {
      const d = depsRef.current;
      const key =
        field === "title"
          ? "titleElementId"
          : field === "subtitle"
            ? "subtitleElementId"
            : "contentElementId";
      d.canvasTextTargetsRef.current = {
        ...d.canvasTextTargetsRef.current,
        [key]: elementId,
      };
    },
    [],
  );

  const hydrateCodeEditFromSlide = useCallback((s: Slide) => {
    const d = depsRef.current;
    d.setEditCode(s.code ?? "");
    d.setEditLanguage(s.language || "javascript");
    d.setEditFontSizeState(s.fontSize ?? 14);
    d.setEditEditorHeight(s.editorHeight ?? 280);
  }, []);

  const setCanvasMediaPanelEditTarget = useCallback(
    (
      elementId: string | null,
      options?: { rehydrateCodeBuffers?: boolean },
    ) => {
      const d = depsRef.current;
      d.canvasTextTargetsRef.current = {
        ...d.canvasTextTargetsRef.current,
        mediaPanelElementId: elementId,
      };
      d.setCanvasMediaPanelElementId(elementId);
      if (!elementId || !options?.rehydrateCodeBuffers) return;
      const idx = d.currentIndexRef.current;
      const cur = d.slidesRef.current[idx];
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

  const resolvePresenter3dMediaPatchElementId = useCallback(
    (slide: Slide, explicitMediaPanelElementId?: string | null) => {
      const d = depsRef.current;
      if (
        slide.type !== SLIDE_TYPE.CONTENT &&
        slide.type !== SLIDE_TYPE.CHAPTER
      )
        return null;
      const candidateId =
        explicitMediaPanelElementId != null &&
        explicitMediaPanelElementId !== ""
          ? explicitMediaPanelElementId
          : d.canvasTextTargetsRef.current.mediaPanelElementId;
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
      const d = depsRef.current;
      if (d.editContentDraftDirtyRef.current) {
        setEditContent(d.editContentRef.current);
        setEditContentRichHtml(d.editContentRichHtmlRef.current);
      }
      d.setSlides((prevSlides) => {
        if (slideIndex < 0 || slideIndex >= prevSlides.length) {
          return prevSlides;
        }
        const cur = prevSlides[slideIndex];
        if (!cur) return prevSlides;
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
        const ensured = ensureSlideCanvasScene(cur);
        const next = applyEditBuffersToSlide(
          ensured,
          buffers,
          d.canvasTextTargetsRef.current,
        );
        if (!isSlidePatchedDifferentFromBuffers(cur, next)) return prevSlides;
        pushSlidesUndo(prevSlides);
        const updated = [...prevSlides];
        updated[slideIndex] = next;
        return updated;
      });
      d.setIsEditing(false);
    },
    [pushSlidesUndo, setEditContent, setEditContentRichHtml],
  );

  const commitSlideEdits = useCallback(
    (options?: { keepEditing?: boolean }) => {
      const d = depsRef.current;
      if (d.editContentDraftDirtyRef.current) {
        setEditContent(d.editContentRef.current);
        setEditContentRichHtml(d.editContentRichHtmlRef.current);
      }
      d.setSlides((prevSlides) => {
        const slideIndex = d.currentIndexRef.current;
        if (slideIndex < 0 || slideIndex >= prevSlides.length) {
          return prevSlides;
        }
        const cur = prevSlides[slideIndex];
        if (!cur) return prevSlides;
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
        const ensured = ensureSlideCanvasScene(cur);
        const next = applyEditBuffersToSlide(
          ensured,
          buffers,
          d.canvasTextTargetsRef.current,
        );
        if (!isSlidePatchedDifferentFromBuffers(cur, next)) return prevSlides;
        pushSlidesUndo(prevSlides);
        const updated = [...prevSlides];
        updated[slideIndex] = next;
        return updated;
      });
      if (!options?.keepEditing) {
        d.setIsEditing(false);
      }
    },
    [pushSlidesUndo, setEditContent, setEditContentRichHtml],
  );

  const syncEditFieldsFromSlide = useCallback(
    (s: Slide) => {
      const d = depsRef.current;
      const s2 = ensureSlideCanvasScene(s);
      const tr = defaultCanvasTextEditTargets(s2);
      d.canvasTextTargetsRef.current = tr;
      d.setCanvasMediaPanelElementId(tr.mediaPanelElementId);
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
      d.setEditTitle(
        titleEl ? readTextMarkdownFromElement(s2, titleEl) : s2.title,
      );
      d.setEditSubtitle(
        subtitleEl
          ? readTextMarkdownFromElement(s2, subtitleEl)
          : (s2.subtitle ?? ""),
      );
      if (contentEl?.kind === "markdown") {
        const p = contentEl.payload;
        if (isSlideCanvasTextPayload(p) && p.richHtml?.trim()) {
          setEditContentRichHtml(p.richHtml);
          d.setEditContentBodyFontScale(
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
          d.setEditContentBodyFontScale(1);
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
        d.setEditContentBodyFontScale(1);
        setEditContent(
          formatMarkdown(
            contentEl ? readTextMarkdownFromElement(s2, contentEl) : s2.content,
          ),
        );
      }
      d.setEditCode(s2.code || "");
      d.setEditLanguage(s2.language || "javascript");
      d.setEditFontSizeState(s2.fontSize || 14);
      d.setEditEditorHeight(s2.editorHeight ?? 280);
    },
    [setEditContent, setEditContentRichHtml],
  );

  const syncCanvasTextEditTargetsFromSelection = useCallback(
    (slide: Slide, selectedElement: SlideCanvasElement) => {
      const d = depsRef.current;
      const actualSlide = d.slidesRef.current[d.currentIndexRef.current] || slide;
      const s2 = ensureSlideCanvasScene(actualSlide);
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

      d.canvasTextTargetsRef.current = {
        ...d.canvasTextTargetsRef.current,
        titleElementId,
        subtitleElementId,
        contentElementId,
      };

      const titleEl = titleElementId
        ? scene.elements.find((e) => e.id === titleElementId)
        : undefined;
      d.setEditTitle(
        titleEl &&
          (titleEl.kind === "title" || titleEl.kind === "chapterTitle")
          ? readTextMarkdownFromElement(s2, titleEl)
          : s2.title,
      );

      const subtitleEl = subtitleElementId
        ? scene.elements.find((e) => e.id === subtitleElementId)
        : undefined;
      d.setEditSubtitle(
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
          d.setEditContentBodyFontScale(
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
          d.setEditContentBodyFontScale(1);
          setEditContent(
            formatMarkdown(readTextMarkdownFromElement(s2, contentEl)),
          );
        }
      } else if (contentEl?.kind === "matrixNotes") {
        setEditContentRichHtml("");
        d.setEditContentBodyFontScale(1);
        setEditContent(
          formatMarkdown(readTextMarkdownFromElement(s2, contentEl)),
        );
      } else {
        setEditContentRichHtml("");
        d.setEditContentBodyFontScale(1);
        setEditContent(formatMarkdown(s2.content ?? ""));
      }
    },
    [setEditContent, setEditContentRichHtml],
  );

  const applySlidesUndo = useCallback(() => {
    const d = depsRef.current;
    const stack = d.slidesUndoRef.current;
    if (stack.length === 0) return;
    const snapshot = stack[stack.length - 1]!;
    d.slidesUndoRef.current = stack.slice(0, -1);
    d.setSlides((cur) => {
      d.slidesRedoRef.current.push(cloneSlideDeck(cur));
      return cloneSlideDeck(snapshot);
    });
    const restored = cloneSlideDeck(snapshot);
    const idx = Math.min(
      d.currentIndexRef.current,
      Math.max(0, restored.length - 1),
    );
    const s = restored[idx];
    if (s) syncEditFieldsFromSlide(s);
    d.setIsEditing(false);
  }, [syncEditFieldsFromSlide]);

  const applySlidesRedo = useCallback(() => {
    const d = depsRef.current;
    const stack = d.slidesRedoRef.current;
    if (stack.length === 0) return;
    const snapshot = stack[stack.length - 1]!;
    d.slidesRedoRef.current = stack.slice(0, -1);
    d.setSlides((cur) => {
      d.slidesUndoRef.current.push(cloneSlideDeck(cur));
      return cloneSlideDeck(snapshot);
    });
    const restored = cloneSlideDeck(snapshot);
    const idx = Math.min(
      d.currentIndexRef.current,
      Math.max(0, restored.length - 1),
    );
    const s = restored[idx];
    if (s) syncEditFieldsFromSlide(s);
    d.setIsEditing(false);
  }, [syncEditFieldsFromSlide]);

  const handleSaveManualEdit = useCallback(() => {
    commitSlideEdits();
  }, [commitSlideEdits]);

  return {
    applyEditContentRichDraft,
    setEditContent,
    setEditContentRichHtml,
    setEditFontSize,
    pushSlidesUndo,
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
  };
}
