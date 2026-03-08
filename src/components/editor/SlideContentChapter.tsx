import { motion } from "motion/react";
import { Pencil, Check } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";

export function SlideContentChapter() {
  const {
    currentSlide,
    isEditing,
    setIsEditing,
    editTitle,
    setEditTitle,
    editSubtitle,
    setEditSubtitle,
    handleSaveManualEdit,
  } = usePresentation();

  if (!currentSlide) return null;

  return (
    <div className="text-center p-12 space-y-6 overflow-y-auto max-h-full w-full flex flex-col items-center">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 60 }}
        className="h-1 bg-emerald-600 rounded-full shrink-0"
      />
      <div className="flex flex-col items-center gap-3 w-full max-w-3xl">
        {isEditing ? (
          <div className="space-y-4 w-full">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Título del capítulo"
              className="font-serif italic text-stone-900 leading-tight text-center bg-transparent border-b border-stone-200 focus:outline-none focus:border-emerald-500 w-full py-1"
              style={{ fontSize: "var(--slide-title-chapter)" }}
              autoFocus
            />
            <input
              type="text"
              value={editSubtitle}
              onChange={(e) => setEditSubtitle(e.target.value)}
              placeholder="Subtítulo (opcional)"
              className="text-stone-500 font-light tracking-wide uppercase text-center bg-transparent border-b border-stone-100 focus:outline-none focus:border-emerald-400 w-full py-1 text-sm"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 w-full">
            <h1
              className="font-serif italic text-stone-900 leading-tight cursor-text hover:bg-stone-50 rounded px-3 py-1 transition-colors"
              style={{ fontSize: "var(--slide-title-chapter)" }}
              onClick={() => setIsEditing(true)}
              onKeyDown={(e) => e.key === "Enter" && setIsEditing(true)}
              role="button"
              tabIndex={0}
              title="Clic para editar el título"
            >
              {currentSlide.title || "Sin título"}
            </h1>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={cn(
                "p-1.5 rounded-md transition-colors shrink-0",
                "text-stone-500 hover:bg-stone-100 hover:text-emerald-600"
              )}
              title="Editar título"
            >
              <Pencil size={18} />
            </button>
          </div>
        )}
        {currentSlide.subtitle && !isEditing && (
          <p
            className="text-stone-500 font-light tracking-wide uppercase"
            style={{ fontSize: "var(--slide-subtitle)" }}
          >
            {currentSlide.subtitle}
          </p>
        )}
      </div>
      {isEditing && (
        <button
          onClick={handleSaveManualEdit}
          className="mt-2 flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
        >
          <Check size={18} />
          Guardar
        </button>
      )}
    </div>
  );
}
