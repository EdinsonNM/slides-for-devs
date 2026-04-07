import { Pencil, Check, Save, RefreshCw, Split } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { SlideMarkdown } from "../shared/SlideMarkdown";
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
    editSubtitle,
    setEditSubtitle,
    editContent,
    setEditContent,
    handleSaveManualEdit,
    setShowRewriteModal,
    setShowSplitModal,
    panelHeightPercent,
    isResizingPanelHeight,
    setIsResizingPanelHeight,
  } = usePresentation();

  if (!currentSlide) return null;

  const isPanelFull = currentSlide.contentLayout === "panel-full";

  if (isPanelFull) {
    const titleHeightPercent = 100 - panelHeightPercent;
    return (
      <>
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 h-full relative">
            <div
              className="px-8 pt-6 pb-4 border-stone-100 dark:border-border flex items-start justify-between gap-4 overflow-hidden"
            style={{ flex: `0 0 ${titleHeightPercent}%`, minHeight: 0, borderBottomWidth: isResizingPanelHeight ? 0 : 1 }}
          >
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Título"
                    className="font-serif italic text-stone-900 dark:text-foreground leading-tight bg-transparent border-b border-stone-200 dark:border-border focus:outline-none focus:border-emerald-500 w-full"
                    style={{ fontSize: "var(--slide-title)" }}
                  />
                  <input
                    type="text"
                    value={editSubtitle}
                    onChange={(e) => setEditSubtitle(e.target.value)}
                    placeholder="Subtítulo o descripción (opcional)"
                    className="text-stone-500 dark:text-stone-400 bg-transparent border-b border-stone-100 dark:border-border focus:outline-none focus:border-emerald-500 w-full text-sm"
                  />
                </>
              ) : (
                <>
                  <h2
                    className="font-serif italic text-stone-900 dark:text-stone-100 leading-tight cursor-text hover:bg-stone-50 dark:hover:bg-stone-800 rounded px-1 -mx-1 py-0.5 transition-colors"
                    style={{ fontSize: "var(--slide-title)" }}
                    onClick={() => setIsEditing(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setIsEditing(true)}
                    title="Clic para editar"
                  >
                    {currentSlide.title || "Sin título"}
                  </h2>
                  {currentSlide.subtitle ? (
                    <p
                      className="text-stone-500 dark:text-stone-300 text-sm cursor-text hover:bg-stone-50 dark:hover:bg-stone-800 rounded px-1 -mx-1 py-0.5 transition-colors"
                      onClick={() => setIsEditing(true)}
                      role="button"
                      tabIndex={0}
                      title="Clic para editar subtítulo"
                    >
                      {currentSlide.subtitle}
                    </p>
                  ) : (
                    <p
                      className="text-stone-400 dark:text-stone-500 text-sm italic cursor-text hover:bg-stone-50 dark:hover:bg-stone-800 rounded px-1 -mx-1 py-0.5"
                      onClick={() => setIsEditing(true)}
                      role="button"
                      tabIndex={0}
                    >
                      Clic para añadir subtítulo (opcional)
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  if (isEditing) handleSaveManualEdit();
                  else setIsEditing(true);
                }}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isEditing
                    ? "bg-emerald-600 text-white"
                    : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-emerald-600 dark:hover:text-emerald-400"
                )}
                title={isEditing ? "Guardar cambios" : "Editar"}
              >
                {isEditing ? <Check size={16} /> : <Pencil size={16} />}
              </button>
              {isEditing && (
                <button
                  onClick={handleSaveManualEdit}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 dark:hover:bg-emerald-500"
                >
                  <Save size={14} />
                </button>
              )}
            </div>
          </div>
          <div
            className="absolute left-0 right-0 h-1.5 cursor-row-resize flex items-center justify-center z-30 group/handle hover:bg-emerald-500/20 transition-colors"
            style={{ top: `${titleHeightPercent}%`, transform: "translateY(-50%)" }}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingPanelHeight(true);
            }}
            title="Arrastra para ajustar el tamaño del panel"
          >
            <div className="w-12 h-0.5 bg-stone-300 group-hover/handle:bg-emerald-500 rounded-full" />
          </div>
          <div className="min-h-0 flex-1 flex flex-col relative overflow-hidden">
            <SlideRightPanel fullWidth />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex-1 p-12 flex flex-col overflow-hidden">
        <div className="mb-8 shrink-0 flex items-start justify-between">
          <div className="flex-1 mr-4">
            <span
              className="uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 font-bold mb-2 block"
              style={{ fontSize: "var(--slide-label)" }}
            >
              Sección {currentIndex + 1}
            </span>
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="font-serif italic text-stone-900 dark:text-foreground leading-tight bg-transparent border-b border-stone-200 dark:border-border focus:outline-none focus:border-emerald-500 w-full"
                style={{ fontSize: "var(--slide-title)" }}
              />
            ) : (
              <h2
                className="font-serif italic text-stone-900 dark:text-stone-100 leading-tight cursor-text hover:bg-stone-50 dark:hover:bg-stone-800 rounded px-1 -mx-1 py-0.5 transition-colors"
                style={{ fontSize: "var(--slide-title)" }}
                onClick={() => setIsEditing(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setIsEditing(true)}
                title="Clic para editar el título"
              >
                {currentSlide.title || "Sin título"}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (isEditing) {
                  handleSaveManualEdit();
                } else {
                  setIsEditing(true);
                }
              }}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                isEditing
                  ? "bg-emerald-600 text-white"
                  : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-emerald-600 dark:hover:text-emerald-400"
              )}
              title={isEditing ? "Guardar cambios" : "Editar"}
            >
              {isEditing ? <Check size={16} /> : <Pencil size={16} />}
            </button>
            <button
              onClick={() => setShowRewriteModal(true)}
              className="p-1.5 rounded-md text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              title="Replantear"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setShowSplitModal(true)}
              className="p-1.5 rounded-md text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
              title="Dividir"
            >
              <Split size={16} />
            </button>
          </div>
        </div>
        <div
          className={cn(
            "flex-1 min-h-[120px] pr-4 flex flex-col min-w-0",
            !isEditing && "overflow-y-auto custom-scrollbar"
          )}
        >
          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Escribe el contenido de la diapositiva (markdown)..."
              className="flex-1 min-h-[120px] w-full p-4 bg-stone-50 dark:bg-surface border border-stone-200 dark:border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none font-sans text-lg text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500"
            />
          ) : (
            <div
              className="min-h-[80px] cursor-text rounded-lg hover:bg-stone-50/80 dark:hover:bg-stone-800/80 transition-colors -m-1 p-1"
              onClick={() => setIsEditing(true)}
              onKeyDown={(e) => e.key === "Enter" && setIsEditing(true)}
              role="button"
              tabIndex={0}
              title="Clic para editar el contenido"
            >
              {currentSlide.content?.trim() ? (
                <SlideMarkdown>{formatMarkdown(currentSlide.content)}</SlideMarkdown>
              ) : (
                <p className="text-stone-400 dark:text-stone-500 italic p-2">Clic para escribir el contenido…</p>
              )}
            </div>
          )}
        </div>
        {isEditing && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSaveManualEdit}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Save size={16} />
              Guardar cambios
            </button>
          </div>
        )}
      </div>
      {(currentSlide.contentLayout ?? "split") === "split" && <SlideRightPanel />}
    </>
  );
}
