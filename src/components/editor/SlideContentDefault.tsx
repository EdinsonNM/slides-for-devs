import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { Pencil, Check, Save, RefreshCw, Split } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { SlideRightPanel } from "./SlideRightPanel";

export function SlideContentDefault() {
  const {
    currentSlide,
    currentIndex,
    formatMarkdown,
    isEditing,
    setIsEditing,
    editTitle,
    setEditTitle,
    editContent,
    setEditContent,
    handleSaveManualEdit,
    setShowRewriteModal,
    setShowSplitModal,
  } = usePresentation();

  if (!currentSlide) return null;

  return (
    <>
      <div className="flex-1 p-12 flex flex-col overflow-hidden">
        <div className="mb-8 shrink-0 flex items-start justify-between">
          <div className="flex-1 mr-4">
            <span
              className="uppercase tracking-[0.2em] text-emerald-600 font-bold mb-2 block"
              style={{ fontSize: "var(--slide-label)" }}
            >
              Sección {currentIndex + 1}
            </span>
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="font-serif italic text-stone-900 leading-tight bg-transparent border-b border-stone-200 focus:outline-none focus:border-emerald-500 w-full"
                style={{ fontSize: "var(--slide-title)" }}
              />
            ) : (
              <h2
                className="font-serif italic text-stone-900 leading-tight"
                style={{ fontSize: "var(--slide-title)" }}
              >
                {currentSlide.title}
              </h2>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (isEditing) {
                  handleSaveManualEdit();
                } else {
                  setIsEditing(true);
                }
              }}
              className={cn(
                "p-2 rounded-lg transition-all shadow-sm group relative",
                isEditing
                  ? "bg-emerald-600 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-emerald-100 hover:text-emerald-600"
              )}
              title={isEditing ? "Guardar cambios" : "Editar manualmente"}
            >
              {isEditing ? <Check size={18} /> : <Pencil size={18} />}
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-stone-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {isEditing ? "Guardar" : "Editar"}
              </span>
            </button>
            <button
              onClick={() => setShowRewriteModal(true)}
              className="p-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-emerald-100 hover:text-emerald-600 transition-all shadow-sm group relative"
              title="Replantear contenido"
            >
              <RefreshCw size={18} />
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-stone-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Replantear
              </span>
            </button>
            <button
              onClick={() => setShowSplitModal(true)}
              className="p-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-emerald-100 hover:text-emerald-600 transition-all shadow-sm group relative"
              title="Dividir diapositiva"
            >
              <Split size={18} />
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-stone-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Dividir
              </span>
            </button>
          </div>
        </div>
        <div className="flex-1 prose prose-stone max-w-none prose-p:text-stone-600 prose-li:text-stone-600 overflow-y-auto pr-4 custom-scrollbar">
          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none font-sans text-lg"
            />
          ) : (
            <ReactMarkdown remarkPlugins={[remarkBreaks]}>
              {formatMarkdown(currentSlide.content)}
            </ReactMarkdown>
          )}
        </div>
        {isEditing && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSaveManualEdit}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Save size={18} />
              Guardar Cambios
            </button>
          </div>
        )}
      </div>
      <SlideRightPanel />
    </>
  );
}
