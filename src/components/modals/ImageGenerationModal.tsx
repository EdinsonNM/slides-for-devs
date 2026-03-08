import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Send, Loader2, Wand2, Upload, Image as ImageIcon } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { IMAGE_STYLES } from "../../constants/imageStyles";
import { cn } from "../../utils/cn";

type ImageModalTab = "generate" | "upload";

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
    handleImageUpload,
    isGeneratingPromptAlternatives,
    handleGeneratePromptAlternatives,
    hasGemini,
    hasOpenAI,
  } = usePresentation();

  const [tab, setTab] = useState<ImageModalTab>("generate");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canGenerateWithAI = hasGemini || hasOpenAI;

  // Reset upload state when closing modal; revoke object URL to avoid leaks
  useEffect(() => {
    if (!showImageModal) {
      setUploadPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setSelectedFile(null);
    }
  }, [showImageModal]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploadPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setSelectedFile(file);
  };

  const handleUseUploadedImage = () => {
    if (selectedFile) {
      handleImageUpload(selectedFile);
      setSelectedFile(null);
      setUploadPreview(null);
      fileInputRef.current?.form?.reset();
    }
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
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900">
                    Imagen del slide
                  </h3>
                  <p className="text-xs text-stone-500">
                    Genera con IA o sube tu propia imagen
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImageModal(false)}
                className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
                disabled={isGeneratingImage}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-stone-100">
              <button
                type="button"
                onClick={() => setTab("generate")}
                className={cn(
                  "flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  tab === "generate"
                    ? "text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50"
                    : "text-stone-500 hover:text-stone-700"
                )}
              >
                <Sparkles size={18} />
                Generar con IA
              </button>
              <button
                type="button"
                onClick={() => setTab("upload")}
                className={cn(
                  "flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2",
                  tab === "upload"
                    ? "text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50"
                    : "text-stone-500 hover:text-stone-700"
                )}
              >
                <Upload size={18} />
                Subir imagen
              </button>
            </div>

            <div className="p-6 space-y-6">
              {tab === "upload" ? (
                <>
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Selecciona una imagen
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={onFileChange}
                      className="block w-full text-sm text-stone-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 file:cursor-pointer cursor-pointer"
                    />
                    {uploadPreview && (
                      <div className="mt-3 rounded-xl border border-stone-200 overflow-hidden bg-stone-50">
                        <img
                          src={uploadPreview}
                          alt="Vista previa"
                          className="w-full max-h-48 object-contain"
                        />
                        <p className="p-2 text-xs text-stone-500 truncate">
                          {selectedFile?.name}
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleUseUploadedImage}
                    disabled={!selectedFile}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    <Upload size={20} />
                    Usar esta imagen
                  </button>
                </>
              ) : (
                <>
                  {!canGenerateWithAI ? (
                    <p className="text-sm text-stone-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
                      Configura una API key de Gemini u OpenAI en Ajustes para poder generar imágenes con IA.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                          Proveedor de IA
                        </label>
                        <div className={cn(
                          "grid gap-2",
                          hasGemini && hasOpenAI ? "grid-cols-2" : "grid-cols-1"
                        )}>
                          {hasGemini && (
                            <button
                              type="button"
                              onClick={() => setImageProvider("gemini")}
                              className={cn(
                                "px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                                imageProvider === "gemini"
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                                  : "bg-white border-stone-200 text-stone-600 hover:border-emerald-500"
                              )}
                            >
                              Google Gemini
                            </button>
                          )}
                          {hasOpenAI && (
                            <button
                              type="button"
                              onClick={() => setImageProvider("openai")}
                              className={cn(
                                "px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                                imageProvider === "openai"
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                                  : "bg-white border-stone-200 text-stone-600 hover:border-emerald-500"
                              )}
                            >
                              OpenAI (DALL·E 3)
                            </button>
                          )}
                        </div>
                        {imageProvider === "gemini" && (
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                              Modelo Gemini (imagen)
                            </label>
                            <select
                              value={geminiImageModelId}
                              onChange={(e) => setGeminiImageModelId(e.target.value)}
                              disabled={isGeneratingImage}
                              className="w-full text-sm text-stone-700 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 cursor-pointer"
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
                      <div className="space-y-3">
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                          Estilo de Imagen
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {IMAGE_STYLES.map((style) => (
                            <button
                              key={style.id}
                              onClick={() => setSelectedStyle(style)}
                              className={cn(
                                "px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                                selectedStyle.id === style.id
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-md"
                                  : "bg-white border-stone-200 text-stone-600 hover:border-emerald-500"
                              )}
                            >
                              {style.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={includeBackground}
                          onChange={(e) => setIncludeBackground(e.target.checked)}
                          disabled={isGeneratingImage}
                          className="w-4 h-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-stone-600 group-hover:text-stone-900">
                          Incluir fondo
                        </span>
                      </label>

                      {currentSlide && (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                              Contexto del Slide
                            </label>
                            <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-sm text-stone-600 italic">
                              &quot;{currentSlide.title}&quot;
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-xs font-bold uppercase tracking-wider text-stone-400">
                                Tu Prompt
                              </label>
                              <button
                                type="button"
                                onClick={handleGeneratePromptAlternatives}
                                disabled={
                                  isGeneratingImage || isGeneratingPromptAlternatives
                                }
                                title="Generar alternativa de prompt según estilo y contexto"
                                className="p-1.5 rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {isGeneratingPromptAlternatives ? (
                                  <Loader2
                                    className="animate-spin"
                                    size={18}
                                    aria-hidden
                                  />
                                ) : (
                                  <Wand2 size={18} aria-hidden />
                                )}
                              </button>
                            </div>
                            <textarea
                              value={imagePrompt}
                              onChange={(e) => setImagePrompt(e.target.value)}
                              placeholder="Ej: Un astronauta plantando una bandera en Marte..."
                              className="w-full h-24 p-4 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-sm"
                              disabled={isGeneratingImage}
                            />
                          </div>
                        </>
                      )}
                      <button
                        onClick={handleImageGenerate}
                        disabled={isGeneratingImage || !imagePrompt.trim()}
                        className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      >
                        {isGeneratingImage ? (
                          <>
                            <Loader2 className="animate-spin" size={20} />
                            Generando Obra Maestra...
                          </>
                        ) : (
                          <>
                            <Send size={20} />
                            Generar Imagen
                          </>
                        )}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
