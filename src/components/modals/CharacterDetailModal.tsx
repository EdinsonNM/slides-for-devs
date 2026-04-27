import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Trash2, User, RefreshCw, Loader2 } from "lucide-react";
import type { SavedCharacter } from "../../types";
import { usePresentation } from "@/presentation/contexts/PresentationContext";

interface CharacterDetailModalProps {
  character: SavedCharacter | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRegenerateSuccess?: (character: SavedCharacter) => void;
  isDeleting?: boolean;
}

async function toDataUrlIfNeeded(url: string): Promise<string | undefined> {
  if (url.startsWith("data:")) return url;
  if (!url.startsWith("blob:")) return undefined;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

export function CharacterDetailModal({
  character,
  onClose,
  onDelete,
  onRegenerateSuccess,
  isDeleting = false,
}: CharacterDetailModalProps) {
  const {
    generateCharacterPreview,
    saveCharacter,
    refreshSavedCharacters,
    hasGemini,
    hasOpenAI,
  } = usePresentation();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const canRegenerate = (hasGemini || hasOpenAI) && character?.description?.trim();

  const handleRegenerateImage = async () => {
    if (!character?.description?.trim() || !canRegenerate) return;
    setIsRegenerating(true);
    try {
      const url = await generateCharacterPreview(character.description.trim());
      const dataUrl = url ? await toDataUrlIfNeeded(url) : undefined;
      if (dataUrl) {
        const updated: SavedCharacter = {
          ...character,
          referenceImageDataUrl: dataUrl,
        };
        await saveCharacter(updated);
        refreshSavedCharacters();
        onRegenerateSuccess?.(updated);
      } else {
        alert("No se pudo generar la imagen. Comprueba tu API key de Gemini u OpenAI.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al generar la imagen del personaje.");
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!character) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-medium text-stone-900">Detalle del personaje</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
            >
              <X size={18} />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex flex-col items-center gap-2 w-full">
              {character.referenceImageDataUrl ? (
                <div className="w-28 h-28 rounded-xl overflow-hidden border border-stone-200 shrink-0">
                  <img
                    src={character.referenceImageDataUrl}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : canRegenerate ? (
                <button
                  type="button"
                  onClick={handleRegenerateImage}
                  disabled={isRegenerating}
                  className="w-28 h-28 rounded-xl bg-stone-100 border-2 border-dashed border-stone-200 flex items-center justify-center hover:bg-violet-50 hover:border-violet-200 text-stone-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Generar imagen de referencia"
                >
                  {isRegenerating ? (
                    <Loader2 size={32} className="animate-spin text-violet-600" />
                  ) : (
                    <RefreshCw size={28} className="text-stone-400 hover:text-violet-600" />
                  )}
                </button>
              ) : (
                <div className="w-28 h-28 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200 shrink-0">
                  <User size={40} className="text-stone-400" />
                </div>
              )}
              {character.referenceImageDataUrl && canRegenerate ? (
                <button
                  type="button"
                  onClick={handleRegenerateImage}
                  disabled={isRegenerating}
                  className="w-full py-2 rounded-xl border border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {isRegenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-violet-600" />
                      Regenerando…
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} className="text-violet-600" />
                      Regenerar imagen
                    </>
                  )}
                </button>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">
                Nombre
              </p>
              <p className="text-sm font-medium text-stone-900">{character.name}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">
                Descripción (prompt)
              </p>
              <p className="text-sm text-stone-600 whitespace-pre-wrap">
                {character.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(character.id)}
              disabled={isDeleting}
              className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                "Eliminando…"
              ) : (
                <>
                  <Trash2 size={16} />
                  Eliminar personaje
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
