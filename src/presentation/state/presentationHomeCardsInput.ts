import type { User } from "firebase/auth";
import type { SavedPresentationMeta } from "../../types";

export type PresentationHomeCardsInput = {
  user: User | null;
  firebaseReady: boolean | null;
  savedList: SavedPresentationMeta[];
};
