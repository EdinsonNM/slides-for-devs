/** En web (sin SQLite): presentación abierta desde la nube, guardado solo vía push. */
export type WebCloudEditSession = {
  ownerUid: string;
  cloudId: string;
  cloudRevision: number;
};
