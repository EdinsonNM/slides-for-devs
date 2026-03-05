import { check } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";

function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined
  );
}

/**
 * Comprueba si hay una actualización disponible y, si la hay, muestra un diálogo
 * para que el usuario elija actualizar ahora o más tarde.
 * Solo se ejecuta dentro de Tauri (escritorio); en web no hace nada.
 */
export async function checkForAppUpdates(): Promise<void> {
  if (!isTauri()) return;

  try {
    const update = await check();
    if (!update) return;

    const message = [
      `Hay una nueva versión disponible: ${update.version}.`,
      update.body?.trim() ? `\n\nNotas:\n${update.body}` : "",
    ].join("");

    const yes = await ask(message, {
      title: "Actualización disponible",
      kind: "info",
      okLabel: "Actualizar ahora",
      cancelLabel: "Más tarde",
    });

    if (yes) {
      await update.downloadAndInstall();
      await relaunch();
    }
  } catch (err) {
    console.warn("Error al comprobar actualizaciones:", err);
  }
}
