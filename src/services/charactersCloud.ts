/**
 * Personajes en Firestore + Storage (mismo usuario que presentaciones).
 * Un personaje = un documento por id (UUID); imagen de referencia en Storage optimizada.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes, type FirebaseStorage } from "firebase/storage";
import type { SavedCharacter } from "../types";
import { initFirebase } from "./firebase";
import { dataUrlToCloudImagePayload } from "../utils/imageOptimize";

const SCHEMA_VERSION = 1;

export class CharacterCloudSyncConflictError extends Error {
  readonly code = "CHARACTER_CLOUD_SYNC_CONFLICT" as const;
  constructor(
    public readonly characterId: string,
    public readonly expectedRevision: number,
    public readonly remoteRevision: number
  ) {
    super(
      `Personaje ${characterId}: la nube está en revisión ${remoteRevision} y la copia local esperaba ${expectedRevision}.`
    );
    this.name = "CharacterCloudSyncConflictError";
  }
}

function charactersCollection(db: import("firebase/firestore").Firestore, uid: string) {
  return collection(db, "users", uid, "characters");
}

function characterDoc(
  db: import("firebase/firestore").Firestore,
  uid: string,
  characterId: string
) {
  return doc(db, "users", uid, "characters", characterId);
}

function storageCharacterPrefix(uid: string, characterId: string) {
  return `users/${uid}/characters/${characterId}`;
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return `data:${mime};base64,${btoa(bin)}`;
}

async function deleteCharacterStorageFiles(
  st: FirebaseStorage,
  prefix: string
): Promise<void> {
  for (const ext of ["webp", "jpg", "jpeg", "png"]) {
    await deleteObject(ref(st, `${prefix}/ref.${ext}`)).catch(() => undefined);
  }
}

export interface PushCharacterCloudOptions {
  localExpectedRevision: number | null;
  force?: boolean;
}

/**
 * Sube un personaje a la nube (metadata + imagen optimizada en Storage).
 */
export async function pushCharacterToCloud(
  uid: string,
  character: SavedCharacter,
  options?: PushCharacterCloudOptions
): Promise<{ syncedAt: string; newRevision: number }> {
  const inst = await initFirebase();
  if (!inst?.firestore || !inst.storage) {
    throw new Error("Firebase no inicializado");
  }
  const { firestore: db, storage: st, auth: fbAuth } = inst;
  if (!fbAuth.currentUser || fbAuth.currentUser.uid !== uid) {
    throw new Error("La sesión de Firebase no coincide.");
  }

  const force = options?.force ?? false;
  const localExpectedRevision = options?.localExpectedRevision;
  const docRef = characterDoc(db, uid, character.id);
  const prefix = storageCharacterPrefix(uid, character.id);

  const preSnap = await getDoc(docRef);
  const preRemoteRev = preSnap.exists()
    ? Number((preSnap.data() as Record<string, unknown>).revision ?? 0)
    : 0;
  if (!force && preSnap.exists() && localExpectedRevision != null) {
    if (preRemoteRev !== localExpectedRevision) {
      throw new CharacterCloudSyncConflictError(
        character.id,
        localExpectedRevision,
        preRemoteRev
      );
    }
  }

  let referenceImageExt: string | null = null;
  if (character.referenceImageDataUrl?.trim().startsWith("data:")) {
    const payload = await dataUrlToCloudImagePayload(character.referenceImageDataUrl);
    if (payload) {
      await deleteCharacterStorageFiles(st, prefix);
      const path = `${prefix}/ref.${payload.ext}`;
      await uploadBytes(ref(st, path), payload.bytes, {
        contentType: payload.contentType,
      });
      referenceImageExt = payload.ext;
    }
  } else {
    await deleteCharacterStorageFiles(st, prefix);
  }

  const syncedAt = new Date().toISOString();

  const newRevision = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    const remoteRev = snap.exists()
      ? Number((snap.data() as Record<string, unknown>).revision ?? 0)
      : 0;

    if (!force && snap.exists() && localExpectedRevision != null) {
      if (remoteRev !== localExpectedRevision) {
        throw new CharacterCloudSyncConflictError(
          character.id,
          localExpectedRevision,
          remoteRev
        );
      }
    }

    const nextRev = snap.exists() ? remoteRev + 1 : 1;
    transaction.set(docRef, {
      schemaVersion: SCHEMA_VERSION,
      name: character.name,
      description: character.description,
      referenceImageExt,
      revision: nextRev,
      updatedAt: serverTimestamp(),
      cloudSyncedAtClient: syncedAt,
    });
    return nextRev;
  });

  return { syncedAt, newRevision };
}

/**
 * Elimina personaje en Firestore y archivos en Storage.
 */
export async function deleteCharacterFromCloud(uid: string, characterId: string): Promise<void> {
  const inst = await initFirebase();
  if (!inst?.firestore || !inst.storage) return;
  const { firestore: db, storage: st, auth: fbAuth } = inst;
  if (!fbAuth.currentUser || fbAuth.currentUser.uid !== uid) return;

  const prefix = storageCharacterPrefix(uid, characterId);
  await deleteCharacterStorageFiles(st, prefix);
  await deleteDoc(characterDoc(db, uid, characterId)).catch(() => undefined);
}

export type CloudCharacterListItem = {
  characterId: string;
  name: string;
  updatedAt: string | null;
};

export async function listCloudCharacters(uid: string): Promise<CloudCharacterListItem[]> {
  const inst = await initFirebase();
  if (!inst?.firestore) throw new Error("Firebase no inicializado");
  const { firestore: db, auth: fbAuth } = inst;
  if (!fbAuth.currentUser || fbAuth.currentUser.uid !== uid) {
    throw new Error("La sesión de Firebase no coincide.");
  }
  const snap = await getDocs(charactersCollection(db, uid));
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      characterId: d.id,
      name: String(data.name ?? ""),
      updatedAt:
        data.cloudSyncedAtClient != null
          ? String(data.cloudSyncedAtClient)
          : data.updatedAt != null && typeof (data.updatedAt as { toDate?: () => Date }).toDate === "function"
            ? (data.updatedAt as { toDate: () => Date }).toDate().toISOString()
            : null,
    };
  });
}

/**
 * Descarga todos los personajes de la nube (imagen → data URL optimizada en origen).
 */
export async function pullAllCharactersFromCloud(uid: string): Promise<SavedCharacter[]> {
  const inst = await initFirebase();
  if (!inst?.firestore || !inst.storage) {
    throw new Error("Firebase no inicializado");
  }
  const { firestore: db, storage: st, auth: fbAuth } = inst;
  if (!fbAuth.currentUser || fbAuth.currentUser.uid !== uid) {
    throw new Error("La sesión de Firebase no coincide.");
  }

  const snap = await getDocs(charactersCollection(db, uid));
  const syncedAt = new Date().toISOString();
  const out: SavedCharacter[] = [];

  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    const revision = Number(data.revision ?? 0);
    const ext = data.referenceImageExt != null ? String(data.referenceImageExt) : "";
    let referenceImageDataUrl: string | undefined;

    if (ext) {
      const path = `${storageCharacterPrefix(uid, d.id)}/ref.${ext}`;
      try {
        const bytes = await getBytes(ref(st, path));
        const mime =
          ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "webp"
              ? "image/webp"
              : "image/png";
        referenceImageDataUrl = bytesToDataUrl(bytes, mime);
      } catch {
        /* sin imagen */
      }
    }

    out.push({
      id: d.id,
      name: String(data.name ?? ""),
      description: String(data.description ?? ""),
      referenceImageDataUrl,
      cloudSyncedAt: syncedAt,
      cloudRevision: Number.isFinite(revision) ? revision : 0,
    });
  }

  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return out;
}
