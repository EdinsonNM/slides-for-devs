import { useState, useRef } from "react";
import { flushSync } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  UserPlus,
  Loader2,
  RefreshCw,
  Check,
  Upload,
  Sparkles,
  ImageIcon,
  Wand2,
} from "lucide-react";
import { usePresentation } from "../../presentation/contexts/PresentationContext";
import { refineCharacterPrompt, describeCharacterFromImage } from "../../services/gemini";
import { cn } from "../../utils/cn";
import { CharacterPromptWizard } from "./CharacterPromptWizard";

type SourceTab = "text" | "image";

export function CharacterCreatorModal() {
  const {
    showCharacterCreatorModal,
    setShowCharacterCreatorModal,
    isGeneratingCharacterPreview,
    generateCharacterPreview,
    selectedStyle,
    saveCharacter,
    setSelectedCharacterId,
    refreshSavedCharacters,
    hasGemini,
    hasOpenAI,
  } = usePresentation();

  const [sourceTab, setSourceTab] = useState<SourceTab>("text");
  const [description, setDescription] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isDescribingImage, setIsDescribingImage] = useState(false);
  const [showPromptWizard, setShowPromptWizard] = useState(false);
  /** Estado local + flushSync: el flag del contexto puede no pintarse antes del await largo. */
  const [isGeneratingCharacterImage, setIsGeneratingCharacterImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasDescription = description.trim().length > 0;
  const canRefineWithGemini =
    hasGemini && hasDescription && sourceTab === "text";
  const canGenerateImage =
    (hasGemini || hasOpenAI) && hasDescription && sourceTab === "text";
  const canUploadImage = hasGemini;
  const isGeneratingImageBusy =
    isGeneratingCharacterPreview || isGeneratingCharacterImage;
  const isBusy =
    isGeneratingImageBusy || isRefining || isDescribingImage;

  const handleRefineDescription = async () => {
    if (!canRefineWithGemini) return;
    const raw = description.trim();
    setIsRefining(true);
    try {
      const refined = await refineCharacterPrompt(raw);
      if (refined) {
        setDescription(refined);
      } else {
        alert(
          "La IA no devolvió una descripción. Prueba a ampliar un poco tu texto o inténtalo de nuevo.",
        );
      }
    } catch (e) {
      console.error("Error refinando prompt:", e);
      alert(
        `No se pudo afinar la descripción: ${e instanceof Error ? e.message : "error desconocido"}`,
      );
    } finally {
      setIsRefining(false);
    }
  };

  const handleGenerateImagePreview = async () => {
    if (!canGenerateImage || isGeneratingImageBusy) return;
    flushSync(() => {
      setIsGeneratingCharacterImage(true);
    });
    try {
      const promptToUse = description.trim();
      const url = await generateCharacterPreview(promptToUse);
      if (url) {
        setPreviewUrl((prev) => {
          if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
          return url;
        });
      } else {
        alert("No se pudo generar la vista previa. Comprueba tu descripción y API key.");
      }
    } finally {
      setIsGeneratingCharacterImage(false);
    }
  };

  const handleReferenceImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return dataUrl;
    });
    if (!hasGemini) return;
    setIsDescribingImage(true);
    try {
      const desc = await describeCharacterFromImage(dataUrl);
      if (desc) setDescription(desc);
    } catch (err) {
      console.error("Error describiendo imagen:", err);
      alert("No se pudo extraer la descripción del personaje. Comprueba que la imagen sea válida y que tengas configurada la API de Gemini.");
    } finally {
      setIsDescribingImage(false);
    }
    fileInputRef.current?.form?.reset();
  };

  /** Convierte blob URL a data URL para poder persistir la imagen del personaje. */
  const toDataUrlIfBlob = async (url: string): Promise<string | undefined> => {
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
  };

  const handleSaveAsCharacter = async () => {
    const trimmedName = name.trim();
    let trimmedDesc = description.trim();

    let referenceImageDataUrl: string | undefined;
    if (previewUrl) {
      referenceImageDataUrl = previewUrl.startsWith("data:")
        ? previewUrl
        : await toDataUrlIfBlob(previewUrl);
    }

    if (referenceImageDataUrl && !trimmedDesc && hasGemini) {
      setIsSaving(true);
      try {
        const desc = await describeCharacterFromImage(referenceImageDataUrl);
        if (desc?.trim()) trimmedDesc = desc.trim();
      } catch (err) {
        console.error("Error describiendo personaje desde imagen:", err);
        alert(
          "No se pudo generar la descripción del personaje desde la imagen. Añade una descripción manualmente para guardar (útil para generación con OpenAI)."
        );
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    }

    if (!trimmedName || !trimmedDesc) {
      if (referenceImageDataUrl && !trimmedDesc) {
        alert("Añade una descripción del personaje para guardar. Con OpenAI se usará esta descripción cuando no se pueda enviar la imagen de referencia.");
      }
      return;
    }
    setIsSaving(true);
    try {
      const id = crypto.randomUUID();
      await saveCharacter({
        id,
        name: trimmedName,
        description: trimmedDesc,
        referenceImageDataUrl,
      });
      refreshSavedCharacters();
      setSelectedCharacterId(id);
      setShowCharacterCreatorModal(false);
      setDescription("");
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      setName("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setShowPromptWizard(false);
    setShowCharacterCreatorModal(false);
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    setDescription("");
    setName("");
    setSourceTab("text");
  };

  if (!showCharacterCreatorModal) return null;

  return (
    <>
      <CharacterPromptWizard
        open={showPromptWizard}
        onClose={() => setShowPromptWizard(false)}
        onApply={(text) => {
          setDescription(text);
          setSourceTab("text");
        }}
        editorStyleName={selectedStyle.name}
        disabled={isBusy}
      />
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
          onClick={() => !isBusy && handleClose()}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-white dark:bg-surface-elevated rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-stone-100 dark:border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <UserPlus size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-stone-900 dark:text-foreground">Crear personaje</h3>
                <p className="text-xs text-stone-500 dark:text-muted-foreground">
                  Descripción a la izquierda; vista previa a la derecha. Afinar texto e imagen por separado.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isBusy}
              className="p-2 shrink-0 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors text-stone-400 dark:text-stone-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-col md:flex-row flex-1 min-h-0">
            <div className="flex-1 min-w-0 overflow-y-auto p-5 sm:p-6 space-y-6">
            {!(hasGemini || hasOpenAI) ? (
              <p className="text-sm text-stone-600 dark:text-stone-200 bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                Configura una API key de Gemini u OpenAI en Ajustes para generar el personaje.
              </p>
            ) : (
              <>
                <div className="flex border-b border-stone-100 dark:border-border">
                  <button
                    type="button"
                    onClick={() => setSourceTab("text")}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-medium transition-colors",
                      sourceTab === "text"
                        ? "text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 dark:border-violet-400"
                        : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                    )}
                  >
                    Describir con texto
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceTab("image")}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                      sourceTab === "image"
                        ? "text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 dark:border-violet-400"
                        : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                    )}
                  >
                    <Upload size={16} />
                    Imagen de referencia
                  </button>
                </div>

                {sourceTab === "image" && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                      Sube una imagen de tu personaje
                    </label>
                    <p className="text-xs text-stone-500 dark:text-muted-foreground">
                      Si ya tienes una imagen del personaje, súbela y la descripción se generará automáticamente (requiere Gemini).
                    </p>
                    <form>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleReferenceImageChange}
                        disabled={!canUploadImage || isBusy}
                        className="block w-full text-sm text-stone-600 dark:text-stone-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 file:dark:bg-violet-900/40 file:dark:text-violet-300 hover:file:dark:bg-violet-900/60 file:cursor-pointer cursor-pointer"
                      />
                    </form>
                    {isDescribingImage && (
                      <p className="text-sm text-stone-500 dark:text-muted-foreground flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        Extrayendo descripción del personaje…
                      </p>
                    )}
                    {!hasGemini && (
                      <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                        La imagen de referencia requiere API de Gemini para extraer la descripción.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                      {sourceTab === "image" ? "Descripción generada (editable)" : "Descripción del personaje"}
                    </label>
                    {sourceTab === "text" && (
                      <button
                        type="button"
                        onClick={() => setShowPromptWizard(true)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium px-2.5 py-1 rounded-lg border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 bg-violet-50/80 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-45 disabled:pointer-events-none transition-colors"
                      >
                        <Wand2 size={14} className="shrink-0" aria-hidden />
                        Asistente paso a paso
                      </button>
                    )}
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      sourceTab === "text"
                        ? "Ej: Humanoide blanco estilo cartoon, cabeza cuadrada, mochila marrón. Puedes usar «Afinar descripción» con Gemini o generar la imagen tal cual."
                        : "Sube una imagen o escribe una descripción."
                    }
                    rows={4}
                    disabled={isBusy}
                    className="w-full text-sm text-stone-700 dark:text-foreground bg-stone-50 dark:bg-surface border border-stone-200 dark:border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 resize-none placeholder:text-stone-400 dark:placeholder:text-stone-500"
                  />
                  {sourceTab === "text" && (
                    <p className="text-xs text-stone-500 dark:text-muted-foreground">
                      El estilo del editor (<span className="font-medium">{selectedStyle.name}</span>) es
                      referencia suave; lo que describas (p. ej. 3D, isométrico, pixel art) prevalece. «Afinar»
                      solo mejora el texto (Gemini); «Generar imagen» usa tu proveedor de imágenes.
                    </p>
                  )}
                </div>

                {sourceTab === "text" && (
                  <div className="rounded-xl border border-stone-200 dark:border-border bg-stone-50/80 dark:bg-surface/80 p-4 space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-muted-foreground">
                        1 · Descripción (texto)
                      </p>
                      <p className="text-xs text-stone-600 dark:text-stone-400">
                        Opcional: convierte notas sueltas en un prompt estable para el mismo personaje en
                        todas las escenas. No gasta generación de imagen.
                      </p>
                      <button
                        type="button"
                        onClick={handleRefineDescription}
                        disabled={!canRefineWithGemini || isRefining || isGeneratingImageBusy}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border text-stone-800 dark:text-foreground hover:bg-stone-100 dark:hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isRefining ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            Afinando descripción…
                          </>
                        ) : (
                          <>
                            <Sparkles size={18} className="text-violet-600 dark:text-violet-400" />
                            Afinar descripción con IA
                          </>
                        )}
                      </button>
                      {!hasGemini && (
                        <p className="text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800 rounded-lg px-2 py-1.5">
                          Afinar requiere API de Gemini. Con solo OpenAI puedes escribir la descripción a
                          mano y usar «Generar imagen».
                        </p>
                      )}
                    </div>

                    <div className="h-px bg-stone-200 dark:bg-border" />

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-muted-foreground">
                        2 · Imagen del personaje
                      </p>
                      <p className="text-xs text-stone-600 dark:text-stone-400">
                        Genera la vista previa con la descripción que ves arriba (refinada o no).
                      </p>
                      <button
                        type="button"
                        onClick={handleGenerateImagePreview}
                        disabled={!canGenerateImage || isGeneratingImageBusy}
                        aria-busy={isGeneratingImageBusy}
                        className={cn(
                          "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                          "disabled:pointer-events-none",
                          !canGenerateImage && !isGeneratingImageBusy && "opacity-50 cursor-not-allowed",
                          isGeneratingImageBusy &&
                            cn(
                              "cursor-wait opacity-100 disabled:opacity-100 shadow-lg motion-safe:animate-pulse",
                              previewUrl
                                ? "ring-2 ring-stone-400/90 dark:ring-stone-500 ring-offset-2 ring-offset-stone-100 dark:ring-offset-stone-800"
                                : "shadow-violet-900/25 ring-2 ring-white/80 ring-offset-2 ring-offset-violet-600",
                            ),
                          previewUrl
                            ? "bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-600"
                            : "bg-violet-600 text-white hover:bg-violet-700 dark:hover:bg-violet-500",
                        )}
                      >
                        {isGeneratingImageBusy ? (
                          <>
                            {previewUrl ? (
                              <RefreshCw
                                size={20}
                                className="shrink-0 animate-spin text-current"
                                aria-hidden
                              />
                            ) : (
                              <Loader2
                                size={20}
                                className="shrink-0 animate-spin text-current"
                                aria-hidden
                              />
                            )}
                            <span className="tabular-nums">Generando imagen…</span>
                          </>
                        ) : previewUrl ? (
                          <>
                            <RefreshCw
                              size={18}
                              className={cn(
                                "shrink-0",
                                canGenerateImage && "motion-safe:animate-pulse",
                              )}
                              aria-hidden
                            />
                            Generar otra imagen
                          </>
                        ) : (
                          <>
                            <span
                              className={cn(
                                "inline-flex shrink-0 text-white",
                                canGenerateImage && "motion-safe:animate-pulse motion-safe:drop-shadow-sm",
                                !canGenerateImage && "opacity-55",
                              )}
                              aria-hidden
                            >
                              <ImageIcon size={18} strokeWidth={2.25} />
                            </span>
                            Generar imagen
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {(hasGemini || hasOpenAI) && (
                  <div className="space-y-3 pt-2 border-t border-stone-100 dark:border-border md:hidden">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                      Vista previa
                    </span>
                    <div className="relative rounded-xl border-2 border-stone-200 dark:border-border overflow-hidden bg-stone-50 dark:bg-surface aspect-square max-w-[280px] mx-auto">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Vista previa del personaje"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-stone-400 dark:text-stone-500">
                          <ImageIcon size={36} className="opacity-45 shrink-0" aria-hidden />
                          <p className="text-xs">Pulsa «Generar imagen» o sube una referencia</p>
                        </div>
                      )}
                      {isGeneratingImageBusy && (
                        <div
                          className="absolute inset-0 bg-stone-900/45 dark:bg-black/55 flex items-center justify-center"
                          aria-busy
                        >
                          <Loader2
                            className="animate-spin text-violet-600 dark:text-violet-400"
                            size={28}
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 dark:text-muted-foreground text-center">
                      {previewUrl
                        ? sourceTab === "image"
                          ? "Revisa la descripción, ponle nombre y guárdalo."
                          : "Si te convence, ponle nombre y guárdalo."
                        : "En pantalla grande la vista previa está a la derecha."}
                    </p>
                  </div>
                )}

                {previewUrl && (
                  <div className="space-y-3 pt-2 border-t border-stone-100 dark:border-border">
                    {sourceTab === "image" && !description.trim() && hasGemini && (
                      <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                        Recomendado: añade o revisa la descripción. Con OpenAI se usará esta descripción cuando no se pueda enviar la imagen de referencia. Si guardas sin descripción, se intentará generarla desde la imagen.
                      </p>
                    )}
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                      Nombre del personaje
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: Presentador"
                      className="w-full text-sm text-stone-700 dark:text-foreground bg-stone-50 dark:bg-surface border border-stone-200 dark:border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 placeholder:text-stone-400 dark:placeholder:text-stone-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveAsCharacter}
                      disabled={isSaving || !name.trim()}
                      className="w-full py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 dark:hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Check size={18} />
                      )}
                      Guardar como personaje
                    </button>
                  </div>
                )}
              </>
            )}
            </div>

            {(hasGemini || hasOpenAI) && (
              <aside className="hidden md:flex md:w-[min(100%,300px)] lg:w-[min(100%,340px)] shrink-0 border-t md:border-t-0 md:border-l border-stone-100 dark:border-border bg-stone-50/70 dark:bg-black/20 flex-col p-5">
                <div className="flex flex-col gap-3 min-h-0 flex-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
                    Vista previa
                  </span>
                  <div className="relative flex-1 min-h-[220px] max-h-[min(52vh,400px)] rounded-xl border-2 border-stone-200 dark:border-border overflow-hidden bg-stone-50 dark:bg-surface flex items-center justify-center">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Vista previa del personaje"
                        className="max-w-full max-h-full w-auto h-auto object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center text-stone-400 dark:text-stone-500">
                        <ImageIcon size={40} className="opacity-45 shrink-0" aria-hidden />
                        <p className="text-xs leading-relaxed">
                          Pulsa «Generar imagen» o sube una imagen de referencia para ver el avatar aquí.
                        </p>
                      </div>
                    )}
                    {isGeneratingImageBusy && (
                      <div
                        className="absolute inset-0 bg-stone-900/45 dark:bg-black/55 flex items-center justify-center"
                        aria-busy
                      >
                        <Loader2
                          className="animate-spin text-violet-600 dark:text-violet-400"
                          size={32}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 dark:text-muted-foreground leading-relaxed">
                    {previewUrl
                      ? sourceTab === "image"
                        ? "Revisa la descripción a la izquierda y guarda cuando esté listo."
                        : "Nombre y guardado en el panel izquierdo."
                      : "Vista previa del personaje generado o subido."}
                  </p>
                </div>
              </aside>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
    </>
  );
}
