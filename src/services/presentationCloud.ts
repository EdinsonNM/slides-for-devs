/**
 * Sincronización de presentaciones con Firestore + Firebase Storage.
 * Imágenes y diagramas grandes van a Storage; metadatos y texto en Firestore.
 */
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import {
  deleteObject,
  getBytes,
  getDownloadURL,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";
import type { Slide } from "../types";
import {
  DECK_COVER_CLOUD_STORAGE_BASENAME,
  isPersistedSlaimDeckCoverSlide,
} from "../constants/deckCover";
import {
  normalizeDeckVisualTheme,
  type DeckVisualTheme,
} from "../domain/entities";
import {
  isSlideCanvasScene,
  normalizeSlideMatrixData,
  type SlideCanvasScene,
} from "../domain/entities";
import { parsePresenter3dViewState } from "../utils/presenter3dView";
import { parseCanvas3dModelTransform } from "../utils/canvas3dModelTransform";
import type { SavedPresentation } from "../types";
import { initFirebase } from "./firebase";
import {
  dataUrlToCloudImagePayload,
  optimizeRasterBytesForCloud,
} from "../utils/imageOptimize";

const SCHEMA_VERSION = 3;
const FIRESTORE_BATCH_LIMIT = 500;
const SLIDE_WRITE_MAX_RETRIES = 3;

/** La nube tiene una revisión distinta a la esperada (otro dispositivo subió cambios). */
export class CloudSyncConflictError extends Error {
  readonly code = "CLOUD_SYNC_CONFLICT" as const;
  constructor(
    public readonly expectedRevision: number,
    public readonly remoteRevision: number,
    public readonly remoteSlideCount?: number
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

/** Correos en minúsculas para `shareInviteEmails` y consultas `array-contains`. */
export function normalizeShareEmail(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

function shareInviteEmailsFromDocData(data: Record<string, unknown>): string[] {
  const em = data.shareInviteEmails;
  if (!Array.isArray(em)) return [];
  return [
    ...new Set(
      em
        .filter((x): x is string => typeof x === "string")
        .map((e) => normalizeShareEmail(e))
        .filter((e): e is string => e != null)
    ),
  ];
}

/** ID estable en `sharedPresentationIndex/{email}/refs/{refId}`. */
export function sharePresentationRefId(ownerUid: string, cloudId: string): string {
  return `${ownerUid}__${cloudId}`;
}

/** Colección de invitaciones por presentación: `users/{ownerUid}/presentationShareGrants/{grantId}`. */
function presentationShareGrantsCollection(db: Firestore, ownerUid: string) {
  return collection(db, "users", ownerUid, "presentationShareGrants");
}

/** ID de doc de invitación por UID de Firebase. */
export function shareGrantDocIdForUid(recipientUid: string): string {
  return `u_${recipientUid}`;
}

/** ID de doc de invitación por correo ya normalizado (minúsculas). */
export function shareGrantDocIdForEmailNorm(emailNorm: string): string {
  try {
    const b = btoa(unescape(encodeURIComponent(emailNorm)));
    return `e_${b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  } catch {
    return `e_${emailNorm.length}_${emailNorm.codePointAt(0) ?? 0}`;
  }
}

export interface PresentationShareGrantRow {
  grantId: string;
  recipientUid: string | null;
  recipientEmailNorm: string | null;
}

/**
 * Sustituye los grants de una presentación (borra docs con ese cloudId y crea los nuevos).
 * Si se pasa `presentationRef`, actualiza en el mismo batch `sharedWith` / `shareInviteEmails`.
 */
async function replacePresentationShareGrants(
  db: Firestore,
  ownerUid: string,
  cloudId: string,
  meta: { topic: string; savedAt: string; updatedAt: string | null },
  recipientUids: string[],
  recipientEmailNorms: string[],
  presentationPatch?: {
    ref: DocumentReference;
    sharedWith: string[];
    shareInviteEmails: string[];
  }
): Promise<void> {
  const grantsCol = presentationShareGrantsCollection(db, ownerUid);
  const existing = await getDocs(query(grantsCol, where("cloudId", "==", cloudId)));
  const batch = writeBatch(db);
  let ops = 0;
  for (const d of existing.docs) {
    batch.delete(d.ref);
    ops += 1;
  }
  const uids = [...new Set(recipientUids.map((u) => u.trim()).filter(Boolean))];
  const emails = [
    ...new Set(
      recipientEmailNorms
        .map((e) => normalizeShareEmail(e))
        .filter((e): e is string => e != null)
    ),
  ];
  for (const uid of uids) {
    batch.set(doc(grantsCol, shareGrantDocIdForUid(uid)), {
      ownerUid,
      cloudId,
      recipientUid: uid,
      recipientEmailNorm: null,
      topic: meta.topic,
      savedAt: meta.savedAt,
      updatedAt: meta.updatedAt,
    });
    ops += 1;
  }
  for (const emailNorm of emails) {
    batch.set(doc(grantsCol, shareGrantDocIdForEmailNorm(emailNorm)), {
      ownerUid,
      cloudId,
      recipientUid: null,
      recipientEmailNorm: emailNorm,
      topic: meta.topic,
      savedAt: meta.savedAt,
      updatedAt: meta.updatedAt,
    });
    ops += 1;
  }
  if (presentationPatch) {
    batch.update(presentationPatch.ref, {
      sharedWith: presentationPatch.sharedWith,
      shareInviteEmails: presentationPatch.shareInviteEmails,
    });
    ops += 1;
  }
  if (ops === 0) return;
  await batch.commit();
}

/** Lista invitaciones de una presentación en la nube (solo el propietario). */
export async function listPresentationShareGrantsForCloudPresentation(
  ownerUid: string,
  cloudId: string
): Promise<PresentationShareGrantRow[]> {
  const inst = await initFirebase();
  if (!inst?.firestore) throw new Error("Firebase no inicializado");
  const { firestore: db, auth: fbAuth } = inst;
  if (!fbAuth.currentUser || fbAuth.currentUser.uid !== ownerUid) {
    throw new Error("Solo el propietario puede listar invitaciones.");
  }
  const grantsCol = presentationShareGrantsCollection(db, ownerUid);
  const snap = await getDocs(query(grantsCol, where("cloudId", "==", cloudId)));
  return snap.docs.map((d) => {
    const g = d.data() as Record<string, unknown>;
    return {
      grantId: d.id,
      recipientUid: typeof g.recipientUid === "string" ? g.recipientUid : null,
      recipientEmailNorm: typeof g.recipientEmailNorm === "string" ? g.recipientEmailNorm : null,
    };
  });
}

/**
 * Mantiene el índice por correo (listable con reglas que comparan emailKey al token).
 * Elimina refs de correos que ya no están invitados y escribe/actualiza los activos.
 */
async function syncPresentationShareEmailIndex(
  db: Firestore,
  ownerUid: string,
  cloudId: string,
  meta: { topic: string; savedAt: string; updatedAt: string | null },
  previousInviteEmails: string[],
  nextInviteEmails: string[]
): Promise<void> {
  const prev = new Set(previousInviteEmails);
  const next = new Set(nextInviteEmails);
  const refId = sharePresentationRefId(ownerUid, cloudId);
  const batch = writeBatch(db);
  let ops = 0;

  for (const email of prev) {
    if (!next.has(email)) {
      batch.delete(doc(db, "sharedPresentationIndex", email, "refs", refId));
      ops += 1;
    }
  }

  const payload = {
    ownerUid,
    cloudId,
    topic: meta.topic,
    savedAt: meta.savedAt,
    updatedAt: meta.updatedAt,
  };

  for (const email of next) {
    batch.set(doc(db, "sharedPresentationIndex", email, "refs", refId), payload, {
      merge: true,
    });
    ops += 1;
  }

  if (ops === 0) return;
  await batch.commit();
}

export interface PresentationShareAccess {
  sharedWithUids: string[];
  /** Correos normalizados (minúsculas); acceso si coinciden con `request.auth.token.email`. */
  shareInviteEmails: string[];
}

export type PresentationPublicationVisibility = "public" | "private" | "unlisted";
export type PresentationPublicationLevel = "basic" | "intermediate" | "advanced";

export interface PresentationPublicationMetadata {
  visibility: PresentationPublicationVisibility;
  description: string;
  tags: string[];
  level: PresentationPublicationLevel;
  categories: string[];
  publishedAt: string | null;
}

function normalizePublicationTags(values: string[]): string[] {
  return [
    ...new Set(
      values
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 12)
    ),
  ];
}

function normalizePublicationCategories(values: string[]): string[] {
  return [
    ...new Set(
      values
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 8)
    ),
  ];
}

export async function getPresentationPublicationMetadata(
  ownerUid: string,
  cloudId: string
): Promise<PresentationPublicationMetadata> {
  const inst = await initFirebase();
  if (!inst?.firestore) throw new Error("Firebase no inicializado");
  const { firestore: db, auth: fbAuth } = inst;
  if (!fbAuth.currentUser) {
    throw new Error("Inicia sesion para ver la publicacion.");
  }
  const snap = await getDoc(presentationDoc(db, ownerUid, cloudId));
  if (!snap.exists()) {
    throw new Error("La presentacion no esta en la nube. Sincronizala primero.");
  }
  const data = snap.data() as Record<string, unknown>;
  const rawTags = Array.isArray(data.publicationTags)
    ? data.publicationTags.filter((x): x is string => typeof x === "string")
    : [];
  const rawCategories = Array.isArray(data.publicationCategories)
    ? data.publicationCategories.filter((x): x is string => typeof x === "string")
    : [];
  const rawVisibility = data.publicationVisibility;
  const visibility: PresentationPublicationVisibility =
    rawVisibility === "public" || rawVisibility === "unlisted" || rawVisibility === "private"
      ? rawVisibility
      : "private";
  const rawLevel = data.publicationLevel;
  const level: PresentationPublicationLevel =
    rawLevel === "basic" || rawLevel === "intermediate" || rawLevel === "advanced"
      ? rawLevel
      : "intermediate";
  return {
    visibility,
    description:
      typeof data.publicationDescription === "string" ? data.publicationDescription : "",
    tags: normalizePublicationTags(rawTags),
    level,
    categories: normalizePublicationCategories(rawCategories),
    publishedAt: timestampToIso(data.publicationPublishedAt),
  };
}

export async function setPresentationPublicationMetadata(
  ownerUid: string,
  cloudId: string,
  metadata: Omit<PresentationPublicationMetadata, "publishedAt">
): Promise<void> {
  const inst = await initFirebase();
  if (!inst?.firestore) throw new Error("Firebase no inicializado");
  const { firestore: db, auth: fbAuth } = inst;
  if (!fbAuth.currentUser || fbAuth.currentUser.uid !== ownerUid) {
    throw new Error("Solo el propietario puede cambiar la publicacion.");
  }
  const dref = presentationDoc(db, ownerUid, cloudId);
  const snap = await getDoc(dref);
  if (!snap.exists()) {
    throw new Error("La presentacion no esta en la nube. Sincronizala primero.");
  }
  const visibility: PresentationPublicationVisibility =
    metadata.visibility === "public" || metadata.visibility === "unlisted"
      ? metadata.visibility
      : "private";
  const level: PresentationPublicationLevel =
    metadata.level === "basic" || metadata.level === "advanced"
      ? metadata.level
      : "intermediate";
  await updateDoc(dref, {
    publicationVisibility: visibility,
    publicationDescription: metadata.description.trim().slice(0, 500),
    publicationTags: normalizePublicationTags(metadata.tags),
    publicationLevel: level,
    publicationCategories: normalizePublicationCategories(metadata.categories),
    publicationPublishedAt:
      visibility === "public" || visibility === "unlisted" ? serverTimestamp() : null,
  });
}

export interface CloudPresentationListItem {
  cloudId: string;
  /** Propietario del documento en `users/{ownerUid}/presentations/...`. */
  ownerUid: string;
  topic: string;
  savedAt: string;
  updatedAt: string | null;
  /** Presentación propia sincronizada vs compartida por otro usuario. */
  source: "mine" | "shared";
  /**
   * URL firmada de la portada Slaim en Storage (`deckCoverImageFile` en el doc principal), no del panel `slide_0.*`.
   * Se rellena al listar.
   */
  homePreviewImageUrl?: string;
  /** Primer slide resuelto (réplica visual del home) si no hay portada Slaim. */
  homeFirstSlideReplica?: Slide;
  /** Tema del doc principal (para pintar la réplica como en el editor). */
  homePreviewDeckVisualTheme?: DeckVisualTheme;
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

function safeStorageLeafName(raw: string | undefined | null): string | undefined {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s.includes("..") || s.includes("/")) return undefined;
  return s;
}

/** Timeout por archivo de Storage al descargar presentaciones (evita spinner infinito). */
const STORAGE_PULL_TIMEOUT_MS = 180_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = globalThis.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        globalThis.clearTimeout(id);
        resolve(v);
      },
      (e) => {
        globalThis.clearTimeout(id);
        reject(e);
      },
    );
  });
}

/** Primer slide con raster/diagrama resueltos desde Storage (miniatura “réplica” del home). */
async function loadFirstSlideResolvedForHomeReplica(
  db: Firestore,
  st: FirebaseStorage,
  ownerUid: string,
  cloudId: string,
  mainData: Record<string, unknown>,
): Promise<Slide | undefined> {
  const expectedSlideCount = Number(mainData.slideCount ?? 0);
  if (expectedSlideCount < 1) return undefined;
  const prefix = storagePrefix(ownerUid, cloudId);
  const slideImagePaths = (mainData.slideImagePaths as Record<string, string>) ?? {};
  const excalidrawPaths = (mainData.excalidrawPaths as Record<string, string>) ?? {};
  const deckCoverLeaf = safeStorageLeafName(String(mainData.deckCoverImageFile ?? ""));
  const inlineSlides = mainData.slides;
  const isV1 =
    Array.isArray(inlineSlides) && (inlineSlides as unknown[]).length > 0;
  let row: Record<string, unknown> | undefined;
  if (isV1) {
    row = (inlineSlides as Record<string, unknown>[])[0];
  } else {
    const s0 = await getDoc(
      doc(db, "users", ownerUid, "presentations", cloudId, "slides", "0"),
    );
    if (!s0.exists()) return undefined;
    row = s0.data() as Record<string, unknown>;
  }
  if (!row) return undefined;
  const base = plainToSlide(row);

  const imageUrl = await (async (): Promise<string | undefined> => {
    const i = 0;
    const fromSlidePaths = slideImagePaths[String(i)]?.trim();
    const imgName =
      fromSlidePaths ||
      (i === 0 && deckCoverLeaf ? deckCoverLeaf : undefined);
    if (!imgName) return base.imageUrl;
    const path = `${prefix}/${imgName}`;
    try {
      return await withTimeout(
        getDownloadURL(ref(st, path)),
        STORAGE_PULL_TIMEOUT_MS,
        `Home preview: imagen slide 0 (${imgName}).`,
      );
    } catch {
      return base.imageUrl;
    }
  })();

  const excalidrawData = await (async (): Promise<string | undefined> => {
    const excName = excalidrawPaths["0"];
    if (!excName) return base.excalidrawData;
    const path = `${prefix}/${excName}`;
    try {
      const bytes = await withTimeout(
        getBytes(ref(st, path)),
        STORAGE_PULL_TIMEOUT_MS,
        "Home preview: diagrama slide 0.",
      );
      return new TextDecoder().decode(bytes);
    } catch {
      return base.excalidrawData;
    }
  })();

  return {
    ...base,
    ...(imageUrl !== undefined ? { imageUrl } : {}),
    ...(excalidrawData !== undefined ? { excalidrawData } : {}),
  };
}

async function deckCoverPreviewDownloadUrl(
  st: FirebaseStorage,
  ownerUid: string,
  cloudId: string,
  mainDocData: Record<string, unknown>,
): Promise<string | undefined> {
  const leaf = safeStorageLeafName(String(mainDocData.deckCoverImageFile ?? ""));
  if (!leaf) return undefined;
  try {
    return await getDownloadURL(ref(st, `${storagePrefix(ownerUid, cloudId)}/${leaf}`));
  } catch {
    return undefined;
  }
}

async function enrichCloudPresentationItemsWithDeckCoverPreview(
  db: Firestore,
  st: FirebaseStorage,
  items: CloudPresentationListItem[],
  /** `ownerUid::cloudId` → datos del doc principal (evita getDoc duplicado). */
  mainDocByOwnerCloud?: Map<string, Record<string, unknown>>,
): Promise<CloudPresentationListItem[]> {
  return Promise.all(
    items.map(async (item) => {
      if (item.homePreviewImageUrl || item.homeFirstSlideReplica) return item;
      const key = `${item.ownerUid}::${item.cloudId}`;
      let main = mainDocByOwnerCloud?.get(key);
      if (!main) {
        const snap = await getDoc(presentationDoc(db, item.ownerUid, item.cloudId));
        if (!snap.exists()) return item;
        main = snap.data() as Record<string, unknown>;
      }
      const deckUrl = await deckCoverPreviewDownloadUrl(
        st,
        item.ownerUid,
        item.cloudId,
        main,
      );
      if (deckUrl) return { ...item, homePreviewImageUrl: deckUrl };
      try {
        const slide0 = await loadFirstSlideResolvedForHomeReplica(
          db,
          st,
          item.ownerUid,
          item.cloudId,
          main,
        );
        return slide0
          ? {
              ...item,
              homeFirstSlideReplica: slide0,
              homePreviewDeckVisualTheme: normalizeDeckVisualTheme(
                main.deckVisualTheme,
              ),
            }
          : item;
      } catch {
        return item;
      }
    }),
  );
}

function slidesSubcollection(db: Firestore, uid: string, cloudId: string) {
  return collection(db, "users", uid, "presentations", cloudId, "slides");
}

async function setDocWithRetry(
  ref: DocumentReference,
  data: Record<string, unknown>,
  retries = SLIDE_WRITE_MAX_RETRIES
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await setDoc(ref, data);
      return;
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise((r) => globalThis.setTimeout(r, 1000 * attempt));
    }
  }
}

async function deleteDocWithRetry(
  ref: DocumentReference,
  retries = SLIDE_WRITE_MAX_RETRIES
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await deleteDoc(ref);
      return;
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise((r) => globalThis.setTimeout(r, 1000 * attempt));
    }
  }
}

/** Borra solo rutas conocidas en Firestore (evita listAll → CORS en localhost/navegador). */
async function deleteKnownPresentationFiles(
  st: FirebaseStorage,
  prefix: string,
  slideImagePaths: Record<string, string>,
  excalidrawPaths: Record<string, string>,
  deckCoverImageFile?: string | null,
): Promise<void> {
  const names = new Set<string>([
    ...Object.values(slideImagePaths),
    ...Object.values(excalidrawPaths),
  ]);
  const deckLeaf = safeStorageLeafName(deckCoverImageFile ?? undefined);
  if (deckLeaf) names.add(deckLeaf);
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

function stripUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) =>
      entry === undefined ? null : stripUndefinedDeep(entry),
    );
  }
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(input)) {
      if (entry === undefined) continue;
      out[key] = stripUndefinedDeep(entry);
    }
    return out;
  }
  return value;
}

function slideToPlain(s: Slide): Record<string, unknown> {
  return {
    id: s.id,
    type: s.type,
    title: s.title,
    subtitle: s.subtitle ?? null,
    content: s.content,
    canvasScene: s.canvasScene ?? null,
    imagePrompt: s.imagePrompt ?? null,
    code: s.code ?? null,
    language: s.language ?? null,
    fontSize: s.fontSize ?? null,
    videoUrl: s.videoUrl ?? null,
    contentType: s.contentType ?? null,
    presenter3dDeviceId: s.presenter3dDeviceId ?? null,
    presenter3dScreenMedia: s.presenter3dScreenMedia ?? null,
    presenter3dViewState: s.presenter3dViewState ?? null,
    canvas3dGlbUrl: s.canvas3dGlbUrl ?? null,
    canvas3dAnimationClipName: s.canvas3dAnimationClipName ?? null,
    canvas3dViewState: s.canvas3dViewState ?? null,
    canvas3dModelTransform: s.canvas3dModelTransform ?? null,
    imageWidthPercent: s.imageWidthPercent ?? null,
    contentLayout: s.contentLayout ?? null,
    panelHeightPercent: s.panelHeightPercent ?? null,
    presenterNotes: s.presenterNotes ?? null,
    speech: s.speech ?? null,
    editorHeight: s.editorHeight ?? null,
    matrixData: s.matrixData ?? null,
    isometricFlowData: s.isometricFlowData ?? null,
    mindMapData: s.mindMapData ?? null,
    mapData: s.mapData ?? null,
    canvas3dSceneData: s.canvas3dSceneData ?? null,
  };
}

function parseCanvasSceneFromPlain(v: unknown): SlideCanvasScene | undefined {
  if (isSlideCanvasScene(v)) return v;
  return undefined;
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
    presenter3dDeviceId:
      p.presenter3dDeviceId != null ? String(p.presenter3dDeviceId) : undefined,
    presenter3dScreenMedia:
      p.presenter3dScreenMedia === "image" || p.presenter3dScreenMedia === "video"
        ? p.presenter3dScreenMedia
        : undefined,
    presenter3dViewState: parsePresenter3dViewState(p.presenter3dViewState),
    canvas3dGlbUrl: p.canvas3dGlbUrl != null ? String(p.canvas3dGlbUrl) : undefined,
    canvas3dAnimationClipName:
      p.canvas3dAnimationClipName != null
        ? String(p.canvas3dAnimationClipName)
        : undefined,
    canvas3dViewState: parsePresenter3dViewState(p.canvas3dViewState),
    canvas3dModelTransform: parseCanvas3dModelTransform(p.canvas3dModelTransform),
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
    isometricFlowData:
      p.isometricFlowData != null ? String(p.isometricFlowData) : undefined,
    mindMapData: p.mindMapData != null ? String(p.mindMapData) : undefined,
    mapData: p.mapData != null ? String(p.mapData) : undefined,
    canvas3dSceneData:
      p.canvas3dSceneData != null ? String(p.canvas3dSceneData) : undefined,
    editorHeight:
      typeof p.editorHeight === "number" ? p.editorHeight : undefined,
    matrixData:
      p.matrixData != null && typeof p.matrixData === "object"
        ? normalizeSlideMatrixData(p.matrixData)
        : undefined,
    canvasScene: parseCanvasSceneFromPlain(p.canvasScene),
  };
}

function timestampToIso(t: unknown): string | null {
  if (t && typeof t === "object" && "toDate" in t && typeof (t as Timestamp).toDate === "function") {
    return (t as Timestamp).toDate().toISOString();
  }
  return null;
}

async function listSharedPresentationsFromEmailIndex(
  db: Firestore,
  emailNorm: string
): Promise<CloudPresentationListItem[]> {
  const snap = await getDocs(collection(db, "sharedPresentationIndex", emailNorm, "refs"));
  return snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      const updatedRaw = data.updatedAt;
      const updatedAt =
        typeof updatedRaw === "string"
          ? updatedRaw
          : timestampToIso(updatedRaw) ?? null;
      return {
        cloudId: String(data.cloudId ?? ""),
        ownerUid: String(data.ownerUid ?? ""),
        source: "shared" as const,
        topic: String(data.topic ?? ""),
        savedAt: String(data.savedAt ?? ""),
        updatedAt,
      };
    })
    .filter((row) => row.ownerUid.length > 0 && row.cloudId.length > 0);
}

/**
 * Sube la presentación a la nube.
 *
 * Flujo diseñado para robustez:
 *  1. Pre-check de revisión (falla temprano si hay conflicto).
 *  2. Subida de medios a Storage + escritura individual de cada slide (con retry).
 *  3. Solo si TODOS los slides se escribieron: transacción para actualizar el doc principal.
 *  4. Limpieza best-effort (slides sobrantes, Storage viejo, grants).
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

  /* ── 1. Pre-check revisión ── */
  const preSnap = await getDoc(docRef);
  if (preSnap.exists() && !force) {
    const preRemoteRev = Number((preSnap.data() as Record<string, unknown>).revision ?? 0);
    const expected = localExpectedRevision ?? 0;
    if (preRemoteRev !== expected) {
      const pd = preSnap.data() as Record<string, unknown>;
      const remoteCount = Number(pd.slideCount ?? (Array.isArray(pd.slides) ? (pd.slides as unknown[]).length : 0));
      throw new CloudSyncConflictError(expected, preRemoteRev, remoteCount);
    }
  }

  /* ── 2. Subida de medios + escritura individual de cada slide ── */
  const slideImagePaths: Record<string, string> = {};
  const excalidrawPaths: Record<string, string> = {};
  let deckCoverImageFile: string | null = null;
  const slidesCol = slidesSubcollection(db, uid, cloudId);
  let slidesWritten = 0;

  for (let i = 0; i < saved.slides.length; i++) {
    const slide = saved.slides[i]!;
    const plain = slideToPlain(slide);
    let imageUrl: string | undefined = slide.imageUrl;

    const useDeckCoverStorage =
      i === 0 && isPersistedSlaimDeckCoverSlide(slide);

    if (slide.imageUrl?.startsWith("data:")) {
      let payload = await dataUrlToCloudImagePayload(slide.imageUrl);
      if (!payload) {
        const parsed = dataUrlToBytes(slide.imageUrl);
        if (parsed) {
          payload = { bytes: parsed.bytes, contentType: parsed.contentType, ext: parsed.ext };
        }
      }
      if (payload) {
        const name = useDeckCoverStorage
          ? `${DECK_COVER_CLOUD_STORAGE_BASENAME}.${payload.ext}`
          : `slide_${i}.${payload.ext}`;
        await uploadBytes(ref(st, `${prefix}/${name}`), payload.bytes, { contentType: payload.contentType });
        if (useDeckCoverStorage) {
          deckCoverImageFile = name;
        } else {
          slideImagePaths[String(i)] = name;
        }
        imageUrl = undefined;
      }
    } else if (slide.imageUrl?.startsWith("http://") || slide.imageUrl?.startsWith("https://")) {
      // Evita CORS en localhost al re-descargar URLs firmadas de Firebase Storage.
      if (!/^https:\/\/firebasestorage\.googleapis\.com\//i.test(slide.imageUrl)) {
        const fetched = await fetchUrlAsBytes(slide.imageUrl);
        if (fetched) {
          const opt = await optimizeRasterBytesForCloud(fetched.bytes, fetched.contentType);
          const use = opt ?? { bytes: fetched.bytes, contentType: fetched.contentType, ext: fetched.ext };
          const name = useDeckCoverStorage
            ? `${DECK_COVER_CLOUD_STORAGE_BASENAME}.${use.ext}`
            : `slide_${i}.${use.ext}`;
          await uploadBytes(ref(st, `${prefix}/${name}`), use.bytes, { contentType: use.contentType });
          if (useDeckCoverStorage) {
            deckCoverImageFile = name;
          } else {
            slideImagePaths[String(i)] = name;
          }
          imageUrl = undefined;
        }
      }
    }

    let excalidrawData: string | undefined = slide.excalidrawData;
    if (slide.excalidrawData && slide.excalidrawData.length > EXCALIDRAW_STORAGE_THRESHOLD) {
      const name = `excalidraw_${i}.json`;
      await uploadBytes(ref(st, `${prefix}/${name}`), new TextEncoder().encode(slide.excalidrawData), { contentType: "application/json" });
      excalidrawPaths[String(i)] = name;
      excalidrawData = undefined;
    }

    const slideData: Record<string, unknown> = {
      order: i,
      ...plain,
      imageUrl: imageUrl ?? null,
      excalidrawData: excalidrawData ?? null,
      isometricFlowData: slide.isometricFlowData ?? null,
    };

    const safeSlideData = stripUndefinedDeep(slideData) as Record<string, unknown>;
    await setDocWithRetry(doc(slidesCol, String(i)), safeSlideData);
    slidesWritten += 1;
  }

  /* ── 3. Todos los slides escritos → actualizar doc principal vía transacción ── */
  const syncedAt = new Date().toISOString();
  const mainPayload = {
    schemaVersion: SCHEMA_VERSION,
    topic: saved.topic,
    savedAt: saved.savedAt,
    characterId: saved.characterId ?? null,
    deckVisualTheme: saved.deckVisualTheme ?? null,
    deckNarrativePresetId: saved.deckNarrativePresetId ?? null,
    narrativeNotes: saved.narrativeNotes ?? null,
    presentationReadme: saved.presentationReadme ?? null,
    slideImagePaths,
    excalidrawPaths,
    /** Portada Slaim dedicada en Storage (no `slide_0.*`). */
    deckCoverImageFile: deckCoverImageFile ?? null,
    slideCount: slidesWritten,
    cloudSyncedAtClient: syncedAt,
  };
  const safeMainPayload = stripUndefinedDeep(mainPayload) as Record<string, unknown>;

  const {
    newRevision,
    preservedShareInviteEmails: inviteEmailsAfterPush,
    preservedSharedWith: sharedWithAfterPush,
  } = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    const remoteRev = snap.exists()
      ? Number((snap.data() as Record<string, unknown>).revision ?? 0)
      : 0;

    let preservedSharedWith: string[] = [];
    let preservedShareInviteEmails: string[] = [];
    if (snap.exists()) {
      const d = snap.data() as Record<string, unknown>;
      const sw = d.sharedWith;
      if (Array.isArray(sw)) {
        preservedSharedWith = sw.filter((x): x is string => typeof x === "string");
      }
      preservedShareInviteEmails = shareInviteEmailsFromDocData(d);
    }

    if (!force && snap.exists()) {
      const expected = localExpectedRevision ?? 0;
      if (remoteRev !== expected) {
        const td = snap.data() as Record<string, unknown>;
        const rc = Number(td.slideCount ?? (Array.isArray(td.slides) ? (td.slides as unknown[]).length : 0));
        throw new CloudSyncConflictError(expected, remoteRev, rc);
      }
    }

    const nextRev = snap.exists() ? remoteRev + 1 : 1;
    transaction.set(docRef, {
      ...safeMainPayload,
      sharedWith: preservedSharedWith,
      shareInviteEmails: preservedShareInviteEmails,
      revision: nextRev,
      updatedAt: serverTimestamp(),
    });
    return { newRevision: nextRev, preservedShareInviteEmails, preservedSharedWith };
  });

  /* ── 4. Limpieza best-effort ── */
  const oldSlideCount = preSnap.exists()
    ? Number((preSnap.data() as Record<string, unknown>).slideCount ?? 0)
    : 0;

  for (let i = saved.slides.length; i < oldSlideCount; i++) {
    try { await deleteDocWithRetry(doc(slidesCol, String(i))); } catch { /* best-effort */ }
  }

  if (preSnap.exists()) {
    const pd = preSnap.data() as Record<string, unknown>;
    const oldImgPaths = (pd.slideImagePaths as Record<string, string>) ?? {};
    const oldExcPaths = (pd.excalidrawPaths as Record<string, string>) ?? {};
    const staleImgs = Object.entries(oldImgPaths).filter(([k]) => !(k in slideImagePaths));
    const staleExc = Object.entries(oldExcPaths).filter(([k]) => !(k in excalidrawPaths));
    const prevDeckLeaf = safeStorageLeafName(String(pd.deckCoverImageFile ?? ""));
    const nextDeckLeaf = deckCoverImageFile ? deckCoverImageFile.trim() : "";
    const deckStale =
      prevDeckLeaf && prevDeckLeaf !== nextDeckLeaf
        ? [deleteObject(ref(st, `${prefix}/${prevDeckLeaf}`)).catch(() => undefined)]
        : [];
    await Promise.all([
      ...staleImgs.map(([, name]) => deleteObject(ref(st, `${prefix}/${name}`)).catch(() => undefined)),
      ...staleExc.map(([, name]) => deleteObject(ref(st, `${prefix}/${name}`)).catch(() => undefined)),
      ...deckStale,
    ]);
  }

  try {
    const postSnap = await getDoc(docRef);
    const pda = (postSnap.data() ?? {}) as Record<string, unknown>;
    const meta = {
      topic: String(pda.topic ?? saved.topic),
      savedAt: String(pda.savedAt ?? saved.savedAt),
      updatedAt: timestampToIso(pda.updatedAt) ?? syncedAt,
    };
    await replacePresentationShareGrants(db, uid, cloudId, meta, sharedWithAfterPush, inviteEmailsAfterPush);
    await syncPresentationShareEmailIndex(db, uid, cloudId, meta, inviteEmailsAfterPush, inviteEmailsAfterPush);
  } catch (indexErr) {
    console.warn("[cloud] Grants o índice de compartidos no actualizados:", indexErr);
  }

  return { cloudId, syncedAt, newRevision };
}

/**
 * Elimina la presentación en Firestore, Storage, grants e índice de correo (solo el propietario).
 */
export async function deleteOwnerPresentationFromCloud(
  uid: string,
  cloudId: string
): Promise<void> {
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
  const docRef = presentationDoc(db, uid, cloudId.trim());
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;

  const data = snap.data() as Record<string, unknown>;
  const topic = String(data.topic ?? "");
  const savedAt = String(data.savedAt ?? "");
  const updatedAt = timestampToIso(data.updatedAt);
  const meta = { topic, savedAt, updatedAt };

  await replacePresentationShareGrants(db, uid, cloudId, meta, [], []);
  const prevInviteEmails = shareInviteEmailsFromDocData(data);
  await syncPresentationShareEmailIndex(db, uid, cloudId, meta, prevInviteEmails, []);

  const prefix = storagePrefix(uid, cloudId);
  await deleteKnownPresentationFiles(
    st,
    prefix,
    (data.slideImagePaths as Record<string, string>) ?? {},
    (data.excalidrawPaths as Record<string, string>) ?? {},
    data.deckCoverImageFile as string | null | undefined,
  );

  const slidesCol = slidesSubcollection(db, uid, cloudId.trim());
  const slidesSnap = await getDocs(slidesCol);
  if (!slidesSnap.empty) {
    for (let start = 0; start < slidesSnap.docs.length; start += FIRESTORE_BATCH_LIMIT) {
      const chunk = slidesSnap.docs.slice(start, start + FIRESTORE_BATCH_LIMIT);
      const delBatch = writeBatch(db);
      for (const d of chunk) delBatch.delete(d.ref);
      await delBatch.commit();
    }
  }

  await deleteDoc(docRef);
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
  const mainByOwnerCloud = new Map(
    snap.docs.map((d) => [`${uid}::${d.id}`, d.data() as Record<string, unknown>]),
  );
  let out: CloudPresentationListItem[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      cloudId: d.id,
      ownerUid: uid,
      source: "mine" as const,
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
  if (inst.storage) {
    out = await enrichCloudPresentationItemsWithDeckCoverPreview(
      db,
      inst.storage,
      out,
      mainByOwnerCloud,
    );
  }
  return out;
}

/** Compat: compartidos solo con array `sharedWith` en el doc (sin `presentationShareGrants`). */
function mergeSharedPresentationDocs(
  docs: QueryDocumentSnapshot[],
  myUid: string
): CloudPresentationListItem[] {
  const byKey = new Map<string, CloudPresentationListItem>();
  for (const d of docs) {
    const ownerUid = d.ref.parent.parent?.id;
    if (!ownerUid || ownerUid === myUid) continue;
    const key = `${ownerUid}::${d.id}`;
    if (byKey.has(key)) continue;
    const data = d.data() as Record<string, unknown>;
    byKey.set(key, {
      cloudId: d.id,
      ownerUid,
      source: "shared",
      topic: String(data.topic ?? ""),
      savedAt: String(data.savedAt ?? ""),
      updatedAt: timestampToIso(data.updatedAt),
    });
  }
  const out = [...byKey.values()];
  out.sort((a, b) => {
    const ta = a.updatedAt || a.savedAt || "";
    const tb = b.updatedAt || b.savedAt || "";
    return tb.localeCompare(ta);
  });
  return out;
}

function mergeSharedFromGrantDocs(
  docs: QueryDocumentSnapshot[],
  myUid: string
): CloudPresentationListItem[] {
  const byKey = new Map<string, CloudPresentationListItem>();
  for (const d of docs) {
    const ownerUid = d.ref.parent.parent?.id;
    const data = d.data() as Record<string, unknown>;
    const cloudId = String(data.cloudId ?? "");
    if (!ownerUid || ownerUid === myUid || !cloudId) continue;
    const key = `${ownerUid}::${cloudId}`;
    if (byKey.has(key)) continue;
    const updatedRaw = data.updatedAt;
    const updatedAt =
      typeof updatedRaw === "string" ? updatedRaw : timestampToIso(updatedRaw);
    byKey.set(key, {
      cloudId,
      ownerUid,
      source: "shared",
      topic: String(data.topic ?? ""),
      savedAt: String(data.savedAt ?? ""),
      updatedAt,
    });
  }
  const out = [...byKey.values()];
  out.sort((a, b) => {
    const ta = a.updatedAt || a.savedAt || "";
    const tb = b.updatedAt || b.savedAt || "";
    return tb.localeCompare(ta);
  });
  return out;
}

/**
 * Presentaciones compartidas contigo por UID (`presentationShareGrants`, collection group) o por correo
 * (`sharedPresentationIndex/{email}/refs/...`).
 */
export async function listCloudPresentationsSharedWithMe(
  myUid: string
): Promise<CloudPresentationListItem[]> {
  const inst = await initFirebase();
  if (!inst?.firestore) throw new Error("Firebase no inicializado");
  if (!inst.auth.currentUser || inst.auth.currentUser.uid !== myUid) {
    throw new Error(
      "La sesión de Firebase no coincide. Vuelve a iniciar sesión e inténtalo de nuevo."
    );
  }
  const db = inst.firestore;
  const emailNorm = inst.auth.currentUser.email
    ? normalizeShareEmail(inst.auth.currentUser.email)
    : null;

  const queryErrors: unknown[] = [];

  let fromGrants: CloudPresentationListItem[] = [];
  const grantDocs: QueryDocumentSnapshot[] = [];
  try {
    const qGrantsUid = query(
      collectionGroup(db, "presentationShareGrants"),
      where("recipientUid", "==", myUid)
    );
    grantDocs.push(...(await getDocs(qGrantsUid)).docs);
  } catch (e) {
    console.warn("[cloud] Listado compartidas (presentationShareGrants recipientUid):", e);
    queryErrors.push(e);
  }
  if (emailNorm) {
    try {
      const qGrantsEmail = query(
        collectionGroup(db, "presentationShareGrants"),
        where("recipientEmailNorm", "==", emailNorm)
      );
      grantDocs.push(...(await getDocs(qGrantsEmail)).docs);
    } catch (e) {
      console.warn("[cloud] Listado compartidas (presentationShareGrants recipientEmailNorm):", e);
      queryErrors.push(e);
    }
  }
  fromGrants = mergeSharedFromGrantDocs(grantDocs, myUid);

  let fromLegacyArrays: CloudPresentationListItem[] = [];
  try {
    const qLegacy = query(
      collectionGroup(db, "presentations"),
      where("sharedWith", "array-contains", myUid)
    );
    const snapLegacy = await getDocs(qLegacy);
    fromLegacyArrays = mergeSharedPresentationDocs([...snapLegacy.docs], myUid);
  } catch (e) {
    console.warn("[cloud] Listado compartidas (presentations sharedWith):", e);
    queryErrors.push(e);
  }

  let fromEmail: CloudPresentationListItem[] = [];
  if (emailNorm) {
    try {
      fromEmail = await listSharedPresentationsFromEmailIndex(db, emailNorm);
    } catch (e) {
      console.warn("[cloud] Listado compartidas (sharedPresentationIndex):", e);
      queryErrors.push(e);
    }
  }

  const expectedQueries = emailNorm ? 4 : 2;
  if (queryErrors.length >= expectedQueries) {
    throw queryErrors[0];
  }

  const byKey = new Map<string, CloudPresentationListItem>();
  for (const row of [...fromGrants, ...fromLegacyArrays, ...fromEmail]) {
    const k = `${row.ownerUid}::${row.cloudId}`;
    if (!byKey.has(k)) byKey.set(k, row);
  }
  let out = [...byKey.values()];
  out.sort((a, b) => {
    const ta = a.updatedAt || a.savedAt || "";
    const tb = b.updatedAt || b.savedAt || "";
    return tb.localeCompare(ta);
  });
  if (inst.storage) {
    out = await enrichCloudPresentationItemsWithDeckCoverPreview(db, inst.storage, out);
  }
  return out;
}

export async function getPresentationShareAccess(
  ownerUid: string,
  cloudId: string
): Promise<PresentationShareAccess> {
  const inst = await initFirebase();
  if (!inst?.firestore) throw new Error("Firebase no inicializado");
  const { firestore: db, auth: fbAuth } = inst;
  if (!fbAuth.currentUser) {
    throw new Error("Inicia sesión para ver los permisos.");
  }
  const dref = presentationDoc(db, ownerUid, cloudId);
  const snap = await getDoc(dref);
  if (!snap.exists()) {
    return { sharedWithUids: [], shareInviteEmails: [] };
  }
  const grantsCol = presentationShareGrantsCollection(db, ownerUid);
  const grantsSnap = await getDocs(query(grantsCol, where("cloudId", "==", cloudId)));
  if (!grantsSnap.empty) {
    const sharedWithUids: string[] = [];
    const shareInviteEmails: string[] = [];
    for (const g of grantsSnap.docs) {
      const row = g.data() as Record<string, unknown>;
      if (typeof row.recipientUid === "string" && row.recipientUid.trim()) {
        sharedWithUids.push(row.recipientUid.trim());
      }
      if (typeof row.recipientEmailNorm === "string" && row.recipientEmailNorm.trim()) {
        shareInviteEmails.push(row.recipientEmailNorm.trim());
      }
    }
    return {
      sharedWithUids: [...new Set(sharedWithUids)],
      shareInviteEmails: [...new Set(shareInviteEmails)],
    };
  }
  const data = snap.data() as Record<string, unknown>;
  const sw = data.sharedWith;
  const sharedWithUids = Array.isArray(sw)
    ? sw.filter((x): x is string => typeof x === "string")
    : [];
  const shareInviteEmails = shareInviteEmailsFromDocData(data);
  return { sharedWithUids, shareInviteEmails };
}

/** Solo el propietario puede actualizar; reglas Firestore deben coincidir. */
export async function setPresentationShareAccess(
  ownerUid: string,
  cloudId: string,
  access: PresentationShareAccess
): Promise<void> {
  const inst = await initFirebase();
  if (!inst?.firestore) throw new Error("Firebase no inicializado");
  const { firestore: db, auth: fbAuth } = inst;
  if (!fbAuth.currentUser || fbAuth.currentUser.uid !== ownerUid) {
    throw new Error("Solo el propietario puede cambiar con quién se comparte.");
  }
  const uids = [...new Set(access.sharedWithUids.map((u) => u.trim()).filter(Boolean))];
  const emails = [
    ...new Set(
      access.shareInviteEmails
        .map((e) => normalizeShareEmail(e))
        .filter((e): e is string => e != null)
    ),
  ];
  const dref = presentationDoc(db, ownerUid, cloudId);
  const snap = await getDoc(dref);
  if (!snap.exists()) {
    throw new Error("La presentación no está en la nube. Sincronízala primero.");
  }
  const prevInviteEmails = shareInviteEmailsFromDocData(
    snap.data() as Record<string, unknown>
  );
  const sd = snap.data() as Record<string, unknown>;
  const meta = {
    topic: String(sd.topic ?? ""),
    savedAt: String(sd.savedAt ?? ""),
    updatedAt: timestampToIso(sd.updatedAt),
  };
  try {
    await replacePresentationShareGrants(db, ownerUid, cloudId, meta, uids, emails, {
      ref: dref,
      sharedWith: uids,
      shareInviteEmails: emails,
    });
    const afterSnap = await getDoc(dref);
    const ad = (afterSnap.data() ?? {}) as Record<string, unknown>;
    await syncPresentationShareEmailIndex(
      db,
      ownerUid,
      cloudId,
      {
        topic: String(ad.topic ?? meta.topic),
        savedAt: String(ad.savedAt ?? meta.savedAt),
        updatedAt: timestampToIso(ad.updatedAt) ?? meta.updatedAt,
      },
      prevInviteEmails,
      emails
    );
  } catch (indexErr) {
    console.warn("[cloud] Grants o índice de compartidos no actualizados:", indexErr);
  }
}

/**
 * Descarga una presentación desde la nube (lista para importar con id local nuevo).
 * `ownerUid` es el dueño del documento; el usuario actual debe ser el dueño o estar en `sharedWith`.
 */
export type PulledPresentation = Omit<SavedPresentation, "id">;

/**
 * Resuelve `ownerUid` + `cloudId` del documento Firestore a partir de metadatos locales.
 * Presentación propia: `cloudId` en meta; compartida importada: `sharedCloudSource` = `ownerUid::cloudId`.
 */
export function resolvePresentationCloudRef(
  meta: { cloudId?: string; sharedCloudSource?: string },
  myUid: string
): { ownerUid: string; cloudId: string } | null {
  const cid = meta.cloudId?.trim();
  if (cid) return { ownerUid: myUid, cloudId: cid };
  const raw = meta.sharedCloudSource?.trim();
  if (!raw) return null;
  const sep = "::";
  const i = raw.indexOf(sep);
  if (i <= 0) return null;
  const ownerUid = raw.slice(0, i).trim();
  const cloudId = raw.slice(i + sep.length).trim();
  if (!ownerUid || !cloudId) return null;
  return { ownerUid, cloudId };
}

/** Solo lee el doc principal (barato) para comparar con `cloudRevision` local. */
export async function getCloudPresentationRevision(
  ownerUid: string,
  cloudId: string
): Promise<number> {
  const inst = await initFirebase();
  if (!inst?.firestore) throw new Error("Firebase no inicializado");
  const { firestore: db, auth: fbAuth } = inst;
  if (!fbAuth.currentUser) {
    throw new Error("Inicia sesión para consultar la nube.");
  }
  const snap = await getDoc(presentationDoc(db, ownerUid, cloudId.trim()));
  if (!snap.exists()) return 0;
  const data = snap.data() as Record<string, unknown>;
  const rev = Number(data.revision ?? 0);
  return Number.isFinite(rev) ? rev : 0;
}

export async function pullPresentationFromCloud(
  ownerUid: string,
  cloudId: string
): Promise<{ presentation: PulledPresentation; cloudRevision: number }> {
  const inst = await initFirebase();
  if (!inst?.firestore || !inst.storage) {
    throw new Error("Firebase no inicializado");
  }
  const { firestore: db, storage: st, auth: fbAuth } = inst;
  if (!fbAuth.currentUser) {
    throw new Error("Inicia sesión para descargar desde la nube.");
  }
  const dref = presentationDoc(db, ownerUid, cloudId);
  const snap = await getDoc(dref);
  if (!snap.exists()) throw new Error("Presentación no encontrada en la nube");

  const data = snap.data() as Record<string, unknown>;
  const cloudRevision = Number(data.revision ?? 0);
  const prefix = storagePrefix(ownerUid, cloudId);
  const slideImagePaths = (data.slideImagePaths as Record<string, string>) ?? {};
  const excalidrawPaths = (data.excalidrawPaths as Record<string, string>) ?? {};
  const deckCoverLeaf = safeStorageLeafName(String(data.deckCoverImageFile ?? ""));

  const inlineSlides = data.slides;
  const isV1 = Array.isArray(inlineSlides) && inlineSlides.length > 0;
  const expectedSlideCount = Number(data.slideCount ?? 0);

  let rawSlides: Record<string, unknown>[];
  if (isV1) {
    rawSlides = inlineSlides as Record<string, unknown>[];
  } else {
    const slidesCol = slidesSubcollection(db, ownerUid, cloudId);
    const slidesSnap = await getDocs(slidesCol);
    rawSlides = slidesSnap.docs
      .sort((a, b) => {
        const dataA = a.data() as Record<string, unknown>;
        const dataB = b.data() as Record<string, unknown>;
        return Number(dataA.order ?? a.id) - Number(dataB.order ?? b.id);
      })
      .map((d) => d.data() as Record<string, unknown>);

    if (expectedSlideCount > 0 && rawSlides.length < expectedSlideCount) {
      throw new Error(
        `Descarga incompleta: se esperaban ${expectedSlideCount} slides pero solo se encontraron ${rawSlides.length}. ` +
        `Puede que la subida no haya terminado. Reintenta en unos segundos.`
      );
    }
  }

  /** Imágenes: solo URL firmada de Storage (no se bajan bytes aquí; el navegador carga bajo demanda). */
  const slides: Slide[] = await Promise.all(
    rawSlides.map(async (_, i) => {
      const row = rawSlides[i]!;
      const base = plainToSlide(row);

      const [imageUrl, excalidrawData] = await Promise.all([
        (async (): Promise<string | undefined> => {
          const fromSlidePaths = slideImagePaths[String(i)]?.trim();
          const imgName =
            fromSlidePaths ||
            (i === 0 && deckCoverLeaf ? deckCoverLeaf : undefined);
          if (!imgName) return base.imageUrl;
          const path = `${prefix}/${imgName}`;
          try {
            return await withTimeout(
              getDownloadURL(ref(st, path)),
              STORAGE_PULL_TIMEOUT_MS,
              `Obtener la URL de la imagen tardó demasiado (${imgName}). Revisa la red o vuelve a intentarlo.`
            );
          } catch (e) {
            console.warn(
              `[cloud] No se pudo resolver URL de imagen del slide ${i} (${imgName}):`,
              e
            );
            return base.imageUrl;
          }
        })(),
        (async (): Promise<string | undefined> => {
          const excName = excalidrawPaths[String(i)];
          if (!excName) return base.excalidrawData;
          const path = `${prefix}/${excName}`;
          try {
            const bytes = await withTimeout(
              getBytes(ref(st, path)),
              STORAGE_PULL_TIMEOUT_MS,
              `La descarga del diagrama tardó demasiado (${excName}). Revisa la red o vuelve a intentarlo.`
            );
            return new TextDecoder().decode(bytes);
          } catch {
            return base.excalidrawData;
          }
        })(),
      ]);

      return {
        ...base,
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(excalidrawData !== undefined ? { excalidrawData } : {}),
      };
    })
  );

  const deckRaw = data.deckVisualTheme;
  const deckVisualTheme =
    deckRaw != null && typeof deckRaw === "object"
      ? normalizeDeckVisualTheme(deckRaw)
      : undefined;

  const presetRaw = data.deckNarrativePresetId;
  const deckNarrativePresetId =
    presetRaw != null && String(presetRaw).trim() !== ""
      ? String(presetRaw).trim()
      : undefined;
  const notesRaw = data.narrativeNotes;
  const narrativeNotes =
    notesRaw != null && String(notesRaw).trim() !== ""
      ? String(notesRaw).trim()
      : undefined;
  const readmeRaw = data.presentationReadme;
  const presentationReadme =
    readmeRaw != null && String(readmeRaw).trim() !== ""
      ? String(readmeRaw).trim()
      : undefined;

  return {
    presentation: {
      topic: String(data.topic ?? ""),
      savedAt: String(data.savedAt ?? new Date().toISOString()),
      characterId:
        data.characterId != null && data.characterId !== ""
          ? String(data.characterId)
          : undefined,
      ...(deckVisualTheme ? { deckVisualTheme } : {}),
      ...(deckNarrativePresetId ? { deckNarrativePresetId } : {}),
      ...(narrativeNotes ? { narrativeNotes } : {}),
      ...(presentationReadme ? { presentationReadme } : {}),
      slides,
    },
    cloudRevision: Number.isFinite(cloudRevision) ? cloudRevision : 0,
  };
}
