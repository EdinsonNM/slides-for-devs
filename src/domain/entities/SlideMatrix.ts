/**
 * Datos estructurados de una diapositiva tipo tabla/matriz (sin números mágicos en consumidores: usar constantes exportadas).
 */

/** Número de columnas al crear una matriz vacía o al ampliar por defecto. */
export const SLIDE_MATRIX_INITIAL_COLUMN_COUNT = 3;

/** Número de filas de datos (sin contar encabezados) en una matriz vacía nueva. */
export const SLIDE_MATRIX_INITIAL_DATA_ROW_COUNT = 2;

/** Mínimo de columnas y filas de datos permitido en la UI. */
export const SLIDE_MATRIX_MIN_COLUMNS = 1;
export const SLIDE_MATRIX_MIN_DATA_ROWS = 1;

/** Máximo razonable para evitar slides gigantes (exportación y render). */
export const SLIDE_MATRIX_MAX_COLUMNS = 12;
export const SLIDE_MATRIX_MAX_DATA_ROWS = 30;

export interface SlideMatrixData {
  columnHeaders: string[];
  /** Filas de celdas; cada fila debe tener la misma longitud que `columnHeaders`. */
  rows: string[][];
}

function emptyHeaderLabel(index: number): string {
  return `Columna ${index + 1}`;
}

export function createEmptySlideMatrixData(): SlideMatrixData {
  const columnHeaders = Array.from({ length: SLIDE_MATRIX_INITIAL_COLUMN_COUNT }, (_, i) =>
    emptyHeaderLabel(i),
  );
  const colCount = columnHeaders.length;
  const rows = Array.from({ length: SLIDE_MATRIX_INITIAL_DATA_ROW_COUNT }, () =>
    Array.from({ length: colCount }, () => ""),
  );
  return { columnHeaders, rows };
}

export function normalizeSlideMatrixData(raw: unknown): SlideMatrixData {
  if (!raw || typeof raw !== "object") {
    return createEmptySlideMatrixData();
  }
  const o = raw as { columnHeaders?: unknown; rows?: unknown };
  const headersIn = Array.isArray(o.columnHeaders)
    ? o.columnHeaders.map((h) => String(h ?? "").trim())
    : [];
  let columnHeaders =
    headersIn.length > 0
      ? headersIn.slice(0, SLIDE_MATRIX_MAX_COLUMNS)
      : Array.from({ length: SLIDE_MATRIX_INITIAL_COLUMN_COUNT }, (_, i) => emptyHeaderLabel(i));
  if (columnHeaders.length < SLIDE_MATRIX_MIN_COLUMNS) {
    columnHeaders = Array.from({ length: SLIDE_MATRIX_MIN_COLUMNS }, (_, i) =>
      columnHeaders[i] ?? emptyHeaderLabel(i),
    );
  }
  const colCount = columnHeaders.length;
  const rowsIn = Array.isArray(o.rows) ? o.rows : [];
  let rows = rowsIn
    .slice(0, SLIDE_MATRIX_MAX_DATA_ROWS)
    .map((row) => {
      const r = Array.isArray(row) ? row : [];
      const cells = Array.from({ length: colCount }, (_, j) => String(r[j] ?? "").trim());
      return cells;
    });
  if (rows.length < SLIDE_MATRIX_MIN_DATA_ROWS) {
    const need = SLIDE_MATRIX_MIN_DATA_ROWS - rows.length;
    rows = [
      ...rows,
      ...Array.from({ length: need }, () => Array.from({ length: colCount }, () => "")),
    ];
  }
  return { columnHeaders, rows };
}

export function serializeSlideMatrixForPrompt(data: SlideMatrixData): string {
  try {
    return JSON.stringify({
      columnHeaders: data.columnHeaders,
      rows: data.rows,
    });
  } catch {
    return "{}";
  }
}

/** Mutaciones puras para toolbar / editor (el estado aplica `normalizeSlideMatrixData` al persistir). */

export function applyMatrixAddColumn(prev: SlideMatrixData): SlideMatrixData {
  if (prev.columnHeaders.length >= SLIDE_MATRIX_MAX_COLUMNS) return prev;
  const n = prev.columnHeaders.length;
  const columnHeaders = [...prev.columnHeaders, emptyHeaderLabel(n)];
  const rows = prev.rows.map((r) => [...r, ""]);
  return { columnHeaders, rows };
}

export function applyMatrixRemoveColumn(prev: SlideMatrixData): SlideMatrixData {
  if (prev.columnHeaders.length <= SLIDE_MATRIX_MIN_COLUMNS) return prev;
  const columnHeaders = prev.columnHeaders.slice(0, -1);
  const rows = prev.rows.map((r) => r.slice(0, -1));
  return { columnHeaders, rows };
}

export function applyMatrixAddRow(prev: SlideMatrixData): SlideMatrixData {
  if (prev.rows.length >= SLIDE_MATRIX_MAX_DATA_ROWS) return prev;
  const colCount = prev.columnHeaders.length;
  const rows = [...prev.rows, Array.from({ length: colCount }, () => "")];
  return { ...prev, rows };
}

export function applyMatrixRemoveRow(prev: SlideMatrixData): SlideMatrixData {
  if (prev.rows.length <= SLIDE_MATRIX_MIN_DATA_ROWS) return prev;
  const rows = prev.rows.slice(0, -1);
  return { ...prev, rows };
}
