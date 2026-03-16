import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  FolderOpen,
  LayoutTemplate,
  Maximize2,
  Save,
  Loader2,
  Mic,
  StickyNote,
  Settings,
  UserPlus,
  RefreshCw,
  FileDown,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { checkForAppUpdates, isTauri } from "../../services/updater";
import { exportPresentationToPowerPoint } from "../../services/exportToPowerPoint";

interface HeaderProps {
  onOpenConfig?: () => void;
}

export function Header(props: HeaderProps) {
  const { onOpenConfig } = props;
  const navigate = useNavigate();
  const {
    topic,
    setTopic,
    goHome,
    openSavedListModal,
    slides,
    handleSave,
    isSaving,
    saveMessage,
    currentSavedId,
    setIsPreviewMode,
    flushDiagramPending,
    setShowSpeechModal,
    isNotesPanelOpen,
    setIsNotesPanelOpen,
    presentationModelId,
    setPresentationModelId,
    presentationModels,
    setShowCharacterCreatorModal,
    showCharactersPanel,
    setShowCharactersPanel,
    showSlideStylePanel,
    setShowSlideStylePanel,
  } = usePresentation();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(topic || "");
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleExportPowerPoint = async () => {
    if (slides.length === 0) return;
    setIsExportingPptx(true);
    try {
      await exportPresentationToPowerPoint({
        topic: topic || "Presentación",
        slides,
      });
    } catch (e) {
      console.error(e);
      alert("Error al exportar a PowerPoint. Revisa la consola.");
    } finally {
      setIsExportingPptx(false);
    }
  };

  const handleCheckUpdates = async () => {
    if (isCheckingUpdates) return;
    setIsCheckingUpdates(true);
    await checkForAppUpdates(false);
    setIsCheckingUpdates(false);
  };

  useEffect(() => {
    setEditTitleValue(topic || "");
  }, [topic]);

  useEffect(() => {
    if (isEditingTitle) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingTitle]);

  const saveTitle = () => {
    const trimmed = editTitleValue.trim();
    setTopic(trimmed || "");
    setIsEditingTitle(false);
  };

  return (
    <header className="h-14 bg-white border-b border-stone-200 px-4 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => {
            goHome();
            navigate("/");
          }}
          className="p-2 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors shrink-0"
          title="Inicio"
        >
          <ChevronLeft size={18} />
        </button>
        {isEditingTitle ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitleValue}
            onChange={(e) => setEditTitleValue(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveTitle();
              }
              if (e.key === "Escape") {
                setEditTitleValue(topic || "");
                setIsEditingTitle(false);
                inputRef.current?.blur();
              }
            }}
            className="font-serif italic text-lg text-stone-900 bg-stone-50 border border-stone-300 rounded px-2 py-0.5 min-w-0 max-w-[40vw] focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Título de la presentación"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingTitle(true)}
            className="font-serif italic text-lg text-stone-900 truncate text-left hover:bg-stone-50 rounded px-1 py-0.5 -mx-1 min-w-0 max-w-[40vw]"
            title="Clic para cambiar el título"
          >
            {topic || "Nueva presentación"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={presentationModelId}
          onChange={(e) => setPresentationModelId(e.target.value)}
          className="text-xs text-stone-500 bg-transparent border-0 rounded px-2 py-1 focus:outline-none focus:ring-0 cursor-pointer max-w-[200px] hover:text-stone-700"
          title="Modelo para texto (presentación, reescribir, código, notas, chat)"
        >
          {presentationModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCheckUpdates}
            disabled={isCheckingUpdates}
            className="p-2 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors disabled:opacity-60"
            title="Buscar actualizaciones"
          >
            {isCheckingUpdates ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <RefreshCw size={18} />
            )}
          </button>
          {onOpenConfig && (
            <button
              type="button"
              onClick={onOpenConfig}
              className="p-2 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
              title="Configuración (API keys)"
            >
              <Settings size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsNotesPanelOpen(!isNotesPanelOpen)}
            className={cn(
              "p-2 rounded-md transition-colors",
              isNotesPanelOpen
                ? "bg-amber-100 text-amber-700"
                : "text-stone-500 hover:bg-stone-100 hover:text-amber-600"
            )}
            title={isNotesPanelOpen ? "Ocultar notas" : "Mostrar notas"}
          >
            <StickyNote size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowSpeechModal(true)}
            className="p-2 rounded-md text-stone-500 hover:bg-violet-100 hover:text-violet-600 transition-colors"
            title="Prompt general (generar speech para toda la presentación)"
          >
            <Mic size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowCharactersPanel(!showCharactersPanel)}
            className={cn(
              "p-2 rounded-md transition-colors",
              showCharactersPanel
                ? "bg-violet-100 text-violet-600"
                : "text-stone-500 hover:bg-violet-100 hover:text-violet-600"
            )}
            title="Personajes (crear, ver, eliminar)"
          >
            <UserPlus size={18} />
          </button>
          {slides.length > 0 && (
            <button
              type="button"
              onClick={() => setShowSlideStylePanel(!showSlideStylePanel)}
              className={cn(
                "p-2 rounded-md transition-colors",
                showSlideStylePanel
                  ? "bg-emerald-100 text-emerald-600"
                  : "text-stone-500 hover:bg-emerald-100 hover:text-emerald-600"
              )}
              title="Plantilla de la diapositiva"
            >
              <LayoutTemplate size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={openSavedListModal}
            className="p-2 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors hidden sm:inline-flex"
            title="Mis presentaciones"
          >
            <FolderOpen size={18} />
          </button>
          {slides.length > 0 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="p-2 rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-60 transition-colors"
              title={currentSavedId ? "Guardar cambios" : "Guardar"}
            >
              {isSaving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
            </button>
          )}
          {slides.length > 0 && (
            <button
              type="button"
              onClick={handleExportPowerPoint}
              disabled={isExportingPptx}
              className="p-2 rounded-md text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors disabled:opacity-60"
              title="Exportar a PowerPoint"
            >
              {isExportingPptx ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <FileDown size={18} />
              )}
            </button>
          )}
          {slides.length > 0 && (
            <button
              onClick={() => {
                flushSync(() => {
                  flushDiagramPending();
                });
                setIsPreviewMode(true);
              }}
              className="p-2 rounded-md bg-stone-800 text-white hover:bg-stone-700 transition-colors"
              title="Vista previa"
            >
              <Maximize2 size={18} />
            </button>
          )}
          {saveMessage && (
            <span className="text-[10px] text-stone-500 font-medium px-1">
              {saveMessage}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
