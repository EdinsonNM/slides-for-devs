import { useEffect, useMemo } from "react";
import * as RiveReact from "@rive-app/react-webgl2";
import type { Layout } from "@rive-app/react-webgl2";
import { inferImplicitRiveAutoplayReset } from "../../utils/rivePlaybackInference";

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
  /**
   * WebGL offscreen puede afectar alineación puntero↔artboard en layouts complejos;
   * un canvas WebGL por instancia evita sorpresas en el editor de slides.
   */
  useOffscreenRenderer: false,
  /**
   * Si fuera true, al salir del viewport el runtime puede parar el render y los
   * listeners de puntero dejan de llegar al canvas (vista previa / overlay).
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
      dispatchPointerExit: true,
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

    const resolveStateMachinesToPlay = (): string[] => {
      const all = rive.stateMachineNames;
      if (stateMachinesProp == null) {
        return [...all];
      }
      const wanted =
        typeof stateMachinesProp === "string"
          ? [stateMachinesProp]
          : [...stateMachinesProp];
      const ok = wanted.map((s) => s.trim()).filter((n) => n && all.includes(n));
      return ok.length > 0 ? ok : [...all];
    };

    safe(() => {
      rive.resizeDrawingSurfaceToCanvas();
      rive.resizeToCanvas();
    });

    let contents: unknown;
    safe(() => {
      contents = rive.contents;
    });

    const implicit = inferImplicitRiveAutoplayReset({
      contents,
      artboardProp: artboardTrimmed,
      stateMachinesProp: stateMachinesProp ?? null,
    });

    /*
     * `rive.reset` con SM explícitas evita `atLeastOne` solo con animación lineal.
     * Tras `reset` el runtime no vuelve a llamar a `setupRiveListeners` como en el
     * primer load; hay que registrar puntero aquí.
     */
    safe(() => {
      if (implicit) {
        rive.reset({
          artboard: implicit.artboard,
          stateMachines: implicit.stateMachines,
          autoplay: true,
        });
        rive.resizeDrawingSurfaceToCanvas();
        rive.resizeToCanvas();
        rive.setupRiveListeners({ isTouchScrollEnabled: true });
        rive.startRendering();
        rive.drawFrame();
        return;
      }

      /*
       * Sin `animations`/`stateMachines` en el constructor, Rive usa `atLeastOne`:
       * si hay animación lineal, instancia esa y puede ignorar las SM. Las
       * interacciones en canvas solo enlazan SM en reproducción con Listeners.
       * `rive.play` ya llama a `setupRiveListeners` en el runtime.
       */
      const smPlay = resolveStateMachinesToPlay();
      if (smPlay.length > 0) {
        const linear = [...rive.animationNames];
        if (linear.length > 0) {
          rive.stop(linear);
        }
        rive.play(smPlay);
      } else {
        rive.startRendering();
        rive.setupRiveListeners({ isTouchScrollEnabled: true });
      }
    });

    rafRef.current = requestAnimationFrame(() => {
      safe(() => {
        rive.resizeDrawingSurfaceToCanvas();
        rive.resizeToCanvas();
        rive.drawFrame();
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [rive, src, artboardTrimmed, stateMachinesDep, stateMachinesProp]);

  return (
    <RiveComponent
      className={className}
      style={{ backgroundColor: "transparent" }}
      aria-label="Animación Rive"
    />
  );
}
