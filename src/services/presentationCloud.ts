/**
 * Sincronización de presentaciones con Firestore + Firebase Storage.
 * Imágenes y diagramas grandes van a Storage; metadatos y texto en Firestore.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes, type FirebaseStorage } from "firebase/storage";
import type { Slide } from "../types";
import type { SavedPresentation } from "../types";
import { initFirebase } from "./firebase";

const SCHEMA_VERSION = 1;

/** La nube tiene una revisión distinta a la esperada (otro dispositivo subió cambios). */
export class CloudSyncConflictError extends Error {
  readonly code = "CLOUD_SYNC_CONFLICT" as const;
  constructor(
    public readonly expectedRevision: number,
    public readonly remoteRevision: number
  ) {
    super(
      `Conflicto: la nube está en revisión ${remoteRevision} y tu copia esperaba ${expectedRevision}.`
    );
    this.name = "CloudSyncConflictError";
  }
}

export interface PushCloudOptions {
  /** Revisión conocida tras el último sync exitoso; debe coincidir con Firestore. */
  localExpectedRevision: number | null;
  /** Sobrescribe la nube sin comprobar revisión (última escritura a propósito). */
  force?: boolean;
}
/** Diagramas mayores se suben a Storage (límite práctico doc Firestore ~1MB). */
const EXCALIDRAW_STORAGE_THRESHOLD = 80 * 1024;

export interface CloudPresentationListItem {
  cloudId: string;
  topic: string;
  savedAt: string;
  updatedAt: string | null;
}

function userPresentationsRef(db: import("firebase/firestore").Firestore, uid: string) {
  return collection(db, "users", uid, "presentations");
}

function presentationDoc(
  db: import("firebase/firestore").Firestore,
  uid: string,
  cloudId: string
) {
  return doc(db, "users", uid, "presentations", cloudId);
}

function storagePrefix(uid: string, cloudId: string) {
  return `users/${uid}/presentations/${cloudId}`;
}

/** Borra solo rutas conocidas en Firestore (evita listAll → CORS en localhost/navegador). */
async function deleteKnownPresentationFiles(
  st: FirebaseStorage,
  prefix: string,
  slideImagePaths: Record<string, string>,
  excalidrawPaths: Record<string, string>
): Promise<void> {
  const names = new Set<string>([
    ...Object.values(slideImagePaths),
    ...Object.values(excalidrawPaths),
  ]);
  await Promise.all(
    [...names].map((name) => {
      if (!name || name.includes("..") || name.includes("/")) return Promise.resolve();
      return deleteObject(ref(st, `${prefix}/${name}`)).catch(() => undefined);
    })
  );
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string; ext: string } | null {
  const m = /^data:([^;,]+)?;base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const contentType = m[1] || "image/png";
  const b64 = m[2].replace(/\s/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  let ext = "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
  else if (contentType.includes("webp")) ext = "webp";
  else if (contentType.includes("gif")) ext = "gif";
  return { bytes, contentType, ext };
}

async function fetchUrlAsBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string; ext: string } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    const buf = await blob.arrayBuffer();
    const ct = blob.type || "image/png";
    let ext = "png";
    if (ct.includes("jpeg")) ext = "jpg";
    else if (ct.includes("webp")) ext = "webp";
    return { bytes: new Uint8Array(buf), contentType: ct, ext };
  } catch {
    return null;
  }
}

function bytesToDataUrl(bytes: Uint8Array | ArrayBuffer, mime: string): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]!);
  const b64 = btoa(bin);
  return `data:${mime};base64,${b64}`;
}

function slideToPlain(s: Slide): Record<string, unknown> {
  return {
    id: s.id,
    type: s.type,
    title: s.title,
    subtitle: s.subtitle ?? null,
    content: s.content,
    imagePrompt: s.imagePrompt ?? null,
    code: s.code ?? null,
    language: s.language ?? null,
    fontSize: s.fontSize ?? null,
    videoUrl: s.videoUrl ?? null,
    contentType: s.contentType ?? null,
    imageWidthPercent: s.imageWidthPercent ?? null,
    contentLayout: s.contentLayout ?? null,
    panelHeightPercent: s.panelHeightPercent ?? null,
    presenterNotes: s.presenterNotes ?? null,
    speech: s.speech ?? null,
    editorHeight: s.editorHeight ?? null,
  };
}

function plainToSlide(p: Record<string, unknown>): Slide {
  return {
    id: String(p.id ?? ""),
    type: p.type as Slide["type"],
    title: String(p.title ?? ""),
    subtitle: p.subtitle != null ? String(p.subtitle) : undefined,
    content: String(p.content ?? ""),
    imageUrl: p.imageUrl != null ? String(p.imageUrl) : undefined,
    imagePrompt: p.imagePrompt != null ? String(p.imagePrompt) : undefined,
    code: p.code != null ? String(p.code) : undefined,
    language: p.language != null ? String(p.language) : undefined,
    fontSize: typeof p.fontSize === "number" ? p.fontSize : undefined,
    videoUrl: p.videoUrl != null ? String(p.videoUrl) : undefined,
    contentType: p.contentType as Slide["contentType"] | undefined,
    imageWidthPercent:
      typeof p.imageWidthPercent === "number" ? p.imageWidthPercent : undefined,
    contentLayout: p.contentLayout as Slide["contentLayout"] | undefined,
    panelHeightPercent:
      typeof p.panelHeightPercent === "number" ? p.panelHeightPercent : undefined,
    presenterNotes:
      p.presenterNotes != null ? String(p.presenterNotes) : undefined,
    speech: p.speech != null ? String(p.speech) : undefined,
    excalidrawData:
      p.excalidrawData != null ? String(p.excalidrawData) : undefined,
    editorHeight:
      typeof p.editorHeight === "number" ? p.editorHeight : undefined,
  };
}

function timestampToIso(t: unknown): string | null {
  if (t && typeof t === "object" && "toDate" in t && typeof (t as Timestamp).toDate === "function") {
    return (t as Timestamp).toDate().toISOString();
  }
  return null;
}

/**
 * Sube la presentación a la nube. Devuelve cloudId y momento de sincronización (ISO).
 */
export async function pushPresentationToCloud(
  uid: string,
  saved: SavedPresentation,
  existingCloudId?: string | null,
  options?: PushCloudOptions
): Promise<{ cloudId: string; syncedAt: string; newRevision: number }> {
  const inst = await initFirebase();
  if (!inst?.firestore || !inst.storage) {
    throw new Error("Firebase no inicializado");
  }
  const { firestore: db, storage: st, auth: fbAuth } = inst;
  if (!fbAuth.currentUser || fbAuth.currentUser.uid !== uid) {
    throw new Error(
      "La sesión de Firebase no coincide con tu usuario. Vuelve a iniciar sesión e inténtalo de nuevo."
    );
  }
  const force = options?.force ?? false;
  const localExpectedRevision = options?.localExpectedRevision;
  const cloudId = existingCloudId?.trim() || crypto.randomUUID();
  const prefix = storagePrefix(uid, cloudId);
  const docRef = presentationDoc(db, uid, cloudId);

  const preSnap = await getDoc(docRef);
  const preRemoteRev = preSnap.exists()
    ? Number((preSnap.data() as Record<string, unknown>).revision ?? 0)
    : 0;

  if (preSnap.exists()) {
    if (!force) {
      const expected = localExpectedRevision ?? 0;
      if (preRemoteRev !== expected) {
        throw new CloudSyncConflictError(expected, preRemoteRev);
      }
    }
    const pd = preSnap.data() as Record<string, unknown>;
    await deleteKnownPresentationFiles(
      st,
      prefix,
      (pd.slideImagePaths as Record<string, string>) ?? {},
      (pd.excalidrawPaths as Record<string, string>) ?? {}
    );
  }

  const slideImagePaths: Record<string, string> = {};
  const excalidrawPaths: Record<string, string> = {};
  const cloudSlides: Record<string, unknown>[] = [];

  for (let i = 0; i < saved.slides.length; i++) {
    const slide = saved.slides[i]!;
    const plain = slideToPlain(slide);
    let imageUrl: string | undefined = slide.imageUrl;

    if (slide.imageUrl?.startsWith("data:")) {
      const parsed = dataUrlToBytes(slide.imageUrl);
      if (parsed) {
        const name = `slide_${i}.${parsed.ext}`;
        const path = `${prefix}/${name}`;
        await uploadBytes(ref(st, path), parsed.bytes, { contentType: parsed.contentType });
        slideImagePaths[String(i)] = name;
        imageUrl = undefined;
      }
    } else if (slide.imageUrl?.startsWith("http://") || slide.imageUrl?.startsWith("https://")) {
      const fetched = await fetchUrlAsBytes(slide.imageUrl);
      if (fetched) {
        const name = `slide_${i}.${fetched.ext}`;
        const path = `${prefix}/${name}`;
        await uploadBytes(ref(st, path), fetched.bytes, { contentType: fetched.contentType });
        slideImagePaths[String(i)] = name;
        imageUrl = undefined;
      }
    }

    let excalidrawData: string | undefined = slide.excalidrawData;
    if (
      slide.excalidrawData &&
      slide.excalidrawData.length > EXCALIDRAW_STORAGE_THRESHOLD
    ) {
      const name = `excalidraw_${i}.json`;
      const path = `${prefix}/${name}`;
      const enc = new TextEncoder().encode(slide.excalidrawData);
      await uploadBytes(ref(st, path), enc, { contentType: "application/json" });
      excalidrawPaths[String(i)] = name;
      excalidrawData = undefined;
    }

    cloudSlides.push({
      ...plain,
      imageUrl: imageUrl ?? null,
      excalidrawData: excalidrawData ?? null,
    });
  }

  const syncedAt = new Date().toISOString();

  const payload = {
    schemaVersion: SCHEMA_VERSION,
    topic: saved.topic,
    savedAt: saved.savedAt,
    characterId: saved.characterId ?? null,
    slideImagePaths,
    excalidrawPaths,
    slides: cloudSlides,
    cloudSyncedAtClient: syncedAt,
  };

  const newRevision = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    const remoteRev = snap.exists()
      ? Number((snap.data() as Record<string, unknown>).revision ?? 0)
      : 0;

    if (!force && snap.exists()) {
      const expected = localExpectedRevision ?? 0;
      if (remoteRev !== expected) {
        throw new CloudSyncConflictError(expected, remoteRev);
      }
    }

    const nextRev = snap.exists() ? remoteRev + 1 : 1;
    transaction.set(docRef, {
      ...payload,
      revision: nextRev,
      updatedAt: serverTimestamp(),
    });
    return nextRev;
  });

  return { cloudId, syncedAt, newRevision };
}

/**
 * Lista presentaciones en la nube del usuario.
 */
export async function listCloudPresentations(
  uid: string
): Promise<CloudPresentationListItem[]> {
  const inst = await initFirebase();
  if (!inst?.firestore) throw new Error("Firebase no inicializado");
  if (!inst.auth.currentUser || inst.auth.currentUser.uid !== uid) {
    throw new Error(
      "La sesión de Firebase no coincide. Vuelve a iniciar sesión e inténtalo de nuevo."
    );
  }
  const db = inst.firestore;
  const snap = await getDocs(userPresentationsRef(db, uid));
  const out: CloudPresentationListItem[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      cloudId: d.id,
      topic: String(data.topic ?? ""),
      savedAt: String(data.savedAt ?? ""),
      updatedAt: timestampToIso(data.updatedAt),
    };
  });
  out.sort((a, b) => {
    const ta = a.updatedAt || a.savedAt || "";
    const tb = b.updatedAt || b.savedAt || "";
    return tb.localeCompare(ta);
  });
  return out;
}

/**
 * Descarga una presentación desde la nube (lista para importar con id local nuevo).
 */
export type PulledPresentation = Omit<SavedPresentation, "id">;

export async function pullPresentationFromCloud(
  uid: string,
  cloudId: string
): Promise<{ presentation: PulledPresentation; cloudRevision: number }> {
  const inst = await initFirebase();
  if (!inst?.firestore || !inst.storage) {
    throw new Error("Firebase no inicializado");
  }
  const { firestore: db, storage: st, auth: fbAuth } = inst;
  if (!fbAuth.currentUser || fbAuth.currentUser.uid !== uid) {
    throw new Error(
      "La sesión de Firebase no coincide. Vuelve a iniciar sesión e inténtalo de nuevo."
    );
  }
  const dref = presentationDoc(db, uid, cloudId);
  const snap = await getDoc(dref);
  if (!snap.exists()) throw new Error("Presentación no encontrada en la nube");

  const data = snap.data() as Record<string, unknown>;
  const cloudRevision = Number(data.revision ?? 0);
  const prefix = storagePrefix(uid, cloudId);
  const slideImagePaths = (data.slideImagePaths as Record<string, string>) ?? {};
  const excalidrawPaths = (data.excalidrawPaths as Record<string, string>) ?? {};
  const rawSlides = (data.slides as Record<string, unknown>[]) ?? [];

  const slides: Slide[] = [];
  for (let i = 0; i < rawSlides.length; i++) {
    const row = rawSlides[i]!;
    let slide = plainToSlide(row);

    const imgName = slideImagePaths[String(i)];
    if (imgName) {
      const path = `${prefix}/${imgName}`;
      try {
        const bytes = await getBytes(ref(st, path));
        const ext = imgName.split(".").pop()?.toLowerCase() ?? "png";
        const mime =
          ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "webp"
              ? "image/webp"
              : ext === "gif"
                ? "image/gif"
                : "image/png";
        slide = { ...slide, imageUrl: bytesToDataUrl(bytes, mime) };
      } catch {
        /* deja sin imagen */
      }
    }

    const excName = excalidrawPaths[String(i)];
    if (excName) {
      const path = `${prefix}/${excName}`;
      try {
        const bytes = await getBytes(ref(st, path));
        const text = new TextDecoder().decode(bytes);
        slide = { ...slide, excalidrawData: text };
      } catch {
        /* sin diagrama */
      }
    }

    slides.push(slide);
  }

  return {
    presentation: {
      topic: String(data.topic ?? ""),
      savedAt: String(data.savedAt ?? new Date().toISOString()),
      characterId:
        data.characterId != null && data.characterId !== ""
          ? String(data.characterId)
          : undefined,
      slides,
    },
    cloudRevision: Number.isFinite(cloudRevision) ? cloudRevision : 0,
  };
}
