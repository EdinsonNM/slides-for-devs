import { invoke } from "@tauri-apps/api/core";
import type {
  Presentation,
  SavedPresentation,
  SavedPresentationMeta,
} from "../types";

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
