import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Pencil, RefreshCw, Sparkles, Split } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import type { Slide } from "../../types";
import {
  SLIDE_TYPE,
  clampCanvasRect,
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
  type SlideCanvasElement,
  type SlideCanvasRect,
} from "../../domain/entities";
import { ensureSlideCanvasScene } from "../../domain/slideCanvas/ensureSlideCanvasScene";
import { migrateLegacySlideToCanvas } from "../../domain/slideCanvas/migrateLegacySlideToCanvas";
import { SlideMarkdown } from "../shared/SlideMarkdown";
import { SlideRightPanel } from "../editor/SlideRightPanel";
import { SlideContentDiagram } from "../editor/SlideContentDiagram";
import type { SlideMatrixData } from "../../domain/entities";
import { SlideMatrixTable } from "../shared/SlideMatrixTable";
import { SlideCanvasCanvaChrome } from "./SlideCanvasCanvaChrome";
import { SlideCanvasHoverOutline } from "./SlideCanvasHoverOutline";
import {
  oppositeCornerPercent,
  rectResizeFromCorner,
  type ResizeCorner,
} from "./slideCanvasResize";

const EDIT_FIELD_ATTR = "data-slide-edit-field";

/** Primer clic en un bloque: permite seleccionar sin mover. */
const DRAG_THRESHOLD_FIRST_PX = 5;
/** Bloque ya seleccionado: cualquier movimiento inicia arrastre (estilo Canva). */
const DRAG_THRESHOLD_SELECTED_PX = 0;

const IA_BTN =
  "p-1.5 rounded-md text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors";

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
    formatMarkdown,
    setSlides,
    setShowRewriteModal,
    setShowGenerateSlideContentModal,
    setGenerateSlideContentPrompt,
    setShowSplitModal,
    patchCurrentSlideCanvasScene,
    patchCurrentSlideMatrix,
    diagramRemountToken,
  } = usePresentation();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<TextField | null>(null);
  const slideContainerRef = useRef<HTMLDivElement | null>(null);
  /** Tras arrastrar un bloque, evita que el `click` posterior abra edición por error. */
  const dragConsumedClickRef = useRef(false);

  useEffect(() => {
    setSelectedId(null);
    setHoveredId(null);
    setActiveField(null);
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
        const copy: SlideCanvasElement = {
          ...el,
          id: crypto.randomUUID(),
          rect: clampCanvasRect({
            ...el.rect,
            x: el.rect.x + 2,
            y: el.rect.y + 2,
          }),
          z: maxZ + 1,
        };
        return { ...scene, elements: [...scene.elements, copy] };
      });
    },
    [patchCurrentSlideCanvasScene],
  );

  const deleteCanvasElement = useCallback(
    (elementId: string) => {
      setSelectedId((sid) => (sid === elementId ? null : sid));
      setHoveredId((hid) => (hid === elementId ? null : hid));
      patchCurrentSlideCanvasScene((scene) => ({
        ...scene,
        elements: scene.elements.filter((e) => e.id !== elementId),
      }));
    },
    [patchCurrentSlideCanvasScene],
  );

  const bringCanvasElementForward = useCallback(
    (elementId: string) => {
      patchCurrentSlideCanvasScene((scene) => {
        const maxZ = scene.elements.reduce((m, e) => Math.max(m, e.z), 0);
        return {
          ...scene,
          elements: scene.elements.map((e) =>
            e.id === elementId ? { ...e, z: maxZ + 1 } : e,
          ),
        };
      });
    },
    [patchCurrentSlideCanvasScene],
  );

  const sendCanvasElementBackward = useCallback(
    (elementId: string) => {
      patchCurrentSlideCanvasScene((scene) => {
        const minZ = scene.elements.reduce((m, e) => Math.min(m, e.z), 0);
        return {
          ...scene,
          elements: scene.elements.map((e) =>
            e.id === elementId ? { ...e, z: minZ - 1 } : e,
          ),
        };
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

      const cleanupWatch = () => {
        window.removeEventListener("pointermove", onMoveWatch);
        window.removeEventListener("pointerup", onUpWatch);
        window.removeEventListener("pointercancel", onUpWatch);
      };

      const cleanupDrag = () => {
        window.removeEventListener("pointermove", onDrag);
        window.removeEventListener("pointerup", onUpDrag);
        window.removeEventListener("pointercancel", onUpDrag);
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
        onPatchRect(elementId, {
          x: baseRect.x + dxPct,
          y: baseRect.y + dyPct,
          w: baseRect.w,
          h: baseRect.h,
        });
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
    [onPatchRect],
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
        onPatchRect(elementId, rectResizeFromCorner(opp.x, opp.y, cur.px, cur.py));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [onPatchRect],
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

  if (!currentSlide) return null;

  const slide = ensureSlideCanvasScene(currentSlide);
  const scene = slide.canvasScene!;
  const sorted = [...scene.elements].sort((a, b) => a.z - b.z);

  const onBackgroundPointerDown = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-slide-canvas-el]")) return;
    setSelectedId(null);
    setHoveredId(null);
  };

  const showIaToolbar = slide.type === SLIDE_TYPE.CONTENT;

  return (
    <div
      ref={slideContainerRef}
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-surface-elevated"
      onPointerDown={onBackgroundPointerDown}
    >
      {showIaToolbar && (
        <div className="absolute left-3 top-3 z-50 flex items-center gap-1 md:left-4 md:top-4">
          <button
            type="button"
            onClick={() => {
              setGenerateSlideContentPrompt("");
              setShowGenerateSlideContentModal(true);
            }}
            className={cn(IA_BTN, "hover:text-emerald-600 dark:hover:text-emerald-400")}
            title="Generar contenido de esta diapositiva con IA"
          >
            <Sparkles size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShowSplitModal(true)}
            className={cn(IA_BTN, "hover:text-amber-600 dark:hover:text-amber-400")}
            title="Dividir"
          >
            <Split size={16} />
          </button>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={cn(
                IA_BTN,
                "hover:text-emerald-600 dark:hover:text-emerald-400",
              )}
              title="Editar texto"
            >
              <Pencil size={16} />
            </button>
          )}
        </div>
      )}

      {(slide.type === SLIDE_TYPE.CHAPTER ||
        slide.type === SLIDE_TYPE.MATRIX ||
        slide.type === SLIDE_TYPE.DIAGRAM) &&
        !showIaToolbar &&
        !isEditing && (
          <div className="absolute right-3 top-3 z-50 md:right-4 md:top-4">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={cn(
                IA_BTN,
                "hover:text-emerald-600 dark:hover:text-emerald-400",
              )}
              title="Editar"
            >
              <Pencil size={16} />
            </button>
          </div>
        )}

      {sorted.map((el) => (
        <CanvasElementEditor
          key={el.id}
          element={el}
          slide={slide}
          slideIndex={currentIndex}
          isSelected={selectedId === el.id}
          isHovered={hoveredId === el.id}
          onHoverEnter={() => setHoveredId(el.id)}
          onHoverLeave={() =>
            setHoveredId((h) => (h === el.id ? null : h))
          }
          onSelect={() => {
            setSelectedId(el.id);
            setHoveredId(null);
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
          formatMarkdown={formatMarkdown}
          patchCurrentSlideMatrix={patchCurrentSlideMatrix}
          setShowRewriteModal={setShowRewriteModal}
          setGenerateSlideContentPrompt={setGenerateSlideContentPrompt}
          setShowGenerateSlideContentModal={setShowGenerateSlideContentModal}
          attachDragThreshold={attachDragThreshold}
          dragThresholdPx={
            selectedId === el.id
              ? DRAG_THRESHOLD_SELECTED_PX
              : DRAG_THRESHOLD_FIRST_PX
          }
          consumeClickIfDrag={consumeClickIfDrag}
          startResizeCorner={startResizeCorner}
          startRotate={startRotate}
          duplicateCanvasElement={duplicateCanvasElement}
          deleteCanvasElement={deleteCanvasElement}
          bringCanvasElementForward={bringCanvasElementForward}
          sendCanvasElementBackward={sendCanvasElementBackward}
          diagramRemountToken={diagramRemountToken}
          onPatchRect={onPatchRect}
          slideContainerRef={slideContainerRef}
        />
      ))}
    </div>
  );
}

function CanvasElementEditor({
  element,
  slide,
  slideIndex,
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
  formatMarkdown,
  patchCurrentSlideMatrix,
  setShowRewriteModal,
  setGenerateSlideContentPrompt,
  setShowGenerateSlideContentModal,
  attachDragThreshold,
  dragThresholdPx,
  consumeClickIfDrag,
  startResizeCorner,
  startRotate,
  duplicateCanvasElement,
  deleteCanvasElement,
  bringCanvasElementForward,
  sendCanvasElementBackward,
  diagramRemountToken,
  onPatchRect,
  slideContainerRef,
}: {
  element: SlideCanvasElement;
  slide: Slide;
  slideIndex: number;
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
  formatMarkdown: (s: string) => string;
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
}) {
  const { rect, kind, id, z } = element;
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
      slide.title,
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
      slide.subtitle,
      editSubtitle,
      kind,
      rotation,
      showSubtitleEdit,
      onPatchRect,
      slideContainerRef,
    ],
  );

  const box: React.CSSProperties = {
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.w}%`,
    height: `${rect.h}%`,
    /** Seleccionado arriba del todo; hover sin seleccionar, un poco por encima de vecinos (contorno visible). */
    zIndex: isSelected ? 10_000 + z : isHovered ? 1000 + z : z,
  };

  const shellHoverProps = {
    onPointerEnter: onHoverEnter,
    onPointerLeave: onHoverLeave,
  };

  const showHoverOutline = isHovered && !isSelected;

  const textField = fieldForKind(kind);

  const showCanvaChrome =
    isSelected && kind !== "excalidraw" && kind !== "sectionLabel";

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
    const captureEl =
      e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
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
    (slide.type === SLIDE_TYPE.CONTENT || slide.type === SLIDE_TYPE.MATRIX);

  const canvaChromeEl =
    showCanvaChrome ? (
      <SlideCanvasCanvaChrome
        showResize
        onResizeCorner={(corner, e) => startResizeCorner(id, corner, e, rect)}
        onRotatePointerDown={(e) => startRotate(id, e, rect, rotation)}
        toolbar={{
          showAi: showToolbarAi,
          onAi: showToolbarAi
            ? () => {
                setGenerateSlideContentPrompt("");
                setShowGenerateSlideContentModal(true);
              }
            : undefined,
          onEdit: () => {
            setIsEditing(true);
            if (kind === "markdown" || kind === "matrixNotes") {
              setActiveField("content");
            } else if (
              kind === "title" ||
              kind === "chapterTitle"
            ) {
              setActiveField("title");
            } else if (
              kind === "subtitle" ||
              kind === "chapterSubtitle"
            ) {
              setActiveField("subtitle");
            } else {
              setIsEditing(true);
            }
          },
          onDuplicate: () => duplicateCanvasElement(id),
          onDelete: () => deleteCanvasElement(id),
          onBringForward: () => bringCanvasElementForward(id),
          onSendBackward: () => sendCanvasElementBackward(id),
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
      className={cn("min-h-0 min-w-0", className)}
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
      return (
        <div
          style={box}
          data-slide-canvas-el
          className={outerShellClass}
          {...shellHoverProps}
        >
          <div className="pointer-events-none flex h-full items-start px-1 pt-0.5">
            <span
              className="font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400"
              style={{ fontSize: "var(--slide-label)" }}
            >
              Sección {slideIndex + 1}
            </span>
          </div>
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
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
          {canvaChromeEl}
          {rotatedInner(
            "flex w-full min-w-0 flex-col overflow-visible",
            <div
              ref={titleAutoMeasureRef}
              className="box-border w-full min-w-0 px-2 py-1"
            >
              {!isEditing || !showTitleEdit ? (
                <div
                  className={cn(
                    "flex w-full min-w-0 shrink-0 flex-col overflow-visible rounded-md",
                    chapter ? "items-center text-center" : "",
                  )}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (consumeClickIfDrag()) return;
                    onSelect();
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
                      setIsEditing(true);
                      setActiveField("title");
                    }
                  }}
                >
                  <span
                    className={cn(
                      "block max-w-full min-w-0 font-serif italic leading-tight text-stone-900 dark:text-stone-100 whitespace-pre-wrap wrap-break-word",
                    )}
                    style={
                      chapter
                        ? { fontSize: "var(--slide-title-chapter)" }
                        : { fontSize: "var(--slide-title)" }
                    }
                  >
                    {(isEditing ? editTitle : slide.title).trim() || "Sin título"}
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
                  className={cn(
                    "field-sizing-content box-border min-h-11 w-full min-w-0 resize-none overflow-hidden rounded-md border-0 bg-transparent font-serif italic leading-tight text-stone-900 shadow-none focus:outline-none focus:ring-0 dark:text-foreground whitespace-pre-wrap wrap-break-word [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    chapter && "text-center",
                  )}
                  style={
                    chapter
                      ? { fontSize: "var(--slide-title-chapter)" }
                      : { fontSize: "var(--slide-title)" }
                  }
                />
              )}
            </div>,
          )}
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
          {canvaChromeEl}
          {rotatedInner(
            "flex w-full min-w-0 flex-col overflow-visible",
            <div
              ref={subtitleAutoMeasureRef}
              className="box-border w-full min-w-0 px-2 py-0.5"
            >
              {!isEditing || !showSubtitleEdit ? (
                <div
                  className={cn(
                    "flex w-full min-w-0 shrink-0 flex-col overflow-visible rounded-md text-sm",
                    chapter &&
                      "items-center text-center font-light uppercase tracking-wide text-stone-400",
                  )}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (consumeClickIfDrag()) return;
                    onSelect();
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
                      setIsEditing(true);
                      setActiveField("subtitle");
                    }
                  }}
                >
                  {(isEditing ? editSubtitle : slide.subtitle ?? "").trim() ? (
                    <span
                      className="block max-w-full min-w-0 whitespace-pre-wrap wrap-break-word"
                      style={{ fontSize: "var(--slide-subtitle)" }}
                    >
                      {isEditing ? editSubtitle : slide.subtitle}
                    </span>
                  ) : (
                    <span className="text-stone-400 italic">
                      Subtítulo (opcional)
                    </span>
                  )}
                </div>
              ) : (
                <input
                  {...{ [EDIT_FIELD_ATTR]: "true" }}
                  type="text"
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  onBlur={() =>
                    window.setTimeout(
                      () => commitSlideEdits({ keepEditing: true }),
                      120,
                    )
                  }
                  className={cn(
                    "field-sizing-content box-border min-h-7 w-full min-w-0 rounded-md border-0 bg-transparent text-sm shadow-none focus:outline-none focus:ring-0 dark:text-stone-200",
                    chapter &&
                      "text-center font-light uppercase tracking-wide",
                  )}
                  style={{ fontSize: "var(--slide-subtitle)" }}
                />
              )}
            </div>,
          )}
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    }
    case "markdown":
      return (
        <div
          style={box}
          data-slide-canvas-el
          className={outerShellClass}
          onPointerDown={onShellPointerDown}
          {...shellHoverProps}
        >
          {canvaChromeEl}
          {rotatedInner(
            "relative flex h-full min-h-0 w-full flex-col overflow-hidden",
            !isEditing || !isSelected || activeField !== "content" ? (
              <div
                className="min-h-0 flex-1 overflow-y-auto px-2 py-1"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (consumeClickIfDrag()) return;
                  onSelect();
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
                    setIsEditing(true);
                    setActiveField("content");
                  }
                }}
              >
                {editContent.trim() ? (
                  <SlideMarkdown>{formatMarkdown(editContent)}</SlideMarkdown>
                ) : (
                  <p className="text-stone-400 italic">
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
                  className="min-h-0 flex-1 resize-none rounded-lg border-0 bg-transparent font-sans text-base leading-relaxed text-stone-900 focus:outline-none focus:ring-0 dark:text-foreground md:text-lg"
                  placeholder="Markdown…"
                />
                <button
                  type="button"
                  className="absolute bottom-2 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-stone-700/30 bg-stone-900 text-white shadow-lg hover:bg-stone-800 dark:border-stone-300/40 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
                  title="Replantear con IA"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowRewriteModal(true)}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            ),
          )}
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    case "mediaPanel":
      return (
        <div
          style={box}
          data-slide-canvas-el
          className={outerShellClass}
          {...shellHoverProps}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            if (
              (e.target as HTMLElement).closest("[data-slide-canvas-chrome]")
            ) {
              return;
            }
            onSelect();
            e.stopPropagation();
            const cap =
              e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
            attachDragThreshold(
              id,
              rect,
              e.clientX,
              e.clientY,
              e.pointerId,
              cap,
              dragThresholdPx,
            );
          }}
        >
          {canvaChromeEl}
          {rotatedInner(
            "h-full min-h-0 w-full overflow-hidden",
            <SlideRightPanel fullWidth />,
          )}
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
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
          {canvaChromeEl}
          {rotatedInner(
            "h-full min-h-0 overflow-y-auto px-1 py-1",
            <SlideMatrixTable
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
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    }
    case "matrixNotes":
      return (
        <div
          style={box}
          data-slide-canvas-el
          className={outerShellClass}
          onPointerDown={onShellPointerDown}
          {...shellHoverProps}
        >
          {canvaChromeEl}
          {rotatedInner(
            "h-full overflow-y-auto px-2 py-1",
            !isEditing || !isSelected || activeField !== "content" ? (
              <div
                className="rounded-md"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (consumeClickIfDrag()) return;
                  onSelect();
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
                    setIsEditing(true);
                    setActiveField("content");
                  }
                }}
              >
                {editContent.trim() ? (
                  <SlideMarkdown>{formatMarkdown(editContent)}</SlideMarkdown>
                ) : (
                  <p className="text-xs text-stone-400">Notas bajo la tabla…</p>
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
                className="min-h-[80px] w-full resize-y rounded-md border border-stone-200 bg-white/80 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-border dark:bg-stone-900/60 dark:text-stone-100"
                placeholder="Notas (opcional)"
              />
            ),
          )}
          {showHoverOutline ? <SlideCanvasHoverOutline /> : null}
        </div>
      );
    case "excalidraw":
      return (
        <div
          style={box}
          data-slide-canvas-el
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
    default:
      return null;
  }
}
