import { useEffect, useState, type ReactNode } from "react";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import type { DeckContentTone } from "../../domain/entities";
import type { SlideDocumentEmbed } from "../../domain/entities/SlideDocumentEmbed";
import { cn } from "../../utils/cn";
import { deckMutedTextClass } from "../../utils/deckSlideChrome";
import { SlideMarkdown } from "./SlideMarkdown";
import { dataUrlToArrayBuffer, textFromDataUrl } from "./slideDocumentDataUrl";

type LoadState = "idle" | "loading" | "ready" | "error";

export interface SlideDocumentSurfaceProps {
  embed: SlideDocumentEmbed | undefined;
  deckContentTone: DeckContentTone;
  className?: string;
  /** Controles adicionales (p. ej. carga) encima del documento, solo editor. */
  topChrome?: ReactNode;
}

export function SlideDocumentSurface({
  embed,
  deckContentTone,
  className,
  topChrome,
}: SlideDocumentSurfaceProps) {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [xlsxHtml, setXlsxHtml] = useState<string | null>(null);

  const tone = deckContentTone;

  useEffect(() => {
    if (!embed?.dataUrl) {
      setLoadState("idle");
      setErrorMessage(null);
      setDocxHtml(null);
      setXlsxHtml(null);
      return;
    }

    if (embed.kind === "pdf" || embed.kind === "markdown") {
      setLoadState("ready");
      setErrorMessage(null);
      setDocxHtml(null);
      setXlsxHtml(null);
      return;
    }

    let cancelled = false;
    setLoadState("loading");
    setErrorMessage(null);
    setDocxHtml(null);
    setXlsxHtml(null);

    (async () => {
      try {
        const ab = dataUrlToArrayBuffer(embed.dataUrl);
        if (embed.kind === "docx") {
          const { value } = await mammoth.convertToHtml({ arrayBuffer: ab });
          if (!cancelled) {
            setDocxHtml(value);
            setLoadState("ready");
          }
        } else if (embed.kind === "xlsx") {
          const wb = XLSX.read(ab, { type: "array" });
          const name = wb.SheetNames[0];
          if (!name) {
            throw new Error("El Excel no tiene hojas.");
          }
          const sheet = wb.Sheets[name]!;
          const html = XLSX.utils.sheet_to_html(sheet, {
            id: "slide-xlsx-table",
            editable: false,
          });
          if (!cancelled) {
            setXlsxHtml(html);
            setLoadState("ready");
          }
        } else {
          if (!cancelled) setLoadState("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setErrorMessage(
            e instanceof Error ? e.message : "No se pudo leer el documento",
          );
          setLoadState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [embed]);

  if (!embed?.dataUrl) {
    return (
      <div
        className={cn(
          "relative flex h-full min-h-0 w-full flex-col items-center justify-center gap-4 px-6 text-center",
          className,
        )}
      >
        {topChrome ? (
          <div className="flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:items-center">
            <div className="flex w-full flex-wrap items-center justify-center gap-2">
              {topChrome}
            </div>
            <p
              className={cn("text-sm max-w-prose", deckMutedTextClass(tone))}
            >
              Elige un PDF, Word (.docx), Excel (.xlsx) o Markdown. Se mostrará
              a pantalla completa en esta diapositiva.
            </p>
          </div>
        ) : (
          <p
            className={cn(
              "text-sm",
              deckMutedTextClass(tone),
            )}
          >
            Sube un PDF, Word (.docx), Excel (.xlsx) o Markdown para mostrarlo
            a pantalla completa.
          </p>
        )}
      </div>
    );
  }

  if (embed.kind === "pdf") {
    return (
      <div className={cn("relative flex h-full min-h-0 w-full flex-col", className)}>
        {topChrome ? (
          <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
            {topChrome}
          </div>
        ) : null}
        <iframe
          title={embed.fileName || "PDF"}
          src={embed.dataUrl}
          className="h-full min-h-0 w-full flex-1 border-0 bg-white"
        />
      </div>
    );
  }

  if (embed.kind === "markdown") {
    const raw = textFromDataUrl(embed.dataUrl);
    return (
      <div
        className={cn(
          "relative h-full min-h-0 w-full overflow-y-auto",
          className,
        )}
      >
        {topChrome ? (
          <div className="sticky top-0 z-10 flex flex-wrap gap-2 border-b border-stone-200/80 bg-background/90 px-3 py-2 backdrop-blur dark:border-border">
            {topChrome}
          </div>
        ) : null}
        <div className="px-4 py-3">
          <SlideMarkdown contentTone={tone}>{raw}</SlideMarkdown>
        </div>
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center",
          className,
          deckMutedTextClass(tone),
        )}
      >
        {topChrome ? (
          <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
            {topChrome}
          </div>
        ) : null}
        <p className="text-sm">Cargando documento…</p>
      </div>
    );
  }

  if (loadState === "error" && errorMessage) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-2 px-4 text-center",
          className,
        )}
      >
        {topChrome ? (
          <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
            {topChrome}
          </div>
        ) : null}
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {errorMessage}
        </p>
      </div>
    );
  }

  if (embed.kind === "docx" && docxHtml) {
    return (
      <div
        className={cn(
          "relative h-full min-h-0 w-full overflow-y-auto",
          className,
        )}
      >
        {topChrome ? (
          <div className="sticky top-0 z-10 flex flex-wrap gap-2 border-b border-stone-200/80 bg-background/90 px-3 py-2 backdrop-blur dark:border-border">
            {topChrome}
          </div>
        ) : null}
        <div
          className="slide-docx-html px-4 py-3 pr-5 prose prose-sm max-w-none dark:prose-invert"
          // eslint-disable-next-line react/no-danger -- HTML fiable: archivo local del usuario
          dangerouslySetInnerHTML={{ __html: docxHtml }}
        />
      </div>
    );
  }

  if (embed.kind === "xlsx" && xlsxHtml) {
    return (
      <div
        className={cn(
          "relative h-full min-h-0 w-full overflow-auto",
          className,
        )}
      >
        {topChrome ? (
          <div className="sticky top-0 z-10 flex flex-wrap gap-2 border-b border-stone-200/80 bg-background/90 px-3 py-2 backdrop-blur dark:border-border">
            {topChrome}
          </div>
        ) : null}
        <div
          className="min-w-0 p-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-stone-300 [&_td]:px-1.5 [&_td]:py-0.5 [&_td]:text-xs dark:[&_td]:border-stone-600 [&_th]:border [&_th]:border-stone-300 [&_th]:px-1.5 [&_th]:py-0.5 [&_th]:text-left [&_th]:text-xs dark:[&_th]:border-stone-600"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: xlsxHtml }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full items-center justify-center",
        className,
        deckMutedTextClass(tone),
      )}
    >
      {topChrome ? (
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
          {topChrome}
        </div>
      ) : null}
      <p className="text-sm">Vista de documento no disponible</p>
    </div>
  );
}
