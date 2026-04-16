import type { Slide } from "../entities";

/** Resultado de generar el deck completo con IA. */
export interface GeneratedPresentationResult {
  slides: Slide[];
  /** Título corto sugerido para la presentación (cabecera / SQLite topic). */
  presentationTitle?: string;
}

/** Opciones ya resueltas para el adaptador (el use case construye `narrativeInstructions`). */
export interface GeneratePresentationOptions {
  narrativeInstructions?: string;
}

export interface PresentationGeneratorPort {
  generatePresentation(
    topic: string,
    modelId: string,
    options?: GeneratePresentationOptions,
  ): Promise<GeneratedPresentationResult>;
}
