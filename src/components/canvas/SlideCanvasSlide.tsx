import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  startTransition,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import {
  BringToFront,
  ChevronDown,
  ChevronUp,
  Frame,
  GripVertical,
  Layers,
  Lock,
  RefreshCw,
  SendToBack,
  Sparkles,
  Split,
  Unlock,
  Video,
} from "lucide-react";
import { useCodeEditorTheme } from "../../hooks/useCodeEditorTheme";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import type { Slide } from "../../types";
import {
  SLIDE_TYPE,
  clampCanvasRect,
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
  type DeckContentTone,
  type SlideCanvasElement,
  type SlideCanvasRect,
  type SlideCanvasScene,
} from "../../domain/entities";
import {
  PANEL_CONTENT_KIND,
  resolveMediaPanelDescriptor,
} from "../../domain/panelContent";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import { useSlideContainerImageDnD } from "../../hooks/useSlideContainerImageDnD";
import { migrateLegacySlideToCanvas } from "../../domain/slideCanvas/migrateLegacySlideToCanvas";
import { normalizeCanvasElementsZOrder } from "../../domain/slideCanvas/normalizeCanvasElementsZOrder";
import {
  reorderCanvasElementLayer,
  type CanvasLayerReorderMove,
} from "../../domain/slideCanvas/reorderCanvasElementLayer";
import {
  getCanvasMarkdownBodyDisplay,
  readTextMarkdownFromElement,
  slideAppearanceForMediaElement,
} from "../../domain/slideCanvas/slideCanvasPayload";
import { isSlideCanvasTextPayload } from "../../domain/entities/SlideCanvas";
import {
  applyWholeRichHtmlBold,
  applyWholeRichHtmlForeColor,
  applyWholeRichHtmlItalic,
  markdownBodyToRichHtmlForEditor,
  plainTextFromRichHtml,
  sanitizeSlideRichHtml,
} from "../../utils/slideRichText";
import {
  SlideChapterTitleReadOnly,
  SlideContentTitleReadOnly,
  SlideSubtitleMarkdownBody,
} from "../../presentation/slide-elements";
import { SlideMarkdown } from "../shared/SlideMarkdown";
import {
  SlideCanvasRichDescription,
  type SlideCanvasRichDescriptionHandle,
} from "./SlideCanvasRichDescription";
import { SlideRightPanel } from "../editor/SlideRightPanel";
import { SlideContentDiagram } from "../editor/SlideContentDiagram";
import { SlideContentIsometricFlow } from "../editor/SlideContentIsometricFlow";
import { SlideContentMindMap } from "../editor/SlideContentMindMap";
import { SlideContentMapbox } from "../editor/SlideContentMapbox";
import type { SlideMatrixData } from "../../domain/entities";
import { SlideMatrixTable } from "../shared/SlideMatrixTable";
import { SlideCanvasAlignmentGuides } from "./SlideCanvasAlignmentGuides";
import {
  CANVAS_CHROME_DATA_ATTR,
  SlideCanvasCanvaChrome,
} from "./SlideCanvasCanvaChrome";
import { SlideCanvasHoverOutline } from "./SlideCanvasHoverOutline";
import { DeckBackdrop } from "../shared/DeckBackdrop";
import {
  deckIaToolbarBtnClass,
  deckIaToolbarHoverClass,
  deckMarkdownBodyTextareaClass,
  deckMatrixNotesTextareaClass,
  deckMediaPanelDragStripClass,
  deckMediaPanelShellClass,
  deckMutedTextClass,
  deckRewriteActionBtnClass,
  deckSlideContentWrapperClass,
  deckSubtitleTextareaClass,
  deckTitleTextareaClass,
} from "../../utils/deckSlideChrome";
import {
  oppositeCornerPercent,
  rectResizeFromCorner,
  rectResizeFromEdge,
  type ResizeCorner,
  type ResizeEdge,
} from "./slideCanvasResize";
import {
  getCanvasAlignmentGuidesForRect,
  snapCanvasRectWhileDragging,
} from "../../utils/slideCanvasAlignmentSnap";

const EDIT_FIELD_ATTR = "data-slide-edit-field";

/** Bloques a pantalla completa: un clic en su interior debe deseleccionar otros bloques del lienzo. */
const CANVAS_KIND_CLICK_PASSTHROUGH = new Set(["isometricFlow", "excalidraw"]);
/** Solo esta franja inicia arrastre del panel con presentador 3D (el lienzo WebGL captura puntero y chocaba con el movimiento). */
const CANVAS_DRAG_STRIP_ATTR = "data-slide-canvas-drag-strip";
/** Menú contextual del lienzo (orden / bloqueo): no debe disparar deselección del fondo. */
const CANVAS_CTX_MENU_ATTR = "data-slide-canvas-ctx-menu";

/**
 * Orden de apilamiento en el lienzo: solo depende de `element.z` (adelante/atrás).
 * La selección no debe subir el bloque por encima de otros: solo un pequeño sub-offset
 * (`stride` + hover/selección) para desempate visual sin cambiar el orden real.
 */
const CANVAS_Z_STRIDE = 10;
const CANVAS_Z_SUB_SELECTED = 2;
const CANVAS_Z_SUB_HOVER = 1;

/** UI flotante del lienzo por encima de los bloques (máx. z de bloque ≈ (n-1)*stride+2; p. ej. ~9992 con n≈1000). */
const SLIDE_CANVAS_UI_Z = 10_000;
/** Capa del cromo de selección (marco + toolbar) por encima de cualquier bloque del lienzo. */
const SLIDE_CANVAS_CHROME_PORTAL_Z = SLIDE_CANVAS_UI_Z + 1;

/**
 * Píxeles mínimos de movimiento antes de iniciar arrastre.
 * Un umbral > 0 evita que micro-movimientos al hacer clic activen el drag
 * y compitan con la selección de texto en el editor.
 * Mismo valor con bloque ya seleccionado: si fuera 0, casi cualquier gesto de
 * selección en la vista previa disparaba el arrastre.
 */
const DRAG_THRESHOLD_PX = 6;

/**
 * `pointerdown` / `dblclick` pueden tener `target` en un nodo `#text`;
 * `Element.prototype.closest` no existe ahí y rompe los handlers.
 */
function eventTargetElement(ev: { target: EventTarget | null }): HTMLElement | null {
  const raw = ev.target;
  if (!raw || !(raw instanceof Node)) return null;
  if (raw.nodeType === Node.ELEMENT_NODE) return raw as HTMLElement;
  return raw.parentElement;
}

type TextField = "title" | "subtitle" | "content";

/** Ajusta `rect.h` al alto real del texto (WYSIWYG) para títulos/subtítulos en el lienzo. */
function useCanvasTextBlockAutoHeight(
  enabled: boolean,
  measureRef: RefObject<HTMLDivElement | null>,
  slideContainerRef: RefObject<HTMLDivElement | null>,
  elementId: string,
  rect: SlideCanvasRect,
  onPatchRect: (id: string, r: SlideCanvasRect) => void,
  deps: unknown[],
) {
  const rectRef = useRef(rect);
  rectRef.current = rect;

  useLayoutEffect(() => {
    if (!enabled) return;
    const slideEl = slideContainerRef.current;
    const m = measureRef.current;
    if (!slideEl || !m) return;

    const run = () => {
      const r = rectRef.current;
      const ch = slideEl.getBoundingClientRect().height;
      if (ch < 1) return;
      const hPx = Math.ceil(m.getBoundingClientRect().height + 2);
      let hPct = (hPx / ch) * 100;
      hPct = Math.min(100 - r.y, Math.max(3, hPct));
      const next = clampCanvasRect({ ...r, h: hPct });
      if (Math.abs(next.h - r.h) < 0.35) return;
      onPatchRect(elementId, next);
    };

    run();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(run);
    });
    ro.observe(m);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps list passed explicitly per bloque
  }, deps);
}

/**
 * Encoge `rect.h` del markdown solo cuando el área de scroll es más alta que el
 * contenido (hueco en blanco). Sin ResizeObserver: no compite con el resize manual.
 */
function useMarkdownCanvasAutoShrinkHeight(
  enabled: boolean,
  measureRootRef: RefObject<HTMLDivElement | null>,
  slideContainerRef: RefObject<HTMLDivElement | null>,
  elementId: string,
  rect: SlideCanvasRect,
  onPatchRect: (id: string, r: SlideCanvasRect) => void,
  deps: unknown[],
) {
  const rectRef = useRef(rect);
  rectRef.current = rect;

  useLayoutEffect(() => {
    if (!enabled) return;
    const root = measureRootRef.current;
    const slideEl = slideContainerRef.current;
    if (!root || !slideEl) return;

    const run = () => {
      const r = rectRef.current;
      const scrollHost =
        root.querySelector<HTMLElement>(
          "[data-slide-markdown-scroll-measure]",
        ) ?? root;
      const sh = scrollHost.scrollHeight;
      const ch = scrollHost.clientHeight;
      if (ch < 8 || sh < 1) return;
      const slideH = slideEl.getBoundingClientRect().height;
      if (slideH < 1) return;

      const pad = 8;
      if (sh + pad >= ch - 2) return;

      const hPx = Math.ceil(sh + pad);
      let hPct = (hPx / slideH) * 100;
      hPct = Math.min(100 - r.y, Math.max(3, hPct));
      const next = clampCanvasRect({ ...r, h: hPct });
      if (Math.abs(next.h - r.h) < 0.35) return;
      onPatchRect(elementId, next);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps list passed explicitly por bloque
  }, deps);
}

function fieldForKind(kind: SlideCanvasElement["kind"]): TextField | null {
  if (kind === "title" || kind === "chapterTitle") return "title";
  if (kind === "subtitle" || kind === "chapterSubtitle") return "subtitle";
  if (kind === "markdown" || kind === "matrixNotes") return "content";
  return null;
}

export function SlideCanvasSlide() {
  const {
    currentSlide,
    currentIndex,
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
    formatMarkdown,
    commitSlideEdits,
    setSlides,
    setShowRewriteModal,
    setShowGenerateSlideContentModal,
    setGenerateSlideContentPrompt,
    setShowSplitModal,
    patchCurrentSlideCanvasScene,
    cycleCodeEditorThemeForMediaPanel,
    patchCurrentSlideMatrix,
    diagramRemountToken,
    openImageModal,
    openImageUploadModal,
    editLanguage,
    setEditLanguage,
    editFontSize,
    setEditFontSize,
    openCodeGenModal,
    setVideoUrlInput,
    setShowVideoModal,
    openVideoModal: queueVideoUrlModal,
    openIframeEmbedModal: queueIframeEmbedModal,
    setCurrentSlidePresenter3dScreenMedia,
    deckVisualTheme,
    setCanvasTextEditTarget,
    syncCanvasTextEditTargetsFromSelection,
    setCanvasMediaPanelEditTarget,
    canvasMediaPanelElementId,
    isPreviewMode,
    ingestImageFileOnCurrentSlide,
    clipboardElement,
    setClipboardElement,
  } = usePresentation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isDragOverImageFile, setIsDragOverImageFile] = useState(false);
  const [activeField, setActiveField] = useState<TextField | null>(null);
  const [canvas3dAnimClipNamesByPanelId, setCanvas3dAnimClipNamesByPanelId] =
    useState<Record<string, string[]>>({});
  const [canvasElContextMenu, setCanvasElContextMenu] = useState<{
    elementId: string;
    x: number;
    y: number;
  } | null>(null);
  const canvasElContextMenuRef = useRef<HTMLDivElement | null>(null);
  const slideCanvasChromePortalRef = useRef<HTMLDivElement | null>(null);
  const slideContainerRef = useRef<HTMLDivElement | null>(null);

  useSlideContainerImageDnD(
    currentSlide,
    slideContainerRef,
    ingestImageFileOnCurrentSlide,
    setIsDragOverImageFile,
  );
  /** Elementos de la escena (orden z) para snap y guías durante el arrastre. */
  const sceneElementsRef = useRef<SlideCanvasElement[]>([]);
  const [alignmentGuides, setAlignmentGuides] = useState<{
    vertical: { posPct: number; stroke: "solid" | "dashed" }[];
    horizontal: { posPct: number; stroke: "solid" | "dashed" }[];
  } | null>(null);
  useEffect(() => {
    setSelectedId(null);
    setHoveredId(null);
    setActiveField(null);
    setAlignmentGuides(null);
    setCanvas3dAnimClipNamesByPanelId({});
    setCanvasElContextMenu(null);
  }, [currentSlide?.id]);

  const onCanvas3dAnimationClipNames = useCallback(
    (mediaPanelElementId: string, names: string[]) => {
      setCanvas3dAnimClipNamesByPanelId((prev) => {
        const prevNames = prev[mediaPanelElementId];
        if (
          prevNames &&
          prevNames.length === names.length &&
          prevNames.every((n, i) => n === names[i])
        ) {
          return prev;
        }
        return { ...prev, [mediaPanelElementId]: names };
      });
    },
    [],
  );

  useEffect(() => {
    if (!isEditing) {
      setActiveField(null);
    }
  }, [isEditing]);

  useEffect(() => {
    if (!currentSlide) return;
    if (currentSlide.canvasScene?.elements?.length) return;
    setSlides((prev) => {
      const idx = currentIndex;
      const s = prev[idx];
      if (!s || s.id !== currentSlide.id || s.canvasScene?.elements?.length) {
        return prev;
      }
      const next = [...prev];
      next[idx] = { ...s, canvasScene: migrateLegacySlideToCanvas(s) };
      return next;
    });
  }, [currentSlide?.id, currentSlide?.canvasScene, currentIndex, setSlides]);

  const onPatchRect = useCallback(
    (id: string, rect: SlideCanvasRect) => {
      patchCurrentSlideCanvasScene((scene) => ({
        ...scene,
        elements: scene.elements.map((e) =>
          e.id === id ? { ...e, rect: clampCanvasRect(rect) } : e,
        ),
      }));
    },
    [patchCurrentSlideCanvasScene],
  );

  type CanvasAlignmentGuidesState = NonNullable<typeof alignmentGuides>;
  const rectPatchRafRef = useRef<number | null>(null);
  const rectPatchPendingRef = useRef<{
    elementId: string;
    rect: SlideCanvasRect;
    guides: CanvasAlignmentGuidesState | null;
  } | null>(null);

  const flushPendingRectPatch = useCallback(() => {
    rectPatchRafRef.current = null;
    const p = rectPatchPendingRef.current;
    rectPatchPendingRef.current = null;
    if (!p) return;
    onPatchRect(p.elementId, p.rect);
    setAlignmentGuides(p.guides);
  }, [onPatchRect, setAlignmentGuides]);

  const scheduleRectPatch = useCallback(
    (
      elementId: string,
      rect: SlideCanvasRect,
      guides: CanvasAlignmentGuidesState | null,
    ) => {
      rectPatchPendingRef.current = { elementId, rect, guides };
      if (rectPatchRafRef.current != null) return;
      rectPatchRafRef.current = requestAnimationFrame(() => {
        flushPendingRectPatch();
      });
    },
    [flushPendingRectPatch],
  );

  const patchElementRotation = useCallback(
    (elementId: string, rotation: number) => {
      const r = ((rotation % 360) + 360) % 360;
      patchCurrentSlideCanvasScene((scene) => ({
        ...scene,
        elements: scene.elements.map((e) =>
          e.id === elementId ? { ...e, rotation: r } : e,
        ),
      }));
    },
    [patchCurrentSlideCanvasScene],
  );

  const duplicateCanvasElement = useCallback(
    (elementId: string) => {
      patchCurrentSlideCanvasScene((scene) => {
        const el = scene.elements.find((x) => x.id === elementId);
        if (!el) return scene;
        const maxZ = scene.elements.reduce((m, x) => Math.max(m, x.z), 0);
        const copyPayload =
          el.payload != null
            ? typeof structuredClone === "function"
              ? structuredClone(el.payload)
              : ({ ...el.payload } as typeof el.payload)
            : undefined;
        const copy: SlideCanvasElement = {
          ...el,
          id: crypto.randomUUID(),
          rect: clampCanvasRect({
            ...el.rect,
            x: el.rect.x + 2,
            y: el.rect.y + 2,
          }),
          z: maxZ + 1,
          payload: copyPayload,
        };
        const elements = normalizeCanvasElementsZOrder([
          ...scene.elements,
          copy,
        ]);
        return { ...scene, elements };
      });
    },
    [patchCurrentSlideCanvasScene],
  );

  const deleteCanvasElement = useCallback(
    (elementId: string) => {
      if (isEditing) {
        flushSync(() => {
          commitSlideEdits({ keepEditing: true });
        });
      }
      if (selectedIdRef.current === elementId) {
        setActiveField(null);
      }
      setSelectedId((sid) => (sid === elementId ? null : sid));
      setHoveredId((hid) => (hid === elementId ? null : hid));
      patchCurrentSlideCanvasScene((scene) => ({
        ...scene,
        elements: scene.elements.filter((e) => e.id !== elementId),
      }));
    },
    [patchCurrentSlideCanvasScene, isEditing, commitSlideEdits],
  );

  const applyCanvasLayerReorder = useCallback(
    (elementId: string, move: CanvasLayerReorderMove) => {
      /**
       * `syncSlideRootFromCanvas` + re-render de todo el lienzo (y visores R3F) pesa; marcar
       * la actualización como transición evita congelar el hilo mientras el usuario sigue
       * interactuando (p. ej. cierre del menú contextual de capas).
       */
      startTransition(() => {
        patchCurrentSlideCanvasScene((scene) => {
          const next = reorderCanvasElementLayer(scene.elements, elementId, move);
          if (!next) return scene;
          return { ...scene, elements: next };
        });
      });
    },
    [patchCurrentSlideCanvasScene],
  );

  const bringCanvasElementForward = useCallback(
    (elementId: string) => applyCanvasLayerReorder(elementId, "forwardOne"),
    [applyCanvasLayerReorder],
  );

  const sendCanvasElementBackward = useCallback(
    (elementId: string) => applyCanvasLayerReorder(elementId, "backwardOne"),
    [applyCanvasLayerReorder],
  );

  const bringCanvasElementToFront = useCallback(
    (elementId: string) => applyCanvasLayerReorder(elementId, "toFront"),
    [applyCanvasLayerReorder],
  );

  const sendCanvasElementToBack = useCallback(
    (elementId: string) => applyCanvasLayerReorder(elementId, "toBack"),
    [applyCanvasLayerReorder],
  );

  const toggleCanvasElementLocked = useCallback(
    (elementId: string) => {
      patchCurrentSlideCanvasScene((scene) => ({
        ...scene,
        elements: scene.elements.map((e) =>
          e.id === elementId ? { ...e, locked: !e.locked } : e,
        ),
      }));
    },
    [patchCurrentSlideCanvasScene],
  );

  const openCanvasElementContextMenu = useCallback(
    (clientX: number, clientY: number, elementId: string) => {
      setCanvasElContextMenu({ elementId, x: clientX, y: clientY });
    },
    [],
  );

  useEffect(() => {
    if (!canvasElContextMenu) return;
    const onDown = (ev: MouseEvent) => {
      if (canvasElContextMenuRef.current?.contains(ev.target as Node)) return;
      setCanvasElContextMenu(null);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setCanvasElContextMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [canvasElContextMenu]);

  const attachDragThreshold = useCallback(
    (
      elementId: string,
      startRect: SlideCanvasRect,
      startClientX: number,
      startClientY: number,
      pointerId: number,
      captureTarget: HTMLElement | null,
      thresholdPx: number,
    ) => {
      const root =
        slideContainerRef.current ??
        (document.getElementById("slide-container") as HTMLElement | null);
      if (!root) return;
      const b = root.getBoundingClientRect();
      const baseRect = { ...startRect };
      const startX = startClientX;
      const startY = startClientY;
      let dragStarted = false;
      let dragPhaseActive = false;
      let onLostPointerCapture: (() => void) | null = null;

      const cleanupWatch = () => {
        window.removeEventListener("pointermove", onMoveWatch);
        window.removeEventListener("pointerup", onUpWatch);
        window.removeEventListener("pointercancel", onUpWatch);
      };

      const cleanupDrag = () => {
        if (!dragPhaseActive) return;
        dragPhaseActive = false;
        if (rectPatchRafRef.current != null) {
          cancelAnimationFrame(rectPatchRafRef.current);
          rectPatchRafRef.current = null;
        }
        const pend = rectPatchPendingRef.current;
        rectPatchPendingRef.current = null;
        if (pend) {
          onPatchRect(pend.elementId, pend.rect);
        }
        setAlignmentGuides(null);
        window.removeEventListener("pointermove", onDrag, {
          passive: false,
        } as AddEventListenerOptions);
        window.removeEventListener("pointerup", onUpDrag);
        window.removeEventListener("pointercancel", onUpDrag);
        if (captureTarget && onLostPointerCapture) {
          captureTarget.removeEventListener(
            "lostpointercapture",
            onLostPointerCapture,
          );
          onLostPointerCapture = null;
        }
        if (
          captureTarget &&
          typeof captureTarget.releasePointerCapture === "function"
        ) {
          try {
            if (captureTarget.hasPointerCapture?.(pointerId)) {
              captureTarget.releasePointerCapture(pointerId);
            }
          } catch {
            /* noop */
          }
        }
      };

      const onDrag = (e2: PointerEvent) => {
        if (e2.pointerId !== pointerId) return;
        e2.preventDefault();
        const dxPct = ((e2.clientX - startX) / b.width) * 100;
        const dyPct = ((e2.clientY - startY) / b.height) * 100;
        const proposed: SlideCanvasRect = {
          x: baseRect.x + dxPct,
          y: baseRect.y + dyPct,
          w: baseRect.w,
          h: baseRect.h,
        };
        const { rect, guides } = snapCanvasRectWhileDragging(
          proposed,
          elementId,
          sceneElementsRef.current,
          b.width,
          b.height,
        );
        const hasGuides =
          guides.vertical.length > 0 || guides.horizontal.length > 0;
        scheduleRectPatch(elementId, rect, hasGuides ? guides : null);
      };

      const onUpDrag = (e2: PointerEvent) => {
        if (e2.pointerId !== pointerId) return;
        cleanupDrag();
      };

      const onMoveWatch = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        if (dragStarted) return;
        const d = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (d < thresholdPx) return;
        dragStarted = true;
        cleanupWatch();
        dragPhaseActive = true;

        onLostPointerCapture = () => {
          cleanupDrag();
        };
        if (captureTarget) {
          captureTarget.addEventListener(
            "lostpointercapture",
            onLostPointerCapture,
          );
        }

        if (captureTarget?.setPointerCapture) {
          try {
            captureTarget.setPointerCapture(pointerId);
          } catch {
            /* noop */
          }
        }

        window.addEventListener("pointermove", onDrag, { passive: false });
        window.addEventListener("pointerup", onUpDrag);
        window.addEventListener("pointercancel", onUpDrag);
        onDrag(ev);
      };

      const onUpWatch = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        cleanupWatch();
      };

      window.addEventListener("pointermove", onMoveWatch, { passive: false });
      window.addEventListener("pointerup", onUpWatch);
      window.addEventListener("pointercancel", onUpWatch);
    },
    [onPatchRect, scheduleRectPatch],
  );

  const startResizeCorner = useCallback(
    (
      elementId: string,
      corner: ResizeCorner,
      e: React.PointerEvent,
      rect: SlideCanvasRect,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const root =
        slideContainerRef.current ??
        (document.getElementById("slide-container") as HTMLElement | null);
      if (!root) return;
      const b = root.getBoundingClientRect();
      const opp = oppositeCornerPercent(corner, rect);
      const toPct = (clientX: number, clientY: number) => ({
        px: ((clientX - b.left) / b.width) * 100,
        py: ((clientY - b.top) / b.height) * 100,
      });
      const onMove = (ev: PointerEvent) => {
        const cur = toPct(ev.clientX, ev.clientY);
        const next = rectResizeFromCorner(opp.x, opp.y, cur.px, cur.py);
        const guides = getCanvasAlignmentGuidesForRect(
          next,
          elementId,
          sceneElementsRef.current,
        );
        const hasGuides =
          guides.vertical.length > 0 || guides.horizontal.length > 0;
        scheduleRectPatch(elementId, next, hasGuides ? guides : null);
      };
      const onUp = () => {
        if (rectPatchRafRef.current != null) {
          cancelAnimationFrame(rectPatchRafRef.current);
          rectPatchRafRef.current = null;
        }
        const pend = rectPatchPendingRef.current;
        rectPatchPendingRef.current = null;
        if (pend) {
          onPatchRect(pend.elementId, pend.rect);
        }
        setAlignmentGuides(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [onPatchRect, scheduleRectPatch],
  );

  const startResizeEdge = useCallback(
    (
      elementId: string,
      edge: ResizeEdge,
      e: React.PointerEvent,
      rect: SlideCanvasRect,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const root =
        slideContainerRef.current ??
        (document.getElementById("slide-container") as HTMLElement | null);
      if (!root) return;
      const b = root.getBoundingClientRect();
      const toPct = (clientX: number, clientY: number) => ({
        px: ((clientX - b.left) / b.width) * 100,
        py: ((clientY - b.top) / b.height) * 100,
      });
      const onMove = (ev: PointerEvent) => {
        const cur = toPct(ev.clientX, ev.clientY);
        const next = rectResizeFromEdge(edge, rect, cur.px, cur.py);
        const guides = getCanvasAlignmentGuidesForRect(
          next,
          elementId,
          sceneElementsRef.current,
        );
        const hasGuides =
          guides.vertical.length > 0 || guides.horizontal.length > 0;
        scheduleRectPatch(elementId, next, hasGuides ? guides : null);
      };
      const onUp = () => {
        if (rectPatchRafRef.current != null) {
          cancelAnimationFrame(rectPatchRafRef.current);
          rectPatchRafRef.current = null;
        }
        const pend = rectPatchPendingRef.current;
        rectPatchPendingRef.current = null;
        if (pend) {
          onPatchRect(pend.elementId, pend.rect);
        }
        setAlignmentGuides(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [onPatchRect, scheduleRectPatch],
  );

  const startRotate = useCallback(
    (
      elementId: string,
      e: React.PointerEvent,
      rect: SlideCanvasRect,
      currentRotation: number,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      const root =
        slideContainerRef.current ??
        (document.getElementById("slide-container") as HTMLElement | null);
      if (!root) return;
      const b = root.getBoundingClientRect();
      const cx = b.left + ((rect.x + rect.w / 2) / 100) * b.width;
      const cy = b.top + ((rect.y + rect.h / 2) / 100) * b.height;
      const r0 = currentRotation;
      const a0 = Math.atan2(e.clientY - cy, e.clientX - cx);
      const onMove = (ev: PointerEvent) => {
        const a1 = Math.atan2(ev.clientY - cy, ev.clientX - cx);
        const deltaDeg = ((a1 - a0) * 180) / Math.PI;
        patchElementRotation(elementId, r0 + deltaDeg);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [patchElementRotation],
  );

  const flushCanvasTextCommitIfEditing = useCallback(() => {
    if (!isEditing) return;
    flushSync(() => {
      commitSlideEdits({ keepEditing: true });
    });
  }, [isEditing, commitSlideEdits]);

  const dismissSlideCanvasSelection = useCallback(() => {
    flushCanvasTextCommitIfEditing();
    setSelectedId(null);
    setHoveredId(null);
    setActiveField(null);
    setCanvasMediaPanelEditTarget(null);
    setCanvasElContextMenu(null);
  }, [flushCanvasTextCommitIfEditing, setCanvasMediaPanelEditTarget]);

  useEffect(() => {
    const handleDismiss = () => dismissSlideCanvasSelection();
    document.addEventListener("slide:dismissCanvasSelection", handleDismiss);
    return () => {
      document.removeEventListener("slide:dismissCanvasSelection", handleDismiss);
    };
  }, [dismissSlideCanvasSelection]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid if user is currently editing text
      if (isEditing) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      if (e.key === "c" || e.key === "C") {
        const id = selectedIdRef.current;
        if (!id) return;
        const el = sceneElementsRef.current.find((x) => x.id === id);
        if (el && setClipboardElement) {
          e.preventDefault();
          const copyPayload =
            el.payload != null
              ? typeof structuredClone === "function"
                ? structuredClone(el.payload)
                : ({ ...el.payload } as typeof el.payload)
              : undefined;
          setClipboardElement({
            ...el,
            payload: copyPayload,
          });
        }
      } else if (e.key === "v" || e.key === "V") {
        if (!clipboardElement) return;
        e.preventDefault();
        patchCurrentSlideCanvasScene((currentScene) => {
          const maxZ = currentScene.elements.reduce((m, x) => Math.max(m, x.z), 0);
          const copyPayload =
            clipboardElement.payload != null
              ? typeof structuredClone === "function"
                ? structuredClone(clipboardElement.payload)
                : ({ ...clipboardElement.payload } as typeof clipboardElement.payload)
              : undefined;
          const copy: SlideCanvasElement = {
            ...clipboardElement,
            id: crypto.randomUUID(),
            rect: clampCanvasRect({
              ...clipboardElement.rect,
              x: clipboardElement.rect.x + 2,
              y: clipboardElement.rect.y + 2,
            }),
            z: maxZ + 1,
            payload: copyPayload,
          };
          const elements = normalizeCanvasElementsZOrder([
            ...currentScene.elements,
            copy,
          ]);
          return { ...currentScene, elements };
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isEditing, clipboardElement, setClipboardElement, patchCurrentSlideCanvasScene]);


  if (!currentSlide) {
    sceneElementsRef.current = [];
    return null;
  }

  const slide = ensureSlideCanvasScene(currentSlide);
  const scene = slide.canvasScene!;
  const sorted = [...scene.elements].sort((a, b) => a.z - b.z);
  sceneElementsRef.current = sorted;

  const canvasContextTarget =
    canvasElContextMenu != null
      ? (sorted.find((e) => e.id === canvasElContextMenu.elementId) ?? null)
      : null;
  const canvasContextIdx =
    canvasContextTarget != null
      ? sorted.findIndex((e) => e.id === canvasContextTarget.id)
      : -1;
  const canvasContextN = sorted.length;

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    const t = eventTargetElement(e);
    if (!t) return;
    /* Cromo en portal y menú contextual viven fuera de `data-slide-canvas-el`; sin esto el
     * pointerdown deselecciona y cierra la UI antes del click (bloqueo / orden no aplican). */
    if (t.closest(`[${CANVAS_CHROME_DATA_ATTR}]`)) return;
    if (t.closest(`[${CANVAS_CTX_MENU_ATTR}]`)) return;
    const canvasHit = t.closest("[data-slide-canvas-el]");
    if (canvasHit) {
      const k = canvasHit.getAttribute("data-slide-canvas-kind");
      if (!k || !CANVAS_KIND_CLICK_PASSTHROUGH.has(k)) return;
    }
    dismissSlideCanvasSelection();
    if (slide.type === SLIDE_TYPE.CONTENT) {
      slideContainerRef.current?.focus({ preventScroll: true });
    }
  };

  const showIaToolbar =
    slide.type === SLIDE_TYPE.CONTENT ||
    slide.type === SLIDE_TYPE.CHAPTER;
  const showPanelVideoToolbarBtn =
    showIaToolbar &&
    resolveMediaPanelDescriptor(slide).showSlideContentVideoToolbar();
  const showPanelIframeToolbarBtn =
    showIaToolbar &&
    resolveMediaPanelDescriptor(slide).showSlideContentIframeEmbedToolbar();
  const isIsometricSlide = slide.type === SLIDE_TYPE.ISOMETRIC;
  const isMapsSlide = slide.type === SLIDE_TYPE.MAPS;
  const isMindMapSlide = slide.type === SLIDE_TYPE.MIND_MAP;

  return (
    <div
      ref={slideContainerRef}
      data-slide-editor-root=""
      id={slide.type === SLIDE_TYPE.CONTENT ? "slide-container" : undefined}
      tabIndex={slide.type === SLIDE_TYPE.CONTENT ? -1 : undefined}
      className={cn(
        "relative isolate flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        deckSlideContentWrapperClass(deckVisualTheme.contentTone),
        (isIsometricSlide || isMapsSlide || isMindMapSlide) && "bg-background",
        slide.type === SLIDE_TYPE.CONTENT &&
          isDragOverImageFile &&
          "ring-2 ring-emerald-500/60 ring-inset",
      )}
      onPointerDown={onBackgroundPointerDown}
    >
      {slide.type === SLIDE_TYPE.ISOMETRIC && (
        <SlideContentIsometricFlow
          onEditorSurfacePointerDown={dismissSlideCanvasSelection}
        />
      )}
      {slide.type === SLIDE_TYPE.MIND_MAP && (
        <SlideContentMindMap />
      )}
      {slide.type === SLIDE_TYPE.MAPS && <SlideContentMapbox />}
      {!isIsometricSlide &&
        slide.type !== SLIDE_TYPE.MIND_MAP &&
        slide.type !== SLIDE_TYPE.MAPS && <DeckBackdrop theme={deckVisualTheme} />}
      {alignmentGuides ? (
        <SlideCanvasAlignmentGuides
          vertical={alignmentGuides.vertical}
          horizontal={alignmentGuides.horizontal}
        />
      ) : null}
      {showIaToolbar && (
        <div
          className="absolute left-3 top-3 flex items-center gap-1 md:left-4 md:top-4"
          style={{ zIndex: SLIDE_CANVAS_UI_Z }}
        >
          <button
            type="button"
            onClick={() => {
              setGenerateSlideContentPrompt("");
              setShowGenerateSlideContentModal(true);
            }}
            className={cn(
              deckIaToolbarBtnClass(deckVisualTheme.contentTone),
              deckIaToolbarHoverClass(deckVisualTheme.contentTone, "emerald"),
            )}
            title="Generar contenido de esta diapositiva con IA"
          >
            <Sparkles size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShowSplitModal(true)}
            className={cn(
              deckIaToolbarBtnClass(deckVisualTheme.contentTone),
              deckIaToolbarHoverClass(deckVisualTheme.contentTone, "amber"),
            )}
            title="Dividir"
          >
            <Split size={16} />
          </button>
          {showPanelVideoToolbarBtn ? (
            <>
              <button
                type="button"
                onClick={() => {
                  queueVideoUrlModal({
                    initialVideoUrl: slide.videoUrl || "",
                  });
                }}
                className={cn(
                  deckIaToolbarBtnClass(deckVisualTheme.contentTone),
                  deckIaToolbarHoverClass(deckVisualTheme.contentTone, "sky"),
                )}
                title={
                  slide.videoUrl?.trim()
                    ? "Cambiar vídeo"
                    : "Añadir vídeo (YouTube, Vimeo o URL directa)"
                }
                aria-label={
                  slide.videoUrl?.trim()
                    ? "Cambiar vídeo del panel"
                    : "Añadir vídeo al panel"
                }
              >
                <Video size={16} />
              </button>
            </>
          ) : null}
          {showPanelIframeToolbarBtn ? (
            <button
              type="button"
              onClick={() => {
                queueIframeEmbedModal({
                  initialIframeEmbedUrl: slide.iframeEmbedUrl || "",
                });
              }}
              className={cn(
                deckIaToolbarBtnClass(deckVisualTheme.contentTone),
                deckIaToolbarHoverClass(deckVisualTheme.contentTone, "slate"),
              )}
              title={
                slide.iframeEmbedUrl?.trim()
                  ? "Cambiar URL del iframe"
                  : "Añadir iframe (URL https)"
              }
              aria-label={
                slide.iframeEmbedUrl?.trim()
                  ? "Cambiar iframe del panel"
                  : "Añadir iframe al panel"
              }
            >
              <Frame size={16} />
            </button>
          ) : null}
        </div>
      )}

      <div
        ref={slideCanvasChromePortalRef}
        className="pointer-events-none absolute inset-0 overflow-visible"
        style={{ zIndex: SLIDE_CANVAS_CHROME_PORTAL_Z }}
      />

      {sorted
        .filter((el) => el.kind !== "sectionLabel")
        /* Diapositiva solo isométrica / mapa: ya se pinta el lienzo completo arriba; el bloque en `canvasScene` duplicaría UI (p. ej. dos toolbars). */
        .filter((el) => {
          if (slide.type === SLIDE_TYPE.ISOMETRIC && el.kind === "isometricFlow") {
            return false;
          }
          if (slide.type === SLIDE_TYPE.MIND_MAP && el.kind === "mindMap") {
            return false;
          }
          if (slide.type === SLIDE_TYPE.MAPS && el.kind === "mapboxMap") {
            return false;
          }
          return true;
        })
        .map((el) => (
        <CanvasElementEditor
          key={el.id}
          element={el}
          slide={slide}
          isSelected={selectedId === el.id}
          isHovered={hoveredId === el.id}
          onHoverEnter={() => setHoveredId(el.id)}
          onHoverLeave={() =>
            setHoveredId((h) => (h === el.id ? null : h))
          }
          onSelect={() => {
            flushCanvasTextCommitIfEditing();
            if (selectedIdRef.current !== el.id) {
              setActiveField(null);
            }
            setSelectedId(el.id);
            setHoveredId(null);
            if (el.kind === "mediaPanel") {
              /* Siempre rehidratar buffers al cambiar de panel (tamaño/idioma/código del payload correcto). */
              setCanvasMediaPanelEditTarget(el.id, {
                rehydrateCodeBuffers: true,
              });
            } else {
              /* Evita que pegar/subir imagen siga yendo al último `mediaPanel` cliqueado. */
              setCanvasMediaPanelEditTarget(null);
            }
            syncCanvasTextEditTargetsFromSelection(slide, el);
          }}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          activeField={activeField}
          setActiveField={setActiveField}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editSubtitle={editSubtitle}
          setEditSubtitle={setEditSubtitle}
          editContent={editContent}
          setEditContent={setEditContent}
          applyEditContentRichDraft={applyEditContentRichDraft}
          editContentRichHtml={editContentRichHtml}
          setEditContentRichHtml={setEditContentRichHtml}
          editContentBodyFontScale={editContentBodyFontScale}
          setEditContentBodyFontScale={setEditContentBodyFontScale}
          formatMarkdown={formatMarkdown}
          commitSlideEdits={commitSlideEdits}
          patchCurrentSlideCanvasScene={patchCurrentSlideCanvasScene}
          patchCurrentSlideMatrix={patchCurrentSlideMatrix}
          setShowRewriteModal={setShowRewriteModal}
          setGenerateSlideContentPrompt={setGenerateSlideContentPrompt}
          setShowGenerateSlideContentModal={setShowGenerateSlideContentModal}
          attachDragThreshold={attachDragThreshold}
          dragThresholdPx={DRAG_THRESHOLD_PX}
          startResizeCorner={startResizeCorner}
          startResizeEdge={startResizeEdge}
          startRotate={startRotate}
          duplicateCanvasElement={duplicateCanvasElement}
          deleteCanvasElement={deleteCanvasElement}
          bringCanvasElementForward={bringCanvasElementForward}
          sendCanvasElementBackward={sendCanvasElementBackward}
          bringCanvasElementToFront={bringCanvasElementToFront}
          sendCanvasElementToBack={sendCanvasElementToBack}
          toggleCanvasElementLocked={toggleCanvasElementLocked}
          canvasLayerStackIndex={sorted.findIndex((e) => e.id === el.id)}
          canvasLayerStackCount={sorted.length}
          diagramRemountToken={diagramRemountToken}
          onPatchRect={onPatchRect}
          slideContainerRef={slideContainerRef}
          openImageModal={openImageModal}
          openImageUploadModal={openImageUploadModal}
          openVideoModal={() => {
            const panelSlide = slideAppearanceForMediaElement(slide, el);
            queueVideoUrlModal({
              mediaPanelElementId: el.id,
              initialVideoUrl: panelSlide.videoUrl || "",
            });
          }}
          openIframeEmbedModal={() => {
            const panelSlide = slideAppearanceForMediaElement(slide, el);
            queueIframeEmbedModal({
              mediaPanelElementId: el.id,
              initialIframeEmbedUrl: panelSlide.iframeEmbedUrl || "",
            });
          }}
          setCurrentSlidePresenter3dScreenMedia={setCurrentSlidePresenter3dScreenMedia}
          setCanvasTextEditTarget={setCanvasTextEditTarget}
          editLanguage={editLanguage}
          setEditLanguage={setEditLanguage}
          editFontSize={editFontSize}
          setEditFontSize={setEditFontSize}
          openCodeGenModal={openCodeGenModal}
          deckContentTone={deckVisualTheme.contentTone}
          onDismissSlideCanvasSelection={dismissSlideCanvasSelection}
          onOpenCanvasElementContextMenu={openCanvasElementContextMenu}
          canvasMediaPanelElementId={canvasMediaPanelElementId}
          cycleCodeEditorThemeForMediaPanel={cycleCodeEditorThemeForMediaPanel}
          canvas3dAnimClipNamesByPanelId={canvas3dAnimClipNamesByPanelId}
          onCanvas3dAnimationClipNames={onCanvas3dAnimationClipNames}
          slideCanvasChromePortalRef={slideCanvasChromePortalRef}
          isPreviewMode={isPreviewMode}
        />
      ))}
      {canvasElContextMenu != null && canvasContextIdx >= 0 ? (
        <div
          ref={canvasElContextMenuRef}
          {...{ [CANVAS_CTX_MENU_ATTR]: "" }}
          className="fixed z-[12000] min-w-[272px] max-w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-xl border border-stone-200/90 bg-white py-2 text-sm shadow-xl ring-1 ring-black/5 dark:border-stone-600 dark:bg-stone-900 dark:ring-white/10"
          style={{
            left: canvasElContextMenu.x,
            top: canvasElContextMenu.y,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          role="menu"
          aria-label="Orden y bloqueo del panel"
        >
          <div className="flex items-center gap-2 px-3 pb-2 pt-0.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400">
              <Layers size={18} strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                Orden de capas
              </p>
              <p className="truncate text-xs text-stone-400 dark:text-stone-500">
                Capa {canvasContextIdx + 1} de {canvasContextN}
              </p>
            </div>
          </div>
          <div className="mx-2 border-t border-stone-100 dark:border-stone-700/80" />
          <div className="px-1.5 pt-1.5">
            <button
              type="button"
              role="menuitem"
              disabled={canvasContextIdx >= canvasContextN - 1}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                canvasContextIdx < canvasContextN - 1
                  ? "text-stone-800 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800/80"
                  : "cursor-not-allowed text-stone-400 dark:text-stone-500",
              )}
              onClick={() => {
                if (canvasContextIdx >= canvasContextN - 1) return;
                bringCanvasElementForward(canvasElContextMenu.elementId);
                setCanvasElContextMenu(null);
              }}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                  canvasContextIdx < canvasContextN - 1
                    ? "border-stone-200 bg-stone-50 dark:border-stone-600 dark:bg-stone-800"
                    : "border-transparent bg-stone-50/50 dark:bg-stone-800/40",
                )}
                aria-hidden
              >
                <ChevronUp size={18} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-tight">
                  Traer adelante
                </span>
                <span className="block text-xs font-normal text-stone-500 dark:text-stone-400">
                  Una capa hacia delante
                </span>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={canvasContextIdx <= 0}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                canvasContextIdx > 0
                  ? "text-stone-800 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800/80"
                  : "cursor-not-allowed text-stone-400 dark:text-stone-500",
              )}
              onClick={() => {
                if (canvasContextIdx <= 0) return;
                sendCanvasElementBackward(canvasElContextMenu.elementId);
                setCanvasElContextMenu(null);
              }}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                  canvasContextIdx > 0
                    ? "border-stone-200 bg-stone-50 dark:border-stone-600 dark:bg-stone-800"
                    : "border-transparent bg-stone-50/50 dark:bg-stone-800/40",
                )}
                aria-hidden
              >
                <ChevronDown size={18} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-tight">
                  Enviar atrás
                </span>
                <span className="block text-xs font-normal text-stone-500 dark:text-stone-400">
                  Una capa hacia detrás
                </span>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={canvasContextIdx >= canvasContextN - 1}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                canvasContextIdx < canvasContextN - 1
                  ? "text-stone-800 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800/80"
                  : "cursor-not-allowed text-stone-400 dark:text-stone-500",
              )}
              onClick={() => {
                if (canvasContextIdx >= canvasContextN - 1) return;
                bringCanvasElementToFront(canvasElContextMenu.elementId);
                setCanvasElContextMenu(null);
              }}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                  canvasContextIdx < canvasContextN - 1
                    ? "border-emerald-200/80 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/40"
                    : "border-transparent bg-stone-50/50 dark:bg-stone-800/40",
                )}
                aria-hidden
              >
                <BringToFront size={18} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-tight">
                  Traer al frente
                </span>
                <span className="block text-xs font-normal text-stone-500 dark:text-stone-400">
                  Sobre todos los paneles
                </span>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={canvasContextIdx <= 0}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                canvasContextIdx > 0
                  ? "text-stone-800 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800/80"
                  : "cursor-not-allowed text-stone-400 dark:text-stone-500",
              )}
              onClick={() => {
                if (canvasContextIdx <= 0) return;
                sendCanvasElementToBack(canvasElContextMenu.elementId);
                setCanvasElContextMenu(null);
              }}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                  canvasContextIdx > 0
                    ? "border-stone-200 bg-stone-50 dark:border-stone-600 dark:bg-stone-800"
                    : "border-transparent bg-stone-50/50 dark:bg-stone-800/40",
                )}
                aria-hidden
              >
                <SendToBack size={18} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-tight">
                  Enviar al fondo
                </span>
                <span className="block text-xs font-normal text-stone-500 dark:text-stone-400">
                  Detrás de todos los paneles
                </span>
              </span>
            </button>
          </div>
          <div className="mx-2 my-1.5 border-t border-stone-100 dark:border-stone-700/80" />
          <div className="px-1.5 pb-0.5">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-stone-800 transition-colors hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800/80"
              onClick={() => {
                toggleCanvasElementLocked(canvasElContextMenu.elementId);
                setCanvasElContextMenu(null);
              }}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                  canvasContextTarget?.locked
                    ? "border-amber-200/90 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/35"
                    : "border-stone-200 bg-stone-50 dark:border-stone-600 dark:bg-stone-800",
                )}
                aria-hidden
              >
                {canvasContextTarget?.locked ? (
                  <Unlock size={18} strokeWidth={2} />
                ) : (
                  <Lock size={18} strokeWidth={2} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-tight">
                  {canvasContextTarget?.locked
                    ? "Desbloquear panel"
                    : "Bloquear panel"}
                </span>
                <span className="block text-xs font-normal text-stone-500 dark:text-stone-400">
                  {canvasContextTarget?.locked
                    ? "Permitir mover y redimensionar"
                    : "Evitar mover o redimensionar"}
                </span>
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CanvasElementEditor({
  element,
  slide,
  isSelected,
  isHovered,
  onHoverEnter,
  onHoverLeave,
  onSelect,
  isEditing,
  setIsEditing,
  activeField,
  setActiveField,
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
  formatMarkdown,
  commitSlideEdits,
  patchCurrentSlideCanvasScene,
  patchCurrentSlideMatrix,
  setShowRewriteModal,
  setGenerateSlideContentPrompt,
  setShowGenerateSlideContentModal,
  attachDragThreshold,
  dragThresholdPx,
  startResizeCorner,
  startResizeEdge,
  startRotate,
  duplicateCanvasElement,
  deleteCanvasElement,
  bringCanvasElementForward,
  sendCanvasElementBackward,
  bringCanvasElementToFront,
  sendCanvasElementToBack,
  toggleCanvasElementLocked,
  canvasLayerStackIndex,
  canvasLayerStackCount,
  diagramRemountToken,
  onPatchRect,
  slideContainerRef,
  openImageModal,
  openImageUploadModal,
  openVideoModal,
  openIframeEmbedModal,
  setCurrentSlidePresenter3dScreenMedia,
  editLanguage,
  setEditLanguage,
  editFontSize,
  setEditFontSize,
  openCodeGenModal,
  deckContentTone,
  setCanvasTextEditTarget,
  onDismissSlideCanvasSelection,
  onOpenCanvasElementContextMenu,
  canvasMediaPanelElementId,
  cycleCodeEditorThemeForMediaPanel,
  canvas3dAnimClipNamesByPanelId,
  onCanvas3dAnimationClipNames,
  slideCanvasChromePortalRef,
  isPreviewMode: deckIsPreviewMode,
}: {
  element: SlideCanvasElement;
  slide: Slide;
  isSelected: boolean;
  isHovered: boolean;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onSelect: () => void;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  activeField: TextField | null;
  setActiveField: (f: TextField | null) => void;
  editTitle: string;
  setEditTitle: (v: string) => void;
  editSubtitle: string;
  setEditSubtitle: (v: string) => void;
  editContent: string;
  setEditContent: (v: string) => void;
  applyEditContentRichDraft: (plain: string, richHtml: string) => void;
  editContentRichHtml: string;
  setEditContentRichHtml: (v: string) => void;
  editContentBodyFontScale: number;
  setEditContentBodyFontScale: (v: number | ((p: number) => number)) => void;
  formatMarkdown: (raw: string) => string;
  commitSlideEdits: (o?: { keepEditing?: boolean }) => void;
  patchCurrentSlideCanvasScene: (
    updater: (scene: SlideCanvasScene) => SlideCanvasScene,
  ) => void;
  patchCurrentSlideMatrix: (u: (p: SlideMatrixData) => SlideMatrixData) => void;
  setShowRewriteModal: (v: boolean) => void;
  setGenerateSlideContentPrompt: (v: string) => void;
  setShowGenerateSlideContentModal: (v: boolean) => void;
  attachDragThreshold: (
    id: string,
    r: SlideCanvasRect,
    clientX: number,
    clientY: number,
    pointerId: number,
    captureTarget: HTMLElement | null,
    thresholdPx: number,
  ) => void;
  dragThresholdPx: number;
  startResizeCorner: (
    id: string,
    corner: ResizeCorner,
    e: React.PointerEvent,
    r: SlideCanvasRect,
  ) => void;
  startResizeEdge: (
    id: string,
    edge: ResizeEdge,
    e: React.PointerEvent,
    r: SlideCanvasRect,
  ) => void;
  startRotate: (
    id: string,
    e: React.PointerEvent,
    r: SlideCanvasRect,
    rot: number,
  ) => void;
  duplicateCanvasElement: (id: string) => void;
  deleteCanvasElement: (id: string) => void;
  bringCanvasElementForward: (id: string) => void;
  sendCanvasElementBackward: (id: string) => void;
  bringCanvasElementToFront: (id: string) => void;
  sendCanvasElementToBack: (id: string) => void;
  toggleCanvasElementLocked: (id: string) => void;
  canvasLayerStackIndex: number;
  canvasLayerStackCount: number;
  diagramRemountToken: number;
  onPatchRect: (id: string, r: SlideCanvasRect) => void;
  slideContainerRef: RefObject<HTMLDivElement | null>;
  openImageModal: (options?: { mediaPanelElementId?: string | null }) => void;
  openImageUploadModal: (options?: {
    mediaPanelElementId?: string | null;
  }) => void;
  openVideoModal: (options?: {
    mediaPanelElementId?: string | null;
    initialVideoUrl?: string;
  }) => void;
  openIframeEmbedModal: () => void;
  setCurrentSlidePresenter3dScreenMedia: (
    m: "image" | "video",
    explicitMediaPanelElementId?: string | null,
  ) => void;
  editLanguage: string;
  setEditLanguage: (v: string) => void;
  editFontSize: number;
  setEditFontSize: (v: number | ((p: number) => number)) => void;
  openCodeGenModal: () => void;
  deckContentTone: DeckContentTone;
  setCanvasTextEditTarget: (
    field: "title" | "subtitle" | "content",
    elementId: string,
  ) => void;
  onDismissSlideCanvasSelection: () => void;
  onOpenCanvasElementContextMenu: (
    clientX: number,
    clientY: number,
    elementId: string,
  ) => void;
  canvasMediaPanelElementId: string | null;
  cycleCodeEditorThemeForMediaPanel: (elementId: string) => void;
  canvas3dAnimClipNamesByPanelId: Record<string, string[]>;
  onCanvas3dAnimationClipNames: (
    mediaPanelElementId: string,
    names: string[],
  ) => void;
  slideCanvasChromePortalRef: RefObject<HTMLDivElement | null>;
  /** Vista previa / presentador en la misma pestaña: no montar WebGL 3D en el lienzo (evita duplicar contextos con el overlay). */
  isPreviewMode: boolean;
}) {
  const tone = deckContentTone;
  const { theme: globalCodeEditorTheme } = useCodeEditorTheme();
  const { rect, kind, id, z } = element;
  const panelSlide =
    kind === "mediaPanel"
      ? slideAppearanceForMediaElement(slide, element)
      : slide;
  const dataMotionRingOnCanvas =
    kind === "mediaPanel" &&
    resolveMediaPanelDescriptor(panelSlide).kind ===
      PANEL_CONTENT_KIND.DATA_MOTION_RING;
  const rotation = element.rotation ?? 0;
  const isLocked = Boolean(element.locked);

  const titleAutoMeasureRef = useRef<HTMLDivElement>(null);
  const subtitleAutoMeasureRef = useRef<HTMLDivElement>(null);
  const markdownMeasureRootRef = useRef<HTMLDivElement>(null);
  const markdownRectRef = useRef(rect);
  markdownRectRef.current = rect;

  const textField = fieldForKind(kind);
  const editingThisBlockText =
    Boolean(
      isEditing &&
        isSelected &&
        textField != null &&
        activeField === textField,
    );

  const isTitleKind = kind === "title" || kind === "chapterTitle";
  const isSubtitleKind = kind === "subtitle" || kind === "chapterSubtitle";
  const showTitleEdit = isEditing && isSelected && activeField === "title";
  const showSubtitleEdit = isEditing && isSelected && activeField === "subtitle";
  /** Con rotación, el AABB infla el alto; no auto-ajustamos para no pisar el tamaño manual. */
  const autoHeightByContent = Math.abs(rotation) < 0.01;

  const canvasMdDisplayForFit =
    kind === "markdown" ? getCanvasMarkdownBodyDisplay(slide, element) : null;
  const markdownFitContentSig =
    kind !== "markdown" || !canvasMdDisplayForFit
      ? ""
      : [
          canvasMdDisplayForFit.kind,
          canvasMdDisplayForFit.kind === "html"
            ? canvasMdDisplayForFit.html
            : canvasMdDisplayForFit.source,
          isSlideCanvasTextPayload(element.payload)
            ? String(element.payload.bodyFontScale ?? 1)
            : "1",
        ].join("\u0001");

  useCanvasTextBlockAutoHeight(
    isTitleKind && autoHeightByContent,
    titleAutoMeasureRef,
    slideContainerRef,
    id,
    rect,
    onPatchRect,
    [
      isTitleKind,
      autoHeightByContent,
      id,
      rect.x,
      rect.y,
      rect.w,
      readTextMarkdownFromElement(slide, element),
      editTitle,
      kind,
      rotation,
      showTitleEdit,
      onPatchRect,
      slideContainerRef,
    ],
  );

  useCanvasTextBlockAutoHeight(
    isSubtitleKind && autoHeightByContent,
    subtitleAutoMeasureRef,
    slideContainerRef,
    id,
    rect,
    onPatchRect,
    [
      isSubtitleKind,
      autoHeightByContent,
      id,
      rect.x,
      rect.y,
      rect.w,
      readTextMarkdownFromElement(slide, element),
      editSubtitle,
      kind,
      rotation,
      showSubtitleEdit,
      onPatchRect,
      slideContainerRef,
    ],
  );

  /**
   * Markdown: sin ResizeObserver (evita pelear con el resize manual). Auto-encogido
   * en layout cuando hay aire bajo el texto; botón en cromo para ajustar alto al contenido.
   */
  useMarkdownCanvasAutoShrinkHeight(
    kind === "markdown" && autoHeightByContent && !editingThisBlockText,
    markdownMeasureRootRef,
    slideContainerRef,
    id,
    rect,
    onPatchRect,
    [
      kind === "markdown" && autoHeightByContent && !editingThisBlockText,
      id,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      markdownFitContentSig,
      editingThisBlockText,
      onPatchRect,
      slideContainerRef,
    ],
  );

  const zRank = Math.round(Number.isFinite(z) ? z : 0);
  const sub =
    (isSelected ? CANVAS_Z_SUB_SELECTED : 0) +
    (!isSelected && isHovered ? CANVAS_Z_SUB_HOVER : 0);
  const stackInLayer = zRank * CANVAS_Z_STRIDE + sub;
  const zIndex = stackInLayer;
  const box: React.CSSProperties = {
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.w}%`,
    height: `${rect.h}%`,
    zIndex,
  };

  const shellHoverProps = {
    onPointerEnter: onHoverEnter,
    onPointerLeave: onHoverLeave,
  };
  const onCanvasShellContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenCanvasElementContextMenu(e.clientX, e.clientY, id);
  };
  const shellSurfaceProps = {
    ...shellHoverProps,
    onContextMenu: onCanvasShellContextMenu,
  };

  const showHoverOutline = isHovered && !isSelected;

  /** Marco verde + asas: visible también en edición de texto (resize/rotación). */
  const showCanvaChromeFrame =
    isSelected &&
    kind !== "excalidraw" &&
    kind !== "isometricFlow" &&
    kind !== "sectionLabel";
  /** Barra píldora (IA, lápiz, B/I…): se oculta en edición para no chocar con la barra de selección del rich text. */
  const showCanvaChromeToolbarPill =
    showCanvaChromeFrame && !editingThisBlockText;

  const onShellPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = eventTargetElement(e);
    if (!t) return;
    if (t.closest(`[${EDIT_FIELD_ATTR}="true"]`)) return;
    if (t.closest("[data-slide-canvas-chrome]")) return;
    if (t.closest("[data-canvas-resize]")) return;

    const editingThisBlock = Boolean(
      isEditing && textField != null && activeField === textField,
    );
    /* En edición: clics en el “aire” del marco (no en el campo) no deben
     * disparar onSelect + commit en flush (pierden foco/selección del rich text). */
    if (editingThisBlock) {
      if (
        t.closest(
          "input, textarea, select, button, [contenteditable='true']",
        )
      ) {
        return;
      }
      return;
    }

    onSelect();
    if (
      t.closest(
        "input, textarea, select, button, [contenteditable='true']",
      )
    ) {
      return;
    }
    /**
     * El segundo `pointerdown` de un doble clic (`detail >= 2`) debe abrir edición sin
     * enganchar `attachDragThreshold`: si el puntero se mueve > umbral entre los dos
     * clics, el navegador no emite `dblclick` y el bloque parece “bloqueado”.
     */
    if (e.detail >= 2) {
      if (kind === "markdown") {
        openMarkdownContentEdit();
        return;
      }
      if (kind === "matrixNotes") {
        openMatrixNotesContentEdit();
        return;
      }
      if (kind === "title" || kind === "chapterTitle") {
        setCanvasTextEditTarget("title", id);
        setEditTitle(readTextMarkdownFromElement(slide, element));
        setIsEditing(true);
        setActiveField("title");
        return;
      }
      if (kind === "subtitle" || kind === "chapterSubtitle") {
        setCanvasTextEditTarget("subtitle", id);
        setEditSubtitle(readTextMarkdownFromElement(slide, element));
        setIsEditing(true);
        setActiveField("subtitle");
        return;
      }
    }
    const captureEl =
      e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
    if (kind !== "isometricFlow" && !isLocked) {
      attachDragThreshold(
        id,
        rect,
        e.clientX,
        e.clientY,
        e.pointerId,
        captureEl,
        dragThresholdPx,
      );
    }
  };

  const toolbarAiKinds: SlideCanvasElement["kind"][] = [
    "markdown",
    "title",
    "chapterTitle",
    "subtitle",
    "chapterSubtitle",
    "matrixNotes",
  ];
  const showToolbarAi =
    toolbarAiKinds.includes(kind) &&
    (slide.type === SLIDE_TYPE.CONTENT ||
      slide.type === SLIDE_TYPE.MATRIX ||
      slide.type === SLIDE_TYPE.ISOMETRIC);

  const mediaPanelDesc = resolveMediaPanelDescriptor(panelSlide);
  const showMediaPanelImageActions =
    kind === "mediaPanel" && mediaPanelDesc.showCanvasToolbarImageActions();
  const showMediaPanelCodeActions =
    kind === "mediaPanel" && mediaPanelDesc.showCanvasToolbarCodeActions();
  const showMediaPanelVideoActions =
    kind === "mediaPanel" && mediaPanelDesc.showCanvasToolbarVideoModal();
  const showMediaPanelIframeEmbedActions =
    kind === "mediaPanel" && mediaPanelDesc.showCanvasToolbarIframeEmbedModal();
  const showMediaPanelCanvas3dActions =
    kind === "mediaPanel" && mediaPanelDesc.showCanvasToolbarCanvas3dActions();
  const showPresenter3dTextureLoads =
    kind === "mediaPanel" && mediaPanelDesc.showCanvasToolbarPresenter3dTextureLoads();

  const effectiveCanvasCodeTheme =
    kind === "mediaPanel" && mediaPanelDesc.kind === PANEL_CONTENT_KIND.CODE
      ? panelSlide.codeEditorTheme ?? globalCodeEditorTheme
      : globalCodeEditorTheme;

  const markdownRichRef = useRef<SlideCanvasRichDescriptionHandle>(null);

  const openMatrixNotesContentEdit = useCallback(() => {
    if (kind !== "matrixNotes") return;
    onSelect();
    setCanvasTextEditTarget("content", id);
    setEditContent(readTextMarkdownFromElement(slide, element));
    setIsEditing(true);
    setActiveField("content");
  }, [
    kind,
    id,
    onSelect,
    element,
    slide,
    setCanvasTextEditTarget,
    setEditContent,
    setIsEditing,
    setActiveField,
  ]);

  const openMarkdownContentEdit = useCallback(() => {
    if (kind !== "markdown") return;
    onSelect();
    setCanvasTextEditTarget("content", id);
    const p = element.payload;
    if (isSlideCanvasTextPayload(p) && p.richHtml?.trim()) {
      setEditContentRichHtml(p.richHtml);
      setEditContentBodyFontScale(
        Math.min(2.5, Math.max(0.5, p.bodyFontScale ?? 1)),
      );
      setEditContent(
        p.markdown.trim()
          ? p.markdown
          : plainTextFromRichHtml(p.richHtml) || "",
      );
    } else {
      setEditContentRichHtml("");
      setEditContentBodyFontScale(1);
      setEditContent(
        formatMarkdown(readTextMarkdownFromElement(slide, element)),
      );
    }
    setIsEditing(true);
    setActiveField("content");
  }, [
    kind,
    id,
    onSelect,
    element,
    slide,
    setCanvasTextEditTarget,
    setEditContentRichHtml,
    setEditContentBodyFontScale,
    setEditContent,
    formatMarkdown,
    setIsEditing,
    setActiveField,
  ]);

  const bumpMarkdownBodyFontScaleOnCanvas = useCallback(
    (factor: number) => {
      if (kind !== "markdown") return;
      const p = element.payload;
      if (!isSlideCanvasTextPayload(p)) return;
      const cur = Math.min(2.5, Math.max(0.5, p.bodyFontScale ?? 1));
      const nextScale = Math.min(
        2.5,
        Math.max(0.5, Number((cur * factor).toFixed(3))),
      );
      flushSync(() => setEditContentBodyFontScale(nextScale));
      patchCurrentSlideCanvasScene((scene) => ({
        ...scene,
        elements: scene.elements.map((e) => {
          if (e.id !== id || e.kind !== "markdown") return e;
          const ep = e.payload;
          if (!isSlideCanvasTextPayload(ep)) return e;
          const c = Math.min(2.5, Math.max(0.5, ep.bodyFontScale ?? 1));
          const n = Math.min(
            2.5,
            Math.max(0.5, Number((c * factor).toFixed(3))),
          );
          return { ...e, payload: { ...ep, bodyFontScale: n } };
        }),
      }));
    },
    [kind, id, element, patchCurrentSlideCanvasScene, setEditContentBodyFontScale],
  );

  const markdownChromeFontScalePct =
    kind === "markdown"
      ? (() => {
          const d = getCanvasMarkdownBodyDisplay(slide, element);
          if (d.kind === "html") return Math.round(d.scale * 100);
          const p = element.payload;
          if (isSlideCanvasTextPayload(p)) {
            return Math.round(
              Math.min(2.5, Math.max(0.5, p.bodyFontScale ?? 1)) * 100,
            );
          }
          return 100;
        })()
      : 100;

  const patchMarkdownWholeRichHtml = useCallback(
    (transform: (html: string) => string) => {
      if (kind !== "markdown") return;
      const p = element.payload;
      if (!isSlideCanvasTextPayload(p)) return;
      const mdFormatted = formatMarkdown(
        readTextMarkdownFromElement(slide, element),
      );
      const baseHtml = p.richHtml?.trim()
        ? p.richHtml
        : markdownBodyToRichHtmlForEditor(mdFormatted);
      const sanitized = sanitizeSlideRichHtml(transform(baseHtml));
      const plain = plainTextFromRichHtml(sanitized);
      const nextMarkdown = plain.trim() ? plain : p.markdown;
      /* `commitSlideEdits` reaplica buffers al lienzo; si los refs siguen vacíos,
       * `applyEditBuffersToSlide` borra `richHtml`. Alinear buffers con el patch. */
      flushSync(() => {
        setEditContentRichHtml(sanitized);
        setEditContent(nextMarkdown);
      });
      patchCurrentSlideCanvasScene((scene) => ({
        ...scene,
        elements: scene.elements.map((e) => {
          if (e.id !== id || e.kind !== "markdown") return e;
          const ep = e.payload;
          if (!isSlideCanvasTextPayload(ep)) return e;
          const mdF = formatMarkdown(readTextMarkdownFromElement(slide, e));
          const base = ep.richHtml?.trim()
            ? ep.richHtml
            : markdownBodyToRichHtmlForEditor(mdF);
          const nextRich = transform(base);
          const san = sanitizeSlideRichHtml(nextRich);
          const pl = plainTextFromRichHtml(san);
          return {
            ...e,
            payload: {
              ...ep,
              richHtml: san,
              markdown: pl.trim() ? pl : ep.markdown,
            },
          };
        }),
      }));
    },
    [
      kind,
      id,
      element,
      patchCurrentSlideCanvasScene,
      slide,
      formatMarkdown,
      setEditContent,
      setEditContentRichHtml,
    ],
  );

  const fitMarkdownHeightToContent = useCallback(() => {
    if (kind !== "markdown") return;
    const elementId = id;
    window.requestAnimationFrame(() => {
      const root = markdownMeasureRootRef.current;
      const slideEl = slideContainerRef.current;
      if (!root || !slideEl) return;
      const r = markdownRectRef.current;
      const scrollHost =
        root.querySelector<HTMLElement>(
          "[data-slide-markdown-scroll-measure]",
        ) ?? root;
      const sh = scrollHost.scrollHeight;
      const slideH = slideEl.getBoundingClientRect().height;
      if (slideH < 1 || sh < 1) return;
      const hPx = Math.ceil(sh + 8);
      let hPct = (hPx / slideH) * 100;
      hPct = Math.min(100 - r.y, Math.max(3, hPct));
      const next = clampCanvasRect({ ...r, h: hPct });
      if (Math.abs(next.h - r.h) < 0.25) return;
      onPatchRect(elementId, next);
    });
  }, [kind, id, onPatchRect, slideContainerRef]);

  const canvaChromeToolbarProps = showCanvaChromeToolbarPill
    ? {
          onGenerateImage: showMediaPanelImageActions
            ? () => openImageModal({ mediaPanelElementId: id })
            : undefined,
          onUseImage:
            showMediaPanelImageActions || showPresenter3dTextureLoads
              ? () => {
                  if (showPresenter3dTextureLoads) {
                    setCurrentSlidePresenter3dScreenMedia("image", id);
                  }
                  openImageUploadModal({ mediaPanelElementId: id });
                }
              : undefined,
          onOpenVideoModal:
            showMediaPanelVideoActions || showPresenter3dTextureLoads
              ? () => {
                  if (showPresenter3dTextureLoads) {
                    setCurrentSlidePresenter3dScreenMedia("video", id);
                  }
                  openVideoModal();
                }
              : undefined,
          onOpenIframeEmbedModal: showMediaPanelIframeEmbedActions
            ? () => openIframeEmbedModal()
            : undefined,
          codeActions: showMediaPanelCodeActions
            ? {
                fontSize:
                  canvasMediaPanelElementId != null &&
                  id === canvasMediaPanelElementId
                    ? editFontSize
                    : panelSlide.fontSize ?? 14,
                onFontDec: () =>
                  setEditFontSize((p) => Math.max(8, p - 2)),
                onFontInc: () =>
                  setEditFontSize((p) => Math.min(64, p + 2)),
                language:
                  canvasMediaPanelElementId != null &&
                  id === canvasMediaPanelElementId
                    ? editLanguage
                    : panelSlide.language || "javascript",
                onLanguageChange: setEditLanguage,
                codeTheme: effectiveCanvasCodeTheme,
                onCyclePanelCodeTheme: () =>
                  cycleCodeEditorThemeForMediaPanel(id),
                onOpenCodeGen: () => openCodeGenModal(),
              }
            : undefined,
          showAi: showToolbarAi,
          onAi: showToolbarAi
            ? () => {
                setGenerateSlideContentPrompt("");
                setShowGenerateSlideContentModal(true);
              }
            : undefined,
          onEdit:
            showMediaPanelImageActions ||
            showMediaPanelCodeActions ||
            showMediaPanelVideoActions ||
            showMediaPanelIframeEmbedActions ||
            showMediaPanelCanvas3dActions ||
            showPresenter3dTextureLoads
            ? undefined
            : () => {
                setIsEditing(true);
                if (kind === "markdown" || kind === "matrixNotes") {
                  setCanvasTextEditTarget("content", id);
                  if (kind === "markdown") {
                    const p = element.payload;
                    if (isSlideCanvasTextPayload(p) && p.richHtml?.trim()) {
                      setEditContentRichHtml(p.richHtml);
                      setEditContentBodyFontScale(
                        Math.min(2.5, Math.max(0.5, p.bodyFontScale ?? 1)),
                      );
                      setEditContent(
                        p.markdown.trim()
                          ? p.markdown
                          : plainTextFromRichHtml(p.richHtml) || "",
                      );
                    } else {
                      setEditContentRichHtml("");
                      setEditContentBodyFontScale(1);
                      setEditContent(
                        formatMarkdown(
                          readTextMarkdownFromElement(slide, element),
                        ),
                      );
                    }
                  } else {
                    setEditContentRichHtml("");
                    setEditContentBodyFontScale(1);
                    setEditContent(
                      formatMarkdown(
                        readTextMarkdownFromElement(slide, element),
                      ),
                    );
                  }
                  setActiveField("content");
                } else if (
                  kind === "title" ||
                  kind === "chapterTitle"
                ) {
                  setCanvasTextEditTarget("title", id);
                  setEditTitle(readTextMarkdownFromElement(slide, element));
                  setActiveField("title");
                } else if (
                  kind === "subtitle" ||
                  kind === "chapterSubtitle"
                ) {
                  setCanvasTextEditTarget("subtitle", id);
                  setEditSubtitle(readTextMarkdownFromElement(slide, element));
                  setActiveField("subtitle");
                } else {
                  setIsEditing(true);
                }
              },
          onDuplicate: () => duplicateCanvasElement(id),
          onDelete: () => deleteCanvasElement(id),
          onBringForwardOneStep: () => bringCanvasElementForward(id),
          onSendBackwardOneStep: () => sendCanvasElementBackward(id),
          onBringToFront: () => bringCanvasElementToFront(id),
          onSendToBack: () => sendCanvasElementToBack(id),
          onToggleLock: () => toggleCanvasElementLocked(id),
          isLocked,
          layerStack: {
            index: canvasLayerStackIndex,
            count: canvasLayerStackCount,
          },
          canvas3dSource: showMediaPanelCanvas3dActions
            ? {
                httpGlbUrl: panelSlide.canvas3dGlbUrl?.startsWith("http")
                  ? panelSlide.canvas3dGlbUrl
                  : "",
                slideId: panelSlide.id,
                mediaPanelElementId: id,
                glbUrl: panelSlide.canvas3dGlbUrl,
                viewState: panelSlide.canvas3dViewState,
                modelTransform: panelSlide.canvas3dModelTransform,
                animationClipNames:
                  canvas3dAnimClipNamesByPanelId[id] ?? [],
                animationClipValue: panelSlide.canvas3dAnimationClipName,
              }
            : undefined,
          markdownDescriptionToolbar:
            kind === "markdown" && showCanvaChromeToolbarPill
              ? {
                  fontScalePct: markdownChromeFontScalePct,
                  onBlockScaleDec: () =>
                    bumpMarkdownBodyFontScaleOnCanvas(1 / 1.08),
                  onBlockScaleInc: () =>
                    bumpMarkdownBodyFontScaleOnCanvas(1.08),
                  onWholeBold: () =>
                    patchMarkdownWholeRichHtml((h) => applyWholeRichHtmlBold(h)),
                  onWholeItalic: () =>
                    patchMarkdownWholeRichHtml((h) =>
                      applyWholeRichHtmlItalic(h),
                    ),
                  onWholeColor: (hex: string) =>
                    patchMarkdownWholeRichHtml((h) =>
                      applyWholeRichHtmlForeColor(h, hex),
                    ),
                  onFitHeightToContent: fitMarkdownHeightToContent,
                }
              : undefined,
      }
    : undefined;

  const canvaChromeEl = showCanvaChromeFrame ? (
    <SlideCanvasCanvaChrome
      showResize={!isLocked}
      isTransformLocked={isLocked}
      layoutDigest={`${rect.x},${rect.y},${rect.w},${rect.h}`}
      chromePortalContainerRef={slideCanvasChromePortalRef}
      chromeAnchorRect={rect}
      chromeAnchorElementId={id}
      slideShellRef={slideContainerRef}
      onResizeCorner={(corner, e) => startResizeCorner(id, corner, e, rect)}
      onResizeEdge={(edge, e) => startResizeEdge(id, edge, e, rect)}
      onRotatePointerDown={(e) => startRotate(id, e, rect, rotation)}
      toolbar={canvaChromeToolbarProps}
    />
  ) : null;

  const shellOverflowVisible =
    showCanvaChromeFrame ||
    (isHovered && !isSelected) ||
    dataMotionRingOnCanvas;
  const outerShellClass = cn(
    "absolute min-h-0 min-w-0 touch-manipulation",
    shellOverflowVisible ? "overflow-visible" : "overflow-hidden",
  );

  const rotatedInner = (
    className: string,
    children: ReactNode,
    opts?: { preserve3d?: boolean },
  ) => {
    const style: React.CSSProperties | undefined = (() => {
      if (!rotation && !opts?.preserve3d) return undefined;
      const s: React.CSSProperties = {};
      if (rotation) {
        s.transform = `rotate(${rotation}deg)`;
        s.transformOrigin = "center center";
      }
      if (opts?.preserve3d) {
        s.transformStyle = "preserve-3d";
      }
      return s;
    })();
    return (
      <div className={cn("relative z-0 min-h-0 min-w-0", className)} style={style}>
        {children}
      </div>
    );
  };

  switch (kind) {
    case "sectionLabel":
      return null;
    case "title":
    case "chapterTitle": {
      const chapter = kind === "chapterTitle";
      return (
        <div
          style={box}
          data-slide-canvas-el
          data-canvas-element-id={id}
          className={outerShellClass}
          onPointerDown={onShellPointerDown}
          {...shellSurfaceProps}
        >
          {rotatedInner(
            "flex w-full min-w-0 flex-col overflow-visible",
            <div
              ref={titleAutoMeasureRef}
              className="box-border w-full min-w-0 px-2 py-1"
            >
              {!isEditing || !showTitleEdit ? (
                <div
                  className={cn(
                    "flex w-full min-w-0 shrink-0 select-none flex-col overflow-visible rounded-md",
                    chapter ? "items-center text-center" : "",
                  )}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                    setCanvasTextEditTarget("title", id);
                    setEditTitle(readTextMarkdownFromElement(slide, element));
                    setIsEditing(true);
                    setActiveField("title");
                  }}
                  role="button"
                  tabIndex={0}
                  title="Doble clic para editar"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSelect();
                      setCanvasTextEditTarget("title", id);
                      setEditTitle(readTextMarkdownFromElement(slide, element));
                      setIsEditing(true);
                      setActiveField("title");
                    }
                  }}
                >
                  {chapter ? (
                    <SlideChapterTitleReadOnly tone={tone}>
                      {(
                        showTitleEdit
                          ? editTitle
                          : readTextMarkdownFromElement(slide, element)
                      ).trim() || "Sin título"}
                    </SlideChapterTitleReadOnly>
                  ) : (
                    <SlideContentTitleReadOnly tone={tone}>
                      {(
                        showTitleEdit
                          ? editTitle
                          : readTextMarkdownFromElement(slide, element)
                      ).trim() || "Sin título"}
                    </SlideContentTitleReadOnly>
                  )}
                </div>
              ) : (
                <textarea
                  {...{ [EDIT_FIELD_ATTR]: "true" }}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() =>
                    window.setTimeout(
                      () => commitSlideEdits({ keepEditing: true }),
                      120,
                    )
                  }
                  rows={1}
                  className={deckTitleTextareaClass(tone, {
                    center: chapter,
                  })}
                  style={
                    chapter
                      ? { fontSize: "var(--slide-title-chapter)" }
                      : { fontSize: "var(--slide-title)" }
                  }
                />
              )}
            </div>,
          )}
          {canvaChromeEl}
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    }
    case "subtitle":
    case "chapterSubtitle": {
      const chapter = kind === "chapterSubtitle";
      return (
        <div
          style={box}
          data-slide-canvas-el
          data-canvas-element-id={id}
          className={outerShellClass}
          onPointerDown={onShellPointerDown}
          {...shellSurfaceProps}
        >
          {rotatedInner(
            "flex w-full min-w-0 flex-col overflow-visible",
            <div
              ref={subtitleAutoMeasureRef}
              className="box-border w-full min-w-0 px-2 py-0.5"
            >
              {!isEditing || !showSubtitleEdit ? (
                <div
                  className={cn(
                    "flex w-full min-w-0 shrink-0 select-none flex-col overflow-visible rounded-md",
                    chapter && "items-center text-center",
                  )}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                    setCanvasTextEditTarget("subtitle", id);
                    setEditSubtitle(readTextMarkdownFromElement(slide, element));
                    setIsEditing(true);
                    setActiveField("subtitle");
                  }}
                  role="button"
                  tabIndex={0}
                  title="Doble clic para editar"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onSelect();
                      setCanvasTextEditTarget("subtitle", id);
                      setEditSubtitle(readTextMarkdownFromElement(slide, element));
                      setIsEditing(true);
                      setActiveField("subtitle");
                    }
                  }}
                >
                  {(
                    isEditing && showSubtitleEdit
                      ? editSubtitle
                      : readTextMarkdownFromElement(slide, element)
                  ).trim() ? (
                    <SlideSubtitleMarkdownBody
                      tone={tone}
                      variant={chapter ? "chapter" : "default"}
                    >
                      {isEditing && showSubtitleEdit
                        ? editSubtitle
                        : readTextMarkdownFromElement(slide, element)}
                    </SlideSubtitleMarkdownBody>
                  ) : (
                    <span
                      className={cn("italic", deckMutedTextClass(tone))}
                      style={{ fontSize: "var(--slide-subtitle)" }}
                    >
                      Subtítulo (opcional)
                    </span>
                  )}
                </div>
              ) : (
                <textarea
                  {...{ [EDIT_FIELD_ATTR]: "true" }}
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  onBlur={() =>
                    window.setTimeout(
                      () => commitSlideEdits({ keepEditing: true }),
                      120,
                    )
                  }
                  rows={3}
                  className={deckSubtitleTextareaClass(tone, {
                    center: chapter,
                  })}
                  style={{ fontSize: "var(--slide-subtitle)" }}
                />
              )}
            </div>,
          )}
          {canvaChromeEl}
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    }
    case "markdown": {
      const bodyDisplay = getCanvasMarkdownBodyDisplay(slide, element);
      const viewEmpty =
        bodyDisplay.kind === "html"
          ? !plainTextFromRichHtml(bodyDisplay.html).trim()
          : !bodyDisplay.source.trim();

      const viewFontScale =
        bodyDisplay.kind === "html"
          ? bodyDisplay.scale
          : Math.min(
              2.5,
              Math.max(
                0.5,
                isSlideCanvasTextPayload(element.payload)
                  ? (element.payload.bodyFontScale ?? 1)
                  : 1,
              ),
            );

      return (
        <div
          style={box}
          data-slide-canvas-el
          data-canvas-element-id={id}
          className={outerShellClass}
          onPointerDown={onShellPointerDown}
          {...shellSurfaceProps}
        >
          {rotatedInner(
            "relative flex h-full min-h-0 w-full flex-col overflow-hidden",
            <div
              ref={markdownMeasureRootRef}
              className="flex min-h-0 flex-1 flex-col px-2 py-1"
            >
              {!isEditing || !isSelected || activeField !== "content" ? (
                <div
                  data-slide-markdown-scroll-measure=""
                  className="relative z-0 min-h-0 flex-1 select-none overflow-y-auto touch-manipulation"
                  tabIndex={0}
                  title="Doble clic para editar"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    openMarkdownContentEdit();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      openMarkdownContentEdit();
                    }
                  }}
                >
                  {!viewEmpty ? (
                    <SlideCanvasRichDescription
                      ref={markdownRichRef}
                      elementId={id}
                      tone={tone}
                      display={bodyDisplay}
                      isEditing={false}
                      plainBuffer={editContent}
                      richHtmlBuffer={editContentRichHtml}
                      fontScale={viewFontScale}
                      onPlainAndRichChange={() => {}}
                      onBlurCommit={() => {}}
                    />
                  ) : (
                    <p className={cn("italic", deckMutedTextClass(tone))}>
                      Doble clic para editar…
                    </p>
                  )}
                </div>
              ) : (
                <div className="relative flex min-h-0 flex-1 flex-col bg-transparent">
                  <SlideCanvasRichDescription
                    ref={markdownRichRef}
                    elementId={id}
                    tone={tone}
                    display={bodyDisplay}
                    isEditing
                    plainBuffer={editContent}
                    richHtmlBuffer={editContentRichHtml}
                    fontScale={editContentBodyFontScale}
                    onPlainAndRichChange={(plain, rich) => {
                      applyEditContentRichDraft(plain, rich);
                    }}
                    onBlurCommit={() =>
                      commitSlideEdits({ keepEditing: true })
                    }
                  />
                  <button
                    type="button"
                    className={cn(deckRewriteActionBtnClass(tone), "z-20")}
                    title="Replantear con IA"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowRewriteModal(true)}
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              )}
            </div>,
          )}
          {canvaChromeEl}
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    }
    case "mediaPanel": {
      const mediaPanelDesc = resolveMediaPanelDescriptor(panelSlide);
      /**
       * En el lienzo: 3D en vivo solo con el bloque seleccionado y sin vista previa abierta;
       * si no, imagen congelada. Con `isPreviewMode`, el overlay ya pinta el 3D: aquí no montar WebGL.
       */
      const r3fUseLiveWebgl =
        mediaPanelDesc.kind === PANEL_CONTENT_KIND.CANVAS_3D ||
        mediaPanelDesc.kind === PANEL_CONTENT_KIND.PRESENTER_3D
          ? isSelected && !deckIsPreviewMode
          : true;
      /**
       * Clave de medición estable por `mediaPanel` (sin `z`); el remount de WebGL 3D va por
       * `r3fStackRevision` (`zRank`), no por esta clave, para no disparar ola de setSize en
       * todos los visores al reordenar.
       */
      const canvasR3fHostMeasureKey = `canvas-r3f:${id}`;
      const dataRingPanel = mediaPanelDesc.kind === PANEL_CONTENT_KIND.DATA_MOTION_RING;
      const codePanelOnCanvas = mediaPanelDesc.kind === PANEL_CONTENT_KIND.CODE;
      const uses3dOrbitChrome = mediaPanelDesc.usesOrbitInteractionChrome();
      const rivePanelOnCanvas = mediaPanelDesc.kind === PANEL_CONTENT_KIND.RIVE;
      const iframePanelOnCanvas =
        mediaPanelDesc.kind === PANEL_CONTENT_KIND.IFRAME_EMBED;
      /**
       * Franja superior para mover el bloque: Rive/WebGL/orbit capturan puntero;
       * un iframe genérico también, así que misma UX.
       */
      const usesInteractionDragStrip =
        uses3dOrbitChrome || rivePanelOnCanvas || iframePanelOnCanvas;
      const onMediaPanelDragPointerDown = (
        e: React.PointerEvent<HTMLElement>,
        captureEl: HTMLElement | null,
      ) => {
        if (e.button !== 0) return;
        const t = eventTargetElement(e);
        if (!t) return;
        if (t.closest("[data-slide-canvas-chrome]")) return;
        onSelect();
        if (
          t.closest(
            "input, textarea, select, button, [contenteditable='true']",
          )
        ) {
          return;
        }
        e.stopPropagation();
        if (isLocked) return;
        attachDragThreshold(
          id,
          rect,
          e.clientX,
          e.clientY,
          e.pointerId,
          captureEl,
          dragThresholdPx,
        );
      };
      return (
        <div
          style={box}
          data-slide-canvas-el
          data-canvas-element-id={id}
          data-slide-canvas-kind="mediaPanel"
          data-slide-element-id={id}
          className={cn(
            outerShellClass,
            codePanelOnCanvas || rivePanelOnCanvas || iframePanelOnCanvas
              ? "bg-transparent"
              : deckMediaPanelShellClass(tone),
          )}
          {...shellSurfaceProps}
          onPointerDown={
            usesInteractionDragStrip
              ? undefined
              : (e) => {
                  const cap =
                    e.currentTarget instanceof HTMLElement
                      ? e.currentTarget
                      : null;
                  onMediaPanelDragPointerDown(e, cap);
                }
          }
        >
          {rotatedInner(
            cn(
              "flex h-full min-h-0 w-full min-w-0 flex-col",
              dataRingPanel ? "overflow-visible" : "overflow-hidden",
            ),
            usesInteractionDragStrip ? (
              <>
                <div
                  {...{ [CANVAS_DRAG_STRIP_ATTR]: "true" }}
                  role="group"
                  aria-label="Arrastrar para mover el panel en el lienzo"
                  title={
                    rivePanelOnCanvas
                      ? "Arrastra esta franja para mover el bloque; en el área inferior interactúa con la animación Rive"
                      : iframePanelOnCanvas
                        ? "Arrastra esta franja para mover el bloque; debajo está el iframe (scroll y clics van al sitio incrustado)"
                        : "Arrastra esta franja para mover el bloque; en el área inferior controlas el modelo 3D"
                  }
                  className={deckMediaPanelDragStripClass(tone)}
                  onPointerDown={(e) => {
                    const cap =
                      e.currentTarget instanceof HTMLElement
                        ? e.currentTarget
                        : null;
                    onMediaPanelDragPointerDown(e, cap);
                  }}
                >
                  <GripVertical
                    size={14}
                    className={cn("shrink-0", deckMutedTextClass(tone))}
                    aria-hidden
                  />
                  <span className="truncate">
                    {rivePanelOnCanvas
                      ? "Arrastra aquí para mover · abajo, animación Rive"
                      : iframePanelOnCanvas
                        ? "Arrastra aquí para mover · abajo, página incrustada"
                        : "Arrastra aquí para mover · abajo, orbitar el modelo 3D"}
                  </span>
                </div>
                <div
                  className="flex min-h-0 flex-1 flex-col"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    const hit = eventTargetElement(e);
                    if (hit?.closest("[data-slide-canvas-chrome]")) {
                      return;
                    }
                    onSelect();
                  }}
                >
                  <SlideRightPanel
                    fullWidth
                    embeddedInCanvas
                    canvasPanelSlide={panelSlide}
                    canvasMediaElementId={id}
                    canvasR3fHostMeasureKey={canvasR3fHostMeasureKey}
                    r3fStackRevision={zRank}
                    r3fUseLiveWebgl={r3fUseLiveWebgl}
                    onCanvas3dAnimationClipNames={
                      mediaPanelDesc.kind === PANEL_CONTENT_KIND.CANVAS_3D
                        ? onCanvas3dAnimationClipNames
                        : undefined
                    }
                  />
                </div>
              </>
            ) : (
              <SlideRightPanel
                fullWidth
                embeddedInCanvas
                canvasPanelSlide={panelSlide}
                canvasMediaElementId={id}
                canvasR3fHostMeasureKey={canvasR3fHostMeasureKey}
                r3fStackRevision={zRank}
                r3fUseLiveWebgl={r3fUseLiveWebgl}
                onCanvas3dAnimationClipNames={
                  mediaPanelDesc.kind === PANEL_CONTENT_KIND.CANVAS_3D
                    ? onCanvas3dAnimationClipNames
                    : undefined
                }
              />
            ),
            dataRingPanel ? { preserve3d: true } : undefined,
          )}
          {canvaChromeEl}
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    }
    case "matrix": {
      const data = normalizeSlideMatrixData(
        slide.matrixData ?? createEmptySlideMatrixData(),
      );
      return (
        <div
          style={box}
          data-slide-canvas-el
          data-canvas-element-id={id}
          className={outerShellClass}
          onPointerDown={onShellPointerDown}
          {...shellSurfaceProps}
        >
          {rotatedInner(
            "h-full min-h-0 overflow-y-auto px-1 py-1",
            <SlideMatrixTable
              deckContentTone={tone}
              data={data}
              editable
              onHeaderChange={(col, value) => {
                patchCurrentSlideMatrix((prev) => {
                  const headers = [...prev.columnHeaders];
                  headers[col] = value;
                  return { ...prev, columnHeaders: headers };
                });
              }}
              onCellChange={(row, col, value) => {
                patchCurrentSlideMatrix((prev) => {
                  const rows = prev.rows.map((r) => [...r]);
                  if (!rows[row]) return prev;
                  rows[row] = [...rows[row]];
                  rows[row][col] = value;
                  return { ...prev, rows };
                });
              }}
              className="max-h-full shadow-inner"
            />,
          )}
          {canvaChromeEl}
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    }
    case "matrixNotes": {
      const matrixNotesPreview =
        isEditing && isSelected && activeField === "content"
          ? editContent
          : readTextMarkdownFromElement(slide, element);
      return (
        <div
          style={box}
          data-slide-canvas-el
          data-canvas-element-id={id}
          className={outerShellClass}
          onPointerDown={onShellPointerDown}
          {...shellSurfaceProps}
        >
          {rotatedInner(
            cn(
              "h-full overflow-y-auto px-2 py-1",
              tone === "light"
                ? "border-t border-slate-600/60"
                : "border-t border-stone-100 dark:border-border",
            ),
            !isEditing || !isSelected || activeField !== "content" ? (
              <div
                className="select-none rounded-md"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                  setCanvasTextEditTarget("content", id);
                  setEditContent(
                    readTextMarkdownFromElement(slide, element),
                  );
                  setIsEditing(true);
                  setActiveField("content");
                }}
                role="button"
                tabIndex={0}
                title="Doble clic para editar"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onSelect();
                    setCanvasTextEditTarget("content", id);
                    setEditContent(
                      readTextMarkdownFromElement(slide, element),
                    );
                    setIsEditing(true);
                    setActiveField("content");
                  }
                }}
              >
                {matrixNotesPreview.trim() ? (
                  <SlideMarkdown contentTone={tone}>
                    {matrixNotesPreview}
                  </SlideMarkdown>
                ) : (
                  <p className={cn("text-xs", deckMutedTextClass(tone))}>
                    Notas bajo la tabla…
                  </p>
                )}
              </div>
            ) : (
              <textarea
                {...{ [EDIT_FIELD_ATTR]: "true" }}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onBlur={() =>
                  window.setTimeout(
                    () => commitSlideEdits({ keepEditing: true }),
                    120,
                  )
                }
                className={deckMatrixNotesTextareaClass(tone)}
                placeholder="Notas (opcional)"
              />
            ),
          )}
          {canvaChromeEl}
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    }
    case "excalidraw":
      return (
        <div
          style={box}
          data-slide-canvas-el
          data-canvas-element-id={id}
          data-slide-canvas-kind="excalidraw"
          className={cn(outerShellClass, "bg-white dark:bg-surface-elevated")}
          {...shellSurfaceProps}
        >
          <div
            key={`${slide.id}-${diagramRemountToken}`}
            className="absolute inset-0 min-h-0"
          >
            <SlideContentDiagram />
          </div>
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    case "isometricFlow":
      return (
        <div
          style={box}
          data-slide-canvas-el
          data-canvas-element-id={id}
          data-slide-canvas-kind="isometricFlow"
          className={cn(
            outerShellClass,
            "bg-transparent",
          )}
          {...shellSurfaceProps}
        >
          <div className="absolute inset-0 min-h-0">
            <SlideContentIsometricFlow
              onEditorSurfacePointerDown={onDismissSlideCanvasSelection}
            />
          </div>
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    default:
      return null;
  }
}
