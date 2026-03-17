import { Loader2, Plus, Mic, ArrowUp } from "lucide-react";
import { cn } from "../../utils/cn";

export type PresentationModel = { id: string; label: string };

export interface PromptInputProps {
  onSubmit: (e: React.FormEvent) => void;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder: string;
  minRows?: number;
  maxRows?: number;
  showPlan?: boolean;
  className?: string;
  presentationModelId?: string;
  setPresentationModelId?: (id: string) => void;
  presentationModels?: PresentationModel[];
  compact?: boolean;
}

/**
 * Input tipo píldora para el tema de la presentación.
 * Variante expandida (página inicial) o compacta (header con carrusel).
 */
export function PromptInput({
  onSubmit,
  value,
  onChange,
  disabled,
  placeholder,
  minRows = 2,
  showPlan = true,
  className = "",
  presentationModelId,
  setPresentationModelId,
  presentationModels,
  compact = false,
}: PromptInputProps) {
  const showModel =
    presentationModelId != null &&
    setPresentationModelId != null &&
    presentationModels != null &&
    presentationModels.length > 0;

  if (compact) {
    return (
      <form onSubmit={onSubmit} className={cn("w-full", className)}>
        <div
          className={cn(
            "group w-full rounded-[28px] border border-stone-200 dark:border-border bg-white dark:bg-surface overflow-hidden transition-all duration-200 ease-out",
            "min-h-[52px] focus-within:min-h-[120px]",
            "shadow-md focus-within:shadow-xl focus-within:ring-2 focus-within:ring-emerald-500/20 dark:focus-within:ring-emerald-500/30"
          )}
          style={{ boxShadow: "0 2px 8px 0 rgba(0,0,0,0.06)" }}
        >
          <div className="flex flex-row items-center gap-2 px-4 py-2.5 focus-within:flex-col focus-within:items-stretch focus-within:py-4 transition-all duration-200">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={placeholder}
              rows={1}
              className="w-full min-h-[28px] max-h-32 resize-none bg-transparent text-stone-800 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500 text-base focus:outline-none py-0 min-w-0 group-focus-within:min-h-[72px]"
              disabled={disabled}
            />
            <div className="flex items-center justify-between gap-2 shrink-0 focus-within:w-full focus-within:pt-1">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-700 transition-colors"
                  title="Añadir"
                  aria-label="Añadir"
                >
                  <Plus size={20} />
                </button>
                {showPlan && (
                  <span className="text-sm text-stone-700 dark:text-stone-300 font-normal">Plan</span>
                )}
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-700 transition-colors"
                  title="Entrada de voz"
                  aria-label="Micrófono"
                >
                  <Mic size={20} />
                </button>
                {showModel && (
                  <select
                    value={presentationModelId}
                    onChange={(e) => setPresentationModelId(e.target.value)}
                    disabled={disabled}
                    className="text-xs text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer min-w-0 max-w-[180px]"
                    aria-label="Modelo para generar la presentación"
                  >
                    {presentationModels!.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button
                type="submit"
                disabled={disabled || !value.trim()}
                className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                aria-label="Enviar"
              >
                {disabled ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <ArrowUp size={18} />
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)}>
      <div
        className="w-full rounded-[28px] border border-stone-200 dark:border-border bg-white dark:bg-surface shadow-md overflow-hidden flex flex-col min-h-[120px]"
        style={{
          boxShadow:
            "0 2px 8px 0 rgba(0,0,0,0.06), inset 0 1px 0 0 rgba(255,255,255,0.8)",
        }}
      >
        <div className="flex-1 flex flex-col px-4 pt-4 pb-1">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={placeholder}
            rows={minRows}
            className="w-full min-h-[72px] max-h-32 resize-none bg-transparent text-stone-800 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500 text-base focus:outline-none py-0"
            disabled={disabled}
          />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 pt-1 gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-700 transition-colors"
              title="Añadir"
              aria-label="Añadir"
            >
              <Plus size={20} />
            </button>
            {showPlan && (
              <span className="text-sm text-stone-700 dark:text-stone-300 font-normal">Plan</span>
            )}
            <button
              type="button"
              className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-700 transition-colors"
              title="Entrada de voz"
              aria-label="Micrófono"
            >
              <Mic size={20} />
            </button>
            {showModel && (
              <select
                value={presentationModelId}
                onChange={(e) => setPresentationModelId(e.target.value)}
                disabled={disabled}
                className="text-xs text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 cursor-pointer min-w-0 max-w-[180px]"
                aria-label="Modelo para generar la presentación"
              >
                {presentationModels!.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            aria-label="Enviar"
          >
            {disabled ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <ArrowUp size={18} />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
