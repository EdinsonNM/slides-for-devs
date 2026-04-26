import { useCallback, useEffect, useRef } from "react";
import { BookText, Save, WandSparkles, X } from "lucide-react";
import Vditor from "vditor";
import "vditor/dist/index.css";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";

const README_TEMPLATE = `# README de la presentación

## Objetivo
- Explica qué problema resuelve esta presentación.

## Público objetivo
- ¿Para quién está diseñada?

## Conceptos clave
- Concepto 1
- Concepto 2

## Referencias
- [Enlace útil](https://example.com)

## Cómo reutilizar
- Qué partes puedes adaptar rápido.

## Notas del presentador
- Tips para presentar mejor este deck.
`;

const README_TOOLBAR: string[] = [
  "headings",
  "bold",
  "italic",
  "strike",
  "link",
  "|",
  "list",
  "ordered-list",
  "check",
  "|",
  "quote",
  "line",
  "code",
  "inline-code",
  "|",
  "table",
  "|",
  "undo",
  "redo",
  "|",
  "edit-mode",
  "outline",
  "preview",
  "fullscreen",
];

function isAppDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function safeDestroyVditor(vd: Vditor): void {
  try {
    // Vditor puede quedar a medio inicializar si el componente se desmonta muy pronto.
    const internal = vd as Vditor & { vditor?: { element?: unknown } };
    if (internal.vditor?.element) {
      vd.destroy();
    }
  } catch {
    // Evita romper la UI si Vditor lanza en destroy.
  }
}

/**
 * README de la presentación en el área central del editor.
 * Vditor modo **IR** (instant render): edición con Markdown y vista renderizada al vuelo, cercana a Typora.
 */
export function PresentationReadmeEditor() {
  const {
    presentationReadme,
    setPresentationReadme,
    setIsReadmePanelOpen,
    isGeneratingReadme,
    handleGenerateReadmeWithAi,
    handleSave,
    isSaving,
  } = usePresentation();

  const mountRef = useRef<HTMLDivElement>(null);
  const vditorRef = useRef<Vditor | null>(null);
  const syncingFromParentRef = useRef(false);
  /** Evita `setValue` cuando el cambio de `presentationReadme` viene del propio editor. */
  const lastMarkdownFromEditorRef = useRef(presentationReadme);

  const applyTheme = useCallback((vd: Vditor) => {
    vd.setTheme(isAppDark() ? "dark" : "classic");
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let disposed = false;
    let ready = false;

    const vd = new Vditor(el, {
      value: presentationReadme,
      mode: "ir",
      lang: "es_ES",
      theme: isAppDark() ? "dark" : "classic",
      cache: { enable: false },
      height: "100%",
      minHeight: 320,
      width: "100%",
      toolbar: README_TOOLBAR,
      toolbarConfig: { pin: false },
      outline: { enable: true, position: "left" },
      preview: { delay: 200, maxWidth: 900 },
      input: (value) => {
        if (syncingFromParentRef.current) return;
        lastMarkdownFromEditorRef.current = value;
        setPresentationReadme(value);
      },
      after: () => {
        if (disposed) {
          safeDestroyVditor(vd);
          return;
        }
        ready = true;
        vditorRef.current = vd;
        applyTheme(vd);
      },
    });

    return () => {
      disposed = true;
      vditorRef.current = null;
      if (ready) {
        safeDestroyVditor(vd);
      }
    };
    // Montar Vditor una sola vez; el markdown inicial es el de este render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const vd = vditorRef.current;
    if (!vd || syncingFromParentRef.current) return;
    if (presentationReadme === lastMarkdownFromEditorRef.current) return;
    const current = vd.getValue();
    if (current === presentationReadme) return;
    syncingFromParentRef.current = true;
    try {
      vd.setValue(presentationReadme, true);
      lastMarkdownFromEditorRef.current = presentationReadme;
    } finally {
      queueMicrotask(() => {
        syncingFromParentRef.current = false;
      });
    }
  }, [presentationReadme]);

  useEffect(() => {
    const root = document.documentElement;
    const obs = new MutationObserver(() => {
      const vd = vditorRef.current;
      if (vd) applyTheme(vd);
    });
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [applyTheme]);

  const handleInsertTemplate = () => {
    const vd = vditorRef.current;
    if (!vd) return;
    syncingFromParentRef.current = true;
    try {
      vd.setValue(README_TEMPLATE, true);
      lastMarkdownFromEditorRef.current = README_TEMPLATE;
      setPresentationReadme(README_TEMPLATE);
    } finally {
      queueMicrotask(() => {
        syncingFromParentRef.current = false;
      });
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-stone-100 dark:bg-stone-950">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200/90 bg-white px-3 py-2 dark:border-border dark:bg-surface-elevated">
        <div className="flex min-w-0 items-center gap-2 text-stone-800 dark:text-foreground">
          <BookText size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">
              README de la presentación
            </h1>
            <p className="truncate text-[11px] text-muted-foreground">
              Modo instantáneo (IR): escribe Markdown y se renderiza al vuelo, estilo Typora.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-surface dark:text-stone-100 dark:hover:bg-white/10"
          >
            <Save size={14} />
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => void handleGenerateReadmeWithAi()}
            disabled={isGeneratingReadme}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
          >
            <WandSparkles size={14} />
            {isGeneratingReadme ? "Generando..." : "Generar con IA"}
          </button>
          <button
            type="button"
            onClick={handleInsertTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-border dark:bg-surface dark:text-stone-200 dark:hover:bg-white/5"
          >
            <WandSparkles size={14} />
            Plantilla
          </button>
          <button
            type="button"
            onClick={() => setIsReadmePanelOpen(false)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium",
              "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10",
            )}
            aria-label="Cerrar README y volver al lienzo"
          >
            <X size={16} />
            Cerrar
          </button>
        </div>
      </header>
      <div
        ref={mountRef}
        className="vditor-readme-host min-h-0 flex-1 overflow-hidden px-1 pb-1 pt-0 sm:px-2 sm:pb-2"
      />
    </div>
  );
}
