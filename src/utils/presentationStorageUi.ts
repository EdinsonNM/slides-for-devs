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
    return "border-2 border-solid border-white/45 shadow-lg shadow-black/30 ring-1 ring-black/15 dark:ring-white/15";
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
    return "border-2 border-solid border-stone-300/90 dark:border-stone-500/80 shadow-sm";
  }
  return "border-2 border-dashed border-amber-400/90 dark:border-amber-500/70";
}
