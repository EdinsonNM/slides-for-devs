/**
 * Reglas reutilizables para generación y descripción de imágenes.
 * Usado por el Prompt Engine en prompts de imagen (alternatives, generation, refine, describe).
 */

export const imageContentRules: string[] = [
  "La imagen NO debe contener ningún texto, leyendas, etiquetas, palabras ni caracteres. Solo elementos puramente visuales e ilustrativos.",
  "No describas estilo visual (minimalista, 3D, etc.) en tu texto si ya está definido; tu respuesta se combina con el estilo elegido.",
  "La descripción debe ser coherente con el contexto del slide (título y contenido).",
  "Cuando haya personaje: debe ser DINÁMICO (otra pose, otra acción: señalando, sorprendido, enseñando, etc.), no la misma postura de referencia.",
];

/**
 * Texto para prohibiciones en prompts de imagen.
 */
export const imageProhibitions: string[] = [
  "PROHIBIDO: estilo visual (minimalista, 3D, etc.) en tu texto si ya está definido.",
  "PROHIBIDO: texto o palabras dentro de la imagen.",
  "PROHIBIDO: inventar otro personaje o cambiar la identidad base (rostro, estilo). SÍ debes describir vestimenta, accesorios y escenario acordes al contenido de la diapositiva (cultura, época, personaje histórico).",
];

/**
 * Regla obligatoria: no texto en la imagen (para generación).
 */
export function imageNoTextRule(): string {
  return "REGLA OBLIGATORIA: La imagen NO debe contener ningún texto, leyendas, etiquetas, palabras ni caracteres. Solo elementos puramente visuales e ilustrativos.";
}

/**
 * Reglas para personaje dinámico (alternativas / generación con personaje).
 */
export function imageCharacterDynamicRule(): string {
  return "El personaje debe ser DINÁMICO: otra pose, otra acción (señalando, sorprendido, enseñando, etc.), no la misma postura de referencia. NO incluyas estilo visual genérico. DESCRIBE: qué hace el personaje (acción), postura, posición, escenario y otros elementos.";
}

/**
 * El personaje debe contextualizarse al contenido de la diapositiva: misma identidad (rostro, estilo)
 * pero vestimenta, accesorios y escena deben reflejar el tema (cultura, época, personaje histórico).
 */
export function imageCharacterContextRule(): string {
  return "CONTEXTUALIZACIÓN OBLIGATORIA: La vestimenta, accesorios y escenario del personaje deben reflejar el contenido de la diapositiva (cultura, época, personaje histórico, tema). Ejemplos: si se habla de Perú o Túpac Amaru → vestimenta de la época, elementos históricos (caballos, contexto colonial); si es tecnología → ropa actual, entorno moderno. El personaje mantiene su identidad (rostro, proporciones, estilo) pero se adapta al contexto de la diapositiva.";
}
