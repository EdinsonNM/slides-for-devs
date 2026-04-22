import { cn } from "../../../utils/cn";
import {
  ICON_PICKER_PACK_FILTERS,
  ICON_PICKER_PAGE_SIZE,
  iconPickerPackChipClasses,
} from "./constants";
import { brandIconPickerThumbnail } from "./BrandIconPickerThumbnail";
import type { IsometricFlowCanvasController } from "./useIsometricFlowCanvasController";

export type IsometricFlowCanvasIconPickerOverlayProps = Pick<
  IsometricFlowCanvasController,
  | "iconPickerOpen"
  | "selectedNode"
  | "setIconPickerOpen"
  | "iconPickerHasMore"
  | "iconPickerResults"
  | "iconPickerOrderedFlat"
  | "iconSearchQuery"
  | "setIconSearchQuery"
  | "iconPickerPackFilter"
  | "setIconPickerPackFilter"
  | "iconPickerGroupByCategory"
  | "setIconPickerGroupByCategory"
  | "setIconPickerVisibleLimit"
  | "iconPickerGroupedSections"
  | "setSelectedNodeBrandIcon"
  | "simpleIconHexById"
>;

export function IsometricFlowCanvasIconPickerOverlay(props: IsometricFlowCanvasIconPickerOverlayProps) {
  const {
    iconPickerOpen,
    selectedNode,
    setIconPickerOpen,
    iconPickerHasMore,
    iconPickerResults,
    iconPickerOrderedFlat,
    iconSearchQuery,
    setIconSearchQuery,
    iconPickerPackFilter,
    setIconPickerPackFilter,
    iconPickerGroupByCategory,
    setIconPickerGroupByCategory,
    setIconPickerVisibleLimit,
    iconPickerGroupedSections,
    setSelectedNodeBrandIcon,
    simpleIconHexById,
  } = props;

  if (!iconPickerOpen || !selectedNode) return null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/45 p-3">
          <div className="flex h-[min(78vh,520px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl dark:border-border dark:bg-stone-900">
            <div className="border-b border-stone-200 px-3 py-2 dark:border-border">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                    Cambiar icono
                  </span>
                  <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                    {iconPickerHasMore
                      ? `${iconPickerResults.length} de ${iconPickerOrderedFlat.length}`
                      : `${iconPickerOrderedFlat.length} iconos`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIconPickerOpen(false)}
                  className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800"
                >
                  Cerrar
                </button>
              </div>
              <div
                className="mt-2.5 flex flex-wrap gap-1.5"
                role="group"
                aria-label="Filtrar por origen del icono"
              >
                {ICON_PICKER_PACK_FILTERS.map((opt) => {
                  const active = iconPickerPackFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-label={opt.aria}
                      aria-pressed={active}
                      onClick={() => setIconPickerPackFilter(opt.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                        iconPickerPackChipClasses(opt.id, active),
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-b border-stone-200 px-3 py-2 dark:border-border">
              <input
                value={iconSearchQuery}
                onChange={(e) => setIconSearchQuery(e.target.value)}
                placeholder="Buscar (openai, g:storage, aws:lambda, si:react, li:workflow…)"
                className="h-9 w-full rounded-md border border-stone-200 bg-stone-50 px-3 text-sm text-stone-700 outline-none focus:border-sky-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200"
              />
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-stone-700 dark:text-stone-200">
                <input
                  type="checkbox"
                  checked={iconPickerGroupByCategory}
                  onChange={(e) => setIconPickerGroupByCategory(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-stone-300 text-sky-600 focus:ring-sky-500 dark:border-stone-600 dark:bg-stone-800"
                />
                <span>Agrupar por carpeta del pack (subcategorías)</span>
              </label>
              <p className="mt-2 text-[11px] leading-snug text-stone-500 dark:text-stone-400">
                Arriba elige pack (Google Cloud, AWS, Simple Icons, Lucide, Lobe o todos). Con texto en el buscador la
                búsqueda es global en todos los packs. Los catálogos Lobe, Simple Icons y Lucide son muy grandes: usa
                «Cargar más».
                {iconPickerGroupByCategory ? (
                  <>
                    {" "}
                    Con agrupación activa, los iconos visibles se ordenan por pack y carpeta; si el filtro es «Todos»,
                    cada bloque muestra «Pack · carpeta».
                  </>
                ) : null}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3">
              {iconPickerGroupByCategory && iconPickerGroupedSections ? (
                <div className="flex flex-col gap-5">
                  {iconPickerGroupedSections.map((section) => (
                    <div key={section.heading}>
                      <h3 className="mb-2 border-b border-stone-200 pb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:border-stone-700 dark:text-stone-400">
                        {section.heading}
                      </h3>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {section.entries.map((entry) => {
                          const active =
                            (selectedNode.iconSlug ?? "").trim().toLowerCase() === entry.id;
                          return (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => {
                                setSelectedNodeBrandIcon(entry.id);
                                setIconSearchQuery("");
                                setIconPickerOpen(false);
                              }}
                              className={cn(
                                "flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-[11px] text-stone-700 transition-colors dark:text-stone-200",
                                active
                                  ? "border-sky-500 bg-sky-50 dark:bg-sky-950/50"
                                  : "border-stone-200 bg-stone-50 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800/70 dark:hover:bg-stone-800",
                              )}
                              title={entry.id}
                            >
                              {brandIconPickerThumbnail(entry, simpleIconHexById)}
                              <span className="w-full truncate text-center">{entry.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {iconPickerResults.map((entry) => {
                    const active =
                      (selectedNode.iconSlug ?? "").trim().toLowerCase() === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          setSelectedNodeBrandIcon(entry.id);
                          setIconSearchQuery("");
                          setIconPickerOpen(false);
                        }}
                        className={cn(
                          "flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-[11px] text-stone-700 transition-colors dark:text-stone-200",
                          active
                            ? "border-sky-500 bg-sky-50 dark:bg-sky-950/50"
                            : "border-stone-200 bg-stone-50 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800/70 dark:hover:bg-stone-800",
                        )}
                        title={entry.id}
                      >
                        {brandIconPickerThumbnail(entry, simpleIconHexById)}
                        <span className="w-full truncate text-center">{entry.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {iconPickerHasMore ? (
                <div className="flex justify-center pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setIconPickerVisibleLimit((n) => n + ICON_PICKER_PAGE_SIZE)
                    }
                    className="rounded-md border border-stone-200 bg-stone-50 px-3 py-1.5 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                  >
                    Cargar más ({iconPickerOrderedFlat.length - iconPickerResults.length} restantes)
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
  );
}
