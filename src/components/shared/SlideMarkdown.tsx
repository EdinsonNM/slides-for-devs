import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "../../utils/cn";

interface SlideMarkdownProps {
  children: string;
  className?: string;
  /** Componentes personalizados para ReactMarkdown (p. ej. para código) */
  components?: Components;
}

/**
 * Wrapper consistente de ReactMarkdown + remarkBreaks + remarkGfm para contenido de slides.
 * Soporta listas, negritas, tablas, tachado y saltos de línea. Usado en editor, preview y presentador.
 */
export function SlideMarkdown({ children, className, components }: SlideMarkdownProps) {
  return (
    <div
      className={cn(
        "prose prose-stone max-w-none",
        "prose-p:text-stone-600 dark:prose-p:text-stone-300 prose-p:mt-0 prose-p:mb-3 last:prose-p:mb-0",
        "prose-li:text-stone-600 dark:prose-li:text-stone-300 prose-ul:my-3 prose-ol:my-3 prose-li:my-1",
        "prose-h1:font-bold prose-h1:text-stone-900 dark:prose-h1:text-stone-100 prose-h1:mt-4 prose-h1:mb-2",
        "prose-h2:font-semibold prose-h2:text-stone-800 dark:prose-h2:text-stone-200 prose-h2:mt-4 prose-h2:mb-2 prose-h2:text-xl",
        "prose-h3:font-semibold prose-h3:text-stone-800 dark:prose-h3:text-stone-200 prose-h3:mt-3 prose-h3:mb-1 prose-h3:text-lg",
        "prose-strong:text-stone-800 dark:prose-strong:text-stone-200",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
