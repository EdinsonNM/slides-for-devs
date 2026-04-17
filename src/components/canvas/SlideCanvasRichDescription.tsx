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

type SlideCanvasRichDescriptionProps = {
  elementId: string;
  tone: DeckContentTone;
  display: CanvasMarkdownBodyDisplay;
  isEditing: boolean;
  plainBuffer: string;
  richHtmlBuffer: string;
  fontScale: number;
  onPlainAndRichChange: (plain: string, richSanitized: string) => void;
  onBlurCommit: () => void;
  shellClassName?: string;
  /** Vista solo lectura: doble clic sobre el texto/HTML (incl. nodos de `dangerouslySetInnerHTML`). */
  onRequestEdit?: () => void;
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
  },
  ref,
) {
  const edRef = useRef<HTMLDivElement>(null);
  const viewDblCaptureRootRef = useRef<HTMLDivElement>(null);
  const onRequestEditRef = useRef(onRequestEdit);
  onRequestEditRef.current = onRequestEdit;
  const prevEditingRef = useRef(false);
  const prevElementIdRef = useRef(elementId);
  const [toolbarPos, setToolbarPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const syncFromEditor = useCallback(() => {
    const el = edRef.current;
    if (!el) return;
    const raw = el.innerHTML;
    const plain = el.innerText.replace(/\u00a0/g, " ");
    onPlainAndRichChange(plain, sanitizeSlideRichHtml(raw));
  }, [onPlainAndRichChange]);

  const selectAllInEditor = useCallback(() => {
    const el = edRef.current;
    if (!el || !isEditing) return;
    const r = document.createRange();
    r.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  }, [isEditing]);

  /** Tras negrita/cursiva/color en todo el bloque, quita el resaltado azul y deja el cursor al final. */
  const collapseCaretToEndOfEditor = useCallback(() => {
    const el = edRef.current;
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
        const el = edRef.current;
        if (!el || !isEditing) return;
        el.focus({ preventScroll: true });
        selectAllInEditor();
        document.execCommand("bold", false);
        syncFromEditor();
        collapseCaretToEndOfEditor();
      },
      selectAllAndItalic: () => {
        const el = edRef.current;
        if (!el || !isEditing) return;
        el.focus({ preventScroll: true });
        selectAllInEditor();
        document.execCommand("italic", false);
        syncFromEditor();
        collapseCaretToEndOfEditor();
      },
      selectAllAndColor: (hex: string) => {
        const el = edRef.current;
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

  useEffect(() => {
    if (isEditing) return;
    const el = viewDblCaptureRootRef.current;
    if (!el || !onRequestEditRef.current) return;
    const onDbl = (ev: MouseEvent) => {
      if (!onRequestEditRef.current) return;
      ev.stopPropagation();
      onRequestEditRef.current();
    };
    el.addEventListener("dblclick", onDbl, true);
    return () => el.removeEventListener("dblclick", onDbl, true);
  }, [isEditing, display.kind]);

  /** Al volver a vista, quitar rangos del documento que sigan apuntando a este nodo (evita azul “fantasma”). */
  useEffect(() => {
    if (isEditing) return;
    const run = () => {
      const root = viewDblCaptureRootRef.current;
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

  useLayoutEffect(() => {
    if (!isEditing) {
      prevEditingRef.current = false;
      return;
    }
    const el = edRef.current;
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
  }, [isEditing, elementId, plainBuffer, richHtmlBuffer]);

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
    const root = edRef.current;
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
    const root = edRef.current;
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

  const wrapClass = cn(
    "slide-rich-wrap min-h-0 min-w-0 max-w-none font-sans leading-relaxed",
    deckPrimaryTextClass(tone),
  );

  if (!isEditing) {
    /* Vista: `select-none` evita resaltado azul “fantasma” al mover el ratón con el bloque
       seleccionado; el doble clic no requiere selección de texto (captura en el shell / div). */
    if (display.kind === "html") {
      return (
        <div
          className={cn(wrapClass, "select-none", shellClassName)}
          style={{ fontSize: `calc(1rem * ${display.scale})` }}
        >
          <div
            ref={viewDblCaptureRootRef}
            className="slide-rich-root select-none [&_a]:underline"
            dangerouslySetInnerHTML={{
              __html: sanitizeSlideRichHtml(display.html),
            }}
          />
        </div>
      );
    }
    const src = display.source.trim() ? display.source : plainBuffer;
    return (
      <div
        ref={viewDblCaptureRootRef}
        className={cn(wrapClass, "select-none", shellClassName)}
        style={{ fontSize: `calc(1rem * ${fontScale})` }}
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
        ref={edRef}
        {...{ [EDIT_FIELD_ATTR]: "true" }}
        contentEditable
        suppressContentEditableWarning
        data-slide-markdown-scroll-measure=""
        className={cn(
          wrapClass,
          "slide-rich-root relative z-10 max-h-[min(70vh,520px)] min-h-0 flex-1 overflow-y-auto bg-transparent px-2 py-2 outline-none",
          /* Tono claro: el texto es casi blanco; sin ::selection explícito el resaltaje casi no se ve. */
          tone === "light"
            ? "[&::selection]:bg-sky-300/70 [&::selection]:text-slate-950"
            : "[&::selection]:bg-sky-500/35 [&::selection]:text-stone-900 dark:[&::selection]:bg-sky-400/40 dark:[&::selection]:text-stone-950",
          tone === "light"
            ? "caret-sky-600"
            : "caret-emerald-600 dark:caret-emerald-400",
        )}
        style={{ fontSize: `calc(1rem * ${fontScale})` }}
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
