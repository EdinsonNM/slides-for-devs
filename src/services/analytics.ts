import { logEvent, setUserId } from "firebase/analytics";
import { getAnalyticsInstance } from "./firebase";

/** Nombres de eventos para Google Analytics (Firebase). Úsalos con trackEvent(). */
export const ANALYTICS_EVENTS = {
  /** Usuario generó una presentación nueva desde el home. */
  PRESENTATION_GENERATED: "presentation_generated",
  /** Usuario abrió una presentación guardada. */
  PRESENTATION_OPENED: "presentation_opened",
  /** Usuario guardó la presentación (manual o auto). */
  PRESENTATION_SAVED: "presentation_saved",
  /** Usuario abrió el modo presentador. */
  PRESENTER_MODE_OPENED: "presenter_mode_opened",
  /** Usuario generó una imagen con IA en una diapositiva. */
  IMAGE_GENERATED: "image_generated",
  /** Usuario generó código con IA. */
  CODE_GENERATED: "code_generated",
  /** Usuario generó notas del presentador para una diapositiva. */
  PRESENTER_NOTES_GENERATED: "presenter_notes_generated",
  /** Usuario generó speech/contenido para una diapositiva. */
  SPEECH_SLIDE_GENERATED: "speech_slide_generated",
  /** Usuario generó speech para todas las diapositivas. */
  SPEECH_ALL_GENERATED: "speech_all_generated",
  /** Usuario guardó un personaje (IA). */
  CHARACTER_SAVED: "character_saved",
  /** Usuario dividió una diapositiva con IA. */
  SLIDE_SPLIT: "slide_split",
  /** Usuario reescribió una diapositiva con IA. */
  SLIDE_REWRITTEN: "slide_rewritten",
  /** Usuario añadió un video a una diapositiva. */
  VIDEO_ADDED: "video_added",
  /** Usuario generó portada para una presentación guardada. */
  COVER_GENERATED: "cover_generated",
} as const;

type AnalyticsParams = Record<string, string | number | boolean>;

/**
 * Envía un evento a Firebase Analytics (Google Analytics).
 * Solo tiene efecto si Firebase está inicializado con measurementId y el usuario está en web o en Tauri con analytics disponible.
 * Los eventos se asocian al user ID cuando el usuario ha iniciado sesión (setAnalyticsUserId).
 */
export function trackEvent(
  eventName: string,
  params?: AnalyticsParams
): void {
  const analytics = getAnalyticsInstance();
  if (!analytics) return;
  try {
    logEvent(analytics, eventName, params);
  } catch {
    // Ignorar si el entorno no soporta analytics (ej. SSR o sin measurementId)
  }
}

/**
 * Asocia los eventos de Analytics al usuario de Firebase Auth.
 * Llamar con el uid cuando el usuario inicia sesión y con null al cerrar sesión.
 * Así en GA4 puedes filtrar por "User ID" para ver solo uso de cuentas identificadas.
 */
export function setAnalyticsUserId(uid: string | null): void {
  const analytics = getAnalyticsInstance();
  if (!analytics) return;
  try {
    setUserId(analytics, uid ?? undefined);
  } catch {
    // Ignorar si el entorno no soporta analytics
  }
}
