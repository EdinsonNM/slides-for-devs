import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import { cn } from "../../utils/cn";

interface SlideMarkdownProps {
  children: string;
  className?: string;
  /** Componentes personalizados para ReactMarkdown (p. ej. para código) */
  components?: Components;
}

/**
 * Wrapper consistente de ReactMarkdown + remarkBreaks para contenido de slides.
 * Usado en editor, preview y presentador.
 */
export function SlideMarkdown({ children, className, components }: SlideMarkdownProps) {
  return (
    <div className={cn("prose prose-stone max-w-none prose-p:text-stone-600 prose-li:text-stone-600", className)}>
      <ReactMarkdown remarkPlugins={[remarkBreaks]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
