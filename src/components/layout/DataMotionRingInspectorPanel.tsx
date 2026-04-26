import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { cn } from "../../utils/cn";
import {
  PANEL_CONTENT_KIND,
  resolveMediaPanelDescriptor,
} from "../../domain/panelContent";
import { SLIDE_TYPE } from "../../domain/entities";
import {
  DATA_MOTION_CHART_TYPE,
  type DataMotionChartType,
  type DataMotionRingBackgroundMode,
  type DataMotionRingCard,
  type DataMotionRingState,
  type DataMotionValueFormat,
  DATA_MOTION_RING_CARD_COUNT_MAX,
  DATA_MOTION_RING_CARD_COUNT_MIN,
  createDefaultDataMotionRingState,
  normalizeDataMotionRingState,
  resizeDataMotionRingCards,
} from "../../domain/dataMotionRing/dataMotionRingModel";

const CHART_OPTIONS: { id: DataMotionChartType; label: string }[] = [
  { id: DATA_MOTION_CHART_TYPE.LINE, label: "Línea" },
  { id: DATA_MOTION_CHART_TYPE.BAR, label: "Barras vert." },
  { id: DATA_MOTION_CHART_TYPE.H_BAR, label: "Barras horiz." },
  { id: DATA_MOTION_CHART_TYPE.GAUGE, label: "Gauge" },
  { id: DATA_MOTION_CHART_TYPE.RADAR, label: "Radar" },
  { id: DATA_MOTION_CHART_TYPE.DONUT, label: "Donut" },
  { id: DATA_MOTION_CHART_TYPE.BIG_NUMBER, label: "Número grande" },
];

const FORMAT_OPTIONS: { id: DataMotionValueFormat; label: string }[] = [
  { id: "integer", label: "Entero" },
  { id: "decimal", label: "Decimal" },
  { id: "currency", label: "Moneda ($)" },
  { id: "percent", label: "Porcentaje" },
];

function parseValuesInput(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

export function DataMotionRingInspectorPanel() {
  const { currentSlide, setCurrentSlideDataMotionRing } = usePresentation();

  const usableSlide =
    currentSlide &&
    (currentSlide.type === SLIDE_TYPE.CONTENT ||
      currentSlide.type === SLIDE_TYPE.CHAPTER);

  const panelKind = currentSlide
    ? resolveMediaPanelDescriptor(currentSlide).kind
    : null;
  const isRing = panelKind === PANEL_CONTENT_KIND.DATA_MOTION_RING;

  const state: DataMotionRingState = normalizeDataMotionRingState(
    currentSlide?.dataMotionRing,
  );

  const commit = (next: DataMotionRingState) => {
    setCurrentSlideDataMotionRing(next);
  };

  const updateCard = (index: number, patch: Partial<DataMotionRingCard>) => {
    const cards = state.cards.map((c, i) => (i === index ? { ...c, ...patch } : c));
    commit({ ...state, cards });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-surface-elevated">
      <div className="flex shrink-0 flex-col gap-1 border-b border-stone-100 bg-stone-50/60 px-3 py-2.5 dark:border-border dark:bg-surface">
        <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          Aro de datos 3D
        </h2>
        <p className="text-[11px] leading-snug text-stone-500 dark:text-stone-400">
          Título y subtítulo del panel son opcionales (vacío = no se muestran). Controla el
          fondo, las tarjetas y sus datos. Al elegir una tarjeta se abre el detalle con gráfico
          interactivo; ciérralo con la X o Escape. El giro se detiene con el detalle abierto.
          Arrastra el fondo para girar e inclinar; pasa el puntero sobre una tarjeta para
          resaltarla.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {!usableSlide ? (
          <p className="text-center text-xs text-stone-500 dark:text-stone-400">
            Abre una diapositiva de contenido o capítulo con panel de media.
          </p>
        ) : !isRing ? (
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 text-[11px] text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
            El bloque activo no es «Aro de datos». En la barra inferior, menú{" "}
            <span className="font-medium">Panel</span>, elige{" "}
            <span className="font-medium">Aro de datos 3D</span>; luego vuelve aquí.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-300">
                Título (opcional)
              </label>
              <input
                type="text"
                value={state.heading}
                onChange={(e) => commit({ ...state, heading: e.target.value })}
                placeholder="Vacío = sin título en el panel"
                className="w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs dark:border-border dark:bg-surface"
              />
              <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-300">
                Subtítulo (opcional)
              </label>
              <input
                type="text"
                value={state.subtitle}
                onChange={(e) => commit({ ...state, subtitle: e.target.value })}
                placeholder="Vacío = sin subtítulo en el panel"
                className="w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs dark:border-border dark:bg-surface"
              />
            </div>

            <label className="flex items-center gap-2 text-[11px] text-stone-700 dark:text-stone-200">
              <input
                type="checkbox"
                checked={Boolean(state.autoRotate)}
                onChange={(e) =>
                  commit({ ...state, autoRotate: e.target.checked })
                }
                className="rounded border-stone-300"
              />
              Giro automático lento
            </label>

            <div className="space-y-2 border-t border-stone-100 pt-3 dark:border-border">
              <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-300">
                Fondo del panel
              </label>
              <select
                value={state.backgroundMode ?? "default"}
                onChange={(e) => {
                  const v = e.target.value as DataMotionRingBackgroundMode;
                  if (v === "solid") {
                    commit({
                      ...state,
                      backgroundMode: "solid",
                      backgroundColor: state.backgroundColor ?? "#e4e2f3",
                    });
                  } else {
                    commit({
                      ...state,
                      backgroundMode: v,
                      backgroundColor: undefined,
                    });
                  }
                }}
                className="w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-[11px] dark:border-border dark:bg-surface"
              >
                <option value="default">Tema por defecto (lavanda / oscuro)</option>
                <option value="transparent">Sin fondo (transparente)</option>
                <option value="solid">Color sólido</option>
              </select>
              {(state.backgroundMode ?? "default") === "solid" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="color"
                    value={
                      /^#[0-9a-fA-F]{6}$/.test(state.backgroundColor ?? "")
                        ? (state.backgroundColor as string)
                        : "#e4e2f3"
                    }
                    onChange={(e) =>
                      commit({
                        ...state,
                        backgroundMode: "solid",
                        backgroundColor: e.target.value,
                      })
                    }
                    className="h-9 w-14 cursor-pointer rounded border border-stone-200 bg-white p-0.5 dark:border-border"
                    aria-label="Selector de color de fondo"
                  />
                  <input
                    type="text"
                    value={state.backgroundColor ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      commit({
                        ...state,
                        backgroundMode: "solid",
                        backgroundColor: raw || "#e4e2f3",
                      });
                    }}
                    placeholder="#e4e2f3"
                    className="min-w-[8rem] flex-1 rounded-md border border-stone-200 bg-white px-2 py-1.5 font-mono text-[11px] dark:border-border dark:bg-surface"
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-medium text-stone-600 dark:text-stone-300">
                  Tarjetas en el aro ({state.cards.length})
                </label>
                <button
                  type="button"
                  className="text-[10px] font-medium text-primary hover:underline"
                  onClick={() => commit(createDefaultDataMotionRingState())}
                >
                  Restaurar demo
                </button>
              </div>
              <input
                type="range"
                min={DATA_MOTION_RING_CARD_COUNT_MIN}
                max={DATA_MOTION_RING_CARD_COUNT_MAX}
                value={state.cards.length}
                onChange={(e) => {
                  const nextCount = Number(e.target.value);
                  commit({
                    ...state,
                    cards: resizeDataMotionRingCards(state, nextCount),
                  });
                }}
                className="w-full accent-primary"
              />
              <p className="text-[10px] text-stone-500 dark:text-stone-400">
                Entre {DATA_MOTION_RING_CARD_COUNT_MIN} y {DATA_MOTION_RING_CARD_COUNT_MAX}{" "}
                tarjetas.
              </p>
            </div>

            <div className="space-y-3 border-t border-stone-100 pt-3 dark:border-border">
              <p className="text-[11px] font-semibold text-stone-800 dark:text-stone-100">
                Tarjetas
              </p>
              {state.cards.map((card, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-stone-200 bg-stone-50/50 p-2.5 dark:border-border dark:bg-white/5"
                >
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                    Tarjeta {index + 1}
                  </p>
                  <label className="mb-1 block text-[10px] text-stone-500">
                    Tipo de gráfica
                  </label>
                  <select
                    value={card.chartType}
                    onChange={(e) =>
                      updateCard(index, {
                        chartType: e.target.value as DataMotionChartType,
                      })
                    }
                    className="mb-2 w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] dark:border-border dark:bg-surface"
                  >
                    {CHART_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  {(card.chartType === DATA_MOTION_CHART_TYPE.BIG_NUMBER ||
                    card.chartType === DATA_MOTION_CHART_TYPE.GAUGE) && (
                    <>
                      <label className="mb-1 block text-[10px] text-stone-500">
                        Formato (número / gauge)
                      </label>
                      <select
                        value={card.format ?? "integer"}
                        onChange={(e) =>
                          updateCard(index, {
                            format: e.target.value as DataMotionValueFormat,
                          })
                        }
                        className="mb-2 w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] dark:border-border dark:bg-surface"
                      >
                        {FORMAT_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  <label className="mb-1 block text-[10px] text-stone-500">
                    Título
                  </label>
                  <input
                    type="text"
                    value={card.title ?? ""}
                    onChange={(e) =>
                      updateCard(index, {
                        title: e.target.value.trim() || undefined,
                      })
                    }
                    placeholder="Ej. Ingresos por región"
                    className="mb-2 w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] dark:border-border dark:bg-surface"
                  />

                  <label className="mb-1 block text-[10px] text-stone-500">
                    Leyenda corta (opcional)
                  </label>
                  <input
                    type="text"
                    value={card.label ?? ""}
                    onChange={(e) =>
                      updateCard(index, {
                        label: e.target.value.trim() || undefined,
                      })
                    }
                    placeholder="Ej. Q1"
                    className="mb-2 w-full rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] dark:border-border dark:bg-surface"
                  />

                  <label className="mb-1 block text-[10px] text-stone-500">
                    Valores (separados por coma)
                  </label>
                  <textarea
                    value={card.values.join(", ")}
                    onChange={(e) => {
                      const values = parseValuesInput(e.target.value);
                      updateCard(index, { values: values.length ? values : [0] });
                    }}
                    rows={2}
                    className={cn(
                      "w-full resize-none rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-[11px]",
                      "dark:border-border dark:bg-surface",
                    )}
                  />

                  <label className="mb-1 mt-2 block text-[10px] text-stone-500">
                    Colores hex (opcional, separados por coma)
                  </label>
                  <input
                    type="text"
                    value={card.colors?.join(", ") ?? ""}
                    onChange={(e) => {
                      const colors = e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      updateCard(index, {
                        colors: colors.length ? colors : undefined,
                      });
                    }}
                    placeholder="#3b82f6, #22c55e"
                    className="w-full rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-[11px] dark:border-border dark:bg-surface"
                  />

                  <label className="mb-1 mt-2 block text-[10px] text-stone-500">
                    Descripción (modal al ampliar)
                  </label>
                  <textarea
                    value={card.description ?? ""}
                    onChange={(e) => {
                      const t = e.target.value;
                      updateCard(index, {
                        description: t.trim() ? t : undefined,
                      });
                    }}
                    rows={3}
                    placeholder="Texto que se muestra en el detalle centrado junto al gráfico interactivo…"
                    className={cn(
                      "w-full resize-y rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px]",
                      "dark:border-border dark:bg-surface",
                    )}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
