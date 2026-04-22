import type { Slide } from "../domain/entities/Slide";

/** Portadas generadas antes del sentinela `[DECK_COVER_SLAIM]` (compatibilidad con caché del home). */
export const LEGACY_DECK_COVER_IMAGE_PROMPT =
  "Portada profesional y moderna para esta presentación, estilo minimalista y atractivo, sin texto.";

export const DECK_COVER_IMAGE_PROMPT_TAG = "[DECK_COVER_SLAIM]";

/** Valor persistido en `slide.imagePrompt` para portadas Slaim (no es el prompt largo enviado al modelo). */
export const DECK_COVER_IMAGE_PROMPT = `${DECK_COVER_IMAGE_PROMPT_TAG} Portada Slaim (lista de inicio).`;

/**
 * Raster de portada en Firebase Storage (`users/.../presentations/{cloudId}/deck_cover.ext`).
 * No reutiliza `slide_0.*`: la portada de lista es un recurso aparte del panel de imagen del slide.
 */
export const DECK_COVER_CLOUD_STORAGE_BASENAME = "deck_cover";

export const SLAIM_MASCOT_COVER_REFERENCE_FILENAME = "slaim-mascot-cover-reference.png";

/**
 * Slaim como caricatura 3D tipo blockbuster de animación (Pixar-like): misma identidad que la referencia
 * (slime verde lima, ojos grandes, sonrisa), pero con exageración amable y apelación emocional.
 */
export const SLAIM_MASCOT_COVER_CHARACTER_PROMPT =
  "Slaim: el mismo slime verde lima de la referencia, reinterpretado en estilo caricatura 3D tipo película de animación (Pixar-like): formas redondeadas y apetitosas, ojos muy expresivos con brillo espectacular, boca amplia y simpática, poses claras; proporciones ligeramente exageradas para humor y empatía, sin volverse grotesco. Materiales suaves, subsurface en gel, rim light suave.";

/**
 * Estilo visual de la portada (Gemini). Fondo variado con escenario que apoye el tema.
 */
export const DECK_COVER_STYLE_PROMPT =
  "Iluminación cinematográfica cálida, color grading rico y armonioso, profundidad de campo suave. Estética caricatura 3D de alta gama tipo estudio de animación (Pixar-like): personajes y props con bordes limpios, apelación emocional, humor visual ligero. Incluye un entorno temático variado (cielo al atardecer, taller acogedor, bosque estilizado, ciudad miniatura, laboratorio cartoon, etc.) acorde al tema de la presentación — nunca fondo plano vacío ni cyclorama gris. Sin diagramas técnicos ni estilo boceto a mano. Sin texto ni logotipos en la imagen.";

export function firstSlideDeckCoverImageUrl(first?: Slide): string | undefined {
  const url = first?.imageUrl?.trim();
  if (!url) return undefined;
  if (first.imagePrompt === DECK_COVER_IMAGE_PROMPT) return url;
  if (first.imagePrompt === LEGACY_DECK_COVER_IMAGE_PROMPT) return url;
  return undefined;
}

/** El slide tiene portada Slaim persistida (mismo criterio que en nube / SQLite). */
export function isPersistedSlaimDeckCoverSlide(slide: Slide | undefined): boolean {
  if (!slide) return false;
  const p = slide.imagePrompt?.trim();
  return p === DECK_COVER_IMAGE_PROMPT || p === LEGACY_DECK_COVER_IMAGE_PROMPT;
}

export function mascotCoverReferenceFetchUrl(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}${SLAIM_MASCOT_COVER_REFERENCE_FILENAME}`;
}

export function buildDeckCoverImageUserPrompt(): string {
  return [
    "Portada exclusiva para la tarjeta de la app (no es el interior del deck).",
    "La imagen adjunta define la identidad de Slaim (slime verde lima): conserva su esencia reconocible pero adáptala al look caricatura 3D Pixar-like descrito en el estilo.",
    "Una sola escena dinámica: Slaim realiza UNA acción clara con 2 a 4 props o elementos de apoyo que refuercen el tema del contexto (divertidos, redondeados, cohesivos con el entorno).",
    "Composición horizontal 16:9: coloca a Slaim predominante hacia la DERECHA; el lado izquierdo puede mostrar más entorno o “respiro” compositivo.",
    "Fondo variado y narrativo (no blanco liso): cielo con nubes estilizadas, habitación temática, exterior soleado, oficina cartoon, etc., siempre acorde al tema y con atmósfera agradable.",
    "Sin texto, números, marcas de agua ni interfaz de usuario.",
  ].join(" ");
}

export async function loadSlaimMascotCoverReferenceDataUrl(): Promise<
  string | undefined
> {
  try {
    const res = await fetch(mascotCoverReferenceFetchUrl());
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () =>
        resolve(typeof fr.result === "string" ? fr.result : undefined);
      fr.onerror = () => resolve(undefined);
      fr.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
