import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { LANGUAGES } from "../../constants/languages";
import { cn } from "../../utils/cn";

export interface CodeDisplayProps {
  code: string;
  language?: string;
  fontSize?: number;
  /** Mostrar barra tipo ventana (puntos + idioma) */
  showChrome?: boolean;
  className?: string;
  /** Para preview: tamaño responsivo con clamp */
  responsiveFontSize?: boolean;
}

/**
 * Bloque de código de solo lectura (SyntaxHighlighter).
 * Usado en vista previa, presentador y como referencia en editor.
 */
export function CodeDisplay({
  code,
  language = "javascript",
  fontSize = 14,
  showChrome = true,
  className,
  responsiveFontSize = false,
}: CodeDisplayProps) {
  const languageName =
    LANGUAGES.find((l) => l.id === language)?.name || language;

  return (
    <div
      className={cn(
        "w-full h-full bg-[#1e1e1e] rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col",
        className
      )}
    >
      {showChrome && (
        <div className="h-12 bg-[#2d2d2d] px-6 flex items-center gap-2 shrink-0">
          <div className="w-3.5 h-3.5 rounded-full bg-[#ff5f56]" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e]" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#27c93f]" />
          <div className="ml-auto text-xs text-stone-400 font-mono uppercase tracking-widest flex items-center gap-4">
            <span className="text-[10px] opacity-50">{fontSize}px</span>
            <span>{languageName}</span>
          </div>
        </div>
      )}
      <div className="flex-1 p-0 font-mono overflow-y-auto custom-scrollbar bg-[#1e1e1e]">
        {code ? (
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            codeTagProps={{
              style: {
                fontSize: "inherit",
                lineHeight: "inherit",
                fontFamily: "inherit",
              },
            }}
            customStyle={{
              margin: 0,
              padding: "2rem",
              background: "transparent",
              fontSize: responsiveFontSize
                ? `clamp(${fontSize * 1.2}px, 1.4vw, ${fontSize * 2.2}px)`
                : `${fontSize}px`,
              lineHeight: responsiveFontSize ? "1.6" : "1.5",
            }}
          >
            {code}
          </SyntaxHighlighter>
        ) : (
          <div className="p-8 text-stone-500 italic">// Sin código</div>
        )}
      </div>
    </div>
  );
}
