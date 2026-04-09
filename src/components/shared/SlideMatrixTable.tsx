import type { SlideMatrixData } from "../../types";
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
}

export function SlideMatrixTable({
  data,
  editable = false,
  presentationDensity = "editor",
  onCellChange,
  onHeaderChange,
  className,
  tableClassName,
}: SlideMatrixTableProps) {
  const { columnHeaders, rows } = data;
  const isPreview = presentationDensity === "preview";

  return (
    <div className={cn("min-h-0 w-full overflow-auto rounded-lg border border-stone-200 dark:border-border", className)}>
      <table
        className={cn(
          "w-full border-collapse text-left text-stone-800 dark:text-stone-100",
          isPreview ? "text-base md:text-[1.05rem]" : "text-sm",
          tableClassName,
        )}
      >
        <thead>
          <tr className="bg-stone-100/90 dark:bg-stone-800/80">
            {columnHeaders.map((h, col) => (
              <th
                key={col}
                className={cn(
                  "border-b border-stone-200 font-semibold dark:border-border min-w-[5rem] max-w-[18rem]",
                  isPreview ? "px-3 py-2.5" : "px-2 py-2",
                )}
              >
                {editable && onHeaderChange ? (
                  <input
                    type="text"
                    value={h}
                    onChange={(e) => onHeaderChange(col, e.target.value)}
                    className={cn(
                      "w-full min-w-0 rounded bg-white/80 font-semibold text-stone-900 outline-none ring-emerald-500/30 focus:ring-2 dark:bg-stone-900/80 dark:text-stone-100",
                      isPreview ? "px-2 py-1.5 text-sm" : "px-1.5 py-1 text-xs",
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
              className="odd:bg-white even:bg-stone-50/80 dark:odd:bg-surface-elevated dark:even:bg-stone-900/40"
            >
              {columnHeaders.map((_, ci) => (
                <td
                  key={ci}
                  className={cn(
                    "border-b border-stone-100 align-top dark:border-border min-w-[5rem] max-w-[18rem]",
                    isPreview ? "px-3 py-2.5" : "px-2 py-1.5",
                  )}
                >
                  {editable && onCellChange ? (
                    <textarea
                      value={row[ci] ?? ""}
                      onChange={(e) => onCellChange(ri, ci, e.target.value)}
                      rows={2}
                      className="w-full min-h-[2.25rem] resize-y rounded border border-transparent bg-white/70 px-1.5 py-1 text-xs leading-snug outline-none ring-emerald-500/30 focus:border-stone-200 focus:ring-2 dark:bg-stone-900/60 dark:focus:border-stone-600"
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
