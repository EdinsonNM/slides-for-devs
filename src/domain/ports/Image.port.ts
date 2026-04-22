export type GeneratedImageAspectRatio = "9:16" | "16:9";

export interface ImageGeneratorPort {
  generateImage(params: {
    slideContext: string;
    userPrompt: string;
    stylePrompt: string;
    includeBackground: boolean;
    modelId: string;
    characterPrompt?: string;
    characterReferenceImageDataUrl?: string;
    /** Vista previa del creador de personajes: no forzar 2D ni anular 3D/isométrico del usuario. */
    characterPreviewOnly?: boolean;
    /** Por defecto 9:16 (slides). Portadas de listado suelen usar 16:9. */
    aspectRatio?: GeneratedImageAspectRatio;
  }): Promise<string | undefined>;
}
