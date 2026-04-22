import type { SavedPresentation } from "../types";

/** Copia local en navegador: cuerpo + metadatos de nube (misma forma que en storage). */
export type WebPresentationRecord = SavedPresentation & {
  cloudId?: string;
  cloudSyncedAt?: string;
  cloudRevision?: number;
  localBodyCleared?: boolean;
  sharedCloudSource?: string;
  dirtySlideIds?: string[];
  syncStatus?: "synced" | "pending" | "offline" | "conflict";
  lastSyncedRevision?: number;
};

const LEGACY_LS_PREFIX = "slides-for-devs-presentations";

const IDB_NAME = "slides-for-devs-presentations-v1";
const IDB_STORE = "presentations";
const IDB_VERSION = 1;

function legacyStorageKey(accountScope: string): string {
  return `${LEGACY_LS_PREFIX}:${accountScope}`;
}

function scopeIdbKeyPrefix(accountScope: string): string {
  return `${accountScope}::`;
}

function recordIdbKey(accountScope: string, id: string): string {
  return `${accountScope}::${id}`;
}

function readLegacyLocalStorage(accountScope: string): WebPresentationRecord[] {
  const raw = localStorage.getItem(legacyStorageKey(accountScope));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WebPresentationRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clearLegacyLocalStorage(accountScope: string): void {
  try {
    localStorage.removeItem(legacyStorageKey(accountScope));
  } catch {
    /* ignore */
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("indexedDB is not available"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = (): void => reject(req.error ?? new Error("indexedDB.open failed"));
    req.onsuccess = (): void => resolve(req.result);
    req.onupgradeneeded = (): void => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDb();
  }
  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = (): void => resolve();
    tx.onerror = (): void => reject(tx.error ?? new Error("IDB transaction error"));
    tx.onabort = (): void => reject(tx.error ?? new Error("IDB transaction aborted"));
  });
}

async function idbReadScope(accountScope: string): Promise<WebPresentationRecord[]> {
  const db = await getDb();
  const tx = db.transaction(IDB_STORE, "readonly");
  const store = tx.objectStore(IDB_STORE);
  const prefix = scopeIdbKeyPrefix(accountScope);
  const upper = `${prefix}\uffff`;
  const range = IDBKeyRange.bound(prefix, upper, false, true);
  const out: WebPresentationRecord[] = [];
  await new Promise<void>((resolve, reject) => {
    const cursorReq = store.openCursor(range);
    cursorReq.onsuccess = (): void => {
      const cursor = cursorReq.result;
      if (!cursor) {
        resolve();
        return;
      }
      out.push(cursor.value as WebPresentationRecord);
      cursor.continue();
    };
    cursorReq.onerror = (): void => reject(cursorReq.error);
  });
  await txDone(tx);
  return out;
}

async function idbReplaceScope(
  accountScope: string,
  records: WebPresentationRecord[],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(IDB_STORE, "readwrite");
  const store = tx.objectStore(IDB_STORE);
  const prefix = scopeIdbKeyPrefix(accountScope);
  const upper = `${prefix}\uffff`;
  const range = IDBKeyRange.bound(prefix, upper, false, true);
  await new Promise<void>((resolve, reject) => {
    const cursorReq = store.openCursor(range);
    cursorReq.onsuccess = (): void => {
      const cursor = cursorReq.result;
      if (!cursor) {
        for (const rec of records) {
          store.put(rec, recordIdbKey(accountScope, rec.id));
        }
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    cursorReq.onerror = (): void => reject(cursorReq.error);
  });
  await txDone(tx);
}

/**
 * Lee todas las presentaciones del ámbito. Migra desde localStorage legado si IndexedDB está vacío.
 */
export async function readWebPresentationRecords(
  accountScope: string,
): Promise<WebPresentationRecord[]> {
  if (typeof indexedDB === "undefined") {
    return readLegacyLocalStorage(accountScope);
  }
  try {
    const fromIdb = await idbReadScope(accountScope);
    if (fromIdb.length > 0) {
      clearLegacyLocalStorage(accountScope);
      return fromIdb;
    }
    const legacy = readLegacyLocalStorage(accountScope);
    if (legacy.length === 0) {
      return [];
    }
    await idbReplaceScope(accountScope, legacy);
    clearLegacyLocalStorage(accountScope);
    return legacy;
  } catch {
    return readLegacyLocalStorage(accountScope);
  }
}

/**
 * Persiste el array completo del ámbito (mismo contrato que antes con localStorage).
 */
function isQuotaExceeded(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" || e.code === 22)
  );
}

export async function writeWebPresentationRecords(
  accountScope: string,
  records: WebPresentationRecord[],
): Promise<void> {
  if (typeof indexedDB === "undefined") {
    try {
      localStorage.setItem(
        legacyStorageKey(accountScope),
        JSON.stringify(records),
      );
    } catch (e) {
      if (isQuotaExceeded(e)) {
        throw new Error(
          "No hay espacio suficiente en el navegador para guardar la presentación. Prueba a borrar datos de otros sitios, usar la app de escritorio o sincronizar con la nube.",
          { cause: e },
        );
      }
      throw e;
    }
    return;
  }
  try {
    await idbReplaceScope(accountScope, records);
    clearLegacyLocalStorage(accountScope);
  } catch (err) {
    try {
      localStorage.setItem(
        legacyStorageKey(accountScope),
        JSON.stringify(records),
      );
      return;
    } catch (lsErr) {
      if (isQuotaExceeded(lsErr) || isQuotaExceeded(err)) {
        throw new Error(
          "No hay espacio suficiente en el navegador para guardar la presentación. Prueba a borrar datos de otros sitios, usar la app de escritorio o sincronizar con la nube.",
          { cause: lsErr instanceof Error ? lsErr : err },
        );
      }
      throw err;
    }
  }
}
