import { useEffect, useState } from "react";
import { useRive } from "@rive-app/react-webgl2";
import { Alignment, Fit, Layout } from "@rive-app/react-webgl2";

const layout = new Layout({
  fit: Fit.Contain,
  alignment: Alignment.Center,
});

const useRiveOpts = {
  shouldResizeCanvasToContainer: true,
  useOffscreenRenderer: false,
  shouldUseIntersectionObserver: false,
} as const;

type DiscoveredArtboard = {
  name: string;
  animations: string[];
  stateMachines: {
    name: string;
    inputs: { name: string; type: string | number }[];
  }[];
};

/**
 * Carga el mismo `src` en una instancia oculta y muestra nombres reales del .riv
 * (`rive.contents`: artboards, state machines, inputs). Así no hace falta adivinar
 * desde la web del marketplace (suelen mostrar View Model / data binding).
 */
export function RiveInspectorDiscoveredHints({
  src,
  onUseArtboardAndStateMachine,
}: {
  src: string | undefined;
  onUseArtboardAndStateMachine: (artboard: string, stateMachine: string) => void;
}) {
  const [boards, setBoards] = useState<DiscoveredArtboard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { RiveComponent, rive } = useRive(
    src?.trim()
      ? {
          src: src.trim(),
          autoplay: false,
          layout,
          shouldDisableRiveListeners: true,
        }
      : null,
    useRiveOpts,
  );

  useEffect(() => {
    if (!rive) {
      setBoards(null);
      setError(null);
      return;
    }
    try {
      const raw = rive.contents as
        | { artboards?: DiscoveredArtboard[] }
        | undefined;
      const abs = raw?.artboards;
      setBoards(abs && abs.length > 0 ? abs : []);
      setError(null);
    } catch {
      setBoards(null);
      setError("No se pudo leer el índice del archivo.");
    }
  }, [rive]);

  if (!src?.trim()) return null;

  return (
    <div className="space-y-2">
      <div
        className="pointer-events-none fixed -left-[9999px] top-0 -z-10 h-24 w-24 overflow-hidden opacity-0"
        aria-hidden
      >
        <RiveComponent className="h-full w-full" />
      </div>

      <div className="rounded-lg border border-stone-200/80 bg-stone-50/80 px-2.5 py-2 dark:border-border dark:bg-white/5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">
          Detectado en el .riv
        </p>
        <p className="mt-1 text-[10px] leading-snug text-stone-500 dark:text-stone-500">
          Los nombres salen del archivo al cargarlo (no de la página del
          marketplace). Si no ves hover o clic en el lienzo, en Rive Editor la
          interacción va con componentes <span className="font-medium">Listener</span>{" "}
          en la state machine; sin listeners el runtime no enlaza puntero al canvas.
          En el lienzo, si el .riv incluye una SM llamada{" "}
          <span className="font-mono">Grid</span> (p. ej. Expression Grid), el
          reproductor intenta ese artboard y esa SM automáticamente.
        </p>
        {error ? (
          <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
            {error}
          </p>
        ) : boards === null ? (
          <p className="mt-2 text-[11px] text-stone-500 dark:text-stone-400">
            Leyendo archivo…
          </p>
        ) : boards.length === 0 ? (
          <p className="mt-2 text-[11px] text-stone-500 dark:text-stone-400">
            Sin artboards en el índice.
          </p>
        ) : (
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-[11px]">
            {boards.map((ab) => (
              <li
                key={ab.name}
                className="rounded border border-stone-200/60 bg-white/90 px-2 py-1.5 dark:border-border dark:bg-surface"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11px] font-medium text-stone-800 dark:text-stone-200">
                    {ab.name}
                  </span>
                  <span className="text-stone-400 dark:text-stone-500">·</span>
                  <span className="text-stone-500 dark:text-stone-400">
                    artboard
                  </span>
                </div>
                {ab.stateMachines.length > 0 ? (
                  <ul className="mt-1.5 space-y-1 border-t border-stone-100 pt-1.5 dark:border-border">
                    {ab.stateMachines.map((sm) => (
                      <li key={`${ab.name}-${sm.name}`} className="pl-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] text-rose-700 dark:text-rose-300">
                            {sm.name}
                          </span>
                          <button
                            type="button"
                            className="pointer-events-auto rounded border border-stone-200 px-1.5 py-0.5 text-[9px] font-medium text-stone-600 hover:bg-stone-100 dark:border-border dark:text-stone-300 dark:hover:bg-white/10"
                            onClick={() =>
                              onUseArtboardAndStateMachine(ab.name, sm.name)
                            }
                          >
                            Fijar este artboard y SM
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[10px] text-stone-400">
                    Sin state machines en este artboard.
                  </p>
                )}
                {ab.animations.length > 0 ? (
                  <p className="mt-1 border-t border-stone-100 pt-1 text-[9px] text-stone-400 dark:border-border dark:text-stone-500">
                    Animaciones lineales:{" "}
                    <span className="font-mono text-stone-600 dark:text-stone-400">
                      {ab.animations.join(", ")}
                    </span>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
