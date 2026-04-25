import {
  startTransition,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { cn } from "../../utils/cn";

/**
 * En presentación, el primer commit del `<Canvas>` R3F + parseo GLB puede ocupar el hilo
 * principal y retrasar el primer paint del resto del slide. Este contenedor deja un hueco
 * estable y monta los hijos tras el siguiente repintado, para que texto y layout aparezcan antes.
 */
export function DeferHeavyWebglMount({
  enabled,
  className,
  children,
}: {
  enabled: boolean;
  /** Misma caja que el visor (`h-full`, bordes) para evitar saltos de layout. */
  className?: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      startTransition(() => setReady(true));
      return;
    }
    setReady(false);
    let cancelled = false;
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(() => {
        if (cancelled) return;
        startTransition(() => {
          if (!cancelled) setReady(true);
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
    };
  }, [enabled]);

  if (!ready) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 w-full items-center justify-center rounded-xl bg-stone-200/25 dark:bg-stone-800/40",
          className,
        )}
        aria-busy="true"
        aria-label="Cargando vista 3D"
      />
    );
  }

  return children;
}
