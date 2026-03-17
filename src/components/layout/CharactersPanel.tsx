import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, UserPlus, User, Trash2, Info } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { CharacterDetailModal } from "../modals/CharacterDetailModal";
import { cn } from "../../utils/cn";

export function CharactersPanel() {
  const {
    showCharactersPanel,
    setShowCharactersPanel,
    savedCharacters,
    deleteCharacter,
    setShowCharacterCreatorModal,
  } = usePresentation();

  const [detailCharacter, setDetailCharacter] = useState<typeof savedCharacters[0] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCharacter(id);
      if (detailCharacter?.id === id) setDetailCharacter(null);
    } finally {
      setDeletingId(null);
    }
  };

  const openCreator = () => {
    setShowCharacterCreatorModal(true);
  };

  if (!showCharactersPanel) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-surface-elevated border-b border-stone-200 dark:border-border shrink-0 overflow-hidden"
        >
          <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-stone-100 dark:border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-muted-foreground">
              Personajes
            </span>
            <button
              type="button"
              onClick={() => setShowCharactersPanel(false)}
              className="p-1.5 rounded-lg text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-600 dark:hover:text-foreground transition-colors"
              title="Cerrar panel"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 py-3 scroll-smooth snap-x snap-mandatory carousel-no-scrollbar">
            <button
              type="button"
              onClick={openCreator}
              className={cn(
                "shrink-0 w-24 h-28 rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-600",
                "flex flex-col items-center justify-center gap-2 text-stone-500 dark:text-stone-400",
                "hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-900/40 hover:text-violet-600 dark:hover:text-violet-400 transition-colors snap-start"
              )}
            >
              <UserPlus size={28} />
              <span className="text-xs font-medium text-center px-1">Crear nuevo personaje</span>
            </button>
            {savedCharacters.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "shrink-0 w-24 snap-start flex flex-col rounded-xl border-2 border-stone-200 dark:border-border overflow-hidden bg-stone-50/50 dark:bg-surface",
                  "transition-all hover:border-stone-300 dark:hover:border-stone-600 hover:shadow-sm"
                )}
              >
                <button
                  type="button"
                  onClick={() => setDetailCharacter(c)}
                  className="flex-1 min-h-0 w-full flex flex-col items-stretch text-left"
                >
                  {c.referenceImageDataUrl ? (
                    <img
                      src={c.referenceImageDataUrl}
                      alt={c.name}
                      className="w-full h-16 object-cover"
                    />
                  ) : (
                    <div className="w-full h-16 bg-stone-100 dark:bg-stone-700 flex items-center justify-center">
                      <User size={24} className="text-stone-400 dark:text-stone-500" />
                    </div>
                  )}
                  <div className="p-1.5 flex items-center justify-between gap-1 min-w-0">
                    <span className="text-xs font-medium text-stone-700 dark:text-foreground truncate flex-1">
                      {c.name}
                    </span>
                    <span
                      className="shrink-0 p-0.5 rounded text-stone-400 dark:text-stone-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/40"
                      title="Ver detalle"
                    >
                      <Info size={12} />
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c.id);
                  }}
                  disabled={deletingId === c.id}
                  className="p-1.5 flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 border-t border-stone-100 dark:border-border"
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <CharacterDetailModal
        character={detailCharacter}
        onClose={() => setDetailCharacter(null)}
        onDelete={(id) => handleDelete(id)}
        onRegenerateSuccess={(c) => setDetailCharacter(c)}
        isDeleting={deletingId !== null}
      />
    </>
  );
}
