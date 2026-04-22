import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Send, Loader2 } from "lucide-react";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export interface PresenterChatProps {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

const markdownComponents: Components = {
  code({
    className,
    children,
    ...props
  }: {
    className?: string;
    children?: React.ReactNode;
    [k: string]: unknown;
  }) {
    const match = /language-(\w+)/.exec(className || "");
    const code = String(children).replace(/\n$/, "");
    return match ? (
      <SyntaxHighlighter
        PreTag="div"
        style={vscDarkPlus}
        language={match[1]}
        customStyle={{
          margin: "0.5rem 0",
          borderRadius: "0.5rem",
          fontSize: "0.8rem",
        }}
        codeTagProps={{ style: { fontFamily: "inherit" } }}
      >
        {code}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

/**
 * Panel de chat con IA en el modo presentador.
 */
export function PresenterChat({
  messages,
  input,
  loading,
  onInputChange,
  onSend,
}: PresenterChatProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-stone-500 text-sm">
            Haz una pregunta sobre el tema o la diapositiva actual. La IA usará
            el contexto de tu presentación para responder.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <div
              className={`max-w-[90%] rounded-lg p-3 text-sm ${
                msg.role === "user"
                  ? "bg-emerald-800/50 text-stone-100"
                  : "bg-stone-700 border border-stone-600 text-white"
              }`}
            >
              {msg.role === "user" ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none prose-p:text-white prose-li:text-stone-100 prose-strong:text-white prose-headings:text-white prose-code:text-amber-200 prose-pre:bg-stone-900 prose-pre:border prose-pre:border-stone-600 [&>*]:text-white [&_ul]:text-stone-100 [&_ol]:text-stone-100">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 flex items-center gap-2 text-stone-400 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Pensando…
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="shrink-0 p-3 border-t border-stone-700 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Pregunta sobre el tema o la diapositiva…"
          className="flex-1 min-w-0 px-3 py-2 bg-stone-800 border border-stone-600 rounded-lg text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          disabled={loading}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!input.trim() || loading}
          className="p-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
          title="Enviar"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
}
