import type { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "../../utils/cn";
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
}

/**
 * Wrapper consistente de ReactMarkdown + remarkGfm + remarkBreaks para contenido de slides.
 * GFM primero evita interacciones raras entre plugins; breaks añade <br> en párrafos.
 */
export function SlideMarkdown({ children, className, style, components }: SlideMarkdownProps) {
  const md = formatMarkdownForDisplay(children ?? "");
  return (
    <div
      style={style}
      className={cn(
        "prose prose-stone max-w-none",
        "prose-p:text-stone-600 dark:prose-p:text-stone-300 prose-p:mt-0 prose-p:mb-4 last:prose-p:mb-0",
        "prose-li:text-stone-600 dark:prose-li:text-stone-300 prose-ul:my-3 prose-ol:my-3 prose-li:my-1",
        "prose-h1:font-bold prose-h1:text-stone-900 dark:prose-h1:text-stone-100 prose-h1:mt-6 prose-h1:mb-2",
        "prose-h2:font-semibold prose-h2:text-stone-800 dark:prose-h2:text-stone-200 prose-h2:mt-8 prose-h2:mb-2 prose-h2:text-xl",
        "prose-h3:font-semibold prose-h3:text-stone-800 dark:prose-h3:text-stone-200 prose-h3:mt-8 prose-h3:mb-2 prose-h3:text-lg",
        "prose-hr:my-8 prose-hr:border-stone-300 dark:prose-hr:border-stone-600",
        "prose-strong:text-stone-800 dark:prose-strong:text-stone-200",
        className
      )}
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
