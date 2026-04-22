import { useRef, useState } from "react";
import { Loader2, Plus, Mic, ArrowUp } from "lucide-react";
import { cn } from "../../utils/cn";
import { ModelSelect } from "../shared/ModelSelect";
import { PromptAttachmentsRow } from "../shared/PromptAttachmentsRow";
import { NarrativeCustomObjectiveModal } from "../modals/NarrativeCustomObjectiveModal";
import type { PresentationModelOption } from "../../constants/presentationModels";
import {
  DEFAULT_DECK_NARRATIVE_PRESET_ID,
  DECK_NARRATIVE_CUSTOM_PRESET_ID,
  NARRATIVE_PRESET_COMBO_OPTIONS,
} from "../../constants/presentationNarrativePresets";
import {
  LARGE_PASTE_CHAR_THRESHOLD,
  createPromptAttachment,
  nextPastedDocumentName,
  type PromptAttachment,
} from "../../utils/promptAttachments";
export type PresentationModel = PresentationModelOption;

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
  attachments?: PromptAttachment[];
  onAddAttachment?: (attachment: PromptAttachment) => void;
  onRemoveAttachment?: (id: string) => void;
  deckNarrativePresetId?: string;
  onDeckNarrativePresetIdChange?: (id: string) => void;
  narrativeNotes?: string;
  onNarrativeNotesChange?: (v: string) => void;
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
  attachments = [],
  onAddAttachment,
  onRemoveAttachment,
  deckNarrativePresetId,
  onDeckNarrativePresetIdChange,
  narrativeNotes = "",
  onNarrativeNotesChange,
}: PromptInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customObjectiveOpen, setCustomObjectiveOpen] = useState(false);
  const narrativeBeforeCustomRef = useRef({
    preset: DEFAULT_DECK_NARRATIVE_PRESET_ID,
    notes: "",
  });

  const showModel =
    presentationModelId != null &&
    setPresentationModelId != null &&
    presentationModels != null &&
    presentationModels.length > 0;

  const showNarrativeCombo =
    onDeckNarrativePresetIdChange != null && deckNarrativePresetId != null;

  const canSubmit =
    Boolean(value.trim()) || (attachments.length > 0 && Boolean(onAddAttachment));

  const handleNarrativePresetChange = (id: string) => {
    if (!onDeckNarrativePresetIdChange) return;
    if (id === DECK_NARRATIVE_CUSTOM_PRESET_ID && onNarrativeNotesChange) {
      narrativeBeforeCustomRef.current = {
        preset: deckNarrativePresetId ?? DEFAULT_DECK_NARRATIVE_PRESET_ID,
        notes: narrativeNotes,
      };
      onDeckNarrativePresetIdChange(id);
      setCustomObjectiveOpen(true);
      return;
    }
    onDeckNarrativePresetIdChange(id);
  };

  const cancelCustomObjective = () => {
    const snap = narrativeBeforeCustomRef.current;
    onDeckNarrativePresetIdChange?.(snap.preset);
    onNarrativeNotesChange?.(snap.notes);
    setCustomObjectiveOpen(false);
  };

  const saveCustomObjective = (text: string) => {
    onNarrativeNotesChange?.(text);
    onDeckNarrativePresetIdChange?.(DECK_NARRATIVE_CUSTOM_PRESET_ID);
    setCustomObjectiveOpen(false);
  };

  const narrativeObjectiveModal =
    onDeckNarrativePresetIdChange != null && onNarrativeNotesChange != null ? (
      <NarrativeCustomObjectiveModal
        isOpen={customObjectiveOpen}
        onCancel={cancelCustomObjective}
        onSave={saveCustomObjective}
        initialText={narrativeNotes}
        disabled={disabled}
      />
    ) : null;

  const handlePaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (!onAddAttachment) return;
    const text = e.clipboardData.getData("text/plain");
    if (text.length < LARGE_PASTE_CHAR_THRESHOLD) return;
    e.preventDefault();
    onAddAttachment(
      createPromptAttachment(
        nextPastedDocumentName(attachments.length),
        text,
      ),
    );
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onAddAttachment) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (!text.trim()) return;
      onAddAttachment(createPromptAttachment(file.name, text));
    };
    reader.readAsText(file);
  };

  const attachmentRow =
    onRemoveAttachment != null ? (
      <PromptAttachmentsRow
        items={attachments}
        onRemove={onRemoveAttachment}
        className={compact ? "px-4 pt-2" : "px-4 pt-2 pb-0"}
      />
    ) : null;

  if (compact) {
    return (
      <>
        <form onSubmit={onSubmit} className={cn("w-full", className)}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.markdown,text/plain"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={handleFileChange}
          />
          <div
            className={cn(
              "group w-full overflow-hidden rounded-[28px] border border-stone-200 bg-white transition-shadow duration-200 ease-out dark:border-stone-600 dark:bg-stone-900",
              "shadow-md focus-within:shadow-lg focus-within:ring-2 focus-within:ring-emerald-500/30 dark:focus-within:ring-emerald-500/40",
            )}
            style={{ boxShadow: "0 2px 8px 0 rgba(0,0,0,0.06)" }}
          >
            {attachmentRow}
            <div className="flex min-w-0 flex-col">
              <div className="px-4 pt-3 pb-2">
                <textarea
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={placeholder}
                  rows={2}
                  className="min-h-[52px] w-full max-h-32 resize-none bg-white py-0 text-[15px] leading-snug text-stone-800 placeholder:text-stone-400 focus:outline-none dark:bg-stone-900 dark:text-foreground dark:placeholder:text-stone-500"
                  disabled={disabled}
                />
              </div>
              <div className="flex flex-col gap-2 border-t border-stone-200 px-4 pb-3 pt-2 dark:border-stone-700">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      className="rounded-full p-2 text-stone-600 transition-colors hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-700"
                      title={
                        onAddAttachment
                          ? "Adjuntar archivo de texto"
                          : "Añadir"
                      }
                      aria-label={
                        onAddAttachment
                          ? "Adjuntar archivo de texto"
                          : "Añadir"
                      }
                      disabled={disabled || !onAddAttachment}
                      onClick={() =>
                        onAddAttachment && fileInputRef.current?.click()
                      }
                    >
                      <Plus size={20} />
                    </button>

                    <button
                      type="button"
                      className="rounded-full p-2 text-stone-600 transition-colors hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-700"
                      title="Entrada de voz"
                      aria-label="Micrófono"
                    >
                      <Mic size={20} />
                    </button>
                    {showNarrativeCombo && (
                      <ModelSelect
                        value={deckNarrativePresetId}
                        options={NARRATIVE_PRESET_COMBO_OPTIONS}
                        onChange={handleNarrativePresetChange}
                        disabled={disabled}
                        size="xs"
                        appearance="ghost"
                        className="min-w-0 max-w-[8.5rem] sm:max-w-[9.5rem]"
                        aria-label="Objetivo del contenido"
                      />
                    )}
                    {showModel && (
                      <ModelSelect
                        value={presentationModelId}
                        options={presentationModels}
                        onChange={setPresentationModelId}
                        disabled={disabled}
                        size="xs"
                        appearance="ghost"
                        className="min-w-0 max-w-[9.5rem] sm:max-w-[11rem]"
                        aria-label="Modelo para generar la presentación"
                      />
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={disabled || !canSubmit}
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                      disabled &&
                        "cursor-wait bg-emerald-500 text-white",
                      !disabled &&
                        !canSubmit &&
                        "cursor-not-allowed bg-stone-200 text-stone-400 dark:bg-stone-700 dark:text-stone-500",
                      !disabled &&
                        canSubmit &&
                        "bg-emerald-500 text-white hover:bg-emerald-600",
                    )}
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
          </div>
        </form>
        {narrativeObjectiveModal}
      </>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className={cn("w-full", className)}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.markdown,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={handleFileChange}
        />
        <div
          className="flex min-h-[132px] w-full flex-col overflow-hidden rounded-[32px] border border-stone-200 bg-white shadow-md dark:border-stone-600 dark:bg-stone-900"
          style={{
            boxShadow: "0 2px 12px 0 rgba(0,0,0,0.05)",
          }}
        >
          {attachmentRow}
          <div className="flex-1 flex flex-col px-5 pt-5 pb-2 min-h-0">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={placeholder}
              rows={minRows}
              className="min-h-[80px] w-full max-h-40 resize-none bg-white py-0 text-[15px] leading-relaxed text-stone-800 placeholder:text-stone-400 focus:outline-none dark:bg-stone-900 dark:text-foreground dark:placeholder:text-stone-500"
              disabled={disabled}
            />
          </div>
          <div className="flex flex-col gap-2.5 border-t border-stone-200 px-4 pb-4 pt-1 dark:border-stone-700">
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className="rounded-full p-2 text-stone-600 transition-colors hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-700"
                  title={
                    onAddAttachment ? "Adjuntar archivo de texto" : "Añadir"
                  }
                  aria-label={
                    onAddAttachment ? "Adjuntar archivo de texto" : "Añadir"
                  }
                  disabled={disabled || !onAddAttachment}
                  onClick={() => onAddAttachment && fileInputRef.current?.click()}
                >
                  <Plus size={20} />
                </button>

                <button
                  type="button"
                  className="rounded-full p-2 text-stone-600 transition-colors hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-700"
                  title="Entrada de voz"
                  aria-label="Micrófono"
                >
                  <Mic size={20} />
                </button>
                {showNarrativeCombo && (
                  <ModelSelect
                    value={deckNarrativePresetId}
                    options={NARRATIVE_PRESET_COMBO_OPTIONS}
                    onChange={handleNarrativePresetChange}
                    disabled={disabled}
                    size="xs"
                    appearance="ghost"
                    className="min-w-0 max-w-[8.5rem] sm:max-w-[9.5rem]"
                    aria-label="Objetivo del contenido"
                  />
                )}
                {showModel && (
                  <ModelSelect
                    value={presentationModelId}
                    options={presentationModels}
                    onChange={setPresentationModelId}
                    disabled={disabled}
                    size="xs"
                    appearance="ghost"
                    className="min-w-0 max-w-[9.5rem] sm:max-w-[11rem]"
                    aria-label="Modelo para generar la presentación"
                  />
                )}
              </div>
              <button
                type="submit"
                disabled={disabled || !canSubmit}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
                  disabled &&
                    "cursor-wait bg-emerald-500 text-white",
                  !disabled &&
                    !canSubmit &&
                    "cursor-not-allowed bg-stone-200 text-stone-400 dark:bg-stone-700 dark:text-stone-500",
                  !disabled &&
                    canSubmit &&
                    "bg-emerald-500 text-white hover:bg-emerald-600",
                )}
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
      {narrativeObjectiveModal}
    </>
  );
}
