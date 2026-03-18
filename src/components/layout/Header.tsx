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
  UserPlus,
  FileDown,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { IconButton } from "../shared/IconButton";
import { ModelSelect } from "../shared/ModelSelect";
import { AvatarMenu } from "../shared/AvatarMenu";
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
    cloudSyncAvailable,
    autoCloudSyncOnSave,
    setAutoCloudSyncOnSave,
  } = usePresentation();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(topic || "");
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
    <header className="h-14 bg-white dark:bg-surface-elevated border-b border-stone-200 dark:border-border px-4 flex items-center justify-between z-10 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <IconButton
          variant="default"
          icon={<ChevronLeft size={18} />}
          aria-label="Inicio"
          title="Inicio"
          onClick={() => {
            goHome();
            navigate("/");
          }}
        />
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
            className={cn(
              "font-serif italic text-lg text-stone-900 dark:text-foreground bg-stone-50 dark:bg-surface border border-stone-300 dark:border-border rounded px-2 py-0.5 min-w-0 max-w-[40vw]",
              "focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            )}
            placeholder="Título de la presentación"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingTitle(true)}
            className="font-serif italic text-lg text-stone-900 dark:text-foreground truncate text-left hover:bg-stone-50 dark:hover:bg-surface rounded px-1 py-0.5 -mx-1 min-w-0 max-w-[40vw]"
            title="Clic para cambiar el título"
          >
            {topic || "Nueva presentación"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
        <ModelSelect
          value={presentationModelId}
          options={presentationModels}
          onChange={setPresentationModelId}
          size="sm"
          title="Modelo para texto (presentación, reescribir, código, notas, chat)"
          aria-label="Modelo para texto"
        />
        <div className="flex items-center gap-1 shrink-0">
          <IconButton
            variant="amber"
            active={isNotesPanelOpen}
            icon={<StickyNote size={18} />}
            aria-label={isNotesPanelOpen ? "Ocultar notas" : "Mostrar notas"}
            title={isNotesPanelOpen ? "Ocultar notas" : "Mostrar notas"}
            onClick={() => setIsNotesPanelOpen(!isNotesPanelOpen)}
          />
          <IconButton
            variant="violet"
            icon={<Mic size={18} />}
            aria-label="Prompt general (generar speech para toda la presentación)"
            title="Prompt general (generar speech para toda la presentación)"
            onClick={() => setShowSpeechModal(true)}
          />
          <IconButton
            variant="violet"
            active={showCharactersPanel}
            icon={<UserPlus size={18} />}
            aria-label="Personajes (crear, ver, eliminar)"
            title="Personajes (crear, ver, eliminar)"
            onClick={() => setShowCharactersPanel(!showCharactersPanel)}
          />
          {slides.length > 0 && (
            <IconButton
              variant="emerald"
              active={showSlideStylePanel}
              icon={<LayoutTemplate size={18} />}
              aria-label="Plantilla de la diapositiva"
              title="Plantilla de la diapositiva"
              onClick={() => setShowSlideStylePanel(!showSlideStylePanel)}
            />
          )}
          <IconButton
            variant="default"
            icon={<FolderOpen size={18} />}
            aria-label="Mis presentaciones"
            title="Mis presentaciones"
            onClick={openSavedListModal}
            className="hidden sm:inline-flex"
          />
          {cloudSyncAvailable && slides.length > 0 && (
            <label
              className="hidden xl:flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400 cursor-pointer shrink-0 max-w-[9rem] leading-tight"
              title="Si está activo, tras cada guardado se sube la presentación a la nube (con control de conflictos entre dispositivos)."
            >
              <input
                type="checkbox"
                checked={autoCloudSyncOnSave}
                onChange={(e) => setAutoCloudSyncOnSave(e.target.checked)}
                className="rounded border-stone-300 dark:border-stone-600 shrink-0"
              />
              <span className="select-none">Auto-sync nube</span>
            </label>
          )}
          {slides.length > 0 && (
            <IconButton
              variant="primary"
              icon={
                isSaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )
              }
              aria-label={currentSavedId ? "Guardar cambios" : "Guardar"}
              title={currentSavedId ? "Guardar cambios" : "Guardar"}
              onClick={handleSave}
              disabled={isSaving}
            />
          )}
          {slides.length > 0 && (
            <IconButton
              variant="default"
              icon={
                isExportingPptx ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <FileDown size={18} />
                )
              }
              aria-label="Exportar a PowerPoint"
              title="Exportar a PowerPoint"
              onClick={handleExportPowerPoint}
              disabled={isExportingPptx}
            />
          )}
          {slides.length > 0 && (
            <IconButton
              variant="primarySolid"
              icon={<Maximize2 size={18} />}
              aria-label="Vista previa"
              title="Vista previa"
              onClick={() => {
                flushSync(() => {
                  flushDiagramPending();
                });
                setIsPreviewMode(true);
              }}
            />
          )}
          {saveMessage && (
            <span className="text-[10px] text-stone-500 dark:text-muted-foreground font-medium px-1">
              {saveMessage}
            </span>
          )}
        </div>
        </div>
        <AvatarMenu onOpenConfig={onOpenConfig} className="ml-1" />
      </div>
    </header>
  );
}
