/** Claves centralizadas para TanStack Query (presentaciones y datos relacionados). */
export const presentationQueryKeys = {
  savedPresentations: (accountScope: string) =>
    ["savedPresentations", accountScope] as const,
  cloudPresentations: (uid: string) => ["cloudPresentations", uid] as const,
  savedCharacters: (accountScope: string) =>
    ["savedCharacters", accountScope] as const,
  generatedResources: (accountScope: string) =>
    ["generatedResources", accountScope] as const,
};
