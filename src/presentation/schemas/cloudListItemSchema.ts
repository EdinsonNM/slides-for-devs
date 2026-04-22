import { z } from "zod";
import type { CloudPresentationListItem } from "../../services/presentationCloud";

/** Validación en el borde para ítems devueltos por listados nube antes de guardar en estado. */
export const cloudPresentationListItemSchema = z
  .object({
    cloudId: z.string(),
    ownerUid: z.string(),
    topic: z.string(),
    savedAt: z.string(),
    updatedAt: z.string().nullable(),
    source: z.enum(["mine", "shared"]),
    homePreviewImageUrl: z.string().optional(),
  })
  .passthrough();

export function parseCloudPresentationListItems(
  raw: unknown[],
): CloudPresentationListItem[] {
  const out: CloudPresentationListItem[] = [];
  for (const item of raw) {
    const r = cloudPresentationListItemSchema.safeParse(item);
    if (r.success) out.push(r.data as CloudPresentationListItem);
    else if (import.meta.env.DEV) {
      console.warn("[cloudList] item inválido omitido", r.error.flatten());
    }
  }
  return out;
}
