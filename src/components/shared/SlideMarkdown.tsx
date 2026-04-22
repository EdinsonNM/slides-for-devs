import type { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "../../utils/cn";
import type { DeckContentTone } from "../../domain/entities";
import { formatMarkdownForDisplay } from "../../utils/markdown";

const MD_VERTICAL_SPACER = "\u00a0";

/** Párrafos generados por formatMarkdownForDisplay para respetar líneas en blanco extra (solo NBSP). */
const spacerAwareParagraph: NonNullable<Components["p"]> = ({ children, ...props }) => {
  const only =
    typeof children === "string"
      ? children
      : Array.isArray(children) &&
          children.length === 1 &&
          typeof (children as unknown[])[0] === "string"
        ? String((children as unknown[])[0])
        : null;
  if (only === MD_VERTICAL_SPACER) {
    return (
      <p
        className="my-2 min-h-[0.55rem] leading-none text-transparent select-none"
        aria-hidden
        {...props}
      >
        {MD_VERTICAL_SPACER}
      </p>
    );
  }
  return <p {...props}>{children}</p>;
};

interface SlideMarkdownProps {
  children: string;
  className?: string;
  style?: CSSProperties;
  /** Componentes personalizados para ReactMarkdown (p. ej. para código) */
  components?: Components;
  /**
   * Tono del tema del deck: `dark` = texto oscuro sobre fondo claro (por defecto).
   * `light` = texto claro sobre fondo oscuro (mejor contraste con presets medianoche / éter).
   */
  contentTone?: DeckContentTone;
}

function proseClassesForDeckTone(tone: DeckContentTone | undefined): string {
  const t = tone ?? "dark";
  if (t === "light") {
    return cn(
      "prose prose-stone max-w-none",
      "prose-invert",
      "prose-p:text-slate-200 prose-p:mt-0 prose-p:mb-4 last:prose-p:mb-0",
      "prose-li:text-slate-200 prose-ul:my-3 prose-ol:my-3 prose-li:my-1",
      "prose-h1:font-bold prose-h1:text-slate-50 prose-h1:mt-6 prose-h1:mb-2",
      "prose-h2:font-semibold prose-h2:text-slate-100 prose-h2:mt-8 prose-h2:mb-2 prose-h2:text-xl",
      "prose-h3:font-semibold prose-h3:text-slate-100 prose-h3:mt-8 prose-h3:mb-2 prose-h3:text-lg",
      "prose-hr:my-8 prose-hr:border-slate-600",
      "prose-strong:text-white prose-a:text-sky-300",
    );
  }
  return cn(
    "prose prose-stone max-w-none",
    "prose-p:text-stone-600 dark:prose-p:text-stone-300 prose-p:mt-0 prose-p:mb-4 last:prose-p:mb-0",
    "prose-li:text-stone-600 dark:prose-li:text-stone-300 prose-ul:my-3 prose-ol:my-3 prose-li:my-1",
    "prose-h1:font-bold prose-h1:text-stone-900 dark:prose-h1:text-stone-100 prose-h1:mt-6 prose-h1:mb-2",
    "prose-h2:font-semibold prose-h2:text-stone-800 dark:prose-h2:text-stone-200 prose-h2:mt-8 prose-h2:mb-2 prose-h2:text-xl",
    "prose-h3:font-semibold prose-h3:text-stone-800 dark:prose-h3:text-stone-200 prose-h3:mt-8 prose-h3:mb-2 prose-h3:text-lg",
    "prose-hr:my-8 prose-hr:border-stone-300 dark:prose-hr:border-stone-600",
    "prose-strong:text-stone-800 dark:prose-strong:text-stone-200",
  );
}

/**
 * Wrapper consistente de ReactMarkdown + remarkGfm + remarkBreaks para contenido de slides.
 * GFM primero evita interacciones raras entre plugins; breaks añade <br> en párrafos.
 */
export function SlideMarkdown({
  children,
  className,
  style,
  components,
  contentTone,
}: SlideMarkdownProps) {
  const md = formatMarkdownForDisplay(children ?? "");
  return (
    <div
      style={style}
      className={cn(proseClassesForDeckTone(contentTone), className)}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          ...components,
          p: components?.p ?? spacerAwareParagraph,
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}
