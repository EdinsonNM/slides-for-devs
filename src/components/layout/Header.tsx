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
  Moon,
  Sun,
  Monitor,
  StickyNote,
  Settings,
  UserPlus,
  RefreshCw,
  FileDown,
  LogOut,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../utils/cn";
import { IconButton } from "../shared/IconButton";
import { GoogleIcon } from "../shared/GoogleIcon";
import { checkForAppUpdates } from "../../services/updater";
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
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authMenuOpen, setAuthMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { firebaseReady, user, signInWithGoogle, signOut } = useAuth();
  const { preference, setPreference } = useTheme();

  const cycleTheme = () => {
    setPreference(
      preference === "light" ? "dark" : preference === "dark" ? "system" : "light"
    );
  };
  const themeTitle =
    preference === "light"
      ? "Tema claro (cambiar a oscuro)"
      : preference === "dark"
        ? "Tema oscuro (cambiar a sistema)"
        : "Tema según sistema (cambiar a claro)";

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

  const handleSignInWithGoogle = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setAuthMenuOpen(false);
    await signOut();
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
        {user ? (
          <div className="relative flex items-center gap-1 mr-1 shrink-0">
            <button
              type="button"
              onClick={() => setAuthMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full px-2 py-1 text-xs text-stone-600 dark:text-muted-foreground hover:bg-stone-100 dark:hover:bg-surface border border-stone-200 dark:border-border max-w-[180px]"
              title={user.email ?? "Cuenta"}
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="w-6 h-6 rounded-full shrink-0"
                />
              ) : (
                <span className="w-6 h-6 rounded-full bg-stone-300 dark:bg-stone-600 flex items-center justify-center text-stone-600 dark:text-stone-300 text-[10px] font-medium shrink-0">
                  {(user.email ?? "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="truncate">{user.email}</span>
            </button>
            {authMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden
                  onClick={() => setAuthMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-surface-elevated border border-stone-200 dark:border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 dark:text-foreground hover:bg-stone-50 dark:hover:bg-surface"
                  >
                    <LogOut size={16} />
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="relative flex items-center gap-1 mr-1 shrink-0">
            {firebaseReady === true ? (
              <button
                type="button"
                onClick={handleSignInWithGoogle}
                disabled={isSigningIn}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-foreground bg-stone-100 dark:bg-surface hover:bg-stone-200 dark:hover:bg-surface-elevated border border-stone-200 dark:border-border disabled:opacity-60 w-fit shrink-0"
              >
                {isSigningIn ? (
                  <Loader2 size={16} className="animate-spin shrink-0" />
                ) : (
                  <GoogleIcon className="shrink-0" />
                )}
                Iniciar sesión con Google
              </button>
            ) : (
              <IconButton
                variant="default"
                icon={<GoogleIcon className="shrink-0" />}
                aria-label="Iniciar sesión para sincronizar en la nube"
                title="Iniciar sesión para sincronizar (configura Firebase en .env o firebase_config.json)"
                className="w-fit shrink-0 opacity-70"
              />
            )}
          </div>
        )}
        <select
          value={presentationModelId}
          onChange={(e) => setPresentationModelId(e.target.value)}
          className="text-xs text-stone-500 dark:text-muted-foreground bg-transparent border-0 rounded px-2 py-1 focus:outline-none focus:ring-0 cursor-pointer max-w-[200px] hover:text-stone-700 dark:hover:text-foreground"
          title="Modelo para texto (presentación, reescribir, código, notas, chat)"
        >
          {presentationModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 shrink-0">
          <IconButton
            variant="default"
            icon={
              preference === "light" ? (
                <Sun size={18} />
              ) : preference === "dark" ? (
                <Moon size={18} />
              ) : (
                <Monitor size={18} />
              )
            }
            aria-label={themeTitle}
            title={themeTitle}
            onClick={cycleTheme}
          />
          <IconButton
            variant="default"
            icon={
              isCheckingUpdates ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <RefreshCw size={18} />
              )
            }
            aria-label="Buscar actualizaciones"
            title="Buscar actualizaciones"
            onClick={handleCheckUpdates}
            disabled={isCheckingUpdates}
          />
          {onOpenConfig && (
            <IconButton
              variant="default"
              icon={<Settings size={18} />}
              aria-label="Configuración (API keys)"
              title="Configuración (API keys)"
              onClick={onOpenConfig}
            />
          )}
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
    </header>
  );
}
