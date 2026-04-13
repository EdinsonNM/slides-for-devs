import type { Slide } from "../domain/entities/Slide";
import { markdownToPlainText } from "../utils/markdownPlainText";

/** Datos mínimos de cada slide para la composición Remotion (serializable). */
export type DeckRemotionSlide = {
  id: string;
  type: Slide["type"];
  title: string;
  subtitle?: string;
  /** Cuerpo ya en texto plano (markdown simplificado). */
  bodyPlain: string;
  indexLabel: string;
};

const MAX_BODY = 2800;

export function mapSlidesForDeckVideoExport(slides: Slide[]): DeckRemotionSlide[] {
  const total = slides.length;
  return slides.map((s, i) => ({
    id: s.id,
    type: s.type,
    title: s.title,
    subtitle: s.subtitle,
    bodyPlain: markdownToPlainText(s.content || "").slice(0, MAX_BODY),
    indexLabel: `${i + 1} / ${total}`,
  }));
}
