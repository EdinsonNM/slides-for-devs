import type { BuiltPrompt, PromptDefinition, RulesInput, OutputSchemaInput } from "./types";

/**
 * Resuelve reglas a un único string (para system prompt).
 */
function resolveRules(rules: RulesInput | undefined): string {
  if (!rules) return "";
  if (typeof rules === "string") return rules;
  if (typeof rules === "function") return rules();
  return rules.join("\n");
}

/**
 * Resuelve outputSchema a string.
 */
function resolveOutputSchema(outputSchema: OutputSchemaInput | undefined): string {
  if (!outputSchema) return "";
  return typeof outputSchema === "string" ? outputSchema : outputSchema.description;
}

/**
 * Construye el system prompt a partir de la definición.
 */
function buildSystem<TInput>(def: PromptDefinition<TInput>): string {
  const parts: string[] = [];
  if (def.role) parts.push(def.role);
  if (def.task) parts.push(def.task);
  const rulesText = resolveRules(def.rules);
  if (rulesText) parts.push(rulesText);
  const schemaText = resolveOutputSchema(def.outputSchema);
  if (schemaText) parts.push(schemaText);
  return parts.filter(Boolean).join("\n\n");
}

/**
 * Construye el user prompt.
 * Si la definición tiene buildUserMessage, se usa; si no, se usa input como datos JSON + constraints.
 */
function buildUser<TInput>(def: PromptDefinition<TInput>, input: TInput): string {
  const defWithBuilder = def as PromptDefinition<TInput> & {
    buildUserMessage?: (input: TInput) => string;
  };
  if (typeof defWithBuilder.buildUserMessage === "function") {
    return defWithBuilder.buildUserMessage(input);
  }
  const parts: string[] = [];
  if (def.constraints && typeof def.constraints === "string") {
    parts.push(def.constraints);
  }
  if (input != null && typeof input === "object" && Object.keys(input as object).length > 0) {
    parts.push("Datos:\n" + JSON.stringify(input, null, 0));
  }
  return parts.filter(Boolean).join("\n\n");
}

/**
 * Genera el prompt final (system + user) a partir de una definición y el input dinámico.
 */
export function buildPrompt<TInput>(
  definition: PromptDefinition<TInput>,
  input: TInput
): BuiltPrompt {
  return {
    system: buildSystem(definition),
    user: buildUser(definition, input),
  };
}
