import { useState } from "react";
import { motion } from "motion/react";
import { KeyRound, Sparkles, Check } from "lucide-react";
import {
  getGeminiApiKey,
  getOpenAIApiKey,
  setGeminiApiKey,
  setOpenAIApiKey,
} from "../../services/apiConfig";
import { cn } from "../../utils/cn";

export function ApiSetupScreen({ onConfigured }: { onConfigured: () => void }) {
  const [geminiKey, setGeminiKey] = useState(() => getGeminiApiKey() ?? "");
  const [openaiKey, setOpenaiKey] = useState(() => getOpenAIApiKey() ?? "");
  const [touched, setTouched] = useState(false);

  const hasGemini = geminiKey.trim().length > 0;
  const hasOpenAI = openaiKey.trim().length > 0;
  const canContinue = hasGemini || hasOpenAI;

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canContinue) return;
    setIsSaving(true);
    try {
      await setGeminiApiKey(geminiKey);
      await setOpenAIApiKey(openaiKey);
      onConfigured();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F6] flex flex-col items-center justify-center p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-100 text-emerald-600 mb-4">
            <KeyRound size={40} />
          </div>
          <h1 className="text-2xl font-semibold text-stone-900">
            Configura tu API
          </h1>
          <p className="text-stone-600 mt-2">
            Para generar presentaciones necesitas al menos una clave de API.
            Puedes usar Gemini, OpenAI o ambas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="gemini-key"
              className="block text-sm font-medium text-stone-700 mb-1.5"
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
                  "w-full px-4 py-3 rounded-xl border bg-white text-stone-900 placeholder:text-stone-400",
                  "focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500",
                  "border-stone-200"
                )}
                autoComplete="off"
              />
              {hasGemini && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                  <Check size={18} />
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Generación de presentaciones e imágenes. Obtén una en{" "}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          <div>
            <label
              htmlFor="openai-key"
              className="block text-sm font-medium text-stone-700 mb-1.5"
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
                  "w-full px-4 py-3 rounded-xl border bg-white text-stone-900 placeholder:text-stone-400",
                  "focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500",
                  "border-stone-200"
                )}
                autoComplete="off"
              />
              {hasOpenAI && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                  <Check size={18} />
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Para generar imágenes con DALL·E 3 en lugar de Gemini.
            </p>
          </div>

          {touched && !canContinue && (
            <p className="text-sm text-amber-600">
              Añade al menos una clave (Gemini u OpenAI) para continuar.
            </p>
          )}

          <button
            type="submit"
            disabled={!canContinue || isSaving}
            className="w-full py-3.5 px-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
  );
}
