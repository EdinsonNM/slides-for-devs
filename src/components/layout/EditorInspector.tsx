import {
  LayoutTemplate,
  UserPlus,
  StickyNote,
  Palette,
  LibraryBig,
  Film,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { SlideStylePanel } from "./SlideStylePanel";
import { CharactersPanel } from "./CharactersPanel";
import { ResourcesPanel } from "./ResourcesPanel";
import { RiveInspectorPanel } from "./RiveInspectorPanel";
import { PresenterNotesPanel } from "../editor/PresenterNotesPanel";
import { RailTooltip } from "../shared/RailTooltip";

const SECTIONS: {
  id: "slide" | "characters" | "notes" | "theme" | "resources" | "rive";
  label: string;
  icon: typeof LayoutTemplate;
}[] = [
  { id: "slide", label: "Diapositiva", icon: LayoutTemplate },
  { id: "characters", label: "Personajes", icon: UserPlus },
  { id: "notes", label: "Notas", icon: StickyNote },
  { id: "theme", label: "Diseño y Tema", icon: Palette },
  { id: "resources", label: "Recursos", icon: LibraryBig },
  { id: "rive", label: "Rive", icon: Film },
];

export function EditorInspector() {
  const {
    inspectorSection,
    setInspectorSection,
    setShowSlideStylePanel,
    setShowCharactersPanel,
    setIsNotesPanelOpen,
    slides,
  } = usePresentation();

  const select = (id: (typeof SECTIONS)[number]["id"]) => {
    if (inspectorSection === id) {
      setInspectorSection(null);
      setShowSlideStylePanel(false);
      setShowCharactersPanel(false);
      setIsNotesPanelOpen(false);
      return;
    }

    setInspectorSection(id);
    if (id === "slide" || id === "theme") {
      setShowSlideStylePanel(true);
      setShowCharactersPanel(false);
      setIsNotesPanelOpen(false);
    } else if (id === "characters") {
      setShowCharactersPanel(true);
      setShowSlideStylePanel(false);
      setIsNotesPanelOpen(false);
    } else if (id === "resources" || id === "rive") {
      setShowSlideStylePanel(false);
      setShowCharactersPanel(false);
      setIsNotesPanelOpen(false);
    } else {
      setIsNotesPanelOpen(true);
      setShowSlideStylePanel(false);
      setShowCharactersPanel(false);
    }
  };

  if (slides.length === 0) return null;

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-row-reverse border-l border-stone-200/90 bg-white text-foreground lg:flex dark:border-border dark:bg-surface-elevated transition-[width] duration-200 ease-in-out",
        inspectorSection === null ? "w-16" : "w-[364px]"
      )}
      aria-label="Propiedades e inspector"
    >
      <div
        className="flex w-16 shrink-0 flex-col items-center gap-1.5 border-l border-stone-200/90 bg-stone-50/50 px-2 py-2 dark:border-border dark:bg-surface-elevated/40"
        role="tablist"
        aria-label="Secciones del inspector"
      >
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const active = inspectorSection === id;
          return (
            <RailTooltip key={id} label={label} detail={`Abrir ${label.toLowerCase()}`} side="left">
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  "flex size-full min-h-12 min-w-12 flex-col items-center justify-center rounded-lg text-foreground/90 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40",
                  active
                    ? "bg-stone-200/60 text-primary dark:bg-white/10"
                    : "hover:bg-stone-100/80 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground",
                )}
                onClick={() => select(id)}
              >
                <Icon size={20} className={cn(active && "stroke-[2.5px]")} />
              </button>
            </RailTooltip>
          );
        })}
      </div>

      {inspectorSection !== null && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-surface-elevated">
          {(inspectorSection === "slide" || inspectorSection === "theme") && (
            <SlideStylePanel variant="inspector" />
          )}
          {inspectorSection === "characters" && (
            <CharactersPanel variant="inspector" />
          )}
          {inspectorSection === "notes" && (
            <PresenterNotesPanel variant="inspector" />
          )}
          {inspectorSection === "resources" && (
            <ResourcesPanel variant="inspector" />
          )}
          {inspectorSection === "rive" && <RiveInspectorPanel />}
        </div>
      )}
    </aside>
  );
}
