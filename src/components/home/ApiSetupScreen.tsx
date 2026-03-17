import { useState } from "react";
import { motion } from "motion/react";
import { KeyRound, Sparkles, Check } from "lucide-react";
import {
  getGeminiApiKey,
  getOpenAIApiKey,
  getXaiApiKey,
  setGeminiApiKey,
  setOpenAIApiKey,
  setXaiApiKey,
} from "../../services/apiConfig";
import { cn } from "../../utils/cn";

export function ApiSetupScreen({ onConfigured }: { onConfigured: () => void }) {
  const [geminiKey, setGeminiKey] = useState(() => getGeminiApiKey() ?? "");
  const [openaiKey, setOpenaiKey] = useState(() => getOpenAIApiKey() ?? "");
  const [xaiKey, setXaiKey] = useState(() => getXaiApiKey() ?? "");
  const [touched, setTouched] = useState(false);

  const hasGemini = geminiKey.trim().length > 0;
  const hasOpenAI = openaiKey.trim().length > 0;
  const hasXai = xaiKey.trim().length > 0;
  const canContinue = hasGemini || hasOpenAI || hasXai;

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canContinue) return;
    setIsSaving(true);
    try {
      await setGeminiApiKey(geminiKey);
      await setOpenAIApiKey(openaiKey);
      await setXaiApiKey(xaiKey);
      onConfigured();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans">
      {/* Izquierda: fondo claro + video con bordes desvanecidos */}
      <div className="w-full lg:w-[45%] min-h-[40vh] lg:min-h-screen bg-[#F6F6F6] dark:bg-surface flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-center w-full max-w-sm relative"
        >
          <div className="rounded-3xl overflow-hidden aspect-square max-h-[320px] flex items-center justify-center relative">
            <video
              src="./video-logo.webm"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-contain"
              aria-hidden
            />
          </div>
        </motion.div>
      </div>

      {/* Derecha: formulario con fondo verde agua */}
      <div className="flex-1 min-h-screen bg-[#B8E6E0] dark:bg-stone-800 flex flex-col items-center justify-center p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/80 dark:bg-surface-elevated text-teal-700 dark:text-emerald-400 shadow-sm mb-4">
              <KeyRound size={28} />
            </div>
            <h1 className="text-2xl font-semibold text-stone-900 dark:text-foreground">
              Configura tu API
            </h1>
            <p className="text-stone-600 dark:text-stone-400 mt-2">
              Para generar presentaciones necesitas al menos una clave de API.
              Puedes usar Gemini, OpenAI, xAI (Grok) o varias.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="gemini-key"
                className="block text-sm font-medium text-stone-700 dark:text-foreground mb-1.5"
              >
                API Key de Google Gemini
              </label>
              <div className="relative">
                <input
                  id="gemini-key"
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="Ej: AIza..."
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border bg-white/95 dark:bg-surface text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500",
                    "focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500",
                    "border-stone-200/80 dark:border-border shadow-sm",
                  )}
                  autoComplete="off"
                />
                {hasGemini && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-600">
                    <Check size={18} />
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                Generación de presentaciones e imágenes. Obtén una en{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-700 dark:text-teal-400 hover:underline font-medium"
                >
                  Google AI Studio
                </a>
              </p>
            </div>

            <div>
              <label
                htmlFor="openai-key"
                className="block text-sm font-medium text-stone-700 dark:text-foreground mb-1.5"
              >
                API Key de OpenAI (opcional)
              </label>
              <div className="relative">
                <input
                  id="openai-key"
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="Ej: sk-..."
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border bg-white/95 dark:bg-surface text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500",
                    "focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500",
                    "border-stone-200/80 dark:border-border shadow-sm",
                  )}
                  autoComplete="off"
                />
                {hasOpenAI && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-600">
                    <Check size={18} />
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                Para generar imágenes con DALL·E 3 en lugar de Gemini.
              </p>
            </div>

            <div>
              <label
                htmlFor="xai-key"
                className="block text-sm font-medium text-stone-700 dark:text-foreground mb-1.5"
              >
                API Key de xAI (Grok) (opcional)
              </label>
              <div className="relative">
                <input
                  id="xai-key"
                  type="password"
                  value={xaiKey}
                  onChange={(e) => setXaiKey(e.target.value)}
                  placeholder="Ej: xai-..."
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border bg-white/95 dark:bg-surface text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500",
                    "focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500",
                    "border-stone-200/80 dark:border-border shadow-sm",
                  )}
                  autoComplete="off"
                />
                {hasXai && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-600">
                    <Check size={18} />
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
                Presentaciones con Grok. Obtén una en{" "}
                <a
                  href="https://console.x.ai/team/default/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-700 dark:text-teal-400 hover:underline font-medium"
                >
                  xAI Console
                </a>
              </p>
            </div>

            {touched && !canContinue && (
              <p className="text-sm text-amber-700 bg-amber-100/80 px-3 py-2 rounded-lg">
                Añade al menos una clave (Gemini, OpenAI o xAI) para continuar.
              </p>
            )}

            <button
              type="submit"
              disabled={!canContinue || isSaving}
              className={cn(
                "w-full py-3.5 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2",
                "bg-teal-600 text-white hover:bg-teal-700",
                "disabled:opacity-50 disabled:cursor-not-allowed shadow-sm",
              )}
            >
              {isSaving ? (
                <>
                  <span className="inline-block w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Continuar
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
