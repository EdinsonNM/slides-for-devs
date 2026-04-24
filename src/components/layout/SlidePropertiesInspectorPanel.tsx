import { useCallback, useEffect, useRef, useState, type ChangeEventHandler } from "react";
import { Image as ImageIcon, Sparkles } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { SLIDE_TYPE } from "../../domain/entities";
import {
  isInspectorSlidePropertiesSectionVisible,
  slideTypeUsesSlideDeckBackgroundImage,
} from "../../domain/entities/slideInspectorSections";
import { cn } from "../../utils/cn";

export function SlidePropertiesInspectorPanel() {
  const {
    currentSlide,
    setCurrentSlideBackgroundImageUrl,
    setShowImageModal,
  } = usePresentation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlDraft, setUrlDraft] = useState("");

  const bgUrl = currentSlide?.slideBackgroundImageUrl?.trim() ?? "";
  const type = currentSlide?.type;

  useEffect(() => {
    setUrlDraft(bgUrl);
  }, [currentSlide?.id, bgUrl]);

  const onPickFile: ChangeEventHandler<HTMLInputElement> = (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f || !f.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      if (url) setCurrentSlideBackgroundImageUrl(url);
    };
    reader.readAsDataURL(f);
  };

  const applyUrl = useCallback(() => {
    const t = urlDraft.trim();
    if (t) setCurrentSlideBackgroundImageUrl(t);
  }, [urlDraft, setCurrentSlideBackgroundImageUrl]);

  if (!currentSlide) return null;

  if (!isInspectorSlidePropertiesSectionVisible(currentSlide.type)) {
    return null;
  }

  if (currentSlide.type === SLIDE_TYPE.CANVAS_3D) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white px-3 py-3 text-sm text-stone-600 dark:bg-surface-elevated dark:text-stone-300">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Fondo
        </p>
        <p className="mt-2 text-xs leading-relaxed">
          En diapositivas de Escena 3D, el fondo detrás del visor 3D se configura en la sección{" "}
          <span className="font-medium text-foreground">Escena 3D</span> (imagen bajo el lienzo
          WebGL).
        </p>
      </div>
    );
  }

  if (!slideTypeUsesSlideDeckBackgroundImage(currentSlide.type)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white px-3 py-3 text-sm text-stone-600 dark:bg-surface-elevated dark:text-stone-300">
        <p className="text-xs leading-relaxed">
          Este tipo de diapositiva no admite un fondo con imagen sobre el tema del deck.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white dark:bg-surface-elevated">
      <div className="shrink-0 border-b border-stone-100 px-3 py-2.5 dark:border-border">
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Propiedades del slide
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-stone-500 dark:text-stone-400">
          Imagen de fondo sobre el tema del deck (sólido, degradado o animado).
        </p>
      </div>
      <div className="space-y-3 px-3 py-3">
        <div
          className={cn(
            "rounded-lg border border-stone-200/90 bg-stone-50/50 p-2.5 dark:border-border dark:bg-white/5",
          )}
        >
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">
            Imagen de fondo
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[10px] font-medium hover:bg-white dark:border-border dark:hover:bg-white/10"
            >
              <ImageIcon className="size-3" aria-hidden />
              Subir…
            </button>
            <button
              type="button"
              onClick={() => setShowImageModal(true)}
              className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-800 hover:bg-violet-100 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-900/50"
            >
              <Sparkles className="size-3" aria-hidden />
              Generar (IA)…
            </button>
            {currentSlide.imageUrl?.trim() ? (
              <button
                type="button"
                onClick={() => {
                  const u = currentSlide.imageUrl?.trim();
                  if (u) setCurrentSlideBackgroundImageUrl(u);
                }}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
              >
                Usar imagen del slide
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-1.5">
            <label className="min-w-0 flex-1 text-[10px] text-stone-500 dark:text-stone-400">
              URL
              <input
                type="url"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://…"
                className="mt-0.5 w-full rounded border border-stone-200 bg-white px-1.5 py-1 font-mono text-[10px] dark:border-border dark:bg-surface"
              />
            </label>
            <button
              type="button"
              onClick={applyUrl}
              className="shrink-0 rounded-md border border-stone-200 px-2 py-1 text-[10px] font-medium hover:bg-stone-100 dark:border-border dark:hover:bg-white/10"
            >
              Aplicar
            </button>
          </div>
          {bgUrl ? (
            <button
              type="button"
              onClick={() => setCurrentSlideBackgroundImageUrl(undefined)}
              className="mt-2 text-[10px] text-red-600 hover:underline dark:text-red-400"
            >
              Quitar fondo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
