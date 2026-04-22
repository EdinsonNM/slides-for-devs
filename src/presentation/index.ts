/**
 * Capa de presentación del slide (UI atómica + estado UI en Zustand).
 *
 * Convención de carpetas:
 * - `slide-elements/atoms`: piezas mínimas sin lógica de negocio.
 * - `slide-elements/molecules`: composiciones de texto del slide (título, capítulo, …).
 * - `state/slices`: trozos del store Zustand; combinar en `presentationUiStore`.
 * - `hooks`: selectores y acciones cómodas sobre el store.
 * - `types`: tipos compartidos solo de esta capa (no duplicar entidades de dominio).
 *
 * Los datos del deck (slides, edición persistente) siguen en `PresentationContext` / hooks
 * existentes hasta que migres cada flujo a stores o casos de uso.
 */
export * from "./slide-elements/index.ts";
export * from "./state/index.ts";
export * from "./hooks/index.ts";
export * from "./types/index.ts";
