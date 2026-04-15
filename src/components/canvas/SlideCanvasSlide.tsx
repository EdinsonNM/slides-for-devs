import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import {
  GripVertical,
  RefreshCw,
  Sparkles,
  Split,
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
} from "../../domain/entities";
import {
  PANEL_CONTENT_KIND,
  resolveMediaPanelDescriptor,
} from "../../domain/panelContent";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import { migrateLegacySlideToCanvas } from "../../domain/slideCanvas/migrateLegacySlideToCanvas";
import { normalizeCanvasElementsZOrder } from "../../domain/slideCanvas/normalizeCanvasElementsZOrder";
import {
  readTextMarkdownFromElement,
  slideAppearanceForMediaElement,
} from "../../domain/slideCanvas/slideCanvasPayload";
import { SlideMarkdown } from "../shared/SlideMarkdown";
import { SlideRightPanel } from "../editor/SlideRightPanel";
import { SlideContentDiagram } from "../editor/SlideContentDiagram";
import { SlideContentIsometricFlow } from "../editor/SlideContentIsometricFlow";
import type { SlideMatrixData } from "../../domain/entities";
import { SlideMatrixTable } from "../shared/SlideMatrixTable";
import { SlideCanvasAlignmentGuides } from "./SlideCanvasAlignmentGuides";
import { SlideCanvasCanvaChrome } from "./SlideCanvasCanvaChrome";
import { SlideCanvasHoverOutline } from "./SlideCanvasHoverOutline";
import { DeckBackdrop } from "../shared/DeckBackdrop";
import {
  deckChapterSubtitleHintClass,
  deckIaToolbarBtnClass,
  deckIaToolbarHoverClass,
  deckMarkdownBodyTextareaClass,
  deckMatrixNotesTextareaClass,
  deckMediaPanelDragStripClass,
  deckMediaPanelShellClass,
  deckMutedTextClass,
  deckPrimaryTextClass,
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

/**
 * Orden de apilamiento en el lienzo: solo debe depender de `element.z` (adelante/atrás).
 * Antes `10_000 + z` al seleccionar rompía “enviar atrás” (el seleccionado siempre encima).
 * `stride` + subcapa (hover/selección) mantiene el orden de datos y un pequeño desempate visual.
 */
const CANVAS_Z_STRIDE = 10;
const CANVAS_Z_SUB_SELECTED = 2;
const CANVAS_Z_SUB_HOVER = 1;

/** UI flotante del lienzo por encima de los bloques (máx. z de bloque ≈ (n-1)*stride+2; p. ej. ~9992 con n≈1000). */
const SLIDE_CANVAS_UI_Z = 10_000;

/**
 * Píxeles mínimos de movimiento antes de iniciar arrastre.
 * Un umbral > 0 evita que micro-movimientos al hacer clic activen el drag
 * y compitan con la selección de texto en el editor.
 * Mismo valor con bloque ya seleccionado: si fuera 0, casi cualquier gesto de
 * selección en la vista previa disparaba el arrastre.
 */
const DRAG_THRESHOLD_PX = 6;

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
    deckVisualTheme,
    setCanvasTextEditTarget,
    setCanvasMediaPanelEditTarget,
    canvasMediaPanelElementId,
  } = usePresentation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<TextField | null>(null);
  const slideContainerRef = useRef<HTMLDivElement | null>(null);
  /** Elementos de la escena (orden z) para snap y guías durante el arrastre. */
  const sceneElementsRef = useRef<SlideCanvasElement[]>([]);
  const [alignmentGuides, setAlignmentGuides] = useState<{
    vertical: { posPct: number; stroke: "solid" | "dashed" }[];
    horizontal: { posPct: number; stroke: "solid" | "dashed" }[];
  } | null>(null);
  /** Tras arrastrar un bloque, evita que el `click` posterior abra edición por error. */
  const dragConsumedClickRef = useRef(false);

  useEffect(() => {
    setSelectedId(null);
    setHoveredId(null);
    setActiveField(null);
    setAlignmentGuides(null);
  }, [currentSlide?.id]);

  useEffect(() => {
    if (!isEditing) {
      setActiveField(null);
    }
  }, [isEditing]);

  /** Un solo clic solo selecciona; al cambiar de bloque se sale del campo de texto (doble clic = editar). */
  useEffect(() => {
    setActiveField(null);
  }, [selectedId]);

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
      setSelectedId((sid) => (sid === elementId ? null : sid));
      setHoveredId((hid) => (hid === elementId ? null : hid));
      patchCurrentSlideCanvasScene((scene) => ({
        ...scene,
        elements: scene.elements.filter((e) => e.id !== elementId),
      }));
    },
    [patchCurrentSlideCanvasScene, isEditing, commitSlideEdits],
  );

  const bringCanvasElementForward = useCallback(
    (elementId: string) => {
      patchCurrentSlideCanvasScene((scene) => {
        const maxZ = scene.elements.reduce((m, e) => Math.max(m, e.z), 0);
        const elements = normalizeCanvasElementsZOrder(
          scene.elements.map((e) =>
            e.id === elementId ? { ...e, z: maxZ + 1 } : e,
          ),
        );
        return { ...scene, elements };
      });
    },
    [patchCurrentSlideCanvasScene],
  );

  const sendCanvasElementBackward = useCallback(
    (elementId: string) => {
      patchCurrentSlideCanvasScene((scene) => {
        const minZ = scene.elements.reduce((m, e) => Math.min(m, e.z), 0);
        const elements = normalizeCanvasElementsZOrder(
          scene.elements.map((e) =>
            e.id === elementId ? { ...e, z: minZ - 1 } : e,
          ),
        );
        return { ...scene, elements };
      });
    },
    [patchCurrentSlideCanvasScene],
  );

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
        setAlignmentGuides(hasGuides ? guides : null);
        onPatchRect(elementId, rect);
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
        dragConsumedClickRef.current = true;
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
    [onPatchRect, setAlignmentGuides],
  );

  const consumeClickIfDrag = useCallback(() => {
    if (!dragConsumedClickRef.current) return false;
    dragConsumedClickRef.current = false;
    return true;
  }, []);

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
        setAlignmentGuides(hasGuides ? guides : null);
        onPatchRect(elementId, next);
      };
      const onUp = () => {
        setAlignmentGuides(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [onPatchRect, setAlignmentGuides],
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
        setAlignmentGuides(hasGuides ? guides : null);
        onPatchRect(elementId, next);
      };
      const onUp = () => {
        setAlignmentGuides(null);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [onPatchRect, setAlignmentGuides],
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
  }, [flushCanvasTextCommitIfEditing]);

  if (!currentSlide) {
    sceneElementsRef.current = [];
    return null;
  }

  const slide = ensureSlideCanvasScene(currentSlide);
  const scene = slide.canvasScene!;
  const sorted = [...scene.elements].sort((a, b) => a.z - b.z);
  sceneElementsRef.current = sorted;
  const canvasStackMaxZRank = sorted.reduce(
    (m, e) => Math.max(m, Math.round(Number.isFinite(e.z) ? e.z : 0)),
    0,
  );

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    const canvasHit = t.closest("[data-slide-canvas-el]");
    if (canvasHit) {
      const k = canvasHit.getAttribute("data-slide-canvas-kind");
      if (!k || !CANVAS_KIND_CLICK_PASSTHROUGH.has(k)) return;
    }
    dismissSlideCanvasSelection();
  };

  const showIaToolbar = slide.type === SLIDE_TYPE.CONTENT;
  const showPanelVideoToolbarBtn =
    showIaToolbar &&
    resolveMediaPanelDescriptor(slide).showSlideContentVideoToolbar();
  const isIsometricSlide = slide.type === SLIDE_TYPE.ISOMETRIC;

  return (
    <div
      ref={slideContainerRef}
      className={cn(
        "relative isolate flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent",
        deckSlideContentWrapperClass(deckVisualTheme.contentTone),
        isIsometricSlide && "bg-slate-50 dark:bg-slate-950",
      )}
      onPointerDown={onBackgroundPointerDown}
    >
      {!isIsometricSlide && <DeckBackdrop theme={deckVisualTheme} />}
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
                  setVideoUrlInput(slide.videoUrl || "");
                  setShowVideoModal(true);
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
        </div>
      )}

      {sorted
        .filter((el) => el.kind !== "sectionLabel")
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
            setSelectedId(el.id);
            setHoveredId(null);
            if (el.kind === "mediaPanel") {
              /* Siempre rehidratar buffers al cambiar de panel (tamaño/idioma/código del payload correcto). */
              setCanvasMediaPanelEditTarget(el.id, {
                rehydrateCodeBuffers: true,
              });
            }
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
          commitSlideEdits={commitSlideEdits}
          patchCurrentSlideMatrix={patchCurrentSlideMatrix}
          setShowRewriteModal={setShowRewriteModal}
          setGenerateSlideContentPrompt={setGenerateSlideContentPrompt}
          setShowGenerateSlideContentModal={setShowGenerateSlideContentModal}
          attachDragThreshold={attachDragThreshold}
          dragThresholdPx={DRAG_THRESHOLD_PX}
          consumeClickIfDrag={consumeClickIfDrag}
          startResizeCorner={startResizeCorner}
          startResizeEdge={startResizeEdge}
          startRotate={startRotate}
          duplicateCanvasElement={duplicateCanvasElement}
          deleteCanvasElement={deleteCanvasElement}
          bringCanvasElementForward={bringCanvasElementForward}
          sendCanvasElementBackward={sendCanvasElementBackward}
          diagramRemountToken={diagramRemountToken}
          onPatchRect={onPatchRect}
          slideContainerRef={slideContainerRef}
          openImageModal={openImageModal}
          openImageUploadModal={openImageUploadModal}
          openVideoModal={() => {
            const panelSlide = slideAppearanceForMediaElement(slide, el);
            setVideoUrlInput(panelSlide.videoUrl || "");
            setShowVideoModal(true);
          }}
          setCanvasTextEditTarget={setCanvasTextEditTarget}
          editLanguage={editLanguage}
          setEditLanguage={setEditLanguage}
          editFontSize={editFontSize}
          setEditFontSize={setEditFontSize}
          openCodeGenModal={openCodeGenModal}
          deckContentTone={deckVisualTheme.contentTone}
          onDismissSlideCanvasSelection={dismissSlideCanvasSelection}
          canvasStackMaxZRank={canvasStackMaxZRank}
          canvasMediaPanelElementId={canvasMediaPanelElementId}
          cycleCodeEditorThemeForMediaPanel={cycleCodeEditorThemeForMediaPanel}
        />
      ))}
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
  commitSlideEdits,
  patchCurrentSlideMatrix,
  setShowRewriteModal,
  setGenerateSlideContentPrompt,
  setShowGenerateSlideContentModal,
  attachDragThreshold,
  dragThresholdPx,
  consumeClickIfDrag,
  startResizeCorner,
  startResizeEdge,
  startRotate,
  duplicateCanvasElement,
  deleteCanvasElement,
  bringCanvasElementForward,
  sendCanvasElementBackward,
  diagramRemountToken,
  onPatchRect,
  slideContainerRef,
  openImageModal,
  openImageUploadModal,
  openVideoModal,
  editLanguage,
  setEditLanguage,
  editFontSize,
  setEditFontSize,
  openCodeGenModal,
  deckContentTone,
  setCanvasTextEditTarget,
  onDismissSlideCanvasSelection,
  canvasStackMaxZRank,
  canvasMediaPanelElementId,
  cycleCodeEditorThemeForMediaPanel,
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
  commitSlideEdits: (o?: { keepEditing?: boolean }) => void;
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
  consumeClickIfDrag: () => boolean;
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
  diagramRemountToken: number;
  onPatchRect: (id: string, r: SlideCanvasRect) => void;
  slideContainerRef: RefObject<HTMLDivElement | null>;
  openImageModal: () => void;
  openImageUploadModal: () => void;
  openVideoModal: () => void;
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
  /** Máximo `element.z` del lienzo: el seleccionado se apila por encima de todos (toolbar/cromo). */
  canvasStackMaxZRank: number;
  canvasMediaPanelElementId: string | null;
  cycleCodeEditorThemeForMediaPanel: (elementId: string) => void;
}) {
  const tone = deckContentTone;
  const { theme: globalCodeEditorTheme } = useCodeEditorTheme();
  const { rect, kind, id, z } = element;
  const panelSlide =
    kind === "mediaPanel"
      ? slideAppearanceForMediaElement(slide, element)
      : slide;
  const rotation = element.rotation ?? 0;

  const titleAutoMeasureRef = useRef<HTMLDivElement>(null);
  const subtitleAutoMeasureRef = useRef<HTMLDivElement>(null);
  const isTitleKind = kind === "title" || kind === "chapterTitle";
  const isSubtitleKind = kind === "subtitle" || kind === "chapterSubtitle";
  const showTitleEdit = isEditing && isSelected && activeField === "title";
  const showSubtitleEdit = isEditing && isSelected && activeField === "subtitle";
  /** Con rotación, el AABB infla el alto; no auto-ajustamos para no pisar el tamaño manual. */
  const autoHeightByContent = Math.abs(rotation) < 0.01;

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

  const zRank = Math.round(Number.isFinite(z) ? z : 0);
  const sub =
    (isSelected ? CANVAS_Z_SUB_SELECTED : 0) +
    (!isSelected && isHovered ? CANVAS_Z_SUB_HOVER : 0);
  const stackInLayer = zRank * CANVAS_Z_STRIDE + sub;
  /** El seleccionado sube a un plano por encima del mayor `z` del resto para que cromo/toolbar no queden tapados. */
  const zIndex = isSelected
    ? (canvasStackMaxZRank + 1) * CANVAS_Z_STRIDE + zRank
    : stackInLayer;
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

  const showHoverOutline = isHovered && !isSelected;

  const textField = fieldForKind(kind);

  const showCanvaChrome =
    isSelected &&
    kind !== "excalidraw" &&
    kind !== "isometricFlow" &&
    kind !== "sectionLabel";

  const onShellPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest(`[${EDIT_FIELD_ATTR}="true"]`)) return;
    if (t.closest("[data-slide-canvas-chrome]")) return;
    if (t.closest("[data-canvas-resize]")) return;
    onSelect();
    const editingThisBlock =
      Boolean(isEditing && textField && activeField === textField);
    if (editingThisBlock) return;
    if (
      t.closest(
        "input, textarea, select, button, [contenteditable='true']",
      )
    ) {
      return;
    }
    const captureEl =
      e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
    if (kind !== "isometricFlow") {
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
  const showMediaPanelCanvas3dActions =
    kind === "mediaPanel" && mediaPanelDesc.showCanvasToolbarCanvas3dActions();

  const effectiveCanvasCodeTheme =
    kind === "mediaPanel" && mediaPanelDesc.kind === PANEL_CONTENT_KIND.CODE
      ? panelSlide.codeEditorTheme ?? globalCodeEditorTheme
      : globalCodeEditorTheme;

  const canvaChromeEl =
    showCanvaChrome ? (
      <SlideCanvasCanvaChrome
        showResize
        layoutDigest={`${rect.x},${rect.y},${rect.w},${rect.h}`}
        onResizeCorner={(corner, e) => startResizeCorner(id, corner, e, rect)}
        onResizeEdge={(edge, e) => startResizeEdge(id, edge, e, rect)}
        onRotatePointerDown={(e) => startRotate(id, e, rect, rotation)}
        toolbar={{
          onGenerateImage: showMediaPanelImageActions
            ? () => openImageModal()
            : undefined,
          onUseImage: showMediaPanelImageActions
            ? () => openImageUploadModal()
            : undefined,
          onOpenVideoModal: showMediaPanelVideoActions
            ? () => openVideoModal()
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
            showMediaPanelCanvas3dActions
            ? undefined
            : () => {
                setIsEditing(true);
                if (kind === "markdown" || kind === "matrixNotes") {
                  setCanvasTextEditTarget("content", id);
                  setEditContent(readTextMarkdownFromElement(slide, element));
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
          onBringForward: () => bringCanvasElementForward(id),
          onSendBackward: () => sendCanvasElementBackward(id),
          canvas3dSource: showMediaPanelCanvas3dActions
            ? {
                httpGlbUrl: panelSlide.canvas3dGlbUrl?.startsWith("http")
                  ? panelSlide.canvas3dGlbUrl
                  : "",
              }
            : undefined,
        }}
      />
    ) : null;

  const shellOverflowVisible =
    showCanvaChrome || (isHovered && !isSelected);
  const outerShellClass = cn(
    "absolute min-h-0 min-w-0 touch-manipulation",
    shellOverflowVisible ? "overflow-visible" : "overflow-hidden",
  );

  const rotatedInner = (className: string, children: ReactNode) => (
    <div
      className={cn("relative z-0 min-h-0 min-w-0", className)}
      style={
        rotation
          ? {
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center center",
            }
          : undefined
      }
    >
      {children}
    </div>
  );

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
          className={outerShellClass}
          onPointerDown={onShellPointerDown}
          {...shellHoverProps}
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
                    if (consumeClickIfDrag()) return;
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
                  <span
                    className={cn(
                      "block max-w-full min-w-0 font-serif italic leading-tight whitespace-pre-wrap wrap-break-word",
                      deckPrimaryTextClass(tone),
                    )}
                    style={
                      chapter
                        ? { fontSize: "var(--slide-title-chapter)" }
                        : { fontSize: "var(--slide-title)" }
                    }
                  >
                    {(
                      isEditing
                        ? editTitle
                        : readTextMarkdownFromElement(slide, element)
                    ).trim() || "Sin título"}
                  </span>
                  {!chapter && (
                    <div className="mt-2 h-1.5 w-20 shrink-0 rounded-full bg-emerald-600" />
                  )}
                  {chapter && (
                    <div className="mx-auto mt-3 h-1 w-14 shrink-0 rounded-full bg-emerald-600 md:mt-4" />
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
          className={outerShellClass}
          onPointerDown={onShellPointerDown}
          {...shellHoverProps}
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
                    "flex w-full min-w-0 shrink-0 select-none flex-col overflow-visible rounded-md text-sm",
                    chapter &&
                      cn(
                        "items-center text-center font-light uppercase tracking-wide",
                        deckChapterSubtitleHintClass(tone),
                      ),
                  )}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (consumeClickIfDrag()) return;
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
                    <SlideMarkdown
                      contentTone={tone}
                      className={cn(
                        "prose-sm max-w-none min-w-0",
                        chapter && "text-center normal-case",
                      )}
                      style={{ fontSize: "var(--slide-subtitle)" }}
                    >
                      {isEditing && showSubtitleEdit
                        ? editSubtitle
                        : readTextMarkdownFromElement(slide, element)}
                    </SlideMarkdown>
                  ) : (
                    <span className={cn("italic", deckMutedTextClass(tone))}>
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
      const bodyPreview =
        isEditing && isSelected && activeField === "content"
          ? editContent
          : readTextMarkdownFromElement(slide, element);
      return (
        <div
          style={box}
          data-slide-canvas-el
          className={outerShellClass}
          onPointerDown={onShellPointerDown}
          {...shellHoverProps}
        >
          {rotatedInner(
            "relative flex h-full min-h-0 w-full flex-col overflow-hidden",
            !isEditing || !isSelected || activeField !== "content" ? (
              <div
                className="min-h-0 flex-1 select-none overflow-y-auto px-2 py-1"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (consumeClickIfDrag()) return;
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
                {bodyPreview.trim() ? (
                  <SlideMarkdown contentTone={tone}>{bodyPreview}</SlideMarkdown>
                ) : (
                  <p className={cn("italic", deckMutedTextClass(tone))}>
                    Doble clic para editar…
                  </p>
                )}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col px-2 py-1">
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
                  className={deckMarkdownBodyTextareaClass(tone)}
                  placeholder="Markdown…"
                />
                <button
                  type="button"
                  className={deckRewriteActionBtnClass(tone)}
                  title="Replantear con IA"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowRewriteModal(true)}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            ),
          )}
          {canvaChromeEl}
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    }
    case "mediaPanel": {
      const mediaPanelDesc = resolveMediaPanelDescriptor(panelSlide);
      const codePanelOnCanvas = mediaPanelDesc.kind === PANEL_CONTENT_KIND.CODE;
      const uses3dOrbitChrome = mediaPanelDesc.usesOrbitInteractionChrome();
      const onMediaPanelDragPointerDown = (
        e: React.PointerEvent<HTMLElement>,
        captureEl: HTMLElement | null,
      ) => {
        if (e.button !== 0) return;
        const t = e.target as HTMLElement;
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
          className={cn(
            outerShellClass,
            codePanelOnCanvas
              ? "bg-transparent"
              : deckMediaPanelShellClass(tone),
          )}
          {...shellHoverProps}
          onPointerDown={
            uses3dOrbitChrome
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
            "flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden",
            uses3dOrbitChrome ? (
              <>
                <div
                  {...{ [CANVAS_DRAG_STRIP_ATTR]: "true" }}
                  role="group"
                  aria-label="Arrastrar para mover el panel en el lienzo"
                  title="Arrastra esta franja para mover el bloque; en el área inferior controlas el modelo 3D"
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
                    Arrastra aquí para mover · abajo, orbitar el modelo 3D
                  </span>
                </div>
                <div
                  className="flex min-h-0 flex-1 flex-col"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    if (
                      (e.target as HTMLElement).closest(
                        "[data-slide-canvas-chrome]",
                      )
                    ) {
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
                  />
                </div>
              </>
            ) : (
              <SlideRightPanel
                fullWidth
                embeddedInCanvas
                canvasPanelSlide={panelSlide}
                canvasMediaElementId={id}
              />
            ),
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
          className={outerShellClass}
          onPointerDown={onShellPointerDown}
          {...shellHoverProps}
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
          className={outerShellClass}
          onPointerDown={onShellPointerDown}
          {...shellHoverProps}
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
                  if (consumeClickIfDrag()) return;
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
          data-slide-canvas-kind="excalidraw"
          className={cn(outerShellClass, "bg-white dark:bg-surface-elevated")}
          {...shellHoverProps}
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
          data-slide-canvas-kind="isometricFlow"
          className={cn(
            outerShellClass,
            "bg-transparent",
          )}
          {...shellHoverProps}
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
