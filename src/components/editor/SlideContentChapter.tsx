import { motion } from "motion/react";
import { usePresentation } from "../../context/PresentationContext";

export function SlideContentChapter() {
  const {
    currentSlide,
    isEditing,
    editTitle,
    setEditTitle,
    handleSaveManualEdit,
  } = usePresentation();

  if (!currentSlide) return null;

  return (
    <div className="text-center p-12 space-y-6 overflow-y-auto max-h-full w-full">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 60 }}
        className="h-1 bg-emerald-600 mx-auto rounded-full"
      />
      {isEditing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="font-serif italic text-stone-900 leading-tight text-center bg-transparent border-b border-stone-200 focus:outline-none focus:border-emerald-500 w-full"
          style={{ fontSize: "var(--slide-title-chapter)" }}
        />
      ) : (
        <h1
          className="font-serif italic text-stone-900 leading-tight"
          style={{ fontSize: "var(--slide-title-chapter)" }}
        >
          {currentSlide.title}
        </h1>
      )}
      {currentSlide.subtitle && (
        <p
          className="text-stone-500 font-light tracking-wide uppercase"
          style={{ fontSize: "var(--slide-subtitle)" }}
        >
          {currentSlide.subtitle}
        </p>
      )}
      {isEditing && (
        <button
          onClick={handleSaveManualEdit}
          className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
        >
          Guardar Diapositiva
        </button>
      )}
    </div>
  );
}
