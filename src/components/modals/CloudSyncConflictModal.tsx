import { AlertTriangle, CloudDownload, CloudUpload, X } from "lucide-react";

export interface CloudSyncConflictModalProps {
  open: boolean;
  expectedRevision: number;
  remoteRevision: number;
  onUseRemote: () => void;
  onForceLocal: () => void;
  onDismiss: () => void;
  busy?: boolean;
}

/**
 * Conflicto de revisión: otro dispositivo subió cambios mientras editabas.
 */
export function CloudSyncConflictModal({
  open,
  expectedRevision,
  remoteRevision,
  onUseRemote,
  onForceLocal,
  onDismiss,
  busy = false,
}: CloudSyncConflictModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
      onClick={busy ? undefined : onDismiss}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-surface-elevated rounded-xl shadow-xl max-w-md w-full p-6 border border-amber-200 dark:border-amber-900/50"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="conflict-title"
        aria-describedby="conflict-desc"
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="shrink-0 p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
            <AlertTriangle size={24} />
          </div>
          <div className="min-w-0">
            <h2
              id="conflict-title"
              className="text-lg font-semibold text-stone-900 dark:text-foreground"
            >
              Conflicto de sincronización
            </h2>
            <p
              id="conflict-desc"
              className="text-sm text-stone-600 dark:text-stone-400 mt-2"
            >
              La copia en la nube tiene cambios más recientes (revisión{" "}
              <strong>{remoteRevision}</strong>) que los que tenías sincronizados
              (revisión <strong>{expectedRevision}</strong>). Probablemente
              editaste en otro dispositivo.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className="shrink-0 p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <ul className="text-xs text-stone-500 dark:text-stone-400 space-y-2 mb-6 list-disc pl-4">
          <li>
            <strong>Usar versión de la nube</strong>: reemplaza esta copia local
            por lo que hay en Firebase (pierdes cambios solo locales no
            subidos).
          </li>
          <li>
            <strong>Subir mi copia</strong>: sobrescribe la nube con lo que tienes
            aquí (el otro dispositivo quedará desactualizado hasta que vuelva a
            sincronizar).
          </li>
        </ul>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onUseRemote}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            <CloudDownload size={18} />
            Usar versión de la nube
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onForceLocal}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 text-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-950/50 disabled:opacity-50"
          >
            <CloudUpload size={18} />
            Subir mi copia
          </button>
        </div>
      </div>
    </div>
  );
}
