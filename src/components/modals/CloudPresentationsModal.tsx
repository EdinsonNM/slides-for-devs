import { X, Cloud, Download, Loader2, FolderOpen, Users } from "lucide-react";
import type { CloudPresentationListItem } from "../../services/presentationCloud";
import type { SavedPresentationMeta } from "../../types";

function cloudItemKey(item: CloudPresentationListItem): string {
  return `${item.ownerUid}::${item.cloudId}`;
}

export interface CloudPresentationsModalProps {
  open: boolean;
  onClose: () => void;
  items: CloudPresentationListItem[];
  loading: boolean;
  error: string | null;
  sharedWarning?: string | null;
  savedList: SavedPresentationMeta[];
  downloadingCloudKey: string | null;
  onDownload: (cloudId: string, ownerUid?: string) => void;
  onOpenLocal: (localId: string) => void;
}

export function CloudPresentationsModal({
  open,
  onClose,
  items,
  loading,
  error,
  sharedWarning,
  savedList,
  downloadingCloudKey,
  onDownload,
  onOpenLocal,
}: CloudPresentationsModalProps) {
  if (!open) return null;

  const localForCloudItem = (item: CloudPresentationListItem) =>
    item.source === "mine"
      ? savedList.find((p) => p.cloudId === item.cloudId)
      : undefined;

  const mine = items.filter((i) => i.source === "mine");
  const shared = items.filter((i) => i.source === "shared");
  /** Si no hay ninguna fila pero falló el listado de compartidas, igual hay que mostrar secciones y el aviso (no el estado vacío único). */
  const showCloudBody = items.length > 0 || !!sharedWarning;

  const renderList = (list: CloudPresentationListItem[], emptyLabel: string) => {
    if (list.length === 0) {
      return (
        <p className="text-stone-500 dark:text-stone-400 text-center py-6 text-sm">{emptyLabel}</p>
      );
    }
    return (
      <ul className="space-y-2">
        {list.map((item) => {
          const local = localForCloudItem(item);
          const key = cloudItemKey(item);
          const isBusy = downloadingCloudKey === key;
          return (
            <li
              key={key}
              className="flex items-center gap-3 p-3 rounded-lg border border-stone-200 dark:border-border bg-stone-50/80 dark:bg-surface"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-900 dark:text-foreground truncate">
                  {item.topic || "Sin título"}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  {item.updatedAt
                    ? new Date(item.updatedAt).toLocaleString()
                    : new Date(item.savedAt).toLocaleDateString()}
                </p>
                {item.source === "shared" && (
                  <p className="text-xs text-violet-600 dark:text-violet-400 mt-1 flex items-center gap-1">
                    <Users size={12} />
                    Compartida contigo
                  </p>
                )}
                {local && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    En este equipo
                  </p>
                )}
              </div>
              {local ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onOpenLocal(local.id)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  <FolderOpen size={16} />
                  Abrir
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onDownload(item.cloudId, item.ownerUid)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {isBusy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Descargar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-surface-elevated rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="cloud-modal-title"
      >
        <div className="p-4 border-b border-stone-200 dark:border-border flex items-center justify-between shrink-0">
          <h3
            id="cloud-modal-title"
            className="font-semibold text-stone-900 dark:text-foreground flex items-center gap-2"
          >
            <Cloud className="text-emerald-600" size={22} />
            Presentaciones en la nube
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg text-stone-600 dark:text-stone-400"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-stone-500">
              <Loader2 className="animate-spin w-8 h-8" />
              <p className="text-sm">Cargando…</p>
            </div>
          )}
          {!loading && error && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center py-8">{error}</p>
          )}
          {!loading && !error && !showCloudBody && (
            <p className="text-stone-500 dark:text-stone-400 text-center py-8 text-sm">
              No hay presentaciones en la nube. Sincroniza desde las tarjetas del inicio.
            </p>
          )}
          {!loading && !error && showCloudBody && (
            <>
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-2">
                  Mías
                </h4>
                {renderList(
                  mine,
                  "Ninguna sincronizada. Usa “Sincronizar con la nube” en una tarjeta."
                )}
              </section>
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-2 flex items-center gap-1.5">
                  <Users size={14} />
                  Compartidas conmigo
                </h4>
                {sharedWarning && (
                  <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
                    No se pudo cargar este bloque: {sharedWarning}
                  </p>
                )}
                {renderList(
                  shared,
                  sharedWarning
                    ? "Si ves un aviso arriba, revisa la consola de Firebase (índice de collection group) o vuelve a abrir este panel."
                    : "Nadie ha compartido contigo aún, o el correo/UID no coincide con tu sesión."
                )}
              </section>
            </>
          )}
        </div>
        <p className="px-4 pb-3 text-xs text-stone-400 dark:text-stone-500">
          Los personajes asociados no se sincronizan; puede que haya que volver a asignarlos tras
          descargar. Las copias desde “compartidas” no enlazan a la nube del autor para evitar
          pisar su archivo.
        </p>
      </div>
    </div>
  );
}
