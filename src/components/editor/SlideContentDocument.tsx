import { useCallback, useRef } from "react";
import { FileUp, Trash2 } from "lucide-react";
import { usePresentation } from "../../presentation/contexts/PresentationContext";
import { useThemeOptional } from "../../presentation/contexts/ThemeContext";
import {
  inferSlideDocumentKind,
  readFileAsDataUrl,
  type SlideDocumentEmbed,
} from "../../domain/entities/SlideDocumentEmbed";
import { SlideDocumentSurface } from "../shared/SlideDocumentSurface";
import { cn } from "../../utils/cn";

const ACCEPT =
  ".pdf,.docx,.xlsx,.md,.markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/markdown,text/plain";

export function SlideContentDocument() {
  const { currentSlide, setCurrentSlideDocumentEmbed, deckVisualTheme } =
    usePresentation();
  const theme = useThemeOptional();
  const inputRef = useRef<HTMLInputElement>(null);

  const embed = currentSlide?.documentEmbed;
  const tone = deckVisualTheme.contentTone;
  /** README: colores alineados con el fondo real (slide `bg-background` = tema app). */
  const importedGithubScheme: "light" | "dark" =
    (theme?.isDark ??
      (typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")))
      ? "dark"
      : "light";

  const onPickFile = useCallback(
    async (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;
      const kind = inferSlideDocumentKind(file);
      if (kind == null) {
        window.alert(
          "Formato no reconocido. Usa PDF, Word (.docx), Excel (.xlsx) o Markdown (.md).",
        );
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const next: SlideDocumentEmbed = {
          dataUrl,
          fileName: file.name,
          kind,
        };
        setCurrentSlideDocumentEmbed(next);
      } catch (e) {
        window.alert(
          e instanceof Error ? e.message : "No se pudo leer el archivo",
        );
      }
    },
    [setCurrentSlideDocumentEmbed],
  );

  const chrome = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          void onPickFile(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "pointer-events-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/90 bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-950 shadow-sm transition-colors hover:bg-amber-500/25 sm:w-auto dark:border-amber-700/50 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20",
        )}
      >
        <FileUp className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        {embed ? "Cambiar archivo" : "Elegir archivo del equipo"}
      </button>
      {embed ? (
        <button
          type="button"
          onClick={() => setCurrentSlideDocumentEmbed(null)}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-stone-700 shadow-sm backdrop-blur dark:border-stone-600 dark:bg-stone-900/90 dark:text-stone-200"
          title="Quitar documento"
        >
          <Trash2 className="size-3.5 shrink-0" strokeWidth={2} />
          Quitar
        </button>
      ) : null}
    </>
  );

  return (
    <div className="absolute inset-0 z-0 flex min-h-0 min-w-0 flex-col bg-background">
      <SlideDocumentSurface
        embed={embed}
        deckContentTone={tone}
        importedGithubScheme={importedGithubScheme}
        className="min-h-0 flex-1"
        topChrome={chrome}
      />
      {embed ? (
        <p className="sr-only" aria-live="polite">
          Documento cargado: {embed.fileName}
        </p>
      ) : null}
    </div>
  );
}
