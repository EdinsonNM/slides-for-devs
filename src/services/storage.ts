import { invoke } from "@tauri-apps/api/core";
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
const MAX_WEB_GENERATED_RESOURCES = 100;

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

/** Guarda la presentación en SQLite (backend) y devuelve su id */
export async function savePresentation(
  presentation: Presentation,
  accountScope: string
): Promise<string> {
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
  await invoke("delete_presentation", { id, accountScope });
}

/** Quita diapositivas e imágenes locales y deja stub con `cloud_id` (copia solo en la nube). */
export async function clearPresentationLocalBody(
  id: string,
  accountScope: string
): Promise<void> {
  await invoke("clear_presentation_local_body", { id, accountScope });
}

/** Importa una presentación completa (p. ej. descargada de la nube). `saved.id` = id local nuevo. */
export async function importSavedPresentation(
  saved: SavedPresentation,
  accountScope: string
): Promise<void> {
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
