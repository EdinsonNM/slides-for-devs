import { useCallback, useEffect } from "react";
import { createConfigSetter } from "../../store/useConfigStore";
import { AUTO_CLOUD_SYNC_STORAGE_KEY } from "./presentationConstants";
import { migrateJsonPresentations } from "../../services/storage";

/**
 * Efectos y setters de “arranque” del módulo de presentación (una sola vez / sin deps del deck).
 *
 * 1. Migración JSON → SQLite al montar el hook de estado de presentación.
 * 2. Toggle de auto-sync con nube: persiste en `localStorage` y actualiza el store de config.
 */
export function usePresentationBootstrapPersistence() {
  useEffect(() => {
    migrateJsonPresentations().catch(() => {});
  }, []);

  const setAutoCloudSyncOnSave = useCallback((value: boolean) => {
    try {
      localStorage.setItem(AUTO_CLOUD_SYNC_STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* ignore */
    }
    createConfigSetter("autoCloudSyncOnSave")(value);
  }, []);

  return { setAutoCloudSyncOnSave };
}
