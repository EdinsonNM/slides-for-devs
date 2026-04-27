import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Send, Loader2, Wand2, Users, User } from "lucide-react";
import type { SavedCharacter } from "../../types";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { IMAGE_STYLES } from "../../constants/imageStyles";
import { CharacterManagerModal } from "./CharacterManagerModal";
import { cn } from "../../utils/cn";

export function ImageGenerationModal() {
  const {
    showImageModal,
    setShowImageModal,
    currentSlide,
    imagePrompt,
    setImagePrompt,
    selectedStyle,
    setSelectedStyle,
    imageProvider,
    setImageProvider,
    geminiImageModelId,
    setGeminiImageModelId,
    geminiImageModels,
    includeBackground,
    setIncludeBackground,
    isGeneratingImage,
    handleImageGenerate,
    isGeneratingPromptAlternatives,
    handleGeneratePromptAlternatives,
    hasGemini,
    hasOpenAI,
    selectedCharacterId,
    setSelectedCharacterId,
    savedCharacters,
    saveCharacter,
    deleteCharacter,
    cloudSyncAvailable,
    handlePushAllCharactersToCloud,
    handlePullCharactersFromCloud,
    isSyncingCharactersCloud,
    generateCharacterPreview,
    refreshSavedCharacters,
  } = usePresentation();

  const [showCharacterManager, setShowCharacterManager] = useState(false);

  const canGenerateWithAI = hasGemini || hasOpenAI;

  const handleRegenerateCharacterReference = async (character: SavedCharacter) => {
    const url = await generateCharacterPreview(character.description.trim());
    if (!url?.trim()) {
      alert("No se pudo regenerar la imagen. Comprueba tu API key de Gemini u OpenAI.");
      return;
    }
    await saveCharacter({
      ...character,
      referenceImageDataUrl: url,
    });
    refreshSavedCharacters();
  };

  return (
    <AnimatePresence>
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={() => !isGeneratingImage && setShowImageModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-surface-elevated rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-4 border-b border-stone-100 dark:border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900 dark:text-foreground">Generar imagen</h3>
                  <p className="text-xs text-stone-500 dark:text-muted-foreground">Genera una imagen con IA para este slide</p>
                </div>
              </div>
              <button
                onClick={() => setShowImageModal(false)}
                className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors text-stone-400 dark:text-stone-500"
                disabled={isGeneratingImage}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto min-h-0 flex-1">
              {!canGenerateWithAI ? (
                <p className="text-sm text-stone-600 dark:text-stone-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                  Configura una API key de Gemini u OpenAI en Ajustes para poder generar imágenes con IA.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                        Proveedor
                      </label>
                      <div className={cn(
                        "flex gap-2",
                        hasGemini && hasOpenAI ? "" : ""
                      )}>
                        {hasGemini && (
                          <button
                            type="button"
                            onClick={() => setImageProvider("gemini")}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                              imageProvider === "gemini"
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                                : "bg-white dark:bg-surface border-stone-200 dark:border-border text-stone-600 dark:text-foreground hover:border-emerald-500 dark:hover:border-emerald-500"
                            )}
                          >
                            Gemini
                          </button>
                        )}
                        {hasOpenAI && (
                          <button
                            type="button"
                            onClick={() => setImageProvider("openai")}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                              imageProvider === "openai"
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                                : "bg-white dark:bg-surface border-stone-200 dark:border-border text-stone-600 dark:text-foreground hover:border-emerald-500 dark:hover:border-emerald-500"
                            )}
                          >
                            GPT Image
                          </button>
                        )}
                      </div>
                    </div>
                    {imageProvider === "gemini" && (
                      <div className="space-y-1.5 min-w-[140px]">
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                          Modelo
                        </label>
                        <select
                          value={geminiImageModelId}
                          onChange={(e) => setGeminiImageModelId(e.target.value)}
                          disabled={isGeneratingImage}
                          className="w-full text-sm text-stone-700 dark:text-foreground bg-stone-50 dark:bg-surface border border-stone-200 dark:border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 cursor-pointer"
                        >
                          {geminiImageModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                        Personaje
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowCharacterManager(true)}
                        className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 flex items-center gap-1 shrink-0"
                      >
                        <Users size={12} />
                        Gestionar
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedCharacterId(null)}
                        disabled={isGeneratingImage}
                        className={cn(
                          "shrink-0 w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all",
                          !selectedCharacterId
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                            : "border-stone-200 dark:border-border bg-stone-50 dark:bg-surface text-stone-400 dark:text-stone-500 hover:border-stone-300 dark:hover:border-stone-600"
                        )}
                        title="Ninguno"
                      >
                        <User size={20} />
                        <span className="text-[10px] font-medium mt-0.5 truncate max-w-full px-1">Ninguno</span>
                      </button>
                      {savedCharacters.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCharacterId(c.id)}
                          disabled={isGeneratingImage}
                          className={cn(
                            "shrink-0 w-14 h-14 rounded-xl border-2 overflow-hidden flex flex-col transition-all",
                            selectedCharacterId === c.id
                              ? "border-emerald-500 ring-2 ring-emerald-500/30"
                              : "border-stone-200 dark:border-border hover:border-stone-300 dark:hover:border-stone-500"
                          )}
                          title={c.name}
                        >
                          {c.referenceImageDataUrl ? (
                            <img
                              src={c.referenceImageDataUrl}
                              alt={c.name}
                              className="w-full h-9 object-cover"
                            />
                          ) : (
                            <div className="w-full h-9 bg-stone-100 dark:bg-stone-700 flex items-center justify-center">
                              <User size={18} className="text-stone-400 dark:text-stone-500" />
                            </div>
                          )}
                          <span className="text-[10px] font-medium text-stone-600 dark:text-stone-300 truncate w-full px-1 py-0.5 bg-white dark:bg-surface-elevated">
                            {c.name}
                          </span>
                        </button>
                      ))}
                    </div>
                    {imageProvider === "openai" &&
                      selectedCharacterId &&
                      savedCharacters.find((c) => c.id === selectedCharacterId)?.referenceImageDataUrl && (
                        <p className="text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-surface border border-stone-200 dark:border-border rounded-lg p-2">
                          Se usará la imagen de referencia cuando sea posible. Si la generación falla, se usará la descripción del personaje.
                        </p>
                      )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                      Estilo
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {IMAGE_STYLES.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setSelectedStyle(style)}
                          className={cn(
                            "px-2 py-1.5 rounded-lg text-xs font-medium border transition-all",
                            selectedStyle.id === style.id
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                              : "bg-white dark:bg-surface border-stone-200 dark:border-border text-stone-600 dark:text-foreground hover:border-emerald-500 dark:hover:border-emerald-500"
                          )}
                        >
                          {style.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="include-bg"
                      type="checkbox"
                      checked={includeBackground}
                      onChange={(e) => setIncludeBackground(e.target.checked)}
                      disabled={isGeneratingImage}
                      className="w-3.5 h-3.5 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="include-bg" className="text-xs text-stone-600 dark:text-stone-400 cursor-pointer">
                      Incluir fondo
                    </label>
                  </div>

                  {currentSlide && (
                    <>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                            Contexto
                          </label>
                          <span className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-[60%] italic">
                            &quot;{currentSlide.title}&quot;
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                            Tu Prompt
                          </label>
                          <button
                            type="button"
                            onClick={handleGeneratePromptAlternatives}
                            disabled={
                              isGeneratingImage || isGeneratingPromptAlternatives
                            }
                            title="Generar alternativa"
                            className="p-1 rounded text-stone-400 dark:text-stone-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isGeneratingPromptAlternatives ? (
                              <Loader2 className="animate-spin" size={16} aria-hidden />
                            ) : (
                              <Wand2 size={16} aria-hidden />
                            )}
                          </button>
                        </div>
                        <textarea
                          value={imagePrompt}
                          onChange={(e) => setImagePrompt(e.target.value)}
                          placeholder="Ej: Un astronauta plantando una bandera en Marte..."
                          className="w-full min-h-[72px] max-h-28 p-3 bg-white dark:bg-surface border border-stone-200 dark:border-border rounded-lg text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-y text-sm"
                          disabled={isGeneratingImage}
                          rows={3}
                        />
                      </div>
                    </>
                  )}
                  <button
                    onClick={handleImageGenerate}
                    disabled={isGeneratingImage || !imagePrompt.trim()}
                    className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shrink-0"
                  >
                    {isGeneratingImage ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        Generar imagen
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <CharacterManagerModal
        isOpen={showCharacterManager}
        onClose={() => setShowCharacterManager(false)}
        savedCharacters={savedCharacters}
        onSaveCharacter={saveCharacter}
        onDeleteCharacter={deleteCharacter}
        cloudSyncAvailable={cloudSyncAvailable}
        onPushCharactersToCloud={handlePushAllCharactersToCloud}
        onPullCharactersFromCloud={handlePullCharactersFromCloud}
        isSyncingCharactersCloud={isSyncingCharactersCloud}
        onRegenerateCharacterReference={
          canGenerateWithAI ? handleRegenerateCharacterReference : undefined
        }
      />
    </AnimatePresence>
  );
}
