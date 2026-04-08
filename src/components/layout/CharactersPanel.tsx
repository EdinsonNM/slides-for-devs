import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, UserPlus, User, Trash2, Info } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { CharacterDetailModal } from "../modals/CharacterDetailModal";
import { cn } from "../../utils/cn";

interface CharactersPanelProps {
  variant?: "toolbar" | "inspector";
}

export function CharactersPanel({ variant = "toolbar" }: CharactersPanelProps) {
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

  const visible = variant === "inspector" || showCharactersPanel;
  if (!visible) return null;

  const list = (
    <>
      <div
        className={cn(
          "px-3 py-2.5 flex items-center justify-between gap-3 border-b shrink-0",
          variant === "inspector"
            ? "border-stone-100 bg-stone-50/60 dark:border-border dark:bg-surface"
            : "border-stone-100 dark:border-border bg-white dark:bg-surface-elevated",
        )}
      >
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            variant === "inspector"
              ? "text-muted-foreground"
              : "text-stone-500 dark:text-muted-foreground",
          )}
        >
          Personajes
        </span>
        {variant === "toolbar" && (
          <button
            type="button"
            onClick={() => setShowCharactersPanel(false)}
            className="p-1.5 rounded-lg text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-600 dark:hover:text-foreground transition-colors"
            title="Cerrar panel"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div
        className={cn(
          "gap-3 px-3 py-3 min-h-0 flex-1",
          variant === "inspector"
            ? "grid grid-cols-2 content-start justify-items-stretch gap-3 overflow-y-auto overflow-x-hidden"
            : "flex overflow-x-auto scroll-smooth snap-x snap-mandatory carousel-no-scrollbar",
        )}
      >
            <button
              type="button"
              onClick={openCreator}
              className={cn(
                "rounded-xl border-2 border-dashed border-stone-300 dark:border-stone-600",
                "flex flex-col items-center justify-center gap-2 text-stone-500 dark:text-stone-400",
                "hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-900/40 hover:text-violet-600 dark:hover:text-violet-400 transition-colors",
                variant === "inspector"
                  ? "min-h-30 w-full min-w-0 px-2 py-3"
                  : "shrink-0 w-28 min-h-30 snap-start",
              )}
            >
              <UserPlus size={28} />
              <span className="text-xs font-medium text-center px-1 leading-snug">
                Crear nuevo personaje
              </span>
            </button>
            {savedCharacters.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "flex min-w-0 flex-col rounded-xl border-2 border-stone-200 dark:border-border overflow-hidden bg-stone-50/50 dark:bg-surface",
                  "transition-all hover:border-stone-300 dark:hover:border-stone-600 hover:shadow-sm",
                  variant === "inspector" ? "w-full" : "shrink-0 w-28 snap-start",
                )}
              >
                <button
                  type="button"
                  onClick={() => setDetailCharacter(c)}
                  className="w-full flex flex-col items-stretch text-left min-w-0"
                >
                  {c.referenceImageDataUrl ? (
                    <div className="relative w-full aspect-4/5 bg-stone-100 dark:bg-stone-800">
                      <img
                        src={c.referenceImageDataUrl}
                        alt={c.name}
                        className="h-full w-full object-contain object-center"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-4/5 w-full items-center justify-center bg-stone-100 dark:bg-stone-700">
                      <User size={28} className="text-stone-400 dark:text-stone-500" />
                    </div>
                  )}
                  <div className="p-1.5 flex items-center justify-between gap-1 min-w-0">
                    <span className="text-xs font-medium text-stone-700 dark:text-foreground truncate flex-1 text-left">
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
    </>
  );

  if (variant === "inspector") {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white dark:bg-surface-elevated">
          {list}
        </div>
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
          {list}
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
