import { useState, useEffect } from "react";
import { KeyRound, Check } from "lucide-react";
import {
  getGeminiApiKey,
  getOpenAIApiKey,
  setGeminiApiKey,
  setOpenAIApiKey,
} from "../../services/apiConfig";
import { BaseModal } from "./BaseModal";
import { cn } from "../../utils/cn";

interface ApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ApiConfigModal({
  isOpen,
  onClose,
  onSaved,
}: ApiConfigModalProps) {
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setGeminiKey(getGeminiApiKey() ?? "");
      setOpenaiKey(getOpenAIApiKey() ?? "");
      setTouched(false);
    }
  }, [isOpen]);

  const hasGemini = geminiKey.trim().length > 0;
  const hasOpenAI = openaiKey.trim().length > 0;
  const canSave = hasGemini || hasOpenAI;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSave) return;
    setIsSaving(true);
    try {
      await setGeminiApiKey(geminiKey);
      await setOpenAIApiKey(openaiKey);
      onSaved?.();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Configuración de API"
      subtitle="Actualiza las claves si el token ha vencido"
      icon={
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
          <KeyRound size={22} />
        </div>
      }
      disabledBackdropClose={isSaving}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="config-gemini-key"
            className="block text-sm font-medium text-stone-700 mb-1"
          >
            API Key de Google Gemini
          </label>
          <div className="relative">
            <input
              id="config-gemini-key"
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Ej: AIza..."
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border bg-white text-stone-900 placeholder:text-stone-400 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500",
                "border-stone-200"
              )}
              autoComplete="off"
            />
            {hasGemini && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                <Check size={16} />
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline"
            >
              Obtener clave
            </a>
          </p>
        </div>

        <div>
          <label
            htmlFor="config-openai-key"
            className="block text-sm font-medium text-stone-700 mb-1"
          >
            API Key de OpenAI (opcional)
          </label>
          <div className="relative">
            <input
              id="config-openai-key"
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="Ej: sk-..."
              className={cn(
                "w-full px-3 py-2.5 rounded-lg border bg-white text-stone-900 placeholder:text-stone-400 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500",
                "border-stone-200"
              )}
              autoComplete="off"
            />
            {hasOpenAI && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                <Check size={16} />
              </span>
            )}
          </div>
        </div>

        {touched && !canSave && (
          <p className="text-sm text-amber-600">
            Debe haber al menos una clave configurada.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors text-sm font-medium"
          >
            Cerrar
          </button>
          <button
            type="submit"
            disabled={!canSave || isSaving}
            className="flex-1 py-2.5 px-4 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar"
            )}
          </button>
        </div>
      </form>
    </BaseModal>
  );
}
