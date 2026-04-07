import type { SavedPresentationMeta } from "../types";

type CardStorageMeta = Pick<
  SavedPresentationMeta,
  "cloudId" | "localBodyCleared"
>;

/** Tarjetas con fondo oscuro / gradiente (home). */
export function presentationHeroCardBorderClass(meta: CardStorageMeta): string {
  const cloud = !!meta.cloudId;
  const cloudStub = !!meta.localBodyCleared && cloud;
  if (cloudStub) {
    return "border-2 border-dashed border-sky-300/85 shadow-lg shadow-sky-950/25 ring-1 ring-sky-400/35";
  }
  if (cloud) {
    return "border-2 border-solid border-emerald-400/75 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/35";
  }
  return "border-2 border-dashed border-white/55 shadow-lg";
}

/** Tarjetas en modales con fondo claro. */
export function presentationListCardBorderClass(meta: CardStorageMeta): string {
  const cloud = !!meta.cloudId;
  const cloudStub = !!meta.localBodyCleared && cloud;
  if (cloudStub) {
    return "border-2 border-dashed border-sky-400 dark:border-sky-500";
  }
  if (cloud) {
    return "border-2 border-solid border-emerald-400 dark:border-emerald-600";
  }
  return "border-2 border-dashed border-amber-400/90 dark:border-amber-500/70";
}
