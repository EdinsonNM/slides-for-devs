import { X } from "lucide-react";
import type { SavedPresentationMeta } from "../../types";

export interface DeletePresentationModalProps {
  open: boolean;
  meta: SavedPresentationMeta | null;
  cloudSyncAvailable: boolean;
  isLoggedIn: boolean;
  onClose: () => void;
  /** Sin nube vinculada: borrar fila local. */
  onDeleteLocalOnly: () => void | Promise<void>;
  /** Con nube: conservar Firestore, vaciar diapositivas locales. */
  onClearLocalKeepCloud: () => void | Promise<void>;
  /** Con nube: borrar SQLite y documento Storage/Firestore. */
  onDeleteLocalAndCloud: () => void | Promise<void>;
}

export function DeletePresentationModal({
  open,
  meta,
  cloudSyncAvailable,
  isLoggedIn,
  onClose,
  onDeleteLocalOnly,
  onClearLocalKeepCloud,
  onDeleteLocalAndCloud,
}: DeletePresentationModalProps) {
  if (!open || !meta) return null;

  const cloudId = meta.cloudId?.trim();
  const hasCloud = !!cloudId;
  const stub = !!meta.localBodyCleared && hasCloud;
  const canManageRemote = cloudSyncAvailable && isLoggedIn && hasCloud;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-surface-elevated rounded-xl shadow-xl max-w-md w-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="delete-presentation-title"
      >
        <div className="p-4 border-b border-stone-200 dark:border-border flex items-center justify-between shrink-0">
          <h3
            id="delete-presentation-title"
            className="font-semibold text-stone-900 dark:text-foreground pr-4"
          >
            ¿Eliminar “{meta.topic || "Sin título"}”?
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg text-stone-600 dark:text-stone-400 shrink-0"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm text-stone-600 dark:text-stone-300">
          {stub ? (
            <p>
              Solo queda el acceso en la nube. Puedes{" "}
              <strong className="text-stone-800 dark:text-stone-100">
                borrar la presentación por completo
              </strong>{" "}
              (nube y esta entrada) o cancelar y abrir la tarjeta para volver a descargar aquí.
            </p>
          ) : hasCloud && canManageRemote ? (
            <p>
              Elige si solo quitas la <strong>copia local</strong>: la tarjeta pasará a marcar que
              sigue en la nube (borde punteado) y podrás recuperarla. O borra también la{" "}
              <strong>copia en la nube</strong> en un segundo paso desde esa tarjeta.
            </p>
          ) : hasCloud && !isLoggedIn ? (
            <p>
              Esta presentación está vinculada a la nube.{" "}
              <strong>Quitar de este dispositivo</strong> conserva la copia remota; para borrarla en
              la nube inicia sesión.
            </p>
          ) : (
            <p>Se eliminará solo de este dispositivo.</p>
          )}
        </div>
        <div className="p-4 pt-0 flex flex-col gap-2">
          {stub ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (
                    !confirm(
                      "Se borrará la presentación en la nube (Firestore y archivos) y se quitará del listado. ¿Continuar?",
                    )
                  )
                    return;
                  void onDeleteLocalAndCloud();
                }}
                disabled={!canManageRemote}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Eliminar de la nube y del listado
              </button>
              {!canManageRemote && (
                <>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Inicia sesión para borrar también la copia en la nube.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !confirm(
                          "Solo se quita esta entrada del listado en este equipo. La presentación seguirá en la nube y la podrás descargar desde «Presentaciones en la nube». ¿Continuar?",
                        )
                      )
                        return;
                      void onDeleteLocalOnly();
                    }}
                    className="w-full py-2.5 rounded-lg text-sm font-medium bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 hover:opacity-90"
                  >
                    Quitar del listado (la nube no se borra)
                  </button>
                </>
              )}
            </>
          ) : hasCloud && canManageRemote ? (
            <>
              <button
                type="button"
                onClick={() => void onClearLocalKeepCloud()}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 hover:opacity-90"
              >
                Solo quitar copia de este dispositivo (sigue en la nube)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    !confirm(
                      "¿Borrar ya mismo en la nube y en este listado? Esta acción no se puede deshacer.",
                    )
                  )
                    return;
                  void onDeleteLocalAndCloud();
                }}
                className="w-full py-2.5 rounded-lg text-sm font-medium border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                Eliminar de este dispositivo y de la nube
              </button>
            </>
          ) : hasCloud && !isLoggedIn ? (
            <button
              type="button"
              onClick={() => void onClearLocalKeepCloud()}
              className="w-full py-2.5 rounded-lg text-sm font-medium bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 hover:opacity-90"
            >
              Quitar copia de este dispositivo (sigue en la nube)
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onDeleteLocalOnly()}
              className="w-full py-2.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700"
            >
              Eliminar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
