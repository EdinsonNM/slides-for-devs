/**
 * Pantalla de carga global. Usa tokens de diseño para consistencia.
 */
export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center font-sans">
      <div className="text-stone-500 flex items-center gap-2">
        <span
          className="inline-block size-5 border-2 border-stone-300 border-t-emerald-500 rounded-full animate-spin"
          aria-hidden
        />
        <span>Cargando…</span>
      </div>
    </div>
  );
}
