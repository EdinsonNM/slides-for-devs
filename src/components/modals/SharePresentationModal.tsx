import { useEffect, useState } from "react";
import { X, Loader2, UserPlus, Trash2 } from "lucide-react";
import {
  getPresentationShareAccess,
  normalizeShareEmail,
  setPresentationShareAccess,
  type PresentationShareEntry,
  type PresentationSharePermission,
} from "../../services/presentationCloud";
import { formatCloudSyncUserMessage } from "../../utils/cloudSyncErrors";
import { useAuth } from "../../presentation/contexts/AuthContext";

export interface SharePresentationModalProps {
  open: boolean;
  onClose: () => void;
  ownerUid: string;
  cloudId: string;
  topic: string;
}

/**
 * Gestiona invitaciones en `users/{owner}/presentationShareGrants` y sincroniza arrays en el doc
 * de la presentación (Storage/reglas). Cada invitado puede tener acceso de lectura o edición.
 */
export function SharePresentationModal({
  open,
  onClose,
  ownerUid,
  cloudId,
  topic,
}: SharePresentationModalProps) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PresentationShareEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [input, setInput] = useState("");
  const [defaultAccess, setDefaultAccess] =
    useState<PresentationSharePermission>("read");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setInput("");
    setLoading(true);
    getPresentationShareAccess(ownerUid, cloudId)
      .then((access) => {
        setEntries(access.entries);
      })
      .catch((e) => {
        console.error(e);
        setError(formatCloudSyncUserMessage(e));
        setEntries([]);
      })
      .finally(() => setLoading(false));
  }, [open, ownerUid, cloudId]);

  const ownerEmailNorm = user?.email ? normalizeShareEmail(user.email) : null;

  const handleAdd = () => {
    const raw = input.trim();
    if (!raw) return;

    const asEmail = normalizeShareEmail(raw);
    if (asEmail) {
      if (ownerEmailNorm && asEmail === ownerEmailNorm) {
        setError("No puedes invitar tu propio correo.");
        return;
      }
      if (entries.some((e) => e.kind === "email" && e.value === asEmail)) {
        setInput("");
        return;
      }
      setEntries((prev) => [
        ...prev,
        { kind: "email", value: asEmail, access: defaultAccess },
      ]);
      setInput("");
      setError(null);
      return;
    }

    if (raw.includes("@")) {
      setError("Ese correo no parece válido.");
      return;
    }

    if (raw === ownerUid) {
      setError("No hace falta añadirte a ti mismo.");
      return;
    }
    if (entries.some((e) => e.kind === "uid" && e.value === raw)) {
      setInput("");
      return;
    }
    setEntries((prev) => [
      ...prev,
      { kind: "uid", value: raw, access: defaultAccess },
    ]);
    setInput("");
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await setPresentationShareAccess(ownerUid, cloudId, {
        entries,
        sharedWithUids: entries
          .filter((e) => e.kind === "uid")
          .map((e) => e.value),
        shareInviteEmails: entries
          .filter((e) => e.kind === "email")
          .map((e) => e.value),
      });
      onClose();
    } catch (e) {
      console.error(e);
      setError(formatCloudSyncUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-surface-elevated rounded-xl shadow-xl max-w-md w-full flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="share-pres-title"
      >
        <div className="p-4 border-b border-stone-200 dark:border-border flex items-center justify-between shrink-0">
          <h3
            id="share-pres-title"
            className="font-semibold text-stone-900 dark:text-foreground flex items-center gap-2"
          >
            <UserPlus className="text-emerald-600" size={22} />
            Compartir presentación
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
        <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            <span className="font-medium text-stone-800 dark:text-foreground">
              {topic || "Sin título"}
            </span>
            {" · "}
            Añade el correo con el que tu compañero inicia sesión en Slaim
            (p. ej. el mismo de Google), o su UID si lo prefieres. El acceso puede ser
            solo lectura o edición sobre la misma presentación compartida.
          </p>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  placeholder="correo@ejemplo.com o UID"
                  className="flex-1 min-w-0 rounded-lg border border-stone-200 dark:border-border bg-white dark:bg-surface px-3 py-2 text-sm text-stone-900 dark:text-foreground"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  className="shrink-0 px-3 py-2 rounded-lg bg-stone-100 dark:bg-stone-700 text-sm font-medium text-stone-800 dark:text-stone-200 hover:opacity-90"
                >
                  Añadir
                </button>
                <select
                  value={defaultAccess}
                  onChange={(e) =>
                    setDefaultAccess(e.target.value as PresentationSharePermission)
                  }
                  className="shrink-0 rounded-lg border border-stone-200 dark:border-border bg-white dark:bg-surface px-2 py-2 text-xs"
                  title="Permiso por defecto al añadir"
                >
                  <option value="read">Lectura</option>
                  <option value="edit">Edición</option>
                </select>
              </div>
              {entries.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Nadie más tiene acceso. El invitado debe usar el mismo correo en el inicio de sesión de la app.
                </p>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {entries.some((e) => e.kind === "email") && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">
                        Por correo
                      </p>
                      <ul className="space-y-1">
                        {entries
                          .filter((e) => e.kind === "email")
                          .map((em) => (
                          <li
                            key={`${em.kind}:${em.value}`}
                            className="flex items-center gap-2 justify-between rounded-lg border border-stone-100 dark:border-border px-3 py-2 text-sm"
                          >
                            <span className="truncate text-xs text-stone-700 dark:text-stone-300">
                              {em.value}
                            </span>
                            <select
                              value={em.access}
                              onChange={(ev) =>
                                setEntries((prev) =>
                                  prev.map((it) =>
                                    it.kind === "email" && it.value === em.value
                                      ? {
                                          ...it,
                                          access:
                                            ev.target.value === "edit"
                                              ? "edit"
                                              : "read",
                                        }
                                      : it
                                  )
                                )
                              }
                              className="rounded-md border border-stone-200 dark:border-border bg-white dark:bg-surface px-1.5 py-1 text-[11px]"
                            >
                              <option value="read">Lectura</option>
                              <option value="edit">Edición</option>
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                setEntries((prev) =>
                                  prev.filter(
                                    (x) => !(x.kind === "email" && x.value === em.value)
                                  )
                                )
                              }
                              className="p-1.5 rounded-md text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                              aria-label={`Quitar ${em.value}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {entries.some((e) => e.kind === "uid") && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1">
                        Por UID
                      </p>
                      <ul className="space-y-1">
                        {entries
                          .filter((e) => e.kind === "uid")
                          .map((u) => (
                          <li
                            key={`${u.kind}:${u.value}`}
                            className="flex items-center gap-2 justify-between rounded-lg border border-stone-100 dark:border-border px-3 py-2 text-sm"
                          >
                            <code className="truncate text-xs text-stone-700 dark:text-stone-300">
                              {u.value}
                            </code>
                            <select
                              value={u.access}
                              onChange={(ev) =>
                                setEntries((prev) =>
                                  prev.map((it) =>
                                    it.kind === "uid" && it.value === u.value
                                      ? {
                                          ...it,
                                          access:
                                            ev.target.value === "edit"
                                              ? "edit"
                                              : "read",
                                        }
                                      : it
                                  )
                                )
                              }
                              className="rounded-md border border-stone-200 dark:border-border bg-white dark:bg-surface px-1.5 py-1 text-[11px]"
                            >
                              <option value="read">Lectura</option>
                              <option value="edit">Edición</option>
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                setEntries((prev) =>
                                  prev.filter(
                                    (x) => !(x.kind === "uid" && x.value === u.value)
                                  )
                                )
                              }
                              className="p-1.5 rounded-md text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                              aria-label={`Quitar ${u.value}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="p-4 border-t border-stone-200 dark:border-border flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading || saving}
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
