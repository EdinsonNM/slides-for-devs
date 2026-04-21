import { useCallback, useMemo, useState } from "react";
import type { HomePresentationCard } from "../../types";
import type { CloudPresentationListItem } from "../../services/presentationCloud";
import { getFirebaseConfig } from "../../services/firebase";
import { formatCloudSharedListError } from "../../utils/cloudSyncErrors";
import { fetchCloudPresentationSnapshots } from "./usePresentationCloudList";
import type { PresentationHomeCardsInput } from "./presentationHomeCardsInput";

/**
 * Listados nube para la home y fusión con presentaciones locales en tarjetas ordenadas por fecha.
 */
export function usePresentationHomeCards({
  user,
  firebaseReady,
  savedList,
}: PresentationHomeCardsInput) {
  const [cloudMineSnapshot, setCloudMineSnapshot] = useState<
    CloudPresentationListItem[]
  >([]);
  const [cloudSharedSnapshot, setCloudSharedSnapshot] = useState<
    CloudPresentationListItem[]
  >([]);
  const [homeCloudSharedListWarning, setHomeCloudSharedListWarning] = useState<
    string | null
  >(null);

  const refreshCloudMineSnapshot = useCallback(async () => {
    // Listar Firestore en web y en Tauri: en navegador no hay SQLite local, así que
    // las tarjetas "solo nube" son la única forma de ver decks sincronizados.
    if (!user || firebaseReady !== true || typeof window === "undefined") {
      setCloudMineSnapshot([]);
      setCloudSharedSnapshot([]);
      setHomeCloudSharedListWarning(null);
      return;
    }
    setHomeCloudSharedListWarning(null);
    const { mine, shared, sharedListError } =
      await fetchCloudPresentationSnapshots(user.uid);
    setCloudMineSnapshot(mine);
    setCloudSharedSnapshot(shared);
    if (sharedListError) {
      console.warn(
        "Listado de presentaciones compartidas (home):",
        sharedListError,
      );
      const cfg = await getFirebaseConfig();
      setHomeCloudSharedListWarning(
        formatCloudSharedListError(sharedListError, cfg?.projectId),
      );
    }
  }, [user, firebaseReady]);

  const homePresentationCards = useMemo((): HomePresentationCard[] => {
    const hasAnyLocalForCloud = (cloudId: string) =>
      savedList.some((p) => p.cloudId === cloudId);

    const sharedSourceKey = (ownerUid: string, cloudId: string) =>
      `${ownerUid}::${cloudId}`;

    const hasLocalForSharedCloud = (ownerUid: string, cloudId: string) =>
      savedList.some(
        (p) => p.sharedCloudSource === sharedSourceKey(ownerUid, cloudId),
      );

    const locals: HomePresentationCard[] = savedList.map((meta) => ({
      kind: "local",
      meta,
    }));

    const cloudOnlyMine: HomePresentationCard[] = cloudMineSnapshot
      .filter(
        (item) =>
          item.source === "mine" && !hasAnyLocalForCloud(item.cloudId),
      )
      .map((item) => ({
        kind: "cloud_only_mine" as const,
        cloudId: item.cloudId,
        ownerUid: item.ownerUid,
        topic: item.topic,
        savedAt: item.savedAt,
        updatedAt: item.updatedAt,
      }));

    const cloudOnlyShared: HomePresentationCard[] = cloudSharedSnapshot
      .filter(
        (item) =>
          item.source === "shared" &&
          !hasLocalForSharedCloud(item.ownerUid, item.cloudId),
      )
      .map((item) => ({
        kind: "cloud_only_shared" as const,
        cloudId: item.cloudId,
        ownerUid: item.ownerUid,
        topic: item.topic,
        savedAt: item.savedAt,
        updatedAt: item.updatedAt,
      }));

    const merged = [...locals, ...cloudOnlyMine, ...cloudOnlyShared];
    merged.sort((a, b) => {
      const ta =
        a.kind === "local" ? a.meta.savedAt : a.updatedAt || a.savedAt;
      const tb =
        b.kind === "local" ? b.meta.savedAt : b.updatedAt || b.savedAt;
      return tb.localeCompare(ta);
    });
    return merged;
  }, [savedList, cloudMineSnapshot, cloudSharedSnapshot]);

  return {
    homeCloudSharedListWarning,
    refreshCloudMineSnapshot,
    homePresentationCards,
  };
}
