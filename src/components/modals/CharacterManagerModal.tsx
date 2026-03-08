import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, UserPlus, Trash2, Users } from "lucide-react";
import type { SavedCharacter } from "../../types";
import { cn } from "../../utils/cn";

interface CharacterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedCharacters: SavedCharacter[];
  onSaveCharacter: (character: SavedCharacter) => Promise<void>;
  onDeleteCharacter: (id: string) => Promise<void>;
}

export function CharacterManagerModal({
  isOpen,
  onClose,
  savedCharacters,
  onSaveCharacter,
  onDeleteCharacter,
}: CharacterManagerModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSaveNew = async () => {
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    if (!trimmedName || !trimmedDesc) return;
    setIsSaving(true);
    try {
      await onSaveCharacter({
        id: crypto.randomUUID(),
        name: trimmedName,
        description: trimmedDesc,
      });
      setName("");
      setDescription("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteCharacter(id);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          <div className="p-6 border-b border-stone-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-medium text-stone-900">Personajes</h3>
                <p className="text-xs text-stone-500">
                  Guarda personajes para reutilizarlos en todas las imágenes
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                <UserPlus size={14} />
                Nuevo personaje
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre (ej: Presentador)"
                className="w-full text-sm text-stone-700 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción para el prompt (ej: humanoide blanco estilo cartoon, cabeza cuadrada, mochila marrón, mismo personaje en todas las escenas)"
                rows={3}
                className="w-full text-sm text-stone-700 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 resize-none"
              />
              <button
                type="button"
                onClick={handleSaveNew}
                disabled={isSaving || !name.trim() || !description.trim()}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? "Guardando…" : "Guardar personaje"}
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Personajes guardados ({savedCharacters.length})
              </span>
              <ul className="space-y-2">
                {savedCharacters.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      "flex items-start gap-2 p-3 rounded-xl border border-stone-200 bg-stone-50/50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-900 text-sm">{c.name}</p>
                      <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">
                        {c.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 shrink-0"
                      title="Eliminar personaje"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
                {savedCharacters.length === 0 && (
                  <li className="text-sm text-stone-500 italic py-2">
                    Aún no hay personajes. Crea uno arriba para usarlo en las imágenes.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
