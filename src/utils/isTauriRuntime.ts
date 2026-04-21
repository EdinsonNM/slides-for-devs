/** True cuando la app corre dentro del WebView de Tauri (no en el navegador). */
export function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined
  );
}
