import { useQuery, useMutation } from "@tanstack/react-query";
import {
  listPresentations,
  loadPresentation,
} from "../services/storage";
import { listCloudPresentations } from "../services/presentationCloud";

export function useSavedPresentations(accountScope: string) {
  return useQuery({
    queryKey: ["savedPresentations", accountScope],
    queryFn: () => listPresentations(accountScope),
  });
}

export function useCloudPresentations(uid?: string) {
  return useQuery({
    queryKey: ["cloudPresentations", uid],
    queryFn: () => listCloudPresentations(uid!),
    enabled: !!uid,
  });
}

export function useLoadPresentation() {
  return useMutation({
    mutationFn: ({ id, accountScope }: { id: string; accountScope: string }) => 
      loadPresentation(id, accountScope),
  });
}

// Just scaffolded, actual implementations will wrap the existing tauri IPCs or cloud calls.
