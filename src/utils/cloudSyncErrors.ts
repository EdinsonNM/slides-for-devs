/**
 * Mensajes legibles para errores de sincronización con Firebase (Firestore/Storage).
 */

function firebaseErrorCode(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return "";
}

/**
 * Mensaje para el listado «Compartidas conmigo»; si hay permission-denied, añade el projectId
 * efectivo de la app para descartar desajuste con la consola (.env / firebase_config).
 */
export function formatCloudSharedListError(
  error: unknown,
  firebaseProjectId?: string | null
): string {
  const base = formatCloudSyncUserMessage(error);
  if (firebaseErrorCode(error) !== "permission-denied") return base;
  const idHint = firebaseProjectId?.trim()
    ? ` Esta app está usando el proyecto Firebase «${firebaseProjectId.trim()}»; en la consola, ese mismo ID debe tener las reglas publicadas.`
    : "";
  return base + idHint;
}

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

  if (code === "failed-precondition") {
    return (
      "Falta un índice de Firestore para completar la consulta de compartidas. " +
      "Abre el enlace que aparece en la consola del navegador (Create index), créalo y vuelve a intentar."
    );
  }

  if (error instanceof Error) return error.message;
  return "Error al sincronizar con la nube.";
}
