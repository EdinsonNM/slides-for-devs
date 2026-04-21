import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, Minus, Plus, Type } from "lucide-react";
import type { DeckContentTone } from "../../domain/entities";
import type { CanvasMarkdownBodyDisplay } from "../../domain/slideCanvas/slideCanvasPayload";
import {
  markdownBodyToRichHtmlForEditor,
  sanitizeSlideRichHtml,
  wrapSelectionWithSpanStyle,
} from "../../utils/slideRichText";
import { cn } from "../../utils/cn";
import {
  deckMutedTextClass,
  deckPrimaryTextClass,
} from "../../utils/deckSlideChrome";
import { SlideMarkdown } from "../shared/SlideMarkdown";
import {
  slideCanvasToolbarIconBtnClass,
  slideCanvasToolbarPillRowClass,
} from "./slideCanvasToolbarStyles";

const EDIT_FIELD_ATTR = "data-slide-edit-field";

export type SlideCanvasRichDescriptionHandle = {
  selectAllAndBold: () => void;
  selectAllAndItalic: () => void;
  selectAllAndColor: (hex: string) => void;
};

export type SlideCanvasRichDescriptionProps = {
  elementId: string;
  tone: DeckContentTone;
  display: CanvasMarkdownBodyDisplay;
  isEditing: boolean;
  plainBuffer: string;
  richHtmlBuffer: string;
  fontScale: number;
  /** `richHtml` es el HTML crudo del contentEditable; quien persiste debe sanitizar (p. ej. `applyEditBuffersToSlide`). */
  onPlainAndRichChange: (plain: string, richHtml: string) => void;
  onBlurCommit: () => void;
  shellClassName?: string;
  onRequestEdit?: () => void;
  /**
   * Sustituye el tamaño base en vista (y en el editor). Por defecto: `calc(var(--slide-body) * …)`
   * para que escale con el lienzo (mismo criterio que el título vía `--slide-title` / `cqw`).
   */
  viewTypographySize?: string;
};

function SelectionMiniToolbar({
  onBold,
  onItalic,
  onColor,
  onSelectionSmaller,
  onSelectionLarger,
}: {
  onBold: () => void;
  onItalic: () => void;
  onColor: (hex: string) => void;
  onSelectionSmaller: () => void;
  onSelectionLarger: () => void;
}) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(slideCanvasToolbarPillRowClass, "pointer-events-auto")}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      role="toolbar"
      aria-label="Formato de la selección"
    >
      <button
        type="button"
        className={slideCanvasToolbarIconBtnClass}
        title="Negrita (solo la selección)"
        onClick={onBold}
      >
        <Bold size={16} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        className={slideCanvasToolbarIconBtnClass}
        title="Cursiva (solo la selección)"
        onClick={onItalic}
      >
        <Italic size={16} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        className={slideCanvasToolbarIconBtnClass}
        title="Color del texto"
        onClick={() => colorInputRef.current?.click()}
      >
        <span className="relative flex items-center">
          <Type size={15} />
          <input
            ref={colorInputRef}
            type="color"
            className="sr-only"
            aria-label="Color del texto seleccionado"
            defaultValue="#2563eb"
            onChange={(e) => onColor(e.target.value)}
          />
        </span>
      </button>
      <span
        className="mx-0.5 h-5 w-px shrink-0 bg-stone-200 dark:bg-stone-600"
        aria-hidden
      />
      <button
        type="button"
        className={slideCanvasToolbarIconBtnClass}
        title="Reducir tamaño de la selección"
        onClick={onSelectionSmaller}
      >
        <Minus size={16} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={slideCanvasToolbarIconBtnClass}
        title="Aumentar tamaño de la selección"
        onClick={onSelectionLarger}
      >
        <Plus size={16} strokeWidth={2} />
      </button>
    </div>
  );
}

export const SlideCanvasRichDescription = forwardRef<
  SlideCanvasRichDescriptionHandle,
  SlideCanvasRichDescriptionProps
>(function SlideCanvasRichDescription(
  {
    elementId,
    tone,
    display,
    isEditing,
    plainBuffer,
    richHtmlBuffer,
    fontScale,
    onPlainAndRichChange,
    onBlurCommit,
    shellClassName,
    onRequestEdit,
    viewTypographySize,
  },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRootRef = useRef<HTMLDivElement>(null);
  const onRequestEditRef = useRef(onRequestEdit);
  onRequestEditRef.current = onRequestEdit;
  const prevEditingRef = useRef(false);
  const prevElementIdRef = useRef(elementId);
  const [toolbarPos, setToolbarPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const wrapClass = cn(
    "slide-rich-wrap min-h-0 min-w-0 max-w-none font-sans leading-relaxed",
    deckPrimaryTextClass(tone),
  );

  const editorFontSize =
    viewTypographySize ?? `calc(var(--slide-body) * ${fontScale})`;

  const viewFontSize =
    viewTypographySize ??
    (display.kind === "html"
      ? `calc(var(--slide-body) * ${display.scale})`
      : `calc(var(--slide-body) * ${fontScale})`);

  const syncFromEditor = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const raw = el.innerHTML;
    const plain = el.innerText.replace(/\u00a0/g, " ");
    onPlainAndRichChange(plain, raw);
  }, [onPlainAndRichChange]);

  const selectAllInEditor = useCallback(() => {
    const el = editorRef.current;
    if (!el || !isEditing) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  }, [isEditing]);

  const collapseCaretToEndOfEditor = useCallback(() => {
    const el = editorRef.current;
    if (!el || !isEditing) return;
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }, [isEditing]);

  useImperativeHandle(
    ref,
    () => ({
      selectAllAndBold: () => {
        const el = editorRef.current;
        if (!el || !isEditing) return;
        el.focus({ preventScroll: true });
        selectAllInEditor();
        document.execCommand("bold", false);
        syncFromEditor();
        collapseCaretToEndOfEditor();
      },
      selectAllAndItalic: () => {
        const el = editorRef.current;
        if (!el || !isEditing) return;
        el.focus({ preventScroll: true });
        selectAllInEditor();
        document.execCommand("italic", false);
        syncFromEditor();
        collapseCaretToEndOfEditor();
      },
      selectAllAndColor: (hex: string) => {
        const el = editorRef.current;
        if (!el || !isEditing) return;
        el.focus({ preventScroll: true });
        selectAllInEditor();
        document.execCommand("foreColor", false, hex);
        syncFromEditor();
        collapseCaretToEndOfEditor();
      },
    }),
    [
      isEditing,
      selectAllInEditor,
      syncFromEditor,
      collapseCaretToEndOfEditor,
    ],
  );

  useLayoutEffect(() => {
    if (!isEditing) {
      prevEditingRef.current = false;
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    const becameEditing = !prevEditingRef.current;
    const idChanged = prevElementIdRef.current !== elementId;
    if (becameEditing || idChanged) {
      const html = richHtmlBuffer.trim()
        ? richHtmlBuffer
        : markdownBodyToRichHtmlForEditor(plainBuffer);
      el.innerHTML = html;
      prevElementIdRef.current = elementId;
      prevEditingRef.current = true;
    }
    // Solo rehidratar al entrar en edición o al cambiar de bloque; no depender de los
    // buffers en cada tecla (evita `useLayoutEffect` por pulsación y mantiene el caret estable).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- plainBuffer/richHtmlBuffer solo para becameEditing/idChanged
  }, [isEditing, elementId]);



  useEffect(() => {
    if (isEditing) return;
    const run = () => {
      const root = viewRootRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0) return;
      const node = sel.anchorNode ?? sel.focusNode;
      if (!node) return;
      const el =
        node.nodeType === Node.ELEMENT_NODE
          ? (node as Element)
          : node.parentElement;
      if (el && root.contains(el)) sel.removeAllRanges();
    };
    requestAnimationFrame(run);
  }, [isEditing, elementId, display.kind, plainBuffer, richHtmlBuffer]);

  const updateToolbarFromSelection = useCallback(() => {
    if (!isEditing) {
      setToolbarPos(null);
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setToolbarPos(null);
      return;
    }
    const root = editorRef.current;
    if (!root || !sel.focusNode || !root.contains(sel.focusNode)) {
      setToolbarPos(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) {
      setToolbarPos(null);
      return;
    }
    const pad = 8;
    setToolbarPos({
      top: rect.top - pad - 44,
      left: rect.left + rect.width / 2,
    });
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const onSel = () => {
      window.requestAnimationFrame(updateToolbarFromSelection);
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [isEditing, updateToolbarFromSelection]);

  const canApplyInlineToSelection = useCallback(() => {
    const sel = window.getSelection();
    const root = editorRef.current;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    if (!root || !sel.focusNode || !root.contains(sel.focusNode)) return false;
    return true;
  }, []);

  const applyBold = useCallback(() => {
    if (!canApplyInlineToSelection()) return;
    document.execCommand("bold", false);
    syncFromEditor();
    updateToolbarFromSelection();
  }, [canApplyInlineToSelection, syncFromEditor, updateToolbarFromSelection]);

  const applyItalic = useCallback(() => {
    if (!canApplyInlineToSelection()) return;
    document.execCommand("italic", false);
    syncFromEditor();
    updateToolbarFromSelection();
  }, [canApplyInlineToSelection, syncFromEditor, updateToolbarFromSelection]);

  const applyColor = useCallback(
    (hex: string) => {
      if (!canApplyInlineToSelection()) return;
      wrapSelectionWithSpanStyle(`color: ${hex}`);
      syncFromEditor();
      updateToolbarFromSelection();
    },
    [canApplyInlineToSelection, syncFromEditor, updateToolbarFromSelection],
  );

  const bumpSelectionFontPx = useCallback(
    (delta: number) => {
      if (!canApplyInlineToSelection()) return;
      const sel = window.getSelection()!;
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const el =
        node.nodeType === Node.ELEMENT_NODE
          ? (node as Element)
          : node.parentElement;
      let px = 16;
      if (el) {
        const fs = window.getComputedStyle(el).fontSize;
        const n = parseFloat(fs);
        if (Number.isFinite(n)) px = n;
      }
      const next = Math.min(64, Math.max(10, Math.round(px + delta)));
      wrapSelectionWithSpanStyle(`font-size: ${next}px`);
      syncFromEditor();
      updateToolbarFromSelection();
    },
    [canApplyInlineToSelection, syncFromEditor, updateToolbarFromSelection],
  );

  if (!isEditing) {
    if (display.kind === "html") {
      return (
        <div
          ref={viewRootRef}
          className={cn(wrapClass, "select-none", shellClassName)}
          style={{ fontSize: viewFontSize }}
          onDoubleClick={(e) => {
            if (onRequestEditRef.current) {
              e.stopPropagation();
              onRequestEditRef.current();
            }
          }}
        >
          <div
            className="slide-rich-root select-none [&_a]:underline"
            dangerouslySetInnerHTML={{
              __html: sanitizeSlideRichHtml(display.html),
            }}
          />
        </div>
      );
    }

    /** Solo `display` (payload del elemento en el slide); no mezclar con `plainBuffer` (buffer global). */
    const src = display.source;
    return (
      <div
        ref={viewRootRef}
        className={cn(wrapClass, "select-none", shellClassName)}
        style={{ fontSize: viewFontSize }}
        onDoubleClick={(e) => {
          if (onRequestEditRef.current) {
            e.stopPropagation();
            onRequestEditRef.current();
          }
        }}
      >
        {src.trim() ? (
          <SlideMarkdown contentTone={tone}>{src}</SlideMarkdown>
        ) : (
          <p className={cn("italic", deckMutedTextClass(tone))}>
            Doble clic para editar…
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative isolate flex min-h-0 flex-1 flex-col",
        shellClassName,
      )}
    >
      {toolbarPos
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[20000]"
              style={{
                top: toolbarPos.top,
                left: toolbarPos.left,
                transform: "translateX(-50%)",
              }}
            >
              <SelectionMiniToolbar
                onBold={applyBold}
                onItalic={applyItalic}
                onColor={applyColor}
                onSelectionSmaller={() => bumpSelectionFontPx(-2)}
                onSelectionLarger={() => bumpSelectionFontPx(2)}
              />
            </div>,
            document.body,
          )
        : null}
      <div
        ref={editorRef}
        {...{ [EDIT_FIELD_ATTR]: "true" }}
        contentEditable
        suppressContentEditableWarning
        data-slide-markdown-scroll-measure=""
        className={cn(
          wrapClass,
          "slide-rich-root relative z-10 max-h-[min(70vh,520px)] min-h-0 flex-1 overflow-y-auto bg-transparent px-2 py-2 outline-none",
          tone === "light"
            ? "[&::selection]:bg-sky-300/70 [&::selection]:text-slate-950"
            : "[&::selection]:bg-sky-500/35 [&::selection]:text-stone-900 dark:[&::selection]:bg-sky-400/40 dark:[&::selection]:text-stone-950",
          tone === "light"
            ? "caret-sky-600"
            : "caret-emerald-600 dark:caret-emerald-400",
        )}
        style={{ fontSize: editorFontSize }}
        onInput={() => {
          syncFromEditor();
          updateToolbarFromSelection();
        }}
        onBlur={() => {
          setToolbarPos(null);
          window.setTimeout(() => onBlurCommit(), 120);
        }}
      />
    </div>
  );
});
