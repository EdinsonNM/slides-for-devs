import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../utils/isTauriRuntime";
import type {
  Presentation,
  SavedCharacter,
  SavedPresentation,
  SavedPresentationMeta,
  GeneratedResourceEntry,
  GeneratedResourceKind,
} from "../types";

const CHARACTERS_STORAGE_KEY = "slides-for-devs-characters";
const GENERATED_RESOURCES_STORAGE_PREFIX = "slides-for-devs-generated-resources";
const PRESENTATIONS_WEB_STORAGE_PREFIX = "slides-for-devs-presentations";
const MAX_WEB_GENERATED_RESOURCES = 100;

/** Copia local en navegador: cuerpo + metadatos de nube en un solo JSON por ámbito. */
type WebPresentationRecord = SavedPresentation & {
  cloudId?: string;
  cloudSyncedAt?: string;
  cloudRevision?: number;
  localBodyCleared?: boolean;
  sharedCloudSource?: string;
};

function presentationsWebStorageKey(accountScope: string): string {
  return `${PRESENTATIONS_WEB_STORAGE_PREFIX}:${accountScope}`;
}

function readWebPresentationRecords(
  accountScope: string,
): WebPresentationRecord[] {
  const raw = localStorage.getItem(presentationsWebStorageKey(accountScope));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WebPresentationRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWebPresentationRecords(
  accountScope: string,
  records: WebPresentationRecord[],
): void {
  localStorage.setItem(
    presentationsWebStorageKey(accountScope),
    JSON.stringify(records),
  );
}

function recordToMeta(r: WebPresentationRecord): SavedPresentationMeta {
  return {
    id: r.id,
    topic: r.topic,
    savedAt: r.savedAt,
    slideCount: r.localBodyCleared ? 0 : r.slides.length,
    cloudId: r.cloudId,
    cloudSyncedAt: r.cloudSyncedAt,
    cloudRevision: r.cloudRevision,
    localBodyCleared: r.localBodyCleared,
    sharedCloudSource: r.sharedCloudSource,
  };
}

function sortPresentationMetasDesc(
  records: WebPresentationRecord[],
): SavedPresentationMeta[] {
  return [...records]
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0))
    .map(recordToMeta);
}

/** Ámbito SQLite para sesión sin cuenta; con sesión Firebase usar `user.uid`. */
export const LOCAL_ACCOUNT_SCOPE_GUEST = "__guest__";

export function localAccountScopeForUser(
  uid: string | null | undefined
): string {
  return uid && uid.trim().length > 0 ? uid.trim() : LOCAL_ACCOUNT_SCOPE_GUEST;
}

function charactersWebStorageKey(accountScope: string): string {
  return `${CHARACTERS_STORAGE_KEY}:${accountScope}`;
}

function generatedResourcesWebStorageKey(accountScope: string): string {
  return `${GENERATED_RESOURCES_STORAGE_PREFIX}:${accountScope}`;
}

function readWebGeneratedResources(
  accountScope: string
): GeneratedResourceEntry[] {
  const raw = localStorage.getItem(generatedResourcesWebStorageKey(accountScope));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as GeneratedResourceEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Guarda la presentación en SQLite (Tauri) o localStorage (navegador) y devuelve su id */
export async function savePresentation(
  presentation: Presentation,
  accountScope: string
): Promise<string> {
  if (!isTauriRuntime()) {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const savedAt = new Date().toISOString();
    const record: WebPresentationRecord = {
      ...presentation,
      id,
      savedAt,
    };
    const prev = readWebPresentationRecords(accountScope);
    writeWebPresentationRecords(accountScope, [record, ...prev]);
    return id;
  }
  return invoke<string>("save_presentation", {
    presentation,
    accountScope,
  });
}

/** Actualiza una presentación ya guardada por id */
export async function updatePresentation(
  id: string,
  presentation: Presentation,
  accountScope: string
): Promise<void> {
  if (!isTauriRuntime()) {
    const prev = readWebPresentationRecords(accountScope);
    const idx = prev.findIndex((p) => p.id === id);
    if (idx < 0) {
      throw new Error("Presentation not found");
    }
    const existing = prev[idx];
    const savedAt = new Date().toISOString();
    const next: WebPresentationRecord = {
      ...presentation,
      id,
      savedAt,
      cloudId: existing.cloudId,
      cloudSyncedAt: existing.cloudSyncedAt,
      cloudRevision: existing.cloudRevision,
      sharedCloudSource: existing.sharedCloudSource,
      localBodyCleared:
        presentation.slides.length === 0 ? existing.localBodyCleared : false,
    };
    const merged = [...prev];
    merged[idx] = next;
    writeWebPresentationRecords(accountScope, merged);
    return;
  }
  await invoke("update_presentation", {
    id,
    presentation,
    accountScope,
  });
}

/** Lista las presentaciones guardadas (solo metadatos, desde SQLite) */
export async function listPresentations(
  accountScope: string
): Promise<SavedPresentationMeta[]> {
  if (!isTauriRuntime()) {
    return sortPresentationMetasDesc(readWebPresentationRecords(accountScope));
  }
  const list = await invoke<SavedPresentationMeta[]>("list_presentations", {
    accountScope,
  });
  return list ?? [];
}

/** Carga una presentación por id desde SQLite */
export async function loadPresentation(
  id: string,
  accountScope: string
): Promise<SavedPresentation> {
  if (!isTauriRuntime()) {
    const rec = readWebPresentationRecords(accountScope).find((p) => p.id === id);
    if (!rec) {
      throw new Error("Presentation not found");
    }
    return {
      id: rec.id,
      savedAt: rec.savedAt,
      topic: rec.topic,
      slides: rec.slides,
      characterId: rec.characterId,
      deckVisualTheme: rec.deckVisualTheme,
      deckNarrativePresetId: rec.deckNarrativePresetId,
      narrativeNotes: rec.narrativeNotes,
    };
  }
  return invoke<SavedPresentation>("load_presentation", {
    id,
    accountScope,
  });
}

/** Elimina una presentación guardada */
export async function deletePresentation(
  id: string,
  accountScope: string
): Promise<void> {
  if (!isTauriRuntime()) {
    const prev = readWebPresentationRecords(accountScope);
    writeWebPresentationRecords(
      accountScope,
      prev.filter((p) => p.id !== id),
    );
    return;
  }
  await invoke("delete_presentation", { id, accountScope });
}

/** Quita diapositivas e imágenes locales y deja stub con `cloud_id` (copia solo en la nube). */
export async function clearPresentationLocalBody(
  id: string,
  accountScope: string
): Promise<void> {
  if (!isTauriRuntime()) {
    const prev = readWebPresentationRecords(accountScope);
    const idx = prev.findIndex((p) => p.id === id);
    if (idx < 0) {
      throw new Error("Presentation not found");
    }
    const existing = prev[idx];
    prev[idx] = {
      ...existing,
      slides: [],
      localBodyCleared: true,
      savedAt: new Date().toISOString(),
    };
    writeWebPresentationRecords(accountScope, prev);
    return;
  }
  await invoke("clear_presentation_local_body", { id, accountScope });
}

/** Importa una presentación completa (p. ej. descargada de la nube). `saved.id` = id local nuevo. */
export async function importSavedPresentation(
  saved: SavedPresentation,
  accountScope: string
): Promise<void> {
  if (!isTauriRuntime()) {
    const prev = readWebPresentationRecords(accountScope);
    const without = prev.filter((p) => p.id !== saved.id);
    const record: WebPresentationRecord = {
      ...saved,
      localBodyCleared: false,
    };
    writeWebPresentationRecords(accountScope, [record, ...without]);
    return;
  }
  await invoke("import_saved_presentation", {
    saved,
    accountScope,
  });
}

export async function setPresentationCloudState(
  id: string,
  cloudId: string | null,
  cloudSyncedAt: string | null,
  cloudRevision: number | null | undefined,
  accountScope: string
): Promise<void> {
  if (!isTauriRuntime()) {
    const prev = readWebPresentationRecords(accountScope);
    const idx = prev.findIndex((p) => p.id === id);
    if (idx < 0) {
      throw new Error("Presentation not found");
    }
    const existing = prev[idx];
    const next: WebPresentationRecord = { ...existing };
    if (cloudId === null || cloudId === "") {
      delete next.cloudId;
    } else if (cloudId !== undefined) {
      next.cloudId = cloudId;
    }
    if (cloudSyncedAt === null || cloudSyncedAt === "") {
      delete next.cloudSyncedAt;
    } else if (cloudSyncedAt !== undefined) {
      next.cloudSyncedAt = cloudSyncedAt;
    }
    if (cloudRevision === null || cloudRevision === undefined) {
      delete next.cloudRevision;
    } else {
      next.cloudRevision = cloudRevision;
    }
    prev[idx] = next;
    writeWebPresentationRecords(accountScope, prev);
    return;
  }
  await invoke("set_presentation_cloud_state", {
    id,
    cloudId: cloudId ?? undefined,
    cloudSyncedAt: cloudSyncedAt ?? undefined,
    cloudRevision: cloudRevision ?? undefined,
    accountScope,
  });
}

/** Tras importar una copia desde “compartida”: `ownerUid::cloudId` para no duplicar la tarjeta fantasma. */
export async function setPresentationSharedCloudSource(
  id: string,
  sharedCloudSource: string | null,
  accountScope: string
): Promise<void> {
  if (!isTauriRuntime()) {
    const prev = readWebPresentationRecords(accountScope);
    const idx = prev.findIndex((p) => p.id === id);
    if (idx < 0) {
      throw new Error("Presentation not found");
    }
    const existing = prev[idx];
    const next: WebPresentationRecord = { ...existing };
    if (sharedCloudSource === null || sharedCloudSource === "") {
      delete next.sharedCloudSource;
    } else {
      next.sharedCloudSource = sharedCloudSource;
    }
    prev[idx] = next;
    writeWebPresentationRecords(accountScope, prev);
    return;
  }
  await invoke("set_presentation_shared_cloud_source", {
    id,
    sharedCloudSource: sharedCloudSource ?? undefined,
    accountScope,
  });
}

/**
 * Migra presentaciones guardadas en JSON (formato antiguo) a SQLite.
 * Devuelve el número de archivos migrados. Se puede llamar al iniciar la app.
 */
export async function migrateJsonPresentations(): Promise<number> {
  if (!isTauriRuntime()) {
    return 0;
  }
  return invoke<number>("migrate_json_presentations");
}

/** Lista los personajes guardados (Tauri: SQLite; web: localStorage por ámbito). */
export async function listCharacters(
  accountScope: string
): Promise<SavedCharacter[]> {
  try {
    return (
      (await invoke<SavedCharacter[]>("list_characters", {
        accountScope,
      })) ?? []
    );
  } catch {
    const raw = localStorage.getItem(charactersWebStorageKey(accountScope));
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}

/** Guarda o actualiza un personaje (Tauri: SQLite; web: localStorage). */
export async function saveCharacter(
  character: SavedCharacter,
  accountScope: string
): Promise<void> {
  try {
    await invoke("save_character", {
      character,
      accountScope,
    });
  } catch {
    const list = await listCharacters(accountScope);
    const idx = list.findIndex((c) => c.id === character.id);
    const next =
      idx >= 0
        ? list.map((c, i) => (i === idx ? character : c))
        : [...list, character];
    localStorage.setItem(
      charactersWebStorageKey(accountScope),
      JSON.stringify(next)
    );
  }
}

/** Elimina un personaje por id (Tauri: SQLite; web: localStorage). */
export async function deleteCharacter(
  id: string,
  accountScope: string
): Promise<void> {
  try {
    await invoke("delete_character", { id, accountScope });
  } catch {
    const list = await listCharacters(accountScope);
    localStorage.setItem(
      charactersWebStorageKey(accountScope),
      JSON.stringify(list.filter((c) => c.id !== id))
    );
  }
}

export async function setCharacterCloudState(
  id: string,
  cloudSyncedAt: string | null,
  cloudRevision: number | null,
  accountScope: string
): Promise<void> {
  try {
    await invoke("set_character_cloud_state", {
      id,
      cloudSyncedAt: cloudSyncedAt ?? undefined,
      cloudRevision: cloudRevision ?? undefined,
      accountScope,
    });
  } catch {
    const list = await listCharacters(accountScope);
    const next = list.map((c) =>
      c.id === id
        ? {
            ...c,
            ...(cloudSyncedAt != null ? { cloudSyncedAt } : {}),
            ...(cloudRevision != null ? { cloudRevision } : {}),
          }
        : c
    );
    localStorage.setItem(
      charactersWebStorageKey(accountScope),
      JSON.stringify(next)
    );
  }
}

export async function listGeneratedResources(
  accountScope: string
): Promise<GeneratedResourceEntry[]> {
  try {
    const list = await invoke<GeneratedResourceEntry[]>(
      "list_generated_resources",
      { accountScope }
    );
    return list ?? [];
  } catch {
    return readWebGeneratedResources(accountScope);
  }
}

export type NewGeneratedResourceInput = {
  kind: GeneratedResourceKind;
  payload: string;
  prompt?: string;
  source?: string;
};

export async function addGeneratedResource(
  input: NewGeneratedResourceInput,
  accountScope: string
): Promise<GeneratedResourceEntry> {
  try {
    return await invoke<GeneratedResourceEntry>("add_generated_resource", {
      accountScope,
      kind: input.kind,
      payload: input.payload,
      prompt: input.prompt,
      source: input.source,
    });
  } catch {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const createdAt = new Date().toISOString();
    const entry: GeneratedResourceEntry = {
      id,
      kind: input.kind,
      payload: input.payload,
      prompt: input.prompt,
      source: input.source,
      createdAt,
    };
    const prev = readWebGeneratedResources(accountScope);
    const next = [entry, ...prev].slice(0, MAX_WEB_GENERATED_RESOURCES);
    localStorage.setItem(
      generatedResourcesWebStorageKey(accountScope),
      JSON.stringify(next)
    );
    return entry;
  }
}

export async function deleteGeneratedResource(
  id: string,
  accountScope: string
): Promise<void> {
  try {
    await invoke("delete_generated_resource", { id, accountScope });
  } catch {
    const prev = readWebGeneratedResources(accountScope);
    localStorage.setItem(
      generatedResourcesWebStorageKey(accountScope),
      JSON.stringify(prev.filter((r) => r.id !== id))
    );
  }
}
