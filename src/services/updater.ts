import { getVersion } from "@tauri-apps/api/app";
import { check } from "@tauri-apps/plugin-updater";
import { ask, message as showMessage } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined
  );
}

async function getAppVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "?";
  }
}

export type UpdateCheckResult =
  | { status: "update-available" }
  | { status: "no-update" }
  | { status: "error"; error: string };

/**
 * Comprueba si hay una actualizaci?n disponible y, si la hay, muestra un di?logo
 * para que el usuario elija actualizar ahora o m?s tarde.
 * Solo se ejecuta dentro de Tauri (escritorio); en web no hace nada.
 * @param silent Si true, no muestra di?logos de "ya actualizado" ni "error"; solo el de "actualizaci?n disponible".
 */
export async function checkForAppUpdates(
  silent = true
): Promise<UpdateCheckResult> {
  if (!isTauri()) {
    if (!silent) {
      if (typeof window !== "undefined" && window.alert) {
        window.alert(
          "Buscar actualizaciones solo funciona en la app de escritorio (el .exe de Windows).\n\n" +
            "Si abriste Slaim desde el navegador o desde ?Instalar? en Chrome, esa es la versi?n web. " +
            "Descarga el instalador desde GitHub ? Releases y ejecuta el .exe para usar la app de escritorio."
        );
      }
    }
    return { status: "no-update" };
  }

  const currentVersion = await getAppVersion();
  console.log("[Updater] Versi?n actual:", currentVersion);

  try {
    const update = await check();
    if (!update) {
      console.log("[Updater] No hay actualizaci?n disponible.");
      if (!silent) {
        await showMessage(
          `Ya tienes la ?ltima versi?n instalada (v${currentVersion}).`,
          { title: "Actualizaciones", kind: "info" }
        );
      }
      return { status: "no-update" };
    }

    const text = [
      `Hay una nueva versi?n disponible: ${update.version}.`,
      update.body?.trim() ? `\n\nNotas:\n${update.body}` : "",
    ].join("");

    const yes = await ask(text, {
      title: "Actualizaci?n disponible",
      kind: "info",
      okLabel: "Actualizar ahora",
      cancelLabel: "M?s tarde",
    });

    if (yes) {
      await update.downloadAndInstall();
      await relaunch();
    }
    return { status: "update-available" };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);
    console.warn("[Updater] Error al comprobar actualizaciones:", err);
    if (!silent) {
      await showMessage(
        `No se pudo comprobar actualizaciones.\n\nVersi?n actual: v${currentVersion}\n\n${errorMessage}`,
        { title: "Actualizaciones", kind: "error" }
      );
    }
    return { status: "error", error: errorMessage };
  }
}
