/**
 * Texto pegado o añadido como “documento” en el prompt de generación (estilo ChatGPT).
 */

export type PromptAttachment = {
  id: string;
  name: string;
  text: string;
};

/** Por encima de esto, un pegado de texto plano se convierte en adjunto en lugar de llenar el campo. */
export const LARGE_PASTE_CHAR_THRESHOLD = 2000;

export function createPromptAttachment(name: string, text: string): PromptAttachment {
  return { id: crypto.randomUUID(), name, text };
}

export function nextPastedDocumentName(existingCount: number): string {
  return `documento-${existingCount + 1}.txt`;
}

/**
 * Combina la instrucción visible con los documentos adjuntos para enviar al modelo.
 * `displayTopic` es el título corto que se guarda en la presentación.
 */
export function composeFullDeckModelInput(
  instruction: string,
  attachments: PromptAttachment[],
): { modelInput: string; displayTopic: string } {
  const inst = instruction.trim();
  const blocks: string[] = [];
  if (inst) blocks.push(inst);
  for (const a of attachments) {
    const body = a.text.trim();
    if (body.length > 0) {
      blocks.push(`--- Documento: ${a.name} ---\n${body}`);
    }
  }
  const modelInput = blocks.join("\n\n").trim();

  let displayTopic = inst;
  if (!displayTopic) {
    const firstLine =
      attachments[0]?.text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.length > 0) ?? "";
    displayTopic = firstLine.slice(0, 120) || "Presentación";
  }

  return { modelInput, displayTopic };
}
