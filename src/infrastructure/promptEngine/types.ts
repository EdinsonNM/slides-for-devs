/**
 * Tipos para el Prompt Object Pattern.
 * Cada prompt se define como objeto; buildPrompt() genera el prompt final.
 */

/** Reglas: array de strings o texto formateado (función que devuelve string). */
export type RulesInput = string[] | (() => string) | string;

/** Restricciones opcionales (ej: min/max slides, instrucciones adicionales). */
export type ConstraintsInput = Record<string, unknown> | string | undefined;

/** Descripción del schema de salida para el LLM (texto o referencia). */
export type OutputSchemaInput = string | { description: string };

/**
 * Definición base de un prompt (objeto estructurado).
 * El input genérico permite tipar los datos dinámicos por flujo.
 */
export interface PromptDefinition<TInput = Record<string, unknown>> {
  /** Rol del modelo (ej: "presentation_expert", "image_expert"). */
  role: string;
  /** Descripción de la tarea. */
  task: string;
  /** Reglas reutilizables (desde promptRules) o texto inline. */
  rules?: RulesInput;
  /** Restricciones opcionales. */
  constraints?: ConstraintsInput;
  /** Descripción del JSON/forma de salida. */
  outputSchema?: OutputSchemaInput;
  /**
   * Si existe, el engine usa esta función para construir el user message.
   * Si no, se usa constraints + "Datos:" + JSON.stringify(input).
   */
  buildUserMessage?: (input: TInput) => string;
}

/**
 * Resultado de buildPrompt: lo que consumen los adaptadores.
 */
export interface BuiltPrompt {
  system: string;
  user: string;
}

/**
 * Input para generatePresentation.
 */
export interface GeneratePresentationInput {
  topic: string;
  slideCount: number;
  strictCount?: boolean;
  /** Instrucciones narrativas (preset + notas) para el modelo. */
  narrativeInstructions?: string;
}

/**
 * Input para splitSlide.
 */
export interface SplitSlideInput {
  slide: { title: string; content: string };
  userPrompt: string;
}

/**
 * Input para rewriteSlide.
 */
export interface RewriteSlideInput {
  slide: { title: string; content: string };
  userPrompt: string;
  /** Objetivo / tono global del deck (opcional). */
  deckNarrativeContext?: string;
}

/**
 * Input para generateSlideContent (una diapositiva desde instrucción / borrador).
 */
export interface GenerateSlideContentInput {
  presentationTopic: string;
  slideTitle: string;
  slideContent: string;
  userPrompt: string;
  deckNarrativeContext?: string;
}

/** Input para generar título, notas y tabla estructurada en un slide tipo matrix. */
export interface GenerateSlideMatrixInput {
  presentationTopic: string;
  slideTitle: string;
  slideSubtitle: string;
  /** JSON serializado de la matriz actual (para refinar o sustituir). */
  matrixJson: string;
  userPrompt: string;
  deckNarrativeContext?: string;
}

/** Input para generar diagrama Mermaid → Excalidraw en un slide tipo diagram. */
export interface GenerateSlideDiagramInput {
  presentationTopic: string;
  slideTitle: string;
  /** Texto libre / notas actuales del slide (contexto). */
  slideContent: string;
  userPrompt: string;
  deckNarrativeContext?: string;
}
