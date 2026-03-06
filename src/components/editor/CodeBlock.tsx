import { useRef, useState, useEffect } from "react";
import { Pencil, Check, X, Sparkles, GripHorizontal } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { usePresentation } from "../../context/PresentationContext";
import { LANGUAGES } from "../../constants/languages";

const MIN_EDITOR_HEIGHT = 120;
const MAX_EDITOR_HEIGHT = 560;

export function CodeBlock() {
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
    editEditorHeight,
    setEditorHeightForCurrentSlide,
    handleSaveManualEdit,
    openCodeGenModal,
  } = usePresentation();

  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(280);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientY - startYRef.current;
      const newHeight = Math.min(
        MAX_EDITOR_HEIGHT,
        Math.max(MIN_EDITOR_HEIGHT, startHeightRef.current + delta)
      );
      setEditorHeightForCurrentSlide(newHeight);
    };
    const onUp = () => setIsResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setEditorHeightForCurrentSlide]);

  if (!currentSlide) return null;

  return (
    <div
      className="flex-1 p-6 flex items-center justify-center overflow-hidden cursor-text"
      onClick={() => !isEditing && setIsEditing(true)}
    >
      <div
        className="w-full min-w-0 max-h-[90vh] bg-[#1e1e1e] rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col relative group/window"
        style={{ height: "fit-content" }}
      >
        <div className="h-9 bg-[#2d2d2d] px-4 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>
          <div className="text-[10px] text-stone-400 font-mono uppercase tracking-wider flex items-center gap-3">
            {isEditing ? (
              <>
                <div className="flex items-center gap-1 border-r border-stone-700 pr-2 mr-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditFontSize((prev) => Math.max(8, prev - 2));
                    }}
                    className="w-7 h-7 flex items-center justify-center hover:bg-stone-700 rounded text-stone-300 transition-colors border border-stone-700"
                    title="Disminuir fuente"
                  >
                    <span className="text-[10px] font-bold">-</span>
                  </button>
                  <span className="w-10 text-center text-[11px] font-bold text-emerald-500">
                    {editFontSize}px
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditFontSize((prev) => Math.min(64, prev + 2));
                    }}
                    className="w-7 h-7 flex items-center justify-center hover:bg-stone-700 rounded text-stone-300 transition-colors border border-stone-700"
                    title="Aumentar fuente"
                  >
                    <span className="text-[10px] font-bold">+</span>
                  </button>
                </div>
                <select
                  value={editLanguage}
                  onChange={(e) => setEditLanguage(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-stone-800 border border-stone-700 focus:outline-none text-center w-32 text-emerald-500 rounded px-2 py-1 cursor-pointer text-[10px] font-bold appearance-none"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openCodeGenModal();
                    }}
                    className="p-1.5 bg-stone-700 hover:bg-emerald-600/80 rounded text-stone-300 hover:text-white transition-colors"
                    title="Generar código con IA"
                  >
                    <Sparkles size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveManualEdit();
                    }}
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white transition-colors shadow-lg"
                    title="Guardar (Enter)"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(false);
                    }}
                    className="p-1.5 bg-stone-700 hover:bg-stone-600 rounded text-stone-300 transition-colors"
                    title="Cancelar (Esc)"
                  >
                    <X size={14} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-[9px] opacity-50 bg-stone-800 px-1.5 py-0.5 rounded">
                  {currentSlide.fontSize || 14}px
                </span>
                <span className="bg-stone-800 px-1.5 py-0.5 rounded">
                  {LANGUAGES.find((l) => l.id === currentSlide.language)
                    ?.name ||
                    currentSlide.language ||
                    "JavaScript"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openCodeGenModal();
                  }}
                  className="ml-2 px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1"
                  title="Generar código con IA según el slide"
                >
                  <Sparkles size={10} />
                  IA
                </button>
              </>
            )}
          </div>
          <div className="w-12" />
        </div>
        <div
          className="min-h-[80px] p-0 font-mono overflow-auto custom-scrollbar bg-[#1e1e1e] shrink-0"
          style={{ height: editEditorHeight, maxHeight: "calc(90vh - 3rem)" }}
        >
          {isEditing ? (
            <textarea
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  handleSaveManualEdit();
                }
                if (e.key === "Escape") {
                  setIsEditing(false);
                }
              }}
              className="w-full h-full min-h-[80px] bg-transparent text-stone-300 p-4 border-none focus:outline-none resize-none leading-relaxed block"
              style={{ fontSize: `${editFontSize}px` }}
              placeholder="// Escribe tu código aquí... (Ctrl+Enter para guardar)"
            />
          ) : (
            <div>
              {currentSlide.code ? (
                <SyntaxHighlighter
                  language={currentSlide.language || "javascript"}
                  style={vscDarkPlus}
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
                    fontSize: `${currentSlide.fontSize || 14}px`,
                    lineHeight: "1.5",
                    overflow: "visible",
                    width: "max-content",
                    minWidth: "100%",
                  }}
                >
                  {currentSlide.code}
                </SyntaxHighlighter>
              ) : (
                <div className="p-6 flex flex-col items-center justify-center gap-3 text-stone-500">
                  <span className="italic">
                    // Haz clic para escribir código...
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openCodeGenModal();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-2 transition-colors"
                  >
                    <Sparkles size={12} />
                    Generar código con IA
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div
          role="separator"
          aria-label="Redimensionar alto del editor"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startYRef.current = e.clientY;
            startHeightRef.current = editEditorHeight;
            setIsResizing(true);
          }}
          className="h-3 shrink-0 bg-[#2d2d2d] border-t border-white/10 flex items-center justify-center cursor-ns-resize hover:bg-stone-600 transition-colors group/resize"
        >
          <GripHorizontal
            className="w-4 h-4 text-stone-500 group-hover/resize:text-stone-400"
            strokeWidth={2}
          />
        </div>
        {!isEditing && (
          <div className="absolute inset-0 bg-emerald-600/0 group-hover/window:bg-emerald-600/5 transition-colors flex items-center justify-center opacity-0 group-hover/window:opacity-100 pointer-events-none">
            <div className="px-3 py-1.5 bg-white rounded-full shadow-lg text-emerald-600 text-xs font-medium flex items-center gap-2">
              <Pencil size={12} />
              Editar Código
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
