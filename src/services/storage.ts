import { invoke } from "@tauri-apps/api/core";
import type {
  Presentation,
  SavedCharacter,
  SavedPresentation,
  SavedPresentationMeta,
} from "../types";

const CHARACTERS_STORAGE_KEY = "slides-for-devs-characters";

/** Guarda la presentación en SQLite (backend) y devuelve su id */
export async function savePresentation(
  presentation: Presentation
): Promise<string> {
  return invoke<string>("save_presentation", { presentation });
}

/** Actualiza una presentación ya guardada por id */
export async function updatePresentation(
  id: string,
  presentation: Presentation
): Promise<void> {
  await invoke("update_presentation", { id, presentation });
}

/** Lista las presentaciones guardadas (solo metadatos, desde SQLite) */
export async function listPresentations(): Promise<SavedPresentationMeta[]> {
  const list = await invoke<SavedPresentationMeta[]>("list_presentations");
  return list ?? [];
}

/** Carga una presentación por id desde SQLite */
export async function loadPresentation(id: string): Promise<SavedPresentation> {
  return invoke<SavedPresentation>("load_presentation", { id });
}

/** Elimina una presentación guardada */
export async function deletePresentation(id: string): Promise<void> {
  await invoke("delete_presentation", { id });
}

/**
 * Migra presentaciones guardadas en JSON (formato antiguo) a SQLite.
 * Devuelve el número de archivos migrados. Se puede llamar al iniciar la app.
 */
export async function migrateJsonPresentations(): Promise<number> {
  return invoke<number>("migrate_json_presentations");
}

/** Lista los personajes guardados (Tauri: SQLite; web: localStorage). */
export async function listCharacters(): Promise<SavedCharacter[]> {
  try {
    return (await invoke<SavedCharacter[]>("list_characters")) ?? [];
  } catch {
    const raw = localStorage.getItem(CHARACTERS_STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}

/** Guarda o actualiza un personaje (Tauri: SQLite; web: localStorage). */
export async function saveCharacter(character: SavedCharacter): Promise<void> {
  try {
    await invoke("save_character", { character });
  } catch {
    const list = await listCharacters();
    const idx = list.findIndex((c) => c.id === character.id);
    const next = idx >= 0 ? list.map((c, i) => (i === idx ? character : c)) : [...list, character];
    localStorage.setItem(CHARACTERS_STORAGE_KEY, JSON.stringify(next));
  }
}

/** Elimina un personaje por id (Tauri: SQLite; web: localStorage). */
export async function deleteCharacter(id: string): Promise<void> {
  try {
    await invoke("delete_character", { id });
  } catch {
    const list = await listCharacters();
    localStorage.setItem(
      CHARACTERS_STORAGE_KEY,
      JSON.stringify(list.filter((c) => c.id !== id))
    );
  }
}
