import { FileText, X } from "lucide-react";
import type { PromptAttachment } from "../../utils/promptAttachments";
import { cn } from "../../utils/cn";

export function PromptAttachmentsRow({
  items,
  onRemove,
  className,
}: {
  items: PromptAttachment[];
  onRemove: (id: string) => void;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 px-1",
        className,
      )}
      role="list"
      aria-label="Documentos adjuntos al prompt"
    >
      {items.map((a) => (
        <div
          key={a.id}
          role="listitem"
          className="inline-flex items-center gap-1.5 max-w-full pl-2 pr-1 py-1 rounded-lg border border-stone-200 dark:border-border bg-stone-50 dark:bg-stone-800/80 text-xs text-stone-700 dark:text-stone-200"
        >
          <FileText
            size={14}
            className="shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <span className="truncate min-w-0 font-medium" title={a.name}>
            {a.name}
          </span>
          <span className="text-stone-400 dark:text-stone-500 shrink-0 tabular-nums">
            {(a.text.length / 1024).toFixed(1)} KB
          </span>
          <button
            type="button"
            onClick={() => onRemove(a.id)}
            className="p-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-500 dark:text-stone-400 transition-colors shrink-0"
            aria-label={`Quitar ${a.name}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
