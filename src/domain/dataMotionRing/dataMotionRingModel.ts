/**
 * Modelo persistido del panel «aro de datos 3D» (`PANEL_CONTENT_KIND.DATA_MOTION_RING`).
 */

export const DATA_MOTION_CHART_TYPE = {
  LINE: "line",
  BAR: "bar",
  H_BAR: "hBar",
  GAUGE: "gauge",
  RADAR: "radar",
  DONUT: "donut",
  BIG_NUMBER: "bigNumber",
} as const;

export type DataMotionChartType =
  (typeof DATA_MOTION_CHART_TYPE)[keyof typeof DATA_MOTION_CHART_TYPE];

export type DataMotionValueFormat = "currency" | "integer" | "percent" | "decimal";

/** Fondo del contenedor del aro (persistido). */
export type DataMotionRingBackgroundMode = "default" | "transparent" | "solid";

export function formatDataMotionRingValue(
  v: number,
  format?: DataMotionValueFormat,
  suffix?: string,
): string {
  const suf = suffix ?? "";
  switch (format) {
    case "currency":
      return `$${v.toFixed(2)}${suf}`;
    case "percent":
      return `${Math.round(v)}%${suf}`;
    case "integer":
      return `${Math.round(v)}${suf}`;
    case "decimal":
      return `${v.toFixed(1)}${suf}`;
    default:
      if (Math.abs(v - Math.round(v)) < 1e-6) return `${Math.round(v)}${suf}`;
      return `${v.toFixed(2)}${suf}`;
  }
}

export interface DataMotionRingCard {
  chartType: DataMotionChartType;
  /** Título visible en la tarjeta del aro y en el modal. */
  title?: string;
  /** Leyenda corta opcional (subtítulo en la tarjeta pequeña). */
  label?: string;
  /** Descripción en el modal al ampliar. Se persiste como `description`; se lee también `notes` heredado. */
  description?: string;
  /** Serie numérica (interpretación según `chartType`). */
  values: number[];
  /** Colores hex opcionales (se repiten si faltan). */
  colors?: string[];
  format?: DataMotionValueFormat;
  suffix?: string;
}

export interface DataMotionRingState {
  /** Vacío oculta el título en el panel. */
  heading: string;
  /** Vacío oculta el subtítulo en el panel. */
  subtitle: string;
  cards: DataMotionRingCard[];
  /** Giro lento automático en modo presentación / editor. */
  autoRotate?: boolean;
  /** Velocidad de giro automático (deg/s). */
  autoRotateDegPerSec?: number;
  /** Fondo: tema lavanda oscuro/claro, transparente o color sólido. */
  backgroundMode?: DataMotionRingBackgroundMode;
  /** Solo si `backgroundMode === "solid"`. Hex tipo `#e4e2f3`. */
  backgroundColor?: string;
}

const DEFAULT_PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#facc15",
  "#ec4899",
  "#14b8a6",
] as const;

export const DATA_MOTION_RING_CARD_COUNT_MIN = 2;
export const DATA_MOTION_RING_CARD_COUNT_MAX = 16;

export function defaultDataMotionPalette(): string[] {
  return [...DEFAULT_PALETTE];
}

function clampCardCount(n: number): number {
  if (!Number.isFinite(n)) return 8;
  return Math.max(
    DATA_MOTION_RING_CARD_COUNT_MIN,
    Math.min(DATA_MOTION_RING_CARD_COUNT_MAX, Math.round(n)),
  );
}

function isChartType(v: unknown): v is DataMotionChartType {
  return (
    typeof v === "string" &&
    (Object.values(DATA_MOTION_CHART_TYPE) as string[]).includes(v)
  );
}

function normalizeCard(raw: unknown, index: number): DataMotionRingCard {
  if (!raw || typeof raw !== "object") {
    return {
      chartType: DATA_MOTION_CHART_TYPE.LINE,
      values: [20 + index * 3, 35, 28, 44, 38, 52, 48],
      colors: [DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]!],
    };
  }
  const o = raw as Record<string, unknown>;
  const chartType = isChartType(o.chartType)
    ? o.chartType
    : DATA_MOTION_CHART_TYPE.LINE;
  const valuesRaw = Array.isArray(o.values) ? o.values : [];
  const values = valuesRaw
    .map((x) => (typeof x === "number" && Number.isFinite(x) ? x : Number(x)))
    .filter((x) => Number.isFinite(x)) as number[];
  const colors = Array.isArray(o.colors)
    ? o.colors.filter((c): c is string => typeof c === "string" && c.length > 0)
    : undefined;
  const title = typeof o.title === "string" ? o.title : undefined;
  const label = typeof o.label === "string" ? o.label : undefined;
  const descriptionRaw =
    typeof o.description === "string"
      ? o.description
      : typeof o.notes === "string"
        ? o.notes
        : undefined;
  const description =
    descriptionRaw && descriptionRaw.trim() ? descriptionRaw.trim() : undefined;
  const format =
    o.format === "currency" ||
    o.format === "integer" ||
    o.format === "percent" ||
    o.format === "decimal"
      ? o.format
      : undefined;
  const suffix = typeof o.suffix === "string" ? o.suffix : undefined;

  const fallbackValues = (): number[] => {
    switch (chartType) {
      case DATA_MOTION_CHART_TYPE.GAUGE:
      case DATA_MOTION_CHART_TYPE.BIG_NUMBER:
        return [62 + index * 2];
      case DATA_MOTION_CHART_TYPE.DONUT:
        return [32, 28, 24, 16];
      case DATA_MOTION_CHART_TYPE.RADAR:
        return [0.65, 0.8, 0.55, 0.9, 0.7, 0.85];
      case DATA_MOTION_CHART_TYPE.H_BAR:
        return [72, 45, 88];
      case DATA_MOTION_CHART_TYPE.BAR:
        return [40, 65, 35, 80, 50, 70];
      default:
        return [20, 35, 28, 44, 38, 52, 48, 55];
    }
  };

  return {
    chartType,
    title,
    label,
    description,
    values: values.length > 0 ? values : fallbackValues(),
    colors: colors && colors.length > 0 ? colors : undefined,
    format,
    suffix,
  };
}

function isBackgroundMode(v: unknown): v is DataMotionRingBackgroundMode {
  return v === "default" || v === "transparent" || v === "solid";
}

function normalizeSolidBackgroundHex(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(t)) return undefined;
  return t.toLowerCase();
}

export function createDefaultDataMotionRingState(): DataMotionRingState {
  return {
    heading: "Data in Motion",
    subtitle: "Insights at a glance",
    autoRotate: true,
    autoRotateDegPerSec: 9,
    backgroundMode: "default",
    cards: [
      {
        chartType: DATA_MOTION_CHART_TYPE.H_BAR,
        title: "Rendimiento por canal",
        label: "Q1",
        description:
          "Comparativa de tres canales clave. Usa el gráfico interactivo para inspeccionar cada barra.",
        values: [72, 45, 88],
        colors: ["#facc15", "#22c55e", "#a855f7"],
      },
      {
        chartType: DATA_MOTION_CHART_TYPE.LINE,
        title: "Tendencia semanal",
        description: "Serie temporal con vista ampliada y tooltip al pasar el cursor.",
        values: [22, 38, 30, 52, 44, 62, 55, 48],
        colors: ["#3b82f6"],
      },
      {
        chartType: DATA_MOTION_CHART_TYPE.GAUGE,
        title: "Salud del pipeline",
        values: [62],
        format: "integer",
        description: "Indicador orientativo del avance global frente al objetivo.",
      },
      {
        chartType: DATA_MOTION_CHART_TYPE.RADAR,
        title: "Perfil multieje",
        values: [0.72, 0.55, 0.88, 0.62, 0.78, 0.5],
        colors: ["#a855f7"],
        description: "Cada eje resume una dimensión; valores normalizados entre 0 y 1.",
      },
      {
        chartType: DATA_MOTION_CHART_TYPE.BAR,
        title: "Volumen por etapa",
        values: [35, 55, 42, 70, 48, 60],
        colors: ["#22c55e"],
        description: "Barras verticales con interactividad en el modal.",
      },
      {
        chartType: DATA_MOTION_CHART_TYPE.DONUT,
        title: "Mix de categorías",
        values: [38, 28, 22, 12],
        colors: ["#ec4899", "#f472b6", "#fda4af", "#fce7f3"],
        description: "Participación relativa de cada segmento sobre el total.",
      },
      {
        chartType: DATA_MOTION_CHART_TYPE.BIG_NUMBER,
        title: "Ticket medio",
        values: [34.02],
        format: "currency",
        description: "Cifra destacada para comunicar un KPI principal en una sola lectura.",
      },
      {
        chartType: DATA_MOTION_CHART_TYPE.BIG_NUMBER,
        title: "Usuarios activos",
        values: [1845],
        format: "integer",
        description: "Total acumulado en la ventana de medición actual.",
      },
    ],
  };
}

export function normalizeDataMotionRingState(raw: unknown): DataMotionRingState {
  const base = createDefaultDataMotionRingState();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const heading =
    typeof o.heading === "string" ? o.heading.trim() : base.heading;
  const subtitle =
    typeof o.subtitle === "string" ? o.subtitle.trim() : base.subtitle;
  const autoRotate =
    typeof o.autoRotate === "boolean" ? o.autoRotate : base.autoRotate;
  const autoRotateDegPerSec =
    typeof o.autoRotateDegPerSec === "number" &&
    Number.isFinite(o.autoRotateDegPerSec)
      ? Math.max(0, Math.min(45, o.autoRotateDegPerSec))
      : base.autoRotateDegPerSec;

  const cardsRaw = Array.isArray(o.cards) ? o.cards : [];
  const cards =
    cardsRaw.length > 0
      ? cardsRaw.map((c, i) => normalizeCard(c, i))
      : base.cards;

  let backgroundMode: DataMotionRingBackgroundMode = base.backgroundMode ?? "default";
  if (isBackgroundMode(o.backgroundMode)) {
    backgroundMode = o.backgroundMode;
  }
  let backgroundColor: string | undefined;
  if (typeof o.backgroundColor === "string") {
    const hex = normalizeSolidBackgroundHex(o.backgroundColor);
    if (hex) backgroundColor = hex;
  }
  if (backgroundMode === "solid" && !backgroundColor) {
    backgroundMode = "default";
  }

  return {
    heading,
    subtitle,
    autoRotate,
    autoRotateDegPerSec,
    backgroundMode,
    ...(backgroundMode === "solid" && backgroundColor
      ? { backgroundColor }
      : {}),
    cards,
  };
}

/** Ajusta la longitud de `cards` conservando las existentes al crecer. */
/**
 * Ajusta `spin` (deg) del contenedor del aro para que la tarjeta `cardIndex` quede
 * frente a la cámara, manteniendo el giro acumulado y el camino angular más corto.
 */
export function nearestSpinToAlignCardFront(
  currentSpinDeg: number,
  cardIndex: number,
  stepDeg: number,
): number {
  const mod = (d: number) => ((d % 360) + 360) % 360;
  const tgtMod = mod(-cardIndex * stepDeg);
  const curMod = mod(currentSpinDeg);
  let delta = tgtMod - curMod;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return currentSpinDeg + delta;
}

export function resizeDataMotionRingCards(
  prev: DataMotionRingState,
  nextCount: number,
): DataMotionRingCard[] {
  const n = clampCardCount(nextCount);
  const out = prev.cards.slice(0, n);
  while (out.length < n) {
    const i = out.length;
    out.push(
      normalizeCard(
        {
          chartType: DATA_MOTION_CHART_TYPE.LINE,
          values: [10 + i * 5, 30 + i, 25, 40 + i, 35],
          colors: [DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]!],
        },
        i,
      ),
    );
  }
  return out;
}
