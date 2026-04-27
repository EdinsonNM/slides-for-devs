import { useEffect, useMemo, useState } from "react";
import { Globe2, Loader2, Save, Settings2, X } from "lucide-react";
import { useAuth } from "@/presentation/contexts/AuthContext";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import {
  getPresentationPublicationMetadata,
  setPresentationPublicationMetadata,
  transferPresentationOwnership,
  type PresentationPublicationLevel,
  type PresentationPublicationVisibility,
} from "../../services/presentationCloud";
import {
  PRESENTATION_CATEGORY_OPTIONS,
  PRESENTATION_LEVEL_OPTIONS,
  PRESENTATION_VISIBILITY_OPTIONS,
} from "../../constants/presentationPublication";
import { formatCloudSyncUserMessage } from "../../utils/cloudSyncErrors";
import { cn } from "../../utils/cn";

/**
 * Configuración de publicación (visibilidad, descripción, tags, nivel, categorías)
 * en el área central del editor, mismo patrón de layout que el README.
 */
export function PresentationSettingsEditor() {
  const { user } = useAuth();
  const {
    topic,
    currentSavedId,
    savedList,
    setIsPresentationSettingsPanelOpen,
    openSharePresentationModal,
    cloudSyncAvailable,
    handleSyncPresentationToCloud,
  } = usePresentation();

  const meta = currentSavedId
    ? savedList.find((p) => p.id === currentSavedId)
    : undefined;
  const cloudId = meta?.cloudId?.trim() ?? "";
  const ownerUid = user?.uid ?? "";

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [visibility, setVisibility] =
    useState<PresentationPublicationVisibility>("private");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [level, setLevel] = useState<PresentationPublicationLevel>("intermediate");
  const [categories, setCategories] = useState<string[]>([]);
  const [transferOwnerUid, setTransferOwnerUid] = useState("");
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    setSavedOk(false);
    if (!ownerUid || !cloudId) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    getPresentationPublicationMetadata(ownerUid, cloudId)
      .then((m) => {
        setVisibility(m.visibility);
        setDescription(m.description);
        setTagsText(m.tags.join(", "));
        setLevel(m.level);
        setCategories(m.categories);
      })
      .catch((e) => {
        console.error(e);
        setError(formatCloudSyncUserMessage(e));
      })
      .finally(() => setLoading(false));
  }, [ownerUid, cloudId]);

  const parsedTags = useMemo(
    () =>
      tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [tagsText],
  );

  const toggleCategory = (category: string) => {
    setCategories((prev) =>
      prev.includes(category)
        ? prev.filter((x) => x !== category)
        : [...prev, category].slice(0, 8),
    );
  };

  const handleSave = async () => {
    if (!ownerUid || !cloudId) return;
    setSaving(true);
    setError(null);
    setSavedOk(false);
    try {
      await setPresentationPublicationMetadata(ownerUid, cloudId, {
        visibility,
        description,
        tags: parsedTags,
        level,
        categories,
      });
      setSavedOk(true);
    } catch (e) {
      console.error(e);
      setError(formatCloudSyncUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const noCloud = !cloudId;
  const canOpenShareModal = !!currentSavedId && !noCloud;

  const handleTransferOwnership = async () => {
    if (!ownerUid || !cloudId || !transferOwnerUid.trim()) return;
    const confirmTransfer = window.confirm(
      "Vas a transferir esta presentación a otro owner. Ya no podrás gestionarla como propietario. ¿Continuar?"
    );
    if (!confirmTransfer) return;
    setTransferring(true);
    setError(null);
    try {
      await transferPresentationOwnership(ownerUid, cloudId, transferOwnerUid.trim());
      setSavedOk(true);
      setTransferOwnerUid("");
      setIsPresentationSettingsPanelOpen(false);
    } catch (e) {
      console.error(e);
      setError(formatCloudSyncUserMessage(e));
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-stone-100 dark:bg-stone-950">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200/90 bg-white px-3 py-2 dark:border-border dark:bg-surface-elevated">
        <div className="flex min-w-0 items-center gap-2 text-stone-800 dark:text-foreground">
          <Settings2 size={18} className="shrink-0 text-sky-600 dark:text-sky-400" />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">
              Configuración de la presentación
            </h1>
            <p className="truncate text-[11px] text-muted-foreground">
              Publicación en Slaim: visibilidad, descripción, tags, nivel y categorías.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!noCloud && (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading || saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-surface dark:text-stone-100 dark:hover:bg-white/10"
            >
              <Save size={14} />
              {saving ? "Guardando…" : "Guardar en la nube"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsPresentationSettingsPanelOpen(false)}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium",
              "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/10",
            )}
            aria-label="Cerrar configuración y volver al lienzo"
          >
            <X size={16} />
            Cerrar
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Presentación:{" "}
            <span className="font-medium text-stone-900 dark:text-foreground">
              {topic || meta?.topic || "Sin título"}
            </span>
          </p>

          {noCloud ? (
            <div className="rounded-xl border border-amber-200/90 bg-amber-50/95 p-4 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-medium">Aún no hay copia en la nube</p>
              <p className="mt-2 text-amber-900/90 dark:text-amber-200/90">
                Sincroniza esta presentación con tu cuenta para poder configurar la
                publicación.
              </p>
              {cloudSyncAvailable && currentSavedId && (
                <button
                  type="button"
                  onClick={() => void handleSyncPresentationToCloud(currentSavedId)}
                  className="mt-4 rounded-lg bg-amber-800 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-500"
                >
                  Sincronizar con la nube
                </button>
              )}
            </div>
          ) : loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-stone-400" />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="rounded-lg border border-stone-200 bg-white p-3 dark:border-border dark:bg-surface">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  Compartir con usuarios
                </p>
                <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                  Configura accesos por usuario en modo lectura o edición.
                </p>
                {canOpenShareModal && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentSavedId) return;
                      openSharePresentationModal(currentSavedId);
                    }}
                    className="mt-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:border-border dark:bg-surface-elevated dark:text-stone-100 dark:hover:bg-white/10"
                  >
                    Gestionar compartidos
                  </button>
                )}
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  Visibilidad
                </span>
                <select
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as PresentationPublicationVisibility)
                  }
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm dark:border-border dark:bg-surface"
                >
                  {PRESENTATION_VISIBILITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  Nivel
                </span>
                <select
                  value={level}
                  onChange={(e) =>
                    setLevel(e.target.value as PresentationPublicationLevel)
                  }
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm dark:border-border dark:bg-surface"
                >
                  {PRESENTATION_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  Descripción
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  maxLength={500}
                  className="w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-border dark:bg-surface"
                  placeholder="Describe brevemente de qué trata esta presentación."
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  Tags
                </span>
                <input
                  type="text"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm dark:border-border dark:bg-surface"
                  placeholder="react, tauri, docker"
                />
              </label>

              <div className="space-y-2">
                <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  <Globe2 size={14} />
                  Categorías
                </p>
                <div className="flex flex-wrap gap-2">
                  {PRESENTATION_CATEGORY_OPTIONS.map((category) => {
                    const active = categories.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className={
                          active
                            ? "rounded-full bg-sky-100 px-2.5 py-1 text-xs text-sky-900 dark:bg-sky-900/40 dark:text-sky-100"
                            : "rounded-full bg-stone-200/80 px-2.5 py-1 text-xs text-stone-700 dark:bg-stone-800 dark:text-stone-300"
                        }
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  Transferir presentación (owner)
                </p>
                <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-100/90">
                  Ingresa el UID del usuario que será el nuevo owner.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={transferOwnerUid}
                    onChange={(e) => setTransferOwnerUid(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm dark:border-amber-800 dark:bg-surface"
                    placeholder="UID del nuevo owner"
                  />
                  <button
                    type="button"
                    onClick={() => void handleTransferOwnership()}
                    disabled={transferring || !transferOwnerUid.trim()}
                    className="shrink-0 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
                  >
                    {transferring ? "Transfiriendo…" : "Transferir"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {savedOk && !noCloud && (
            <p
              className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
              role="status"
            >
              Cambios guardados en la nube.
            </p>
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
