import { useEffect, useMemo } from "react";
import * as RiveReact from "@rive-app/react-canvas";
import type { Layout } from "@rive-app/react-canvas";

const { Alignment, Fit, Layout: RiveLayoutClass, useRive } = RiveReact;

const defaultLayout = new RiveLayoutClass({
  fit: Fit.Contain,
  alignment: Alignment.Center,
});

/**
 * Convierte el texto guardado en el slide (nombres separados por coma) al
 * formato `stateMachines` de `useRive` / Rive React.
 */
export function riveStateMachinesFromStoredNames(
  stored: string | undefined,
): string | string[] | undefined {
  if (!stored?.trim()) return undefined;
  const parts = stored.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return parts;
}

const defaultUseRiveOptions = {
  shouldResizeCanvasToContainer: true,
  useOffscreenRenderer: false,
  /**
   * Si queda en true, al salir del viewport el runtime puede parar el render y
   * los listeners de puntero dejan de llegar al canvas (vista previa / overlay).
   */
  shouldUseIntersectionObserver: false,
} as const;

export interface SlideRivePlayerProps {
  src: string;
  /** Artboard por nombre; si falta, Rive usa el default del .riv. */
  artboard?: string;
  /**
   * Nombre(s) de la state machine a instanciar al cargar (recomendado en la doc
   * de Rive React para interacción: https://rive.app/docs/runtimes/react/react ).
   * Si no se pasa, se intentan todas las SM del artboard tras el load.
   */
  stateMachines?: string | string[];
  /** Clases del canvas (contenedor lo controla el padre). */
  className?: string;
  layout?: Layout;
}

/**
 * Rive en slides / presentador: misma config en editor y `SlideCanvasView`.
 */
export function SlideRivePlayer({
  src,
  artboard,
  stateMachines: stateMachinesProp,
  className = "h-full w-full min-h-[80px] bg-transparent touch-manipulation",
  layout = defaultLayout,
}: SlideRivePlayerProps) {
  const artboardTrimmed = artboard?.trim();
  const stateMachinesDep = useMemo(
    () =>
      stateMachinesProp == null
        ? ""
        : typeof stateMachinesProp === "string"
          ? stateMachinesProp
          : stateMachinesProp.join("\0"),
    [stateMachinesProp],
  );

  const { RiveComponent, rive } = useRive(
    {
      src,
      autoplay: true,
      ...(artboardTrimmed ? { artboard: artboardTrimmed } : {}),
      ...(stateMachinesProp != null ? { stateMachines: stateMachinesProp } : {}),
      layout,
      shouldDisableRiveListeners: false,
      enableMultiTouch: true,
      isTouchScrollEnabled: true,
    },
    defaultUseRiveOptions,
  );

  useEffect(() => {
    if (!rive) return;
    let cancelled = false;
    const rafRef = { current: 0 as number };

    const safe = (fn: () => void) => {
      if (cancelled) return;
      try {
        fn();
      } catch {
        /* instancia o WASM ya liberados (desmontaje / cambio de key) */
      }
    };

    // Si el `.riv` tiene animaciones lineales y también state machines, el
    // runtime solo instancia la primera animación (`atLeastOne`). Sin SM en
    // reproducción con listeners, `setupRiveListeners` no registra puntero.
    safe(() => {
      const smNames = rive.stateMachineNames;
      if (smNames.length > 0) {
        rive.play(smNames);
      }
    });

    queueMicrotask(() => {
      if (cancelled) return;
      safe(() => {
        rive.resizeDrawingSurfaceToCanvas();
        rive.resizeToCanvas();
        rive.startRendering();
        rive.setupRiveListeners({ isTouchScrollEnabled: true });
      });
      rafRef.current = requestAnimationFrame(() => {
        safe(() => {
          rive.resizeDrawingSurfaceToCanvas();
          rive.resizeToCanvas();
          rive.setupRiveListeners({ isTouchScrollEnabled: true });
          rive.drawFrame();
        });
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [rive, src, artboardTrimmed, stateMachinesDep]);

  return (
    <RiveComponent
      className={className}
      style={{ backgroundColor: "transparent" }}
      aria-label="Animación Rive"
    />
  );
}
