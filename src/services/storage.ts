import {
  writeTextFile,
  readTextFile,
  readDir,
  mkdir,
  remove,
  exists,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';
import type { Presentation, SavedPresentation, SavedPresentationMeta } from '../types';

const PRESENTATIONS_DIR = 'presentations';

function getPath(id: string): string {
  return `${PRESENTATIONS_DIR}/${id}.json`;
}

/** Guarda la presentación actual en disco y devuelve su id */
export async function savePresentation(presentation: Presentation): Promise<string> {
  const id = crypto.randomUUID();
  const saved: SavedPresentation = {
    ...presentation,
    id,
    savedAt: new Date().toISOString(),
  };
  const path = getPath(id);
  const dirExists = await exists(PRESENTATIONS_DIR, { baseDir: BaseDirectory.AppData });
  if (!dirExists) {
    await mkdir(PRESENTATIONS_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  }
  await writeTextFile(path, JSON.stringify(saved, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
  return id;
}

/** Actualiza una presentación ya guardada por id */
export async function updatePresentation(
  id: string,
  presentation: Presentation
): Promise<void> {
  const path = getPath(id);
  const existsFile = await exists(path, { baseDir: BaseDirectory.AppData });
  if (!existsFile) throw new Error('Presentación no encontrada');
  const saved: SavedPresentation = {
    ...presentation,
    id,
    savedAt: new Date().toISOString(),
  };
  await writeTextFile(path, JSON.stringify(saved, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
}

/** Lista las presentaciones guardadas (solo metadatos) */
export async function listPresentations(): Promise<SavedPresentationMeta[]> {
  const dirExists = await exists(PRESENTATIONS_DIR, { baseDir: BaseDirectory.AppData });
  if (!dirExists) return [];
  const entries = await readDir(PRESENTATIONS_DIR, { baseDir: BaseDirectory.AppData });
  const metas: SavedPresentationMeta[] = [];
  for (const entry of entries) {
    if (!entry.isFile || !entry.name?.endsWith('.json')) continue;
    const id = entry.name.replace(/\.json$/, '');
    try {
      const raw = await readTextFile(getPath(id), { baseDir: BaseDirectory.AppData });
      const data = JSON.parse(raw) as SavedPresentation;
      metas.push({
        id: data.id,
        topic: data.topic,
        savedAt: data.savedAt,
        slideCount: data.slides?.length ?? 0,
      });
    } catch {
      // archivo corrupto o formato antiguo, omitir
    }
  }
  metas.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  return metas;
}

/** Carga una presentación por id */
export async function loadPresentation(id: string): Promise<SavedPresentation> {
  const path = getPath(id);
  const raw = await readTextFile(path, { baseDir: BaseDirectory.AppData });
  const data = JSON.parse(raw) as SavedPresentation;
  if (!data.topic || !Array.isArray(data.slides)) {
    throw new Error('Formato de presentación inválido');
  }
  return { ...data, id };
}

/** Elimina una presentación guardada */
export async function deletePresentation(id: string): Promise<void> {
  const path = getPath(id);
  await remove(path, { baseDir: BaseDirectory.AppData });
}
