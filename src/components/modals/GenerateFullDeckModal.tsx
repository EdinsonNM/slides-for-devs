import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Loader2, Plus } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { PromptAttachmentsRow } from "../shared/PromptAttachmentsRow";
import {
  LARGE_PASTE_CHAR_THRESHOLD,
  createPromptAttachment,
  nextPastedDocumentName,
} from "../../utils/promptAttachments";
import { NarrativeCustomObjectiveModal } from "./NarrativeCustomObjectiveModal";
import { ModelSelect } from "../shared/ModelSelect";
import {
  DEFAULT_DECK_NARRATIVE_PRESET_ID,
  DECK_NARRATIVE_CUSTOM_PRESET_ID,
  NARRATIVE_PRESET_COMBO_OPTIONS,
} from "../../constants/presentationNarrativePresets";

export function GenerateFullDeckModal() {
  const {
    showGenerateFullDeckModal,
    setShowGenerateFullDeckModal,
    generateFullDeckTopic,
    setGenerateFullDeckTopic,
    generateFullDeckAttachments,
    addGenerateFullDeckAttachment,
    removeGenerateFullDeckAttachment,
    handleConfirmGenerateFullDeck,
    pendingGeneration: pending,
    deckNarrativePresetId,
    setDeckNarrativePresetId,
    narrativeNotes,
    setNarrativeNotes,
  } = usePresentation();

  const busy = pending !== null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customObjectiveOpen, setCustomObjectiveOpen] = useState(false);
  const narrativeBeforeCustomRef = useRef({
    preset: DEFAULT_DECK_NARRATIVE_PRESET_ID,
    notes: "",
  });

  const handleNarrativePresetChange = (id: string) => {
    if (id === DECK_NARRATIVE_CUSTOM_PRESET_ID) {
      narrativeBeforeCustomRef.current = {
        preset: deckNarrativePresetId,
        notes: narrativeNotes,
      };
      setDeckNarrativePresetId(id);
      setCustomObjectiveOpen(true);
      return;
    }
    setDeckNarrativePresetId(id);
  };

  const cancelCustomObjective = () => {
    const snap = narrativeBeforeCustomRef.current;
    setDeckNarrativePresetId(snap.preset);
    setNarrativeNotes(snap.notes);
    setCustomObjectiveOpen(false);
  };

  const saveCustomObjective = (text: string) => {
    setNarrativeNotes(text);
    setDeckNarrativePresetId(DECK_NARRATIVE_CUSTOM_PRESET_ID);
    setCustomObjectiveOpen(false);
  };

  const canConfirm =
    Boolean(generateFullDeckTopic.trim()) ||
    generateFullDeckAttachments.length > 0;

  const closeModal = () => {
    if (busy) return;
    if (customObjectiveOpen) {
      cancelCustomObjective();
    }
    setShowGenerateFullDeckModal(false);
  };

  const handlePaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
    const text = e.clipboardData.getData("text/plain");
    if (text.length < LARGE_PASTE_CHAR_THRESHOLD) return;
    e.preventDefault();
    addGenerateFullDeckAttachment(
      createPromptAttachment(
        nextPastedDocumentName(generateFullDeckAttachments.length),
        text,
      ),
    );
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (!text.trim()) return;
      addGenerateFullDeckAttachment(createPromptAttachment(file.name, text));
    };
    reader.readAsText(file);
  };

  return (
    <>
    <AnimatePresence>
      {showGenerateFullDeckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm"
            onClick={closeModal}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-surface-elevated rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-stone-100 dark:border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-medium text-stone-900 dark:text-foreground">
                    Generar toda la presentación
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-muted-foreground">
                    Se generará el conjunto de diapositivas a partir del tema (se
                    reemplaza el contenido actual). Un pegado muy largo se añade
                    como documento.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors text-stone-400 dark:text-stone-500"
                disabled={busy}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,text/plain"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={handleFileChange}
              />
              <div className="space-y-2">
                <label
                  htmlFor="full-deck-topic"
                  className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground"
                >
                  Tema o instrucción
                </label>
                <PromptAttachmentsRow
                  items={generateFullDeckAttachments}
                  onRemove={removeGenerateFullDeckAttachment}
                  className="-mx-1"
                />
                <textarea
                  id="full-deck-topic"
                  value={generateFullDeckTopic}
                  onChange={(e) => setGenerateFullDeckTopic(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Ej: Introducción a Rust para equipo de backend, 8 diapositivas…"
                  className="w-full h-32 p-4 bg-white dark:bg-surface border border-stone-200 dark:border-border rounded-xl text-stone-900 dark:text-foreground placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-sm"
                  disabled={busy}
                />
              </div>
              <div className="space-y-2 rounded-xl bg-stone-50/80 dark:bg-stone-900/30 px-3 py-3 border border-stone-100/80 dark:border-stone-800/50">
                <p className="text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  Objetivo del contenido
                </p>
                <ModelSelect
                  value={deckNarrativePresetId}
                  options={NARRATIVE_PRESET_COMBO_OPTIONS}
                  onChange={handleNarrativePresetChange}
                  disabled={busy}
                  size="sm"
                  appearance="field"
                  className="w-full max-w-sm"
                  aria-label="Objetivo del contenido"
                />
              </div>
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-border hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50"
                >
                  <Plus size={18} />
                  Adjuntar archivo de texto
                </button>
              </div>
              <button
                type="button"
                onClick={handleConfirmGenerateFullDeck}
                disabled={busy || !canConfirm}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 dark:hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {busy ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generando…
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generar presentación
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    <NarrativeCustomObjectiveModal
      isOpen={customObjectiveOpen}
      onCancel={cancelCustomObjective}
      onSave={saveCustomObjective}
      initialText={narrativeNotes}
      disabled={busy}
    />
    </>
  );
}
