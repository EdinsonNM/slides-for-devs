/**
 * Presets de objetivo / narrativa para generación de deck (no confundir con tema visual ni estilo de imagen).
 */
export const DEFAULT_DECK_NARRATIVE_PRESET_ID = "general";

/** Objetivo definido por el usuario en el modal “Custom”. */
export const DECK_NARRATIVE_CUSTOM_PRESET_ID = "custom";

export interface PresentationNarrativePreset {
  id: string;
  label: string;
  /** Etiqueta corta para chips en barras estrechas (evita scroll horizontal). */
  shortLabel: string;
  description: string;
  /** Instrucciones inyectadas en el prompt de generación completa. */
  instructionsForModel: string;
}

export const PRESENTATION_NARRATIVE_PRESETS: readonly PresentationNarrativePreset[] = [
  {
    id: "general",
    label: "General",
    shortLabel: "General",
    description:
      "Cuando no buscas un estilo muy marcado: informes, status, documentación o decks que deban servir para varias situaciones.",
    instructionsForModel:
      "Estructura clara y profesional: portada o capítulo inicial, secciones de contenido con viñetas y datos cuando aplique, y cierre con conclusiones o siguientes pasos. Tono informativo y directo.",
  },
  {
    id: "teaching",
    label: "Enseñanza",
    shortLabel: "Clase",
    description:
      "Para enseñar o formar: conceptos ordenados, definiciones, ejemplos y un cierre con resumen o ideas para practicar.",
    instructionsForModel:
      "Enfoque didáctico: introduce conceptos de forma progresiva, usa definiciones breves, ejemplos concretos y analogías cuando ayuden. Incluye una sección de resumen o ‘takeaways’ y, si encaja, ideas de práctica o comprobación de comprensión. Evita jerga sin explicarla.",
  },
  {
    id: "storytelling",
    label: "Storytelling",
    shortLabel: "Historia",
    description:
      "Charlas con hilo narrativo: plantear contexto y conflicto, avanzar por “capítulos” y cerrar con un mensaje memorable.",
    instructionsForModel:
      "Narrativa con arco: contexto o ‘mundo’ inicial, problema o tensión, desarrollo por capítulos (usa slides tipo chapter para marcar actos), clímax o insight clave y resolución o moraleja. Tono cercano pero profesional; haz memorable el hilo conductor.",
  },
  {
    id: "sales_pitch",
    label: "Venta / pitch",
    shortLabel: "Pitch",
    description:
      "Ventas, demos o inversores: problema del cliente, solución, pruebas o datos de respaldo y un cierre con siguiente paso claro.",
    instructionsForModel:
      "Pitch comercial: problema del cliente, propuesta de valor clara, diferenciación, prueba o prueba social (métricas, casos), oferta o paquetes si aplica, y cierre con llamada a la acción concreta. Tono persuasivo sin exagerar; datos creíbles.",
  },
  {
    id: "keynote",
    label: "Keynote",
    shortLabel: "Keynote",
    description:
      "Presentaciones en escenario o evento: frases cortas, pocas viñetas y ideas que se lean bien en pantalla grande.",
    instructionsForModel:
      "Estilo keynote: mensajes cortos y contundentes, pocas viñetas por slide, frases memorables. Usa capítulos para ritmo; evita densidad de texto; prioriza ideas que puedan proyectarse en pantalla grande.",
  },
  {
    id: DECK_NARRATIVE_CUSTOM_PRESET_ID,
    label: "Personalizado",
    shortLabel: "Custom",
    description:
      "Cuando quieres fijar tú el tono, la audiencia, la estructura o reglas concretas; al elegirlo se abre un editor de texto.",
    instructionsForModel:
      "Estructura clara y profesional por defecto. El usuario puede añadir instrucciones detalladas en el editor personalizado; si no hay texto personalizado, prioriza claridad y brevedad.",
  },
] as const;

export interface NarrativePresetComboOption {
  id: string;
  label: string;
  description: string;
}

/** Opciones del combo de objetivo (misma fila que el modelo en el prompt). */
export const NARRATIVE_PRESET_COMBO_OPTIONS: NarrativePresetComboOption[] =
  PRESENTATION_NARRATIVE_PRESETS.map((p) => ({
    id: p.id,
    label: p.shortLabel,
    description: p.description,
  }));

export function getPresentationNarrativePresetById(
  id: string | undefined | null,
): PresentationNarrativePreset {
  const normalized = (id ?? "").trim() || DEFAULT_DECK_NARRATIVE_PRESET_ID;
  const found = PRESENTATION_NARRATIVE_PRESETS.find((p) => p.id === normalized);
  return found ?? PRESENTATION_NARRATIVE_PRESETS[0];
}

/** Texto combinado para prompts (preset fijo o instrucciones “Custom”). */
export function buildDeckNarrativeContextForPrompts(
  presetId: string | undefined | null,
  narrativeNotes?: string | null,
): string {
  const preset = getPresentationNarrativePresetById(presetId);
  const notes = (narrativeNotes ?? "").trim();

  if (preset.id === DECK_NARRATIVE_CUSTOM_PRESET_ID) {
    if (notes.length > 0) {
      return `Instrucciones de narrativa y objetivo (definidas por el usuario):\n${notes.slice(0, 1200)}`;
    }
    return preset.instructionsForModel;
  }

  return preset.instructionsForModel;
}
