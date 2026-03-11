import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, UserPlus, Loader2, RefreshCw, Check, Upload } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { refineCharacterPrompt, describeCharacterFromImage } from "../../services/gemini";
import { cn } from "../../utils/cn";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canGenerate =
    (hasGemini || hasOpenAI) &&
    description.trim().length > 0 &&
    sourceTab === "text";
  const canUploadImage = hasGemini;

  const handleGeneratePreview = async () => {
    if (!canGenerate) return;
    let promptToUse = description.trim();
    if (hasGemini) {
      setIsRefining(true);
      try {
        const refined = await refineCharacterPrompt(promptToUse);
        if (refined) {
          promptToUse = refined;
          setDescription(refined);
        }
      } catch (e) {
        console.error("Error refinando prompt:", e);
      } finally {
        setIsRefining(false);
      }
    }
    const url = await generateCharacterPreview(promptToUse);
    if (url) {
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return url;
      });
    } else {
      alert("No se pudo generar la vista previa. Comprueba tu descripción y API key.");
    }
  };

  const handleGenerateAgain = () => {
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    handleGeneratePreview();
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
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
          onClick={() => !isGeneratingCharacterPreview && handleClose()}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-stone-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                <UserPlus size={20} />
              </div>
              <div>
                <h3 className="font-medium text-stone-900">Crear personaje</h3>
                <p className="text-xs text-stone-500">
                  Genera una vista previa y guárdalo para usarlo en todas las imágenes
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isGeneratingCharacterPreview || isRefining || isDescribingImage}
              className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
            {!(hasGemini || hasOpenAI) ? (
              <p className="text-sm text-stone-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
                Configura una API key de Gemini u OpenAI en Ajustes para generar el personaje.
              </p>
            ) : (
              <>
                <div className="flex border-b border-stone-100">
                  <button
                    type="button"
                    onClick={() => setSourceTab("text")}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-medium transition-colors",
                      sourceTab === "text"
                        ? "text-violet-600 border-b-2 border-violet-600"
                        : "text-stone-500 hover:text-stone-700"
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
                        ? "text-violet-600 border-b-2 border-violet-600"
                        : "text-stone-500 hover:text-stone-700"
                    )}
                  >
                    <Upload size={16} />
                    Imagen de referencia
                  </button>
                </div>

                {sourceTab === "image" && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Sube una imagen de tu personaje
                    </label>
                    <p className="text-xs text-stone-500">
                      Si ya tienes una imagen del personaje, súbela y la descripción se generará automáticamente (requiere Gemini).
                    </p>
                    <form>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleReferenceImageChange}
                        disabled={!canUploadImage || isDescribingImage}
                        className="block w-full text-sm text-stone-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 file:cursor-pointer cursor-pointer"
                      />
                    </form>
                    {isDescribingImage && (
                      <p className="text-sm text-stone-500 flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" />
                        Extrayendo descripción del personaje…
                      </p>
                    )}
                    {!hasGemini && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        La imagen de referencia requiere API de Gemini para extraer la descripción.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    {sourceTab === "image" ? "Descripción generada (editable)" : "Descripción del personaje"}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      sourceTab === "text"
                        ? "Ej: Humanoide blanco estilo cartoon, cabeza cuadrada, mochila marrón. Se refinará automáticamente al generar (Gemini)."
                        : "Sube una imagen o escribe una descripción."
                    }
                    rows={4}
                    disabled={isGeneratingCharacterPreview || isRefining || isDescribingImage}
                    className="w-full text-sm text-stone-700 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 resize-none"
                  />
                  {sourceTab === "text" && (
                    <p className="text-xs text-stone-500">
                      Al generar, se creará un prompt más preciso y reutilizable. Estilo:{" "}
                      <span className="font-medium">{selectedStyle.name}</span>
                    </p>
                  )}
                </div>

                {sourceTab === "text" && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={previewUrl ? handleGenerateAgain : handleGeneratePreview}
                    disabled={!canGenerate || isGeneratingCharacterPreview}
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                      previewUrl
                        ? "bg-stone-100 text-stone-700 hover:bg-stone-200"
                        : "bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {(isRefining || isGeneratingCharacterPreview) ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        {isRefining ? "Refinando prompt…" : "Generando…"}
                      </>
                    ) : previewUrl ? (
                      <>
                        <RefreshCw size={18} />
                        Generar de nuevo
                      </>
                    ) : (
                      <>
                        <UserPlus size={18} />
                        Generar vista previa
                      </>
                    )}
                  </button>
                </div>
                )}

                {previewUrl && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Vista previa
                    </span>
                    <div className="rounded-xl border-2 border-stone-200 overflow-hidden bg-stone-50 aspect-square max-w-[280px] mx-auto">
                      <img
                        src={previewUrl}
                        alt="Vista previa del personaje"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <p className="text-xs text-stone-500 text-center">
                      {sourceTab === "image"
                        ? "Revisa la descripción generada, edítala si quieres, ponle nombre y guárdalo."
                        : "Si te convence, ponle nombre y guárdalo como personaje."}
                    </p>
                  </div>
                )}

                {previewUrl && (
                  <div className="space-y-3 pt-2 border-t border-stone-100">
                    {sourceTab === "image" && !description.trim() && hasGemini && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        Recomendado: añade o revisa la descripción. Con OpenAI se usará esta descripción cuando no se pueda enviar la imagen de referencia. Si guardas sin descripción, se intentará generarla desde la imagen.
                      </p>
                    )}
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Nombre del personaje
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: Presentador"
                      className="w-full text-sm text-stone-700 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveAsCharacter}
                      disabled={isSaving || !name.trim()}
                      className="w-full py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
