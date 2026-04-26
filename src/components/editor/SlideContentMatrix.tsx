import { useCallback } from "react";
import { usePresentation } from "../../presentation/contexts/PresentationContext";
import {
  createEmptySlideMatrixData,
  normalizeSlideMatrixData,
  SLIDE_TYPE,
} from "../../domain/entities";
import { SlideMatrixTable } from "../shared/SlideMatrixTable";

export function SlideContentMatrix() {
  const {
    currentSlide,
    patchCurrentSlideMatrix,
    setEditTitle,
    setEditSubtitle,
    setEditContent,
    setSlides,
    currentIndex,
  } = usePresentation();

  const data = normalizeSlideMatrixData(
    currentSlide?.matrixData ?? createEmptySlideMatrixData(),
  );

  const syncMetaFields = useCallback(
    (title: string, subtitle: string, content: string) => {
      setEditTitle(title);
      setEditSubtitle(subtitle);
      setEditContent(content);
      setSlides((prev) => {
        const cur = prev[currentIndex];
        if (!cur || cur.type !== SLIDE_TYPE.MATRIX) return prev;
        const next = [...prev];
        next[currentIndex] = {
          ...cur,
          title,
          subtitle: subtitle.trim() || undefined,
          content,
        };
        return next;
      });
    },
    [currentIndex, setEditContent, setEditSubtitle, setEditTitle, setSlides],
  );

  if (!currentSlide || currentSlide.type !== SLIDE_TYPE.MATRIX) return null;

  const onHeaderChange = (col: number, value: string) => {
    patchCurrentSlideMatrix((prev) => {
      const headers = [...prev.columnHeaders];
      headers[col] = value;
      return { ...prev, columnHeaders: headers };
    });
  };

  const onCellChange = (row: number, col: number, value: string) => {
    patchCurrentSlideMatrix((prev) => {
      const rows = prev.rows.map((r) => [...r]);
      if (!rows[row]) return prev;
      rows[row] = [...rows[row]];
      rows[row][col] = value;
      return { ...prev, rows };
    });
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden bg-white p-4 md:p-6 dark:bg-surface-elevated">
      <div className="shrink-0 space-y-2">
        <input
          type="text"
          value={currentSlide.title}
          onChange={(e) => syncMetaFields(e.target.value, currentSlide.subtitle ?? "", currentSlide.content)}
          placeholder="Título del slide"
          className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-lg font-semibold text-stone-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-border dark:bg-stone-900/40 dark:text-stone-100"
        />
        <input
          type="text"
          value={currentSlide.subtitle ?? ""}
          onChange={(e) => syncMetaFields(currentSlide.title, e.target.value, currentSlide.content)}
          placeholder="Subtítulo (opcional)"
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-600 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-border dark:bg-stone-900/40 dark:text-stone-300"
        />
      </div>

      <div className="min-h-0 flex-1">
        <SlideMatrixTable
          data={data}
          editable
          onHeaderChange={onHeaderChange}
          onCellChange={onCellChange}
          className="max-h-[min(58vh,480px)] shadow-inner"
        />
      </div>

      <div className="shrink-0 space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-muted-foreground">
          Notas bajo la tabla (opcional)
        </label>
        <textarea
          value={currentSlide.content}
          onChange={(e) => syncMetaFields(currentSlide.title, currentSlide.subtitle ?? "", e.target.value)}
          placeholder="Contexto o conclusiones breves (texto o markdown ligero)…"
          rows={3}
          className="w-full resize-y rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-border dark:bg-stone-900/40 dark:text-stone-100"
        />
      </div>
    </div>
  );
}
