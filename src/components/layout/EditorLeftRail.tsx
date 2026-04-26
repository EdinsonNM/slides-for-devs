import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Home,
  Clapperboard,
  FileDown,
  Image as ImageIcon,
  Loader2,
  UserPlus,
  LayoutTemplate,
  Sparkles,
  Mic,
  StickyNote,
  BookText,
  Settings2,
} from "lucide-react";
import { PRESENTATION_MODELS } from "../../constants/presentationModels";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { exportPresentationToPowerPoint } from "../../services/exportToPowerPoint";
import { exportCurrentSlideAsImage } from "../../services/exportSlideAsImage";
import { RailPresentationModelPicker } from "../shared/RailPresentationModelPicker";
import { RailTooltip } from "../shared/RailTooltip";
import { cn } from "../../utils/cn";

interface EditorLeftRailProps {
  onOpenConfig?: () => void;
}

const railIconBtnClass =
  "flex size-full min-h-9 min-w-9 items-center justify-center rounded-lg text-foreground/90 outline-none hover:bg-stone-100 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40";

export function EditorLeftRail({ onOpenConfig: _onOpenConfig }: EditorLeftRailProps) {
  void _onOpenConfig;
  const navigate = useNavigate();
  const {
    goHome,
    slides,
    currentIndex,
    deckVisualTheme,
    topic,
    openGenerateFullDeckModal,
    openExportDeckVideoModal,
    setShowCharactersPanel,
    setShowSlideStylePanel,
    setInspectorSection,
    setIsNotesPanelOpen,
    setIsReadmePanelOpen,
    isReadmePanelOpen,
    setIsPresentationSettingsPanelOpen,
    isPresentationSettingsPanelOpen,
    setShowSpeechModal,
    presentationModelId,
    presentationModels,
    captureWorkspaceSnapshot,
  } = usePresentation();

  const [exporting, setExporting] = useState(false);
  const [pptxExportDetail, setPptxExportDetail] = useState<string | null>(null);
  const [exportingSlideImage, setExportingSlideImage] = useState(false);

  const goPanels = (
    which: "characters" | "template" | "notes" | "readme" | "presentationSettings",
  ) => {
    if (which === "characters") {
      setInspectorSection("characters");
      setShowCharactersPanel(true);
      setShowSlideStylePanel(false);
      setIsReadmePanelOpen(false);
      setIsPresentationSettingsPanelOpen(false);
    } else if (which === "template") {
      setInspectorSection("slide");
      setShowSlideStylePanel(true);
      setShowCharactersPanel(false);
      setIsReadmePanelOpen(false);
      setIsPresentationSettingsPanelOpen(false);
    } else if (which === "notes") {
      setInspectorSection("notes");
      setIsNotesPanelOpen(true);
      setShowCharactersPanel(false);
      setShowSlideStylePanel(false);
      setIsReadmePanelOpen(false);
      setIsPresentationSettingsPanelOpen(false);
    } else if (which === "presentationSettings") {
      setIsPresentationSettingsPanelOpen(true);
      setIsReadmePanelOpen(false);
      setIsNotesPanelOpen(false);
      setShowCharactersPanel(false);
      setShowSlideStylePanel(false);
      setInspectorSection(null);
    } else {
      setIsReadmePanelOpen(true);
      setIsPresentationSettingsPanelOpen(false);
      setIsNotesPanelOpen(false);
      setShowCharactersPanel(false);
      setShowSlideStylePanel(false);
      setInspectorSection(null);
    }
  };

  const exportPptx = async () => {
    if (slides.length === 0) return;
    setExporting(true);
    setPptxExportDetail("Preparando exportación…");
    try {
      const snap = flushSync(() => captureWorkspaceSnapshot());
      await exportPresentationToPowerPoint(
        {
          topic: snap.topic || "Presentación",
          slides: snap.slides,
          deckVisualTheme: snap.deckVisualTheme,
        },
        undefined,
        {
          onExportProgress: (info) => {
            flushSync(() => {
              if (info.phase === "capture_start") {
                setPptxExportDetail(
                  `Capturando diapositiva ${info.slideIndex + 1} de ${info.totalSlides}…`,
                );
              } else if (info.phase === "pptx_packaging") {
                setPptxExportDetail(
                  "Generando archivo PowerPoint (puede tardar con muchas imágenes)…",
                );
              }
            });
          },
        },
      );
    } catch (e) {
      console.error(e);
      alert("Error al exportar a PowerPoint.");
    } finally {
      setExporting(false);
      setPptxExportDetail(null);
    }
  };

  const exportSlideImage = async () => {
    const currentSlide = slides[currentIndex];
    if (!currentSlide) return;
    setExportingSlideImage(true);
    try {
      const snap = flushSync(() => captureWorkspaceSnapshot());
      const slide = snap.slides[snap.currentIndex];
      if (!slide) throw new Error("No se encontró la diapositiva actual.");
      await exportCurrentSlideAsImage(slide, snap.currentIndex, snap.deckVisualTheme);
    } catch (e) {
      console.error(e);
      alert(
        e instanceof Error
          ? e.message
          : "Error al exportar la diapositiva como imagen.",
      );
    } finally {
      setExportingSlideImage(false);
    }
  };

  const hasSlides = slides.length > 0;

  const currentModelLabel = useMemo(() => {
    const fromAllowed = presentationModels.find((m) => m.id === presentationModelId);
    if (fromAllowed) return fromAllowed.label;
    return PRESENTATION_MODELS.find((m) => m.id === presentationModelId)?.label ?? null;
  }, [presentationModelId, presentationModels]);

  return (
    <aside
      className="z-20 flex w-16 shrink-0 flex-col items-center gap-1.5 border-r border-stone-200/90 bg-white px-2 py-2 dark:border-border dark:bg-surface-elevated"
      aria-label="Navegación principal del editor"
    >
      <RailTooltip label="Inicio" detail="Volver al inicio">
        <button
          type="button"
          className={railIconBtnClass}
          aria-label="Inicio"
          onClick={() => {
            goHome();
            navigate("/");
          }}
        >
          <Home size={20} strokeWidth={1.75} />
        </button>
      </RailTooltip>

      <RailTooltip
        label="Modelo de IA"
        detail={
          currentModelLabel ??
          "Configura al menos una API key (Gemini, OpenAI, Groq…) en el menú de tu cuenta."
        }
      >
        <RailPresentationModelPicker triggerClassName={railIconBtnClass} />
      </RailTooltip>

      <div
        className="flex w-full flex-col items-center gap-1 border-t border-stone-200/80 pt-1.5 dark:border-stone-600/60"
        role="toolbar"
        aria-label="Acciones de presentación"
      >
        <RailTooltip
          label="Generar con IA"
          detail="Toda la presentación a partir del tema (usa el modelo elegido arriba)."
        >
          <button
            type="button"
            className={railIconBtnClass}
            aria-label="Generar toda la presentación con IA"
            disabled={!hasSlides}
            onClick={() => openGenerateFullDeckModal()}
          >
            <Sparkles size={18} strokeWidth={2} />
          </button>
        </RailTooltip>
        <RailTooltip label="Speech" detail="Notas y speech para todas las diapositivas.">
          <button
            type="button"
            className={railIconBtnClass}
            aria-label="Speech para toda la presentación"
            disabled={!hasSlides}
            onClick={() => setShowSpeechModal(true)}
          >
            <Mic size={18} strokeWidth={2} />
          </button>
        </RailTooltip>
        <RailTooltip label="Exportar vídeo" detail="Render con Remotion.">
          <button
            type="button"
            className={railIconBtnClass}
            aria-label="Exportar vídeo"
            disabled={!hasSlides}
            onClick={() => openExportDeckVideoModal()}
          >
            <Clapperboard size={18} strokeWidth={2} />
          </button>
        </RailTooltip>
        <RailTooltip
          label={exporting ? "Exportando…" : "Exportar a PowerPoint"}
          detail={
            exporting
              ? pptxExportDetail ?? "Generando archivo .pptx"
              : "Descarga compatible con Microsoft PowerPoint."
          }
        >
          <button
            type="button"
            className={railIconBtnClass}
            aria-label="Exportar a PowerPoint"
            disabled={!hasSlides || exporting}
            onClick={() => void exportPptx()}
          >
            {exporting ? (
              <Loader2 size={18} strokeWidth={2} className="animate-spin" aria-hidden />
            ) : (
              <FileDown size={18} strokeWidth={2} />
            )}
          </button>
        </RailTooltip>
        <RailTooltip
          label={exportingSlideImage ? "Exportando imagen…" : "Exportar diapositiva"}
          detail={
            exportingSlideImage
              ? "Capturando diapositiva como PNG…"
              : "Exportar la diapositiva actual como imagen PNG (1920×1080)."
          }
        >
          <button
            type="button"
            className={railIconBtnClass}
            aria-label="Exportar diapositiva como imagen"
            disabled={!hasSlides || exportingSlideImage || exporting}
            onClick={() => void exportSlideImage()}
          >
            {exportingSlideImage ? (
              <Loader2 size={18} strokeWidth={2} className="animate-spin" aria-hidden />
            ) : (
              <ImageIcon size={18} strokeWidth={2} />
            )}
          </button>
        </RailTooltip>
      </div>

      <div
        className="flex w-full flex-col items-center gap-1 border-t border-stone-200/80 pt-1.5 dark:border-stone-600/60"
        role="toolbar"
        aria-label="Paneles del editor"
      >
        <RailTooltip label="Personajes" detail="Avatares y voz para la presentación.">
          <button
            type="button"
            className={railIconBtnClass}
            aria-label="Personajes"
            onClick={() => goPanels("characters")}
          >
            <UserPlus size={18} strokeWidth={2} />
          </button>
        </RailTooltip>
        <RailTooltip label="Plantilla" detail="Estilos de la diapositiva actual.">
          <button
            type="button"
            className={railIconBtnClass}
            aria-label="Plantilla de diapositiva"
            disabled={!hasSlides}
            onClick={() => goPanels("template")}
          >
            <LayoutTemplate size={18} strokeWidth={2} />
          </button>
        </RailTooltip>
        <RailTooltip label="Notas del presentador" detail="Vista para notas y teleprompter.">
          <button
            type="button"
            className={railIconBtnClass}
            aria-label="Notas del presentador"
            disabled={!hasSlides}
            onClick={() => goPanels("notes")}
          >
            <StickyNote size={18} strokeWidth={2} />
          </button>
        </RailTooltip>
        <RailTooltip
          label="README de la presentación"
          detail="Documentación en Markdown (objetivo, público, enlaces…)."
        >
          <button
            type="button"
            className={cn(
              railIconBtnClass,
              isReadmePanelOpen && "bg-stone-200/60 dark:bg-white/10",
            )}
            aria-label="README de la presentación"
            disabled={!hasSlides}
            onClick={() => goPanels("readme")}
          >
            <BookText size={18} strokeWidth={2} />
          </button>
        </RailTooltip>
        <RailTooltip
          label="Configuración de la presentación"
          detail="Publicación en Slaim: visibilidad, descripción, tags, nivel y categorías."
        >
          <button
            type="button"
            className={cn(
              railIconBtnClass,
              isPresentationSettingsPanelOpen && "bg-stone-200/60 dark:bg-white/10",
            )}
            aria-label="Configuración de la presentación"
            disabled={!hasSlides}
            onClick={() => goPanels("presentationSettings")}
          >
            <Settings2 size={18} strokeWidth={2} />
          </button>
        </RailTooltip>
      </div>
    </aside>
  );
}
