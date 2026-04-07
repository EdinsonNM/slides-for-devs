import { Cloud, CloudDownload, HardDrive, Users } from "lucide-react";
import type { SavedPresentationMeta } from "../../types";

function shortSyncedLabel(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Insignia esquina superior izquierda en tarjetas del home (gradiente / portada). */
export function PresentationStorageBadge({
  cloudId,
  cloudSyncedAt,
  localBodyCleared,
  sharedCloudSource,
}: Pick<
  SavedPresentationMeta,
  "cloudId" | "cloudSyncedAt" | "localBodyCleared" | "sharedCloudSource"
>) {
  const syncedShort = shortSyncedLabel(cloudSyncedAt);

  if (sharedCloudSource) {
    return (
      <div
        className="absolute top-5 left-5 z-30 flex max-w-[min(100%-2rem,15rem)] flex-col gap-0.5 rounded-lg bg-violet-700/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-violet-400/50"
        title="Importada desde una presentación que te compartieron. Es una copia local; no enlaza a la nube del autor."
      >
        <span className="flex items-center gap-1">
          <Users size={12} className="shrink-0" aria-hidden />
          Compartida
        </span>
        <span className="normal-case font-medium text-[9px] text-violet-100/95">
          Copia en este equipo
        </span>
      </div>
    );
  }

  if (cloudId && localBodyCleared) {
    return (
      <div
        className="absolute top-5 left-5 z-30 flex max-w-[min(100%-2rem,15rem)] flex-col gap-0.5 rounded-lg bg-sky-900/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-sky-400/50"
        title="Sin diapositivas en este equipo. Abre la tarjeta para descargar de nuevo desde tu nube."
      >
        <span className="flex items-center gap-1">
          <CloudDownload size={12} className="shrink-0" aria-hidden />
          En la nube
        </span>
        <span className="normal-case font-medium text-[9px] text-sky-100/95">
          Sin copia local — toca para recuperar
        </span>
      </div>
    );
  }

  if (cloudId) {
    const title = syncedShort
      ? `Sincronizada con tu nube. Último sync: ${syncedShort}.`
      : "Sincronizada con tu nube. Disponible en otros equipos con la misma cuenta.";
    return (
      <div
        className="absolute top-5 left-5 z-30 flex max-w-[min(100%-2rem,14rem)] flex-col gap-0.5 rounded-lg bg-emerald-600/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
        title={title}
      >
        <span className="flex items-center gap-1">
          <Cloud size={12} className="shrink-0" aria-hidden />
          En la nube
        </span>
        {syncedShort && (
          <span className="normal-case font-medium text-[9px] text-white/90">
            Sync {syncedShort}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="absolute top-5 left-5 z-30 flex max-w-[min(100%-2rem,14rem)] items-center gap-1 rounded-lg bg-amber-950/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-amber-400/45"
      title="Solo en este dispositivo. Sube a la nube para tener copia en tu cuenta y abrirla en otro equipo."
    >
      <HardDrive size={12} className="shrink-0" aria-hidden />
      Solo local
    </div>
  );
}
