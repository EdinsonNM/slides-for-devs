import type { Slide } from "../domain/entities/Slide";
import {
  markdownExtractImageUrls,
  markdownToPlainText,
} from "../utils/markdownPlainText";

/** Datos mínimos de cada slide para la composición Remotion (serializable). */
export type DeckRemotionSlide = {
  id: string;
  type: Slide["type"];
  title: string;
  subtitle?: string;
  /** Cuerpo ya en texto plano (markdown simplificado). */
  bodyPlain: string;
  indexLabel: string;
  /** URLs absolutas o data:/blob: para `<Img>` en el vídeo. */
  imageUrls: string[];
};

const MAX_BODY = 2800;

function isRenderableDeckImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (u.startsWith("data:image/")) return true;
  if (u.startsWith("blob:")) return true;
  if (/^https?:\/\//i.test(u)) {
    if (/youtube\.com|youtu\.be|vimeo\.com|player\.vimeo/i.test(u)) return false;
    return true;
  }
  if (u.startsWith("/")) return true;
  return false;
}

function absolutizeUrlForDeck(url: string): string {
  const u = url.trim();
  if (u.startsWith("/") && typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${u}`;
  }
  return u;
}

export function mapSlidesForDeckVideoExport(slides: Slide[]): DeckRemotionSlide[] {
  const total = slides.length;
  return slides.map((s, i) => {
    const urls: string[] = [];
    const push = (raw?: string) => {
      if (!raw?.trim()) return;
      const abs = absolutizeUrlForDeck(raw);
      if (!isRenderableDeckImageUrl(abs)) return;
      if (!urls.includes(abs)) urls.push(abs);
    };
    if (s.contentType !== "code") {
      push(s.imageUrl);
    }
    for (const u of markdownExtractImageUrls(s.content || "")) {
      push(u);
    }
    return {
      id: s.id,
      type: s.type,
      title: s.title,
      subtitle: s.subtitle,
      bodyPlain: markdownToPlainText(s.content || "").slice(0, MAX_BODY),
      indexLabel: `${i + 1} / ${total}`,
      imageUrls: urls,
    };
  });
}
