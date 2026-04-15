import {
  ArrowLeftRight,
  FileText,
  Heading,
  Image as ImageIcon,
  Link2,
  Plus,
  Repeat2,
  Trash2,
} from "lucide-react";
import { cn } from "../../../utils/cn";
import { sanitizeBrandIconColor } from "../../../domain/entities/IsometricFlowDiagram";
import { LINK_COLOR_PRESETS, LUCIDE_BRAND_ICON_FILL, NODE_SHAPE_TOOLBAR } from "./constants";
import { normalizeSimpleIconHex } from "./canvasModel";
import type { IsometricFlowCanvasController } from "./useIsometricFlowCanvasController";

export type IsometricFlowCanvasToolbarProps = Pick<
  IsometricFlowCanvasController,
  | "readOnly"
  | "data"
  | "addNode"
  | "primarySelectedId"
  | "connectFrom"
  | "setSelectedLinkId"
  | "setConnectFrom"
  | "selectedNodeIds"
  | "selectedLinkId"
  | "removeSelection"
  | "slideTextOverlayToolbar"
  | "setSelectedNodeShape"
  | "setIconPickerOpen"
  | "selectedNode"
  | "simpleIconHexById"
  | "setSelectedNodeBrandIconColor"
  | "setLinkStrokeColor"
  | "toggleLinkReversed"
  | "resetLinkBend"
  | "toggleLinkAnimationStyle"
  | "addReverseLink"
>;

export function IsometricFlowCanvasToolbar(props: IsometricFlowCanvasToolbarProps) {
  const {
    readOnly,
    data,
    addNode,
    primarySelectedId,
    connectFrom,
    setSelectedLinkId,
    setConnectFrom,
    selectedNodeIds,
    selectedLinkId,
    removeSelection,
    slideTextOverlayToolbar,
    setSelectedNodeShape,
    setIconPickerOpen,
    selectedNode,
    simpleIconHexById,
    setSelectedNodeBrandIconColor,
    setLinkStrokeColor,
    toggleLinkReversed,
    resetLinkBend,
    toggleLinkAnimationStyle,
    addReverseLink,
  } = props;

  if (readOnly) return null;

  return (
    <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-1.5 rounded-lg border border-stone-200/90 bg-white/95 px-2 py-1.5 shadow-sm dark:border-border dark:bg-stone-900/95">
      <button
        type="button"
        onClick={addNode}
        className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-700"
        aria-label="Añadir bloque"
      >
        <Plus size={14} />
        Bloque
      </button>
      {(primarySelectedId || connectFrom) && (
        <button
          type="button"
          onClick={() => {
            setSelectedLinkId(null);
            setConnectFrom((c) => (c ? null : primarySelectedId));
          }}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
            connectFrom
              ? "border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200"
              : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200",
          )}
          aria-label="Modo conexión: elige dos bloques"
          title="Conectar: origen y destino"
        >
          <Link2 size={14} />
          {connectFrom ? "Destino…" : "Conectar"}
        </button>
      )}
      {(selectedNodeIds.length > 0 || selectedLinkId) && (
        <button
          type="button"
          onClick={removeSelection}
          className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-red-50 hover:text-red-700 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-red-950/40"
          aria-label={
            selectedLinkId
              ? "Eliminar conector seleccionado"
              : selectedNodeIds.length > 1
                ? "Eliminar bloques seleccionados"
                : "Eliminar bloque seleccionado"
          }
        >
          <Trash2 size={14} />
          Quitar
        </button>
      )}
      {slideTextOverlayToolbar ? (
        <div
          className="flex flex-wrap items-center gap-1 border-l border-stone-200 pl-1.5 dark:border-stone-600"
          role="group"
          aria-label="Texto en el lienzo"
        >
          <button
            type="button"
            onClick={slideTextOverlayToolbar.onAddTitle}
            disabled={slideTextOverlayToolbar.disableTitle}
            title={
              slideTextOverlayToolbar.disableTitle
                ? "Ya hay un título en el lienzo"
                : "Añadir bloque de título al lienzo"
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700",
              slideTextOverlayToolbar.disableTitle && "pointer-events-none opacity-40",
            )}
          >
            <Heading size={14} />
            Título
          </button>
          <button
            type="button"
            onClick={slideTextOverlayToolbar.onAddDescription}
            disabled={slideTextOverlayToolbar.disableDescription}
            title={
              slideTextOverlayToolbar.disableDescription
                ? "Ya hay un bloque de descripción"
                : "Añadir bloque de descripción (markdown) al lienzo"
            }
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700",
              slideTextOverlayToolbar.disableDescription && "pointer-events-none opacity-40",
            )}
          >
            <FileText size={14} />
            Descripción
          </button>
        </div>
      ) : null}
      {primarySelectedId && !selectedLinkId && (
        <div
          className="flex flex-wrap items-center gap-0.5 border-l border-stone-200 pl-1.5 dark:border-stone-600"
          role="group"
          aria-label="Tipo de icono del bloque"
        >
          <span className="sr-only">Tipo de icono</span>
          {NODE_SHAPE_TOOLBAR.map(({ value, label, Icon }) => {
            const current =
              data.nodes.find((x) => x.id === primarySelectedId)?.shape ?? "slab";
            const active = current === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedNodeShape(value)}
                title={label}
                aria-label={label}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md border text-stone-700 transition-colors",
                  active
                    ? "border-sky-500 bg-sky-50 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100"
                    : "border-stone-200 bg-stone-50 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700",
                )}
              >
                <Icon size={14} strokeWidth={active ? 2.25 : 1.75} />
              </button>
            );
          })}
        </div>
      )}
      {primarySelectedId && !selectedLinkId ? (
        <div className="flex flex-wrap items-center gap-1 border-l border-stone-200 pl-1.5 dark:border-stone-600">
          <button
            type="button"
            onClick={() => setIconPickerOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            title="Abrir selector de iconos"
          >
            <ImageIcon size={13} />
            Cambiar icono
          </button>
          {selectedNode?.shape === "brand" &&
          (() => {
            const slug = (selectedNode.iconSlug ?? "").trim().toLowerCase();
            return slug.startsWith("si:") || slug.startsWith("li:");
          })() ? (
            <>
              <label className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-600 dark:text-stone-300">
                <span className="hidden sm:inline">Color</span>
                <input
                  type="color"
                  className="h-7 w-8 cursor-pointer rounded border border-stone-200 bg-white p-0 dark:border-stone-600"
                  title="Color del icono (Simple Icons o Lucide)"
                  aria-label="Color del icono de marca"
                  value={(() => {
                    const s = (selectedNode.iconSlug ?? "").trim().toLowerCase();
                    const catSi = s.startsWith("si:") ? simpleIconHexById[s] : undefined;
                    const catLi = s.startsWith("li:") ? LUCIDE_BRAND_ICON_FILL : undefined;
                    const cat = catSi ?? catLi;
                    const ov = selectedNode.brandIconColor
                      ? sanitizeBrandIconColor(selectedNode.brandIconColor)
                      : undefined;
                    const fromOv =
                      ov && /^#[0-9A-Fa-f]{3,8}$/i.test(ov) ? normalizeSimpleIconHex(ov) : undefined;
                    return fromOv ?? cat ?? "#64748b";
                  })()}
                  onChange={(e) => setSelectedNodeBrandIconColor(e.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => setSelectedNodeBrandIconColor(null)}
                className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[10px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                title="Quitar color personalizado y usar el del catálogo (hex Simple Icons o tinte Lucide por defecto)"
              >
                Auto
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {selectedLinkId && (
        <>
          <button
            type="button"
            onClick={toggleLinkAnimationStyle}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            aria-label="Cambiar estilo de animación del conector"
            title="Cambiar estilo de animación"
          >
            {data.links.find((l) => l.id === selectedLinkId)?.animationStyle ===
            "pulse"
              ? "Anim: Pulso"
              : "Anim: Flujo"}
          </button>
          <button
            type="button"
            onClick={toggleLinkReversed}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            aria-label="Invertir sentido de la flecha"
            title="Invertir flecha"
          >
            <ArrowLeftRight size={14} />
            Sentido
          </button>
          <button
            type="button"
            onClick={addReverseLink}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            aria-label="Crear conector de regreso"
            title="Crear conector en sentido contrario"
          >
            <Repeat2 size={14} />
            Doble sentido
          </button>
          <div className="flex items-center gap-0.5 border-l border-stone-200 pl-1.5 dark:border-stone-600">
            <span className="sr-only">Color del conector</span>
            {LINK_COLOR_PRESETS.map((p) => (
              <button
                key={p.stroke}
                type="button"
                onClick={() => setLinkStrokeColor(p.stroke)}
                className="h-5 w-5 rounded border border-stone-300/80 shadow-sm hover:scale-110 dark:border-stone-500"
                style={{ backgroundColor: p.swatch }}
                title={p.label}
                aria-label={`Color ${p.label}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={resetLinkBend}
            disabled={(() => {
              const sl = data.links.find((l) => l.id === selectedLinkId);
              if (!sl) return true;
              return !sl.bendOffset && !sl.routeWaypoints?.length;
            })()}
            className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-40 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            title="Vuelve a la ruta ortogonal automática"
            aria-label="Restablecer ruta del conector"
          >
            Ruta auto
          </button>
        </>
      )}
    </div>

  );
}
