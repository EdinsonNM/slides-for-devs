import {
  listCloudPresentations,
  listCloudPresentationsSharedWithMe,
} from "../../services/presentationCloud";
import type { CloudPresentationListItem } from "../../services/presentationCloud";
import { parseCloudPresentationListItems } from "../schemas/cloudListItemSchema";

export type CloudPresentationSnapshotsResult = {
  mine: CloudPresentationListItem[];
  shared: CloudPresentationListItem[];
  /** Si el listado compartido falla, se devuelve el error para mensajes de UI. */
  sharedListError: unknown | null;
};

/** Listados nube para home (Mías + compartidas conmigo), con validación en el borde. */
export async function fetchCloudPresentationSnapshots(
  uid: string,
): Promise<CloudPresentationSnapshotsResult> {
  let mine: CloudPresentationListItem[] = [];
  try {
    const raw = await listCloudPresentations(uid);
    mine = parseCloudPresentationListItems(raw as unknown[]);
  } catch {
    mine = [];
  }
  let shared: CloudPresentationListItem[] = [];
  let sharedListError: unknown | null = null;
  try {
    const rawShared = await listCloudPresentationsSharedWithMe(uid);
    shared = parseCloudPresentationListItems(rawShared as unknown[]);
  } catch (e) {
    shared = [];
    sharedListError = e;
  }
  return { mine, shared, sharedListError };
}
