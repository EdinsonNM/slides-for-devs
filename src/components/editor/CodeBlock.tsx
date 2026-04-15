import { flushSync } from "react-dom";
import {
  Pencil,
  Check,
  X,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  vscDarkPlus,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { usePresentation } from "../../context/PresentationContext";
import { LANGUAGES } from "../../constants/languages";
import { cn } from "../../utils/cn";
import { useCodeEditorTheme } from "../../hooks/useCodeEditorTheme";
import type { Slide } from "../../types";

export interface CodeBlockProps {
  /** En vista grande los controles viven en el inspector; solo se muestran los dots de la ventana. */
  titleBarMode?: "full" | "minimal";
  /** Bloque `mediaPanel` en el lienzo: edición con doble clic, sin barra de guardar; tema/IA/fuente en el cromo flotante. */
  embeddedInCanvas?: boolean;
  canvasPanelSlide?: Slide;
  /** Id del elemento `mediaPanel` en el lienzo (aislar edición con varios paneles de código). */
  canvasMediaElementId?: string;
}

export function CodeBlock({
  titleBarMode = "full",
  embeddedInCanvas = false,
  canvasPanelSlide,
  canvasMediaElementId,
}: CodeBlockProps) {
  const {
    currentSlide,
    isEditing,
    setIsEditing,
    editCode,
    setEditCode,
    editLanguage,
    setEditLanguage,
    editFontSize,
    setEditFontSize,
    handleSaveManualEdit,
    commitSlideEdits,
    openCodeGenModal,
    canvasMediaPanelElementId,
    setCanvasMediaPanelEditTarget,
    cycleCodeEditorThemeForMediaPanel,
  } = usePresentation();

  const globalCodeTheme = useCodeEditorTheme();

  if (!currentSlide) return null;

  const slide = canvasPanelSlide ?? currentSlide;

  /** En lienzo: tema por `payload` del panel; si no hay override, mismo valor que el hook global. */
  const codeUiTheme =
    embeddedInCanvas && canvasPanelSlide
      ? (canvasPanelSlide.codeEditorTheme ?? globalCodeTheme.theme)
      : globalCodeTheme.theme;
  const isLight = codeUiTheme === "light";

  const isThisCanvasCodePanelEditing =
    embeddedInCanvas &&
    canvasMediaElementId != null &&
    canvasMediaPanelElementId === canvasMediaElementId;
  const isCodeTextareaActive =
    isEditing && (!embeddedInCanvas || isThisCanvasCodePanelEditing);

  /** En el lienzo cada panel tiene su `fontSize` en el payload; el buffer global solo aplica al panel en edición. */
  const displayFontSize =
    embeddedInCanvas && !isCodeTextareaActive
      ? slide.fontSize ?? 14
      : editFontSize;

  const shell = isLight
    ? "bg-[#fafafa] border-stone-300 shadow-none"
    : "bg-[#1e1e1e] border-stone-700/90 shadow-none";
  const titleBar = isLight
    ? "bg-stone-200/90 border-b border-stone-300"
    : "bg-[#2d2d2d]";
  const editorArea = isLight ? "bg-[#fafafa]" : "bg-[#1e1e1e]";
  const controlBtn = isLight
    ? "border-stone-400 text-stone-700 hover:bg-stone-300"
    : "border-stone-700 text-stone-300 hover:bg-stone-700";
  const selectLang = isLight
    ? "bg-white border-stone-400 text-emerald-700"
    : "bg-stone-800 border-stone-700 text-emerald-500";
  const iconMuted = isLight ? "text-stone-600" : "text-stone-500";

  const enterCodeEdit = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    if (embeddedInCanvas && canvasMediaElementId) {
      if (
        isEditing &&
        canvasMediaPanelElementId != null &&
        canvasMediaPanelElementId !== canvasMediaElementId
      ) {
        flushSync(() => {
          commitSlideEdits({ keepEditing: true });
        });
      }
      setCanvasMediaPanelEditTarget(canvasMediaElementId, {
        rehydrateCodeBuffers: true,
      });
    }
    setIsEditing(true);
  };

  const exitCodeEditCommit = () => {
    window.setTimeout(() => commitSlideEdits(), 120);
  };

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col overflow-hidden",
        embeddedInCanvas ? "p-0" : "p-4 md:p-6",
      )}
      onClick={
        embeddedInCanvas
          ? undefined
          : () => {
              if (!isEditing) setIsEditing(true);
            }
      }
    >
      <div
        data-code-panel={embeddedInCanvas ? "" : undefined}
        className={cn(
          "relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border group/window",
          shell,
          embeddedInCanvas ? "cursor-default" : "cursor-text",
          /* El lienzo aplica `deckSlideContentWrapperClass` con `text-stone-900` y apaga Prism en el panel activo. */
          embeddedInCanvas && !isLight && "!text-[#d4d4d4]",
          embeddedInCanvas && isLight && "!text-stone-800",
        )}
      >
        <div
          className={cn(
            "flex h-9 shrink-0 items-center px-4",
            titleBarMode === "minimal" ? "justify-start" : "justify-between",
            titleBar,
          )}
        >
          <div className="flex gap-2">
            <div className="h-3 w-3 rounded-full bg-[#ff5f56]" />
            <div className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
            <div className="h-3 w-3 rounded-full bg-[#27c93f]" />
          </div>
          {titleBarMode === "minimal" ? null : (
            <div
              className={`flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider ${isLight ? "text-stone-600" : "text-stone-400"}`}
            >
              {isCodeTextareaActive ? (
                <>
                  <div className="mr-1 flex items-center gap-1 border-r border-stone-700 pr-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditFontSize((prev) => Math.max(8, prev - 2));
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded border transition-colors ${controlBtn}`}
                      title="Disminuir fuente"
                    >
                      <span className="text-[10px] font-bold">-</span>
                    </button>
                    <span
                      className={`w-10 text-center text-[11px] font-bold ${isLight ? "text-emerald-700" : "text-emerald-500"}`}
                    >
                      {editFontSize}px
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditFontSize((prev) => Math.min(64, prev + 2));
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded border transition-colors ${controlBtn}`}
                      title="Aumentar fuente"
                    >
                      <span className="text-[10px] font-bold">+</span>
                    </button>
                  </div>
                  <select
                    value={editLanguage}
                    onChange={(e) => setEditLanguage(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-32 cursor-pointer appearance-none rounded border px-2 py-1 text-center text-[10px] font-bold focus:outline-none ${selectLang}`}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                  <div className="ml-2 flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCodeGenModal();
                      }}
                      className="rounded bg-stone-700 p-1.5 text-stone-300 transition-colors hover:bg-emerald-600/80 hover:text-white"
                      title="Generar código con IA"
                    >
                      <Sparkles size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveManualEdit();
                      }}
                      className="rounded bg-emerald-600 p-1.5 text-white shadow-lg transition-colors hover:bg-emerald-500"
                      title="Guardar (Enter)"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(false);
                      }}
                      className="rounded bg-stone-700 p-1.5 text-stone-300 transition-colors hover:bg-stone-600"
                      title="Cancelar (Esc)"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] opacity-70 ${isLight ? "bg-stone-300 text-stone-700" : "bg-stone-800 opacity-50"}`}
                >
                  {editFontSize}px
                </span>
                  <span
                    className={`rounded px-1.5 py-0.5 ${isLight ? "bg-stone-300 text-stone-800" : "bg-stone-800"}`}
                  >
                    {LANGUAGES.find((l) => l.id === slide.language)
                      ?.name ||
                      slide.language ||
                      "JavaScript"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openCodeGenModal();
                    }}
                    className="ml-2 flex items-center gap-1 rounded bg-emerald-600/80 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
                    title="Generar código con IA según el slide"
                  >
                    <Sparkles size={10} />
                    IA
                  </button>
                </>
              )}
            </div>
          )}
          {titleBarMode === "minimal" ? null : (
            <div className="flex shrink-0 items-center justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (embeddedInCanvas && canvasMediaElementId) {
                    cycleCodeEditorThemeForMediaPanel(canvasMediaElementId);
                  } else {
                    globalCodeTheme.toggleTheme();
                  }
                }}
                className={`rounded-md p-1.5 transition-colors ${isLight ? "bg-stone-300 text-amber-700 hover:bg-stone-400" : "bg-stone-700 text-amber-400 hover:bg-stone-600"}`}
                title={
                  codeUiTheme === "dark"
                    ? "Tema claro del editor"
                    : "Tema oscuro del editor"
                }
                aria-label={
                  codeUiTheme === "dark"
                    ? "Cambiar a tema claro del editor"
                    : "Cambiar a tema oscuro del editor"
                }
              >
                {codeUiTheme === "dark" ? (
                  <Sun size={16} strokeWidth={2} />
                ) : (
                  <Moon size={16} strokeWidth={2} />
                )}
              </button>
            </div>
          )}
        </div>
        <div
          className={cn(
            "custom-scrollbar min-h-0 flex-1 overflow-auto p-0 font-mono",
            editorArea,
            isLight ? "[&::-webkit-scrollbar-thumb]:bg-stone-400" : "",
            /* El slide usa `deckSlideContentWrapperClass` (`text-stone-900` / slate) y apaga tokens Prism o el textarea si heredan. */
            embeddedInCanvas &&
              (isLight
                ? "text-stone-900 [&_textarea]:!text-stone-800"
                : "text-[#e5e5e5] [&_textarea]:!text-[#e5e5e5]"),
          )}
        >
          {isCodeTextareaActive ? (
            <textarea
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  if (embeddedInCanvas) {
                    commitSlideEdits();
                  } else {
                    handleSaveManualEdit();
                  }
                }
                if (e.key === "Escape") {
                  if (embeddedInCanvas) {
                    commitSlideEdits();
                  } else {
                    setIsEditing(false);
                  }
                }
              }}
              onBlur={() => {
                if (embeddedInCanvas) exitCodeEditCommit();
              }}
              className={cn(
                "box-border block min-h-full w-full resize-none border-none bg-transparent p-4 leading-relaxed focus:outline-none",
                isLight
                  ? "text-stone-800 placeholder:text-stone-400"
                  : "text-stone-300",
                embeddedInCanvas &&
                  (isLight
                    ? "!text-stone-800 !placeholder:text-stone-400"
                    : "!text-stone-200 !placeholder:text-stone-500"),
              )}
              style={{ fontSize: `${displayFontSize}px` }}
              placeholder={
                embeddedInCanvas
                  ? "// Escribe tu código… (Esc para guardar y salir)"
                  : "// Escribe tu código aquí... (Ctrl+Enter para guardar)"
              }
            />
          ) : (
            <div
              className="inline-block min-h-full min-w-full max-w-none align-top"
              onDoubleClick={
                embeddedInCanvas
                  ? (e) => {
                      enterCodeEdit(e);
                    }
                  : undefined
              }
              role={embeddedInCanvas ? "button" : undefined}
              tabIndex={embeddedInCanvas ? 0 : undefined}
              title={embeddedInCanvas ? "Doble clic para editar" : undefined}
              onKeyDown={
                embeddedInCanvas
                  ? (e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        enterCodeEdit();
                      }
                    }
                  : undefined
              }
            >
              {slide.code ? (
                <SyntaxHighlighter
                  language={slide.language || "javascript"}
                  style={isLight ? oneLight : vscDarkPlus}
                  codeTagProps={{
                    style: {
                      fontSize: "inherit",
                      lineHeight: "inherit",
                      fontFamily: "inherit",
                    },
                  }}
                  customStyle={{
                    margin: 0,
                    padding: "1.5rem",
                    background: "transparent",
                    boxShadow: "none",
                    fontSize: `${displayFontSize}px`,
                    lineHeight: "1.5",
                    overflow: "visible",
                  }}
                >
                  {slide.code}
                </SyntaxHighlighter>
              ) : (
                <div
                  className={`flex min-h-full flex-col items-center justify-center gap-3 p-6 ${isLight ? "text-stone-600" : "text-stone-500"}`}
                  onDoubleClick={
                    embeddedInCanvas
                      ? (e) => {
                          e.stopPropagation();
                          enterCodeEdit(e);
                        }
                      : undefined
                  }
                >
                  <span className="italic">
                    {embeddedInCanvas
                      ? "// Doble clic para escribir código…"
                      : "// Haz clic para escribir código..."}
                  </span>
                  {!embeddedInCanvas ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCodeGenModal();
                      }}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
                    >
                      <Sparkles size={12} />
                      Generar código con IA
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
        {!isCodeTextareaActive && (
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-colors group-hover/window:opacity-100 ${isLight ? "bg-emerald-600/0 group-hover/window:bg-emerald-500/10" : "bg-emerald-600/0 group-hover/window:bg-emerald-600/5"}`}
          >
            <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-600 shadow-lg dark:border-border dark:bg-stone-800 dark:text-emerald-400">
              <Pencil size={12} />
              {embeddedInCanvas ? "Doble clic para editar" : "Editar Código"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
