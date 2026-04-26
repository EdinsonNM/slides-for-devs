import { useAuth } from "../../context/AuthContext";
import { usePresentation } from "../../context/PresentationContext";
import { GeneratingPresentationModal } from "../../components/modals/GeneratingPresentationModal";
import { SharePresentationModal } from "../../components/modals/SharePresentationModal";
import { CloudSyncConflictModal } from "../../components/modals/CloudSyncConflictModal";
import { DeletePresentationModal } from "../../components/modals/DeletePresentationModal";

export function GlobalPresentationModals() {
  const { user } = useAuth();
  const {
    pendingGeneration,
    sharePresentationLocalId,
    closeSharePresentationModal,
    savedList,
    deletePresentationTarget,
    closeDeletePresentationModal,
    confirmDeletePresentationEverywhere,
    cloudSyncConflict,
    dismissCloudSyncConflict,
    resolveCloudConflictUseRemote,
    resolveCloudConflictForceLocal,
  } = usePresentation();

  const shareMeta =
    sharePresentationLocalId != null
      ? savedList.find((p) => p.id === sharePresentationLocalId)
      : undefined;

  return (
    <>
      <GeneratingPresentationModal isOpen={pendingGeneration !== null} />
      <SharePresentationModal
        open={
          sharePresentationLocalId !== null &&
          !!shareMeta?.cloudId &&
          !!user
        }
        onClose={closeSharePresentationModal}
        ownerUid={user?.uid ?? ""}
        cloudId={shareMeta?.cloudId ?? ""}
        topic={shareMeta?.topic ?? ""}
      />
      <CloudSyncConflictModal
        open={cloudSyncConflict !== null}
        expectedRevision={cloudSyncConflict?.expectedRevision ?? 0}
        remoteRevision={cloudSyncConflict?.remoteRevision ?? 0}
        localSlideCount={cloudSyncConflict?.localSlideCount}
        remoteSlideCount={cloudSyncConflict?.remoteSlideCount}
        onDismiss={dismissCloudSyncConflict}
        onUseRemote={resolveCloudConflictUseRemote}
        onForceLocal={resolveCloudConflictForceLocal}
      />
      <DeletePresentationModal
        open={deletePresentationTarget !== null}
        meta={deletePresentationTarget}
        onClose={closeDeletePresentationModal}
        onDeleteEverywhere={confirmDeletePresentationEverywhere}
      />
    </>
  );
}
