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
  }): Promise<string | undefined>;
}
