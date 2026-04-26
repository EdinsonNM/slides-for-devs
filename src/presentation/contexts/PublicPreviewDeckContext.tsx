import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PulledPresentation } from "../../services/presentationCloud";

export type PublicPreviewDeckContextValue = {
  deck: PulledPresentation | null;
  registerDeck: (d: PulledPresentation) => void;
  isPreviewOpen: boolean;
  previewIndex: number;
  setPreviewIndex: React.Dispatch<React.SetStateAction<number>>;
  openPreview: (startIndex: number) => void;
  closePreview: () => void;
};

const PublicPreviewDeckContext = createContext<PublicPreviewDeckContextValue | null>(
  null,
);

export function PublicPreviewDeckProvider({ children }: { children: ReactNode }) {
  const [deck, setDeck] = useState<PulledPresentation | null>(null);
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const registerDeck = useCallback((d: PulledPresentation) => {
    setDeck(d);
  }, []);

  const openPreview = useCallback((startIndex: number) => {
    setPreviewIndex(startIndex);
    setPreviewOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  const value = useMemo<PublicPreviewDeckContextValue>(
    () => ({
      deck,
      registerDeck,
      isPreviewOpen,
      previewIndex,
      setPreviewIndex,
      openPreview,
      closePreview,
    }),
    [deck, isPreviewOpen, previewIndex, registerDeck, openPreview, closePreview],
  );

  return (
    <PublicPreviewDeckContext.Provider value={value}>
      {children}
    </PublicPreviewDeckContext.Provider>
  );
}

export function usePublicPreviewDeck(): PublicPreviewDeckContextValue {
  const c = useContext(PublicPreviewDeckContext);
  if (!c) {
    throw new Error("usePublicPreviewDeck debe usarse dentro de PublicPreviewDeckProvider");
  }
  return c;
}

export function usePublicPreviewDeckOptional(): PublicPreviewDeckContextValue | null {
  return useContext(PublicPreviewDeckContext);
}
