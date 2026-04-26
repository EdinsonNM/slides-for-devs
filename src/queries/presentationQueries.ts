import { useQuery, useMutation } from "@tanstack/react-query";
import {
  listPresentations,
  loadPresentation,
  listCharacters,
  listGeneratedResources,
} from "../services/storage";
import { listCloudPresentations } from "../services/presentationCloud";
import { presentationQueryKeys } from "@/presentation/queryKeys";

export function useSavedPresentations(accountScope: string) {
  return useQuery({
    queryKey: presentationQueryKeys.savedPresentations(accountScope),
    queryFn: () => listPresentations(accountScope),
  });
}

export function useSavedCharacters(accountScope: string) {
  return useQuery({
    queryKey: presentationQueryKeys.savedCharacters(accountScope),
    queryFn: () => listCharacters(accountScope),
  });
}

export function useGeneratedResourcesList(accountScope: string) {
  return useQuery({
    queryKey: presentationQueryKeys.generatedResources(accountScope),
    queryFn: () => listGeneratedResources(accountScope),
  });
}

export function useCloudPresentations(uid?: string) {
  return useQuery({
    queryKey: presentationQueryKeys.cloudPresentations(uid ?? ""),
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
