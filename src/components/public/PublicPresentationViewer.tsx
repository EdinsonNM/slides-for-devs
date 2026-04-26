import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Home, Loader2 } from "lucide-react";
import { PreviewSlideContent } from "../preview/PreviewSlideContent";
import {
  pullPresentationFromCloud,
  type PulledPresentation,
} from "../../services/presentationCloud";
import { normalizeDeckVisualTheme } from "../../domain/entities";

export function PublicPresentationViewer() {
  const navigate = useNavigate();
  const { ownerUid = "", cloudId = "" } = useParams<{
    ownerUid: string;
    cloudId: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deck, setDeck] = useState<PulledPresentation | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!ownerUid || !cloudId) {
      setError("Referencia de presentación inválida.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    pullPresentationFromCloud(ownerUid, cloudId)
      .then((res) => {
        if (cancelled) return;
        setDeck(res.presentation);
        setIndex(0);
      })
      .catch((e) => {
        console.error(e);
        if (cancelled) return;
        setError("No se pudo abrir esta presentación pública.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerUid, cloudId]);

  const currentSlide = deck?.slides[index];
  const total = deck?.slides.length ?? 0;
  const deckTheme = useMemo(
    () => normalizeDeckVisualTheme(deck?.deckVisualTheme),
    [deck?.deckVisualTheme],
  );

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => setIndex((i) => Math.min(total - 1, i + 1));

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-950 text-stone-100">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !deck || !currentSlide) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-stone-950 px-4 text-stone-100">
        <p className="text-sm text-red-300">{error ?? "Presentación no disponible."}</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="rounded-lg bg-stone-800 px-3 py-2 text-xs font-semibold hover:bg-stone-700"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 w-full min-w-0 flex-col overflow-hidden bg-stone-950 text-stone-100">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs hover:bg-white/10"
        >
          <Home className="h-3.5 w-3.5" />
          Inicio
        </button>
        <p className="line-clamp-1 text-sm font-semibold">{deck.topic || "Presentación pública"}</p>
        <span className="text-xs text-stone-400">
          {index + 1}/{total}
        </span>
      </header>

      <div className="relative flex min-h-0 flex-1 items-stretch justify-stretch">
        <PreviewSlideContent
          slide={currentSlide}
          slideIndex={index}
          layout="fullscreen"
          imageWidthPercent={60}
          panelHeightPercent={52}
          deckVisualTheme={deckTheme}
          disableEntryMotion
          hideSectionLabel
        />
        <button
          type="button"
          onClick={goPrev}
          disabled={index === 0}
          className="absolute left-3 top-1/2 z-40 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white disabled:opacity-40"
          aria-label="Anterior"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={index >= total - 1}
          className="absolute right-3 top-1/2 z-40 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white disabled:opacity-40"
          aria-label="Siguiente"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
