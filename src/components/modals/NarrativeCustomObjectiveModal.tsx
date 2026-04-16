import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { BaseModal } from "./BaseModal";

const MAX_LEN = 1200;

export interface NarrativeCustomObjectiveModalProps {
  isOpen: boolean;
  onCancel: () => void;
  /** Texto guardado en `narrativeNotes` y preset permanece `custom`. */
  onSave: (text: string) => void;
  initialText: string;
  disabled?: boolean;
}

export function NarrativeCustomObjectiveModal({
  isOpen,
  onCancel,
  onSave,
  initialText,
  disabled = false,
}: NarrativeCustomObjectiveModalProps) {
  const [draft, setDraft] = useState(initialText);

  useEffect(() => {
    if (isOpen) setDraft(initialText);
  }, [isOpen, initialText]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      title="Objetivo personalizado"
      subtitle="Describe tono, audiencia, estructura o límites. Se usará al generar la presentación."
      icon={
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200">
          <PenLine size={20} aria-hidden />
        </div>
      }
      disabledBackdropClose={disabled}
      className="max-w-lg"
    >
      <textarea
        className="min-h-[168px] w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 dark:border-border dark:bg-surface dark:text-foreground dark:placeholder:text-stone-500"
        placeholder="Ej.: Audiencia ejecutiva; pocas viñetas; priorizar datos y diagramas; tono directo…"
        maxLength={MAX_LEN}
        disabled={disabled}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label="Instrucciones de objetivo personalizado"
      />
      <p className="mt-1 text-right text-xs tabular-nums text-stone-400 dark:text-stone-500">
        {draft.length} / {MAX_LEN}
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50 dark:border-border dark:bg-surface dark:text-stone-200 dark:hover:bg-stone-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSave(draft.trim())}
          disabled={disabled}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 dark:hover:bg-emerald-500"
        >
          Guardar
        </button>
      </div>
    </BaseModal>
  );
}
