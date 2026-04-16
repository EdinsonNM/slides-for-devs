import type { Slide } from "../domain/entities";
import { SLIDE_TYPE } from "../domain/entities";

export function truncateForPresentationTitle(text: string, max = 72): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

/**
 * Título de deck tras generación: modelo → primera chapter → primera slide → brief truncado.
 */
export function resolveGeneratedPresentationTitle(params: {
  presentationTitle?: string | null;
  slides: Slide[];
  fallbackBrief: string;
}): string {
  const fromModel = (params.presentationTitle ?? "").trim();
  if (fromModel.length > 0) return fromModel;
  const firstChapter = params.slides.find((s) => s.type === SLIDE_TYPE.CHAPTER);
  if (firstChapter?.title?.trim()) return firstChapter.title.trim();
  const first = params.slides[0];
  if (first?.title?.trim()) return first.title.trim();
  return truncateForPresentationTitle(params.fallbackBrief);
}
