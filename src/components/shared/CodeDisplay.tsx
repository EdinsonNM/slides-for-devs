import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  vscDarkPlus,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { LANGUAGES } from "../../constants/languages";
import { cn } from "../../utils/cn";
import { useCodeEditorTheme } from "../../hooks/useCodeEditorTheme";

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
 * Respeta el tema del editor de código (localStorage, mismo que el panel lateral).
 */
export function CodeDisplay({
  code,
  language = "javascript",
  fontSize = 14,
  showChrome = true,
  className,
  responsiveFontSize = false,
}: CodeDisplayProps) {
  const { isLight } = useCodeEditorTheme();
  const languageName =
    LANGUAGES.find((l) => l.id === language)?.name || language;

  const shell = isLight
    ? "bg-[#fafafa] border-stone-300 shadow-none"
    : "bg-[#1e1e1e] border-stone-700/90 shadow-none";
  const titleBar = isLight
    ? "bg-stone-200/90 border-b border-stone-300"
    : "bg-[#2d2d2d]";
  const editorArea = isLight ? "bg-[#fafafa]" : "bg-[#1e1e1e]";

  return (
    <div
      className={cn(
        "w-full h-full rounded-2xl overflow-hidden flex flex-col",
        shell,
        className
      )}
    >
      {showChrome && (
        <div
          className={cn(
            "h-12 px-6 flex items-center gap-2 shrink-0",
            titleBar
          )}
        >
          <div className="w-3.5 h-3.5 rounded-full bg-[#ff5f56]" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e]" />
          <div className="w-3.5 h-3.5 rounded-full bg-[#27c93f]" />
          <div
            className={cn(
              "ml-auto text-xs font-mono uppercase tracking-widest flex items-center gap-4",
              isLight ? "text-stone-600" : "text-stone-400"
            )}
          >
            <span className="text-[10px] opacity-70">{fontSize}px</span>
            <span
              className={
                isLight ? "text-stone-800" : "text-stone-300"
              }
            >
              {languageName}
            </span>
          </div>
        </div>
      )}
      <div
        className={cn(
          "flex-1 p-0 font-mono overflow-y-auto custom-scrollbar",
          editorArea
        )}
      >
        {code ? (
          <div className="min-w-full inline-block align-top max-w-none">
            <SyntaxHighlighter
              language={language}
              style={isLight ? oneLight : vscDarkPlus}
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
                boxShadow: "none",
                fontSize: responsiveFontSize
                  ? `clamp(${fontSize * 1.2}px, 1.4vw, ${fontSize * 2.2}px)`
                  : `${fontSize}px`,
                lineHeight: responsiveFontSize ? "1.6" : "1.5",
                overflow: "visible",
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>
        ) : (
          <div className="p-8 italic text-stone-500">
            // Sin código
          </div>
        )}
      </div>
    </div>
  );
}
