import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Home,
  ChevronDown,
  FileDown,
  Loader2,
  UserPlus,
  LayoutTemplate,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { exportPresentationToPowerPoint } from "../../services/exportToPowerPoint";

interface EditorLeftRailProps {
  onOpenConfig?: () => void;
}

export function EditorLeftRail({ onOpenConfig: _onOpenConfig }: EditorLeftRailProps) {
  void _onOpenConfig;
  const navigate = useNavigate();
  const {
    goHome,
    slides,
    topic,
    openGenerateFullDeckModal,
    setShowCharactersPanel,
    setShowSlideStylePanel,
    setInspectorSection,
    setIsNotesPanelOpen,
  } = usePresentation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const goPanels = (which: "characters" | "template" | "notes") => {
    if (which === "characters") {
      setInspectorSection("characters");
      setShowCharactersPanel(true);
      setShowSlideStylePanel(false);
    } else if (which === "template") {
      setInspectorSection("slide");
      setShowSlideStylePanel(true);
      setShowCharactersPanel(false);
    } else {
      setInspectorSection("notes");
      setIsNotesPanelOpen(true);
      setShowCharactersPanel(false);
      setShowSlideStylePanel(false);
    }
    setMenuOpen(false);
  };

  const exportPptx = async () => {
    if (slides.length === 0) return;
    setExporting(true);
    setMenuOpen(false);
    try {
      await exportPresentationToPowerPoint({
        topic: topic || "Presentación",
        slides,
      });
    } catch (e) {
      console.error(e);
      alert("Error al exportar a PowerPoint.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <aside
      className="z-20 flex w-12 shrink-0 flex-col items-center gap-2 border-r border-stone-200/90 bg-white py-2 dark:border-border dark:bg-surface-elevated"
      aria-label="Navegación principal del editor"
    >
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground/90 outline-none hover:bg-stone-100 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Inicio"
        title="Volver al inicio"
        onClick={() => {
          goHome();
          navigate("/");
        }}
      >
        <Home size={20} strokeWidth={1.75} />
      </button>

      <div ref={menuRef} className="relative flex flex-col items-center">
        <button
          type="button"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg text-foreground/90 outline-none hover:bg-stone-100 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary",
            menuOpen && "bg-stone-100 dark:bg-white/10",
          )}
          aria-label="Menú archivo y paneles"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((v) => !v)}
          title="Menú"
        >
          <ChevronDown size={18} strokeWidth={2} />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute left-full top-0 z-50 ml-1 w-52 rounded-lg border border-stone-200 bg-white py-1 shadow-lg shadow-stone-900/8 dark:border-border dark:bg-surface-elevated dark:shadow-black/40"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-stone-50 dark:hover:bg-white/8"
              onClick={() => {
                goPanels("characters");
              }}
            >
              <UserPlus size={16} className="shrink-0 opacity-80" />
              Personajes
            </button>
            {slides.length > 0 && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-stone-50 dark:hover:bg-white/8"
                  onClick={() => {
                    goPanels("template");
                  }}
                >
                  <LayoutTemplate size={16} className="shrink-0 opacity-80" />
                  Plantilla de diapositiva
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-stone-50 dark:hover:bg-white/8"
                  onClick={() => goPanels("notes")}
                >
                  Notas del presentador
                </button>
              </>
            )}
            <button
              type="button"
              role="menuitem"
              disabled={slides.length === 0 || exporting}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-stone-50 dark:hover:bg-white/8 disabled:opacity-40"
              onClick={() => void exportPptx()}
            >
              {exporting ? (
                <Loader2 size={16} className="shrink-0 animate-spin" />
              ) : (
                <FileDown size={16} className="shrink-0 opacity-80" />
              )}
              Exportar PowerPoint
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-stone-50 dark:hover:bg-white/8"
              onClick={() => {
                setMenuOpen(false);
                openGenerateFullDeckModal();
              }}
            >
              Generar presentación (IA)
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
