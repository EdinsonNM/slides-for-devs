import { LayoutTemplate, UserPlus, StickyNote } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { SlideStylePanel } from "./SlideStylePanel";
import { CharactersPanel } from "./CharactersPanel";
import { PresenterNotesPanel } from "../editor/PresenterNotesPanel";

const SECTIONS: {
  id: "slide" | "characters" | "notes";
  label: string;
  icon: typeof LayoutTemplate;
}[] = [
  { id: "slide", label: "Diapositiva", icon: LayoutTemplate },
  { id: "characters", label: "Personajes", icon: UserPlus },
  { id: "notes", label: "Notas", icon: StickyNote },
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
    setInspectorSection(id);
    if (id === "slide") {
      setShowSlideStylePanel(true);
      setShowCharactersPanel(false);
      setIsNotesPanelOpen(false);
    } else if (id === "characters") {
      setShowCharactersPanel(true);
      setShowSlideStylePanel(false);
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
      className="hidden w-[300px] shrink-0 flex-col border-l border-stone-200/90 bg-white text-foreground lg:flex dark:border-border dark:bg-surface-elevated"
      aria-label="Propiedades e inspector"
    >
      <div
        className="flex shrink-0 border-b border-stone-100 dark:border-border"
        role="tablist"
        aria-label="Secciones del inspector"
      >
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const active = inspectorSection === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold uppercase tracking-wide outline-none transition-colors",
                active
                  ? "bg-stone-50 text-primary dark:bg-background"
                  : "text-muted-foreground hover:bg-stone-50/90 dark:hover:bg-white/6 hover:text-foreground",
              )}
              onClick={() => select(id)}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {inspectorSection === "slide" && (
          <SlideStylePanel variant="inspector" />
        )}
        {inspectorSection === "characters" && (
          <CharactersPanel variant="inspector" />
        )}
        {inspectorSection === "notes" && (
          <PresenterNotesPanel variant="inspector" />
        )}
      </div>
    </aside>
  );
}
