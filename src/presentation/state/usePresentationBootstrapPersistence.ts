import { useEffect } from "react";
import { migrateJsonPresentations } from "../../services/storage";

/**
 * Efectos de “arranque” del módulo de presentación (una sola vez / sin deps del deck).
 *
 * Migración JSON → SQLite al montar el hook de estado de presentación.
 */
export function usePresentationBootstrapPersistence() {
  useEffect(() => {
    migrateJsonPresentations().catch(() => {});
  }, []);
}
