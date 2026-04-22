import { isTauriRuntime } from "../services/apiConfig";

/** Abre una URL en el navegador del sistema (Tauri) o en una pestaña nueva (web). */
export async function openExternalLink(url: string): Promise<void> {
  const u = url.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return;

  if (isTauriRuntime()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke<void>("open_external_url", { url: u });
    } catch {
      window.open(u, "_blank", "noopener,noreferrer");
    }
    return;
  }

  window.open(u, "_blank", "noopener,noreferrer");
}
