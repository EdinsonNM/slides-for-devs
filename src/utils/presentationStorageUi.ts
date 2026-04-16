import type { SavedPresentationMeta } from "../types";

type CardStorageMeta = Pick<
  SavedPresentationMeta,
  "cloudId" | "localBodyCleared"
>;

/** Home hero: borde fino y sombra suave; el estado de almacenamiento se ve sobre todo en la insignia. */
export function presentationHeroCardBorderClass(meta: CardStorageMeta): string {
  const cloudStub = !!meta.localBodyCleared && !!meta.cloudId;
  const shadow =
    "shadow-sm shadow-stone-900/6 dark:shadow-black/25";
  if (cloudStub) {
    return `border border-dashed border-sky-300/75 dark:border-sky-600/45 ${shadow}`;
  }
  return `border border-solid border-stone-200/90 dark:border-stone-600/55 ${shadow}`;
}

/** Tarjetas en modales con fondo claro. */
export function presentationListCardBorderClass(meta: CardStorageMeta): string {
  const cloud = !!meta.cloudId;
  const cloudStub = !!meta.localBodyCleared && cloud;
  if (cloudStub) {
    return "border-2 border-solid border-sky-400 dark:border-sky-500";
  }
  if (cloud) {
    return "border-2 border-solid border-stone-300/90 dark:border-stone-500/80 shadow-sm";
  }
  return "border-2 border-dashed border-amber-400/90 dark:border-amber-500/70";
}
