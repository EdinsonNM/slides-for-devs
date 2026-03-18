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
      "Publica en la consola las reglas de Firestore y de Storage descritas en docs/firebase-rules.md " +
      "(ambas: usuarios solo en users/{suId}/presentations/...). " +
      "Si ya las publicaste, revisa que el bucket de Storage en .env (VITE_FIREBASE_STORAGE_BUCKET) sea el del proyecto."
    );
  }

  if (code === "unauthenticated") {
    return "Sesión no válida. Cierra sesión, vuelve a entrar e inténtalo de nuevo.";
  }

  if (error instanceof Error) return error.message;
  return "Error al sincronizar con la nube.";
}
