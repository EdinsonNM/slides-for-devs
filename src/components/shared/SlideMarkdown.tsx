import type { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "../../utils/cn";
import type { DeckContentTone } from "../../domain/entities";
import {
  formatMarkdownForDisplay,
  formatMarkdownImportedFile,
} from "../../utils/markdown";
import { slideMarkdownRehypePlugins } from "../../utils/slideMarkdownPipeline";

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

const MarkdownImg: NonNullable<Components["img"]> = (props) => {
  const { className, alt, ...rest } = props;
  return (
    <img
      alt={alt ?? ""}
      className={cn(
        "max-h-[min(70vh,720px)] w-auto max-w-full rounded-md",
        className,
      )}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  );
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
  /**
   * `display` (por defecto): preprocesado de diapositivas (listas, espacios, NBSP).
   * `importedFile`: solo normalizar newlines; usar para .md subidos (README estilo GitHub).
   */
  preprocess?: "display" | "importedFile";
  /**
   * Con `preprocess=importedFile`, paleta `data-gh` (GitHub). Debe alinearse con el **fond**
   * real (p. ej. `dark` si la app o el slide es oscuro). Si no se pasa, se infiere con
   * `contentTone` (puede chocar con `bg-background` en modo oscuro).
   */
  importedGithubScheme?: "light" | "dark";
}

function proseClassesForDeckTone(tone: DeckContentTone | undefined): string {
  const t = tone ?? "dark";
  if (t === "light") {
    return cn(
      "prose prose-stone max-w-none",
      "prose-invert",
      "prose-img:mx-auto prose-img:rounded-md prose-table:block prose-th:border prose-td:border",
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
    "prose-img:mx-auto prose-img:rounded-md prose-table:block prose-th:border prose-td:border",
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
 * Wrapper de ReactMarkdown + remarkGfm; `remarkBreaks` solo en modo edición (no en .md
 * importado) para aproximarse a GFM/GitHub y no insertar <br> entre líneas consecutivas.
 */
export function SlideMarkdown({
  children,
  className,
  style,
  components,
  contentTone,
  preprocess = "display",
  importedGithubScheme,
}: SlideMarkdownProps) {
  const source = children ?? "";
  const md =
    preprocess === "importedFile"
      ? formatMarkdownImportedFile(source)
      : formatMarkdownForDisplay(source);
  const githubReadme = preprocess === "importedFile";
  const dataGh: "light" | "dark" = githubReadme
    ? (importedGithubScheme ??
        (contentTone === "light" ? "dark" : "light"))
    : "light";
  return (
    <div
      style={style}
      data-gh={githubReadme ? dataGh : undefined}
      className={cn(
        githubReadme
          ? "markdown-body-gh w-full text-base leading-normal"
          : proseClassesForDeckTone(contentTone),
        "min-w-0 overflow-x-auto",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={
          githubReadme
            ? // Sin remark-breaks: alinea con GFM/GitHub; los saltos simples en un párrafo no
              // vuelan `<br>` y los badges `[![x]]()` en líneas seguidas quedan en fila.
              [remarkGfm]
            : [remarkGfm, remarkBreaks]
        }
        rehypePlugins={slideMarkdownRehypePlugins}
        components={{
          ...components,
          p:
            components?.p ??
            (githubReadme
              ? defaultMarkdownParagraph
              : spacerAwareParagraph),
          img: components?.img ?? MarkdownImg,
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

/** `react-markdown` pasa `node` (hast); no volcar al DOM (evita atributos inválidos). */
const defaultMarkdownParagraph: NonNullable<Components["p"]> = ({
  node: _node,
  children,
  ...rest
}) => <p {...rest}>{children}</p>;
