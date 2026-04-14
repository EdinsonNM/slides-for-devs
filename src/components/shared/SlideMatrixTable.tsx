import type { SlideMatrixData } from "../../types";
import type { DeckContentTone } from "../../domain/entities";
import { cn } from "../../utils/cn";

export interface SlideMatrixTableProps {
  data: SlideMatrixData;
  editable?: boolean;
  /** `preview`: tipografía más grande para vista previa / presentador. */
  presentationDensity?: "editor" | "preview";
  /** Por celda: (rowIndex, colIndex, value) */
  onCellChange?: (row: number, col: number, value: string) => void;
  onHeaderChange?: (col: number, value: string) => void;
  className?: string;
  tableClassName?: string;
  /** Alinea colores con fondos de deck oscuros (`contentTone` del tema). */
  deckContentTone?: DeckContentTone;
}

export function SlideMatrixTable({
  data,
  editable = false,
  presentationDensity = "editor",
  onCellChange,
  onHeaderChange,
  className,
  tableClassName,
  deckContentTone,
}: SlideMatrixTableProps) {
  const { columnHeaders, rows } = data;
  const isPreview = presentationDensity === "preview";
  const onDarkDeck = deckContentTone === "light";

  return (
    <div
      className={cn(
        "min-h-0 w-full overflow-auto rounded-lg border",
        onDarkDeck
          ? "border-slate-600/70 bg-slate-950/40 backdrop-blur-sm"
          : "border-stone-200 dark:border-border",
        className,
      )}
    >
      <table
        className={cn(
          "w-full border-collapse text-left",
          onDarkDeck
            ? "text-slate-100"
            : "text-stone-800 dark:text-stone-100",
          isPreview ? "text-base md:text-[1.05rem]" : "text-sm",
          tableClassName,
        )}
      >
        <thead>
          <tr
            className={cn(
              onDarkDeck
                ? "bg-slate-900/90 text-slate-100"
                : "bg-stone-100/90 dark:bg-stone-800/80",
            )}
          >
            {columnHeaders.map((h, col) => (
              <th
                key={col}
                className={cn(
                  "border-b font-semibold min-w-[5rem] max-w-[18rem]",
                  onDarkDeck
                    ? "border-slate-600/80"
                    : "border-stone-200 dark:border-border",
                  isPreview ? "px-3 py-2.5" : "px-2 py-2",
                )}
              >
                {editable && onHeaderChange ? (
                  <input
                    type="text"
                    value={h}
                    onChange={(e) => onHeaderChange(col, e.target.value)}
                    className={cn(
                      "w-full min-w-0 rounded font-semibold outline-none ring-emerald-500/30 focus:ring-2",
                      isPreview ? "px-2 py-1.5 text-sm" : "px-1.5 py-1 text-xs",
                      onDarkDeck
                        ? "border border-slate-600/60 bg-slate-950/70 text-slate-100 placeholder:text-slate-500"
                        : "bg-white/80 text-stone-900 dark:bg-stone-900/80 dark:text-stone-100",
                    )}
                    aria-label={`Encabezado columna ${col + 1}`}
                  />
                ) : (
                  <span
                    className={cn(
                      "block wrap-break-word px-0.5",
                      isPreview && "leading-snug tracking-tight",
                    )}
                  >
                    {h || "—"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={cn(
                onDarkDeck
                  ? "odd:bg-slate-900/35 even:bg-slate-800/25"
                  : "odd:bg-white even:bg-stone-50/80 dark:odd:bg-surface-elevated dark:even:bg-stone-900/40",
              )}
            >
              {columnHeaders.map((_, ci) => (
                <td
                  key={ci}
                  className={cn(
                    "border-b align-top min-w-[5rem] max-w-[18rem]",
                    onDarkDeck
                      ? "border-slate-700/50"
                      : "border-stone-100 dark:border-border",
                    isPreview ? "px-3 py-2.5" : "px-2 py-1.5",
                  )}
                >
                  {editable && onCellChange ? (
                    <textarea
                      value={row[ci] ?? ""}
                      onChange={(e) => onCellChange(ri, ci, e.target.value)}
                      rows={2}
                      className={cn(
                        "w-full min-h-[2.25rem] resize-y rounded border px-1.5 py-1 text-xs leading-snug outline-none ring-emerald-500/30 focus:ring-2",
                        onDarkDeck
                          ? "border-slate-600/50 bg-slate-950/60 text-slate-100 placeholder:text-slate-500 focus:border-slate-500"
                          : "border-transparent bg-white/70 focus:border-stone-200 dark:bg-stone-900/60 dark:focus:border-stone-600",
                      )}
                      aria-label={`Celda fila ${ri + 1} columna ${ci + 1}`}
                    />
                  ) : (
                    <span
                      className={cn(
                        "block whitespace-pre-wrap wrap-break-word leading-snug",
                        isPreview ? "text-[0.95rem] md:text-base" : "text-xs",
                      )}
                    >
                      {row[ci] ?? ""}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
