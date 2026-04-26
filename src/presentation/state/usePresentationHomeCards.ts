import { useCallback, useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    void refreshCloudMineSnapshot();
  }, [refreshCloudMineSnapshot]);

  useEffect(() => {
    if (!user || firebaseReady !== true || typeof window === "undefined") return;
    const onFocus = () => {
      void refreshCloudMineSnapshot();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshCloudMineSnapshot();
      }
    };
    const id = window.setInterval(() => {
      void refreshCloudMineSnapshot();
    }, 15000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user, firebaseReady, refreshCloudMineSnapshot]);

  const homePresentationCards = useMemo((): HomePresentationCard[] => {
    const hasAnyLocalForCloud = (cloudId: string) =>
      savedList.some((p) => p.cloudId === cloudId);

    const locals: HomePresentationCard[] = savedList
      .filter((meta) => !meta.sharedCloudSource)
      .map((meta) => ({
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
        ...(item.homePreviewImageUrl
          ? { homePreviewImageUrl: item.homePreviewImageUrl }
          : {}),
        ...(item.homeFirstSlideReplica
          ? { homeFirstSlideReplica: item.homeFirstSlideReplica }
          : {}),
        ...(item.homePreviewDeckVisualTheme
          ? {
              homePreviewDeckVisualTheme: item.homePreviewDeckVisualTheme,
            }
          : {}),
      }));

    const cloudOnlyShared: HomePresentationCard[] = cloudSharedSnapshot
      .filter((item) => item.source === "shared")
      .map((item) => ({
        kind: "cloud_only_shared" as const,
        cloudId: item.cloudId,
        ownerUid: item.ownerUid,
        topic: item.topic,
        savedAt: item.savedAt,
        updatedAt: item.updatedAt,
        ...(item.homePreviewImageUrl
          ? { homePreviewImageUrl: item.homePreviewImageUrl }
          : {}),
        ...(item.homeFirstSlideReplica
          ? { homeFirstSlideReplica: item.homeFirstSlideReplica }
          : {}),
        ...(item.homePreviewDeckVisualTheme
          ? {
              homePreviewDeckVisualTheme: item.homePreviewDeckVisualTheme,
            }
          : {}),
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
