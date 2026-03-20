/**
 * Mensajes legibles para errores de sincronización con Firebase (Firestore/Storage).
 */
export function formatCloudSyncUserMessage(error: unknown): string {
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  if (code === "permission-denied") {
    return (
      "Firebase rechazó la operación (permisos insuficientes). " +
      "Publica las reglas de Firestore y de Storage (mismo contenido que docs/firebase-rules.md; en el repo: firestore.rules y storage.rules). " +
      "Consola: Firestore → Reglas y Storage → Reglas; o CLI: firebase deploy --only firestore:rules,storage (ver docs/firebase-rules.md). " +
      "Si ya las publicaste, comprueba que VITE_FIREBASE_STORAGE_BUCKET y VITE_FIREBASE_PROJECT_ID en .env sean del mismo proyecto."
    );
  }

  if (code === "unauthenticated") {
    return "Sesión no válida. Cierra sesión, vuelve a entrar e inténtalo de nuevo.";
  }

  if (error instanceof Error) return error.message;
  return "Error al sincronizar con la nube.";
}
