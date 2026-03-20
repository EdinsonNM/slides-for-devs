const STORAGE_GEMINI = "slaim_gemini_api_key";
const STORAGE_OPENAI = "slaim_openai_api_key";
const STORAGE_XAI = "slaim_xai_api_key";
const STORAGE_GROQ = "slaim_groq_api_key";
const STORAGE_CEREBRAS = "slaim_cerebras_api_key";
const STORAGE_OPENROUTER = "slaim_openrouter_api_key";

/** Cache en memoria cuando corre en Tauri (keychain); se rellena con loadApiKeysFromBackend(). */
const inMemoryCache: {
  gemini: string | null;
  openai: string | null;
  xai: string | null;
  groq: string | null;
  cerebras: string | null;
  openrouter: string | null;
} = {
  gemini: null,
  openai: null,
  xai: null,
  groq: null,
  cerebras: null,
  openrouter: null,
};

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined
  );
}

/** Carga las API keys desde el keychain (Tauri). Llamar al inicio si isTauri(). */
export async function loadApiKeysFromBackend(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const [
      gemini,
      openai,
      xai,
      groq,
      cerebras,
      openrouter,
    ] = await Promise.all([
      invoke<string | null>("get_gemini_api_key"),
      invoke<string | null>("get_openai_api_key"),
      invoke<string | null>("get_xai_api_key"),
      invoke<string | null>("get_groq_api_key"),
      invoke<string | null>("get_cerebras_api_key"),
      invoke<string | null>("get_openrouter_api_key"),
    ]);
    inMemoryCache.gemini = gemini?.trim() || null;
    inMemoryCache.openai = openai?.trim() || null;
    inMemoryCache.xai = xai?.trim() || null;
    inMemoryCache.groq = groq?.trim() || null;
    inMemoryCache.cerebras = cerebras?.trim() || null;
    inMemoryCache.openrouter = openrouter?.trim() || null;
  } catch {
    inMemoryCache.gemini = null;
    inMemoryCache.openai = null;
    inMemoryCache.xai = null;
    inMemoryCache.groq = null;
    inMemoryCache.cerebras = null;
    inMemoryCache.openrouter = null;
  }
}

/** Devuelve si hay al menos una API configurada (solo las configuradas en la app, no env). */
export function hasAnyApiConfiguredSync(): boolean {
  if (isTauri()) {
    return !!(
      inMemoryCache.gemini ||
      inMemoryCache.openai ||
      inMemoryCache.xai ||
      inMemoryCache.groq ||
      inMemoryCache.cerebras ||
      inMemoryCache.openrouter
    );
  }
  const stored =
    localStorage.getItem(STORAGE_GEMINI)?.trim() ||
    localStorage.getItem(STORAGE_OPENAI)?.trim() ||
    localStorage.getItem(STORAGE_XAI)?.trim() ||
    localStorage.getItem(STORAGE_GROQ)?.trim() ||
    localStorage.getItem(STORAGE_CEREBRAS)?.trim() ||
    localStorage.getItem(STORAGE_OPENROUTER)?.trim();
  return !!stored;
}

/** En Tauri: consulta el keychain y rellena el cache; devuelve si hay alguna configurada. En web: devuelve hasAnyApiConfiguredSync(). */
export async function hasAnyApiConfiguredAsync(): Promise<boolean> {
  if (!isTauri()) return hasAnyApiConfiguredSync();
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const has = await invoke<boolean>("has_any_api_configured");
    if (has) await loadApiKeysFromBackend();
    return has;
  } catch {
    return false;
  }
}

/** Clave de Gemini: en Tauri desde keychain (cache), en web desde localStorage. Solo la configurada en la app. */
export function getGeminiApiKey(): string | undefined {
  if (isTauri()) return inMemoryCache.gemini ?? undefined;
  return localStorage.getItem(STORAGE_GEMINI)?.trim() || undefined;
}

/** Clave de OpenAI: en Tauri desde keychain (cache), en web desde localStorage. Solo la configurada en la app. */
export function getOpenAIApiKey(): string | undefined {
  if (isTauri()) return inMemoryCache.openai ?? undefined;
  return localStorage.getItem(STORAGE_OPENAI)?.trim() || undefined;
}

/** Clave de xAI (Grok): en Tauri desde keychain (cache), en web desde localStorage. Solo la configurada en la app. */
export function getXaiApiKey(): string | undefined {
  if (isTauri()) return inMemoryCache.xai ?? undefined;
  return localStorage.getItem(STORAGE_XAI)?.trim() || undefined;
}

export function getGroqApiKey(): string | undefined {
  if (isTauri()) return inMemoryCache.groq ?? undefined;
  return localStorage.getItem(STORAGE_GROQ)?.trim() || undefined;
}

export function getCerebrasApiKey(): string | undefined {
  if (isTauri()) return inMemoryCache.cerebras ?? undefined;
  return localStorage.getItem(STORAGE_CEREBRAS)?.trim() || undefined;
}

export function getOpenRouterApiKey(): string | undefined {
  if (isTauri()) return inMemoryCache.openrouter ?? undefined;
  return localStorage.getItem(STORAGE_OPENROUTER)?.trim() || undefined;
}

/** Guarda la clave de Gemini. En Tauri usa keychain y actualiza el cache. */
export async function setGeminiApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_gemini_api_key", { key: trimmed || "" });
    inMemoryCache.gemini = trimmed || null;
  } else {
    if (trimmed) localStorage.setItem(STORAGE_GEMINI, trimmed);
    else localStorage.removeItem(STORAGE_GEMINI);
  }
}

/** Guarda la clave de OpenAI. En Tauri usa keychain y actualiza el cache. */
export async function setOpenAIApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_openai_api_key", { key: trimmed || "" });
    inMemoryCache.openai = trimmed || null;
  } else {
    if (trimmed) localStorage.setItem(STORAGE_OPENAI, trimmed);
    else localStorage.removeItem(STORAGE_OPENAI);
  }
}

/** Guarda la clave de xAI (Grok). En Tauri usa keychain y actualiza el cache. */
export async function setXaiApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_xai_api_key", { key: trimmed || "" });
    inMemoryCache.xai = trimmed || null;
  } else {
    if (trimmed) localStorage.setItem(STORAGE_XAI, trimmed);
    else localStorage.removeItem(STORAGE_XAI);
  }
}

export async function setGroqApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_groq_api_key", { key: trimmed || "" });
    inMemoryCache.groq = trimmed || null;
  } else {
    if (trimmed) localStorage.setItem(STORAGE_GROQ, trimmed);
    else localStorage.removeItem(STORAGE_GROQ);
  }
}

export async function setCerebrasApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_cerebras_api_key", { key: trimmed || "" });
    inMemoryCache.cerebras = trimmed || null;
  } else {
    if (trimmed) localStorage.setItem(STORAGE_CEREBRAS, trimmed);
    else localStorage.removeItem(STORAGE_CEREBRAS);
  }
}

export async function setOpenRouterApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_openrouter_api_key", { key: trimmed || "" });
    inMemoryCache.openrouter = trimmed || null;
  } else {
    if (trimmed) localStorage.setItem(STORAGE_OPENROUTER, trimmed);
    else localStorage.removeItem(STORAGE_OPENROUTER);
  }
}

export function hasAnyApiConfigured(): boolean {
  return hasAnyApiConfiguredSync();
}
