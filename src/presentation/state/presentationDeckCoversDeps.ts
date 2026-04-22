import type { MutableRefObject } from "react";
import type { SavedPresentationMeta } from "../../types";

export type PresentationDeckCoversDeps = {
  savedList: SavedPresentationMeta[];
  localAccountScope: string;
  geminiImageModelId: string;
  user: { uid: string } | null;
  runAutoSyncAfterSaveRef: MutableRefObject<(id: string) => Promise<void>>;
};
