/** Modelos de generación 3D (texto / imagen → modelo) en la API de Meshy. */
export const DEFAULT_MESHY_AI_MODEL_ID = "latest";

export const MESHY_AI_MODEL_STORAGE_KEY = "slaim_meshy_ai_model_id";

export const MESHY_AI_MODEL_OPTIONS: { id: string; label: string }[] = [
  { id: "latest", label: "Meshy 6 (latest)" },
  { id: "meshy-6", label: "Meshy 6" },
  { id: "meshy-5", label: "Meshy 5" },
];

export function readStoredMeshyAiModelId(): string {
  if (typeof window === "undefined") return DEFAULT_MESHY_AI_MODEL_ID;
  const raw = window.localStorage
    .getItem(MESHY_AI_MODEL_STORAGE_KEY)
    ?.trim();
  if (!raw) return DEFAULT_MESHY_AI_MODEL_ID;
  const ok = MESHY_AI_MODEL_OPTIONS.some((o) => o.id === raw);
  return ok ? raw : DEFAULT_MESHY_AI_MODEL_ID;
}

export function writeStoredMeshyAiModelId(id: string): void {
  if (typeof window === "undefined") return;
  const trimmed = id.trim();
  if (!trimmed) {
    window.localStorage.removeItem(MESHY_AI_MODEL_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(MESHY_AI_MODEL_STORAGE_KEY, trimmed);
}
