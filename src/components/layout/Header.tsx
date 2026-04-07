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
  Sparkles,
  MoreHorizontal,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { IconButton } from "../shared/IconButton";
import { AvatarMenu } from "../shared/AvatarMenu";
import { HeaderToolbarGroup } from "./HeaderToolbarGroup";
import { exportPresentationToPowerPoint } from "../../services/exportToPowerPoint";

interface HeaderProps {
  onOpenConfig?: () => void;
}

const panelActiveClass =
  "bg-stone-200/90 dark:bg-stone-600/50 text-stone-900 dark:text-stone-100";

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
    showCharactersPanel,
    setShowCharactersPanel,
    showSlideStylePanel,
    setShowSlideStylePanel,
    openGenerateFullDeckModal,
  } = usePresentation();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(topic || "");
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const handleExportPowerPoint = async () => {
    if (slides.length === 0) return;
    setIsExportingPptx(true);
    setMoreMenuOpen(false);
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

  const toggleCharactersPanel = () => {
    if (showCharactersPanel) {
      setShowCharactersPanel(false);
    } else {
      setShowSlideStylePanel(false);
      setShowCharactersPanel(true);
    }
  };

  const toggleSlideStylePanel = () => {
    if (showSlideStylePanel) {
      setShowSlideStylePanel(false);
    } else {
      setShowCharactersPanel(false);
      setShowSlideStylePanel(true);
    }
  };

  useEffect(() => {
    if (!moreMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreMenuOpen]);

  const saveTitle = () => {
    const trimmed = editTitleValue.trim();
    setTopic(trimmed || "");
    setIsEditingTitle(false);
  };

  const workspaceButtons = (
    <>
      <IconButton
        variant="default"
        icon={<StickyNote size={18} />}
        aria-label={isNotesPanelOpen ? "Ocultar notas" : "Mostrar notas"}
        title={isNotesPanelOpen ? "Ocultar notas del presentador" : "Mostrar notas del presentador"}
        onClick={() => setIsNotesPanelOpen(!isNotesPanelOpen)}
        className={cn(isNotesPanelOpen && panelActiveClass)}
      />
      <IconButton
        variant="default"
        icon={<Mic size={18} />}
        aria-label="Prompt general (generar speech para toda la presentación)"
        title="Prompt general (generar speech para toda la presentación)"
        onClick={() => setShowSpeechModal(true)}
      />
      <div className="hidden xl:contents">
        <IconButton
          variant="default"
          icon={<UserPlus size={18} />}
          aria-label="Personajes (crear, ver, eliminar)"
          title="Personajes (crear, ver, eliminar)"
          onClick={toggleCharactersPanel}
          className={cn(showCharactersPanel && panelActiveClass)}
        />
        {slides.length > 0 && (
          <IconButton
            variant="default"
            icon={<LayoutTemplate size={18} />}
            aria-label="Plantilla de la diapositiva"
            title="Plantilla de la diapositiva"
            onClick={toggleSlideStylePanel}
            className={cn(showSlideStylePanel && panelActiveClass)}
          />
        )}
      </div>
    </>
  );

  const fileCloudInline = (
    <>
      <IconButton
        variant="default"
        icon={<FolderOpen size={18} />}
        aria-label="Mis presentaciones"
        title="Mis presentaciones"
        onClick={openSavedListModal}
      />
    </>
  );

  const exportButton = slides.length > 0 && (
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
      className="hidden xl:inline-flex"
    />
  );

  return (
    <header className="h-14 bg-white dark:bg-surface-elevated border-b border-stone-200 dark:border-border px-4 flex items-center justify-between z-10 shrink-0 gap-3">
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
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <nav
          aria-label="Barra de herramientas del editor"
          className="flex items-center min-w-0 overflow-x-auto overflow-y-visible carousel-no-scrollbar"
        >
          <HeaderToolbarGroup>
            <IconButton
              variant="default"
              icon={<Sparkles size={18} />}
              aria-label="Generar toda la presentación con IA"
              title="Generar toda la presentación con IA (reemplaza diapositivas). El modelo se elige en Configuración (menú de cuenta)."
              onClick={openGenerateFullDeckModal}
            />
          </HeaderToolbarGroup>
          <HeaderToolbarGroup>{workspaceButtons}</HeaderToolbarGroup>
          <HeaderToolbarGroup className="hidden xl:flex">{fileCloudInline}</HeaderToolbarGroup>
          <HeaderToolbarGroup className="items-center">
            {exportButton}
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
              <span className="text-[10px] text-stone-500 dark:text-muted-foreground font-medium px-1 max-w-20 truncate xl:max-w-none">
                {saveMessage}
              </span>
            )}
          </HeaderToolbarGroup>
          <div ref={moreMenuRef} className="relative shrink-0 xl:hidden border-l border-stone-200 dark:border-border pl-3 ml-0">
            <IconButton
              variant="default"
              icon={<MoreHorizontal size={18} />}
              aria-label="Más opciones"
              title="Más opciones (archivo, exportar, paneles)"
              aria-expanded={moreMenuOpen}
              aria-haspopup="menu"
              onClick={() => setMoreMenuOpen((v) => !v)}
            />
            {moreMenuOpen && (
              <div
                role="menu"
                aria-label="Más opciones del editor"
                className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-stone-200 dark:border-border bg-white dark:bg-surface-elevated py-1 shadow-xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  className={cn(
                    "w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 text-stone-700 dark:text-foreground hover:bg-stone-100 dark:hover:bg-surface"
                  )}
                  onClick={() => {
                    setMoreMenuOpen(false);
                    openSavedListModal();
                  }}
                >
                  <FolderOpen size={16} className="shrink-0 opacity-70" />
                  Mis presentaciones
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={cn(
                    "w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 text-stone-700 dark:text-foreground hover:bg-stone-100 dark:hover:bg-surface",
                    showCharactersPanel && "bg-stone-100 dark:bg-surface"
                  )}
                  onClick={() => {
                    toggleCharactersPanel();
                    setMoreMenuOpen(false);
                  }}
                >
                  <UserPlus size={16} className="shrink-0 opacity-70" />
                  Personajes
                </button>
                {slides.length > 0 && (
                  <button
                    type="button"
                    role="menuitem"
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 text-stone-700 dark:text-foreground hover:bg-stone-100 dark:hover:bg-surface",
                      showSlideStylePanel && "bg-stone-100 dark:bg-surface"
                    )}
                    onClick={() => {
                      toggleSlideStylePanel();
                      setMoreMenuOpen(false);
                    }}
                  >
                    <LayoutTemplate size={16} className="shrink-0 opacity-70" />
                    Plantilla de diapositiva
                  </button>
                )}
                {slides.length > 0 && (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 text-stone-700 dark:text-foreground hover:bg-stone-100 dark:hover:bg-surface disabled:opacity-50"
                    onClick={handleExportPowerPoint}
                    disabled={isExportingPptx}
                  >
                    {isExportingPptx ? (
                      <Loader2 size={16} className="shrink-0 animate-spin" />
                    ) : (
                      <FileDown size={16} className="shrink-0 opacity-70" />
                    )}
                    Exportar PowerPoint
                  </button>
                )}
              </div>
            )}
          </div>
        </nav>
        <AvatarMenu onOpenConfig={onOpenConfig} className="ml-0 shrink-0" />
      </div>
    </header>
  );
}
