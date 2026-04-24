import { useEffect, useMemo } from "react";
import {
  LayoutTemplate,
  UserPlus,
  StickyNote,
  Palette,
  LibraryBig,
  BarChart3,
  Box,
  Image,
  Map,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";
import { SlideStylePanel } from "./SlideStylePanel";
import { CharactersPanel } from "./CharactersPanel";
import { ResourcesPanel } from "./ResourcesPanel";
import { PresenterNotesPanel } from "../editor/PresenterNotesPanel";
import { DataMotionRingInspectorPanel } from "./DataMotionRingInspectorPanel";
import { Scene3dInspectorPanel } from "./Scene3dInspectorPanel";
import { MapSlideInspectorPanel } from "./MapSlideInspectorPanel";
import { SlidePropertiesInspectorPanel } from "./SlidePropertiesInspectorPanel";
import { RailTooltip } from "../shared/RailTooltip";
import { SLIDE_TYPE } from "../../domain/entities";
import {
  isInspectorMapSlideSectionVisible,
  isInspectorScene3dSectionVisible,
  isInspectorSlidePropertiesSectionVisible,
} from "../../domain/entities/slideInspectorSections";

type InspectorSectionId =
  | "slide"
  | "slideProperties"
  | "characters"
  | "notes"
  | "theme"
  | "resources"
  | "dataRing"
  | "mapbox"
  | "scene3d";

type SectionDef = {
  id: InspectorSectionId;
  label: string;
  icon: typeof LayoutTemplate;
  /** Si no se define, la sección siempre se muestra en el rail. */
  isVisibleForSlideType?: (type: (typeof SLIDE_TYPE)[keyof typeof SLIDE_TYPE]) => boolean;
};

const SECTION_DEFS: SectionDef[] = [
  { id: "slide", label: "Diapositiva", icon: LayoutTemplate },
  {
    id: "slideProperties",
    label: "Propiedades",
    icon: Image,
    isVisibleForSlideType: isInspectorSlidePropertiesSectionVisible,
  },
  { id: "characters", label: "Personajes", icon: UserPlus },
  { id: "notes", label: "Notas", icon: StickyNote },
  { id: "theme", label: "Diseño y Tema", icon: Palette },
  { id: "resources", label: "Recursos", icon: LibraryBig },
  { id: "dataRing", label: "Aro de datos", icon: BarChart3 },
  {
    id: "mapbox",
    label: "Mapa Mapbox",
    icon: Map,
    isVisibleForSlideType: isInspectorMapSlideSectionVisible,
  },
  {
    id: "scene3d",
    label: "Escena 3D",
    icon: Box,
    isVisibleForSlideType: isInspectorScene3dSectionVisible,
  },
];

export function EditorInspector() {
  const {
    inspectorSection,
    setInspectorSection,
    setShowSlideStylePanel,
    setShowCharactersPanel,
    setIsNotesPanelOpen,
    slides,
    currentSlide,
  } = usePresentation();

  const visibleSections = useMemo(() => {
    const t = currentSlide?.type;
    if (t == null) {
      return SECTION_DEFS.filter((s) => !s.isVisibleForSlideType);
    }
    return SECTION_DEFS.filter((s) => !s.isVisibleForSlideType || s.isVisibleForSlideType(t));
  }, [currentSlide?.type]);

  useEffect(() => {
    if (!currentSlide) return;
    const t = currentSlide.type;
    if (inspectorSection === "scene3d" && t !== SLIDE_TYPE.CANVAS_3D) {
      setInspectorSection("slide");
    } else if (inspectorSection === "mapbox" && t !== SLIDE_TYPE.MAPS) {
      setInspectorSection("slide");
    } else if (
      inspectorSection === "slideProperties" &&
      !isInspectorSlidePropertiesSectionVisible(t)
    ) {
      setInspectorSection("slide");
    }
  }, [currentSlide?.id, currentSlide?.type, inspectorSection, setInspectorSection]);

  const select = (id: InspectorSectionId) => {
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
    } else if (
      id === "resources" ||
      id === "dataRing" ||
      id === "scene3d" ||
      id === "mapbox" ||
      id === "slideProperties"
    ) {
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
        inspectorSection === null ? "w-16" : "w-[364px]",
      )}
      aria-label="Propiedades e inspector"
    >
      <div
        className="flex w-16 shrink-0 flex-col items-center gap-1.5 border-l border-stone-200/90 bg-stone-50/50 px-2 py-2 dark:border-border dark:bg-surface-elevated/40"
        role="tablist"
        aria-label="Secciones del inspector"
      >
        {visibleSections.map(({ id, label, icon: Icon }) => {
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
          {inspectorSection === "slideProperties" && <SlidePropertiesInspectorPanel />}
          {inspectorSection === "characters" && <CharactersPanel variant="inspector" />}
          {inspectorSection === "notes" && <PresenterNotesPanel variant="inspector" />}
          {inspectorSection === "resources" && <ResourcesPanel variant="inspector" />}
          {inspectorSection === "dataRing" && <DataMotionRingInspectorPanel />}
          {inspectorSection === "mapbox" && <MapSlideInspectorPanel />}
          {inspectorSection === "scene3d" && <Scene3dInspectorPanel />}
        </div>
      )}
    </aside>
  );
}
