import { createContext, useContext } from "react";
import {
  usePresentationState,
  type PresentationState,
} from "@/presentation/hooks/global/usePresentationState";

const PresentationContext = createContext<PresentationState | null>(null);

export function PresentationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = usePresentationState();
  return (
    <PresentationContext.Provider value={state}>
      {children}
    </PresentationContext.Provider>
  );
}

export function usePresentation(): PresentationState {
  const ctx = useContext(PresentationContext);
  if (!ctx) {
    throw new Error("usePresentation must be used within PresentationProvider");
  }
  return ctx;
}

export function usePresentationOptional(): PresentationState | null {
  return useContext(PresentationContext);
}
