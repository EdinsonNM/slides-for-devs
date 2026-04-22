import type { DeckVisualTheme, Slide } from "./domain/entities";

export interface ImageStyle {
  id: string;
  name: string;
  prompt: string;
}

export type GeneratedResourceKind = "image" | "model3d";

/** Imagen o modelo 3D generado y guardado en la biblioteca local del usuario. */
export interface GeneratedResourceEntry {
  id: string;
  kind: GeneratedResourceKind;
  /** Data URL de imagen o de archivo .glb (Meshy). */
  payload: string;
  prompt?: string;
  source?: string;
  createdAt: string;
}

export interface SavedCharacter {
  id: string;
  name: string;
  description: string;
  referenceImageDataUrl?: string;
  /** Tras subir a Firebase (mismo uid que presentaciones). */
  cloudSyncedAt?: string;
  cloudRevision?: number;
}

export interface Presentation {
  topic: string;
  slides: Slide[];
  characterId?: string;
  /** Tema visual del lienzo 16:9 (independiente del tema claro/oscuro de la app). */
  deckVisualTheme?: DeckVisualTheme;
  /** Objetivo narrativo para IA (enseñanza, pitch, storytelling, etc.). */
  deckNarrativePresetId?: string;
  /** Notas libres de tono/objetivo; se concatenan al preset en los prompts. */
  narrativeNotes?: string;
}

export interface SavedPresentation extends Presentation {
  id: string;
  savedAt: string;
}

export interface SavedPresentationMeta {
  id: string;
  topic: string;
  savedAt: string;
  slideCount: number;
  /** Firestore document id when synced to cloud */
  cloudId?: string;
  cloudSyncedAt?: string;
  /** Revisión Firestore tras el último sync (control de conflictos entre dispositivos). */
  cloudRevision?: number;
  /**
   * Sin diapositivas en SQLite; el vínculo `cloudId` sigue válido (copia recuperable desde la nube).
   */
  localBodyCleared?: boolean;
  /**
   * Si se importó desde una presentación compartida: `ownerUid::cloudId` del documento en la nube del autor.
   * Sirve para no duplicar la tarjeta fantasma en el home tras descargar.
   */
  sharedCloudSource?: string;
  /** IDs de slides pendientes de sincronizar hacia la nube. */
  dirtySlideIds?: string[];
  /** Estado de sincronización local para UI y reintentos. */
  syncStatus?: "synced" | "pending" | "offline" | "conflict";
  /** Última revisión cloud confirmada localmente (alias funcional de cloudRevision). */
  lastSyncedRevision?: number;
}

/** Elemento de la parrilla/carrusel del home: copia local o documento solo en Firestore. */
export type HomePresentationCard =
  | { kind: "local"; meta: SavedPresentationMeta }
  | {
      kind: "cloud_only_mine";
      cloudId: string;
      ownerUid: string;
      topic: string;
      savedAt: string;
      updatedAt: string | null;
      /** Portada Slaim en nube (`deckCoverImageFile`), URL firmada. */
      homePreviewImageUrl?: string;
      /** Primer slide resuelto (réplica) si no hay portada Slaim. */
      homeFirstSlideReplica?: Slide;
      /** Tema del deck en la nube (tipografía/fondo acorde al doc principal). */
      homePreviewDeckVisualTheme?: DeckVisualTheme;
    }
  | {
      kind: "cloud_only_shared";
      cloudId: string;
      ownerUid: string;
      topic: string;
      savedAt: string;
      updatedAt: string | null;
      homePreviewImageUrl?: string;
      homeFirstSlideReplica?: Slide;
      homePreviewDeckVisualTheme?: DeckVisualTheme;
    };

export function homePresentationCardKey(card: HomePresentationCard): string {
  return card.kind === "local"
    ? card.meta.id
    : `cloud:${card.ownerUid}:${card.cloudId}`;
}
