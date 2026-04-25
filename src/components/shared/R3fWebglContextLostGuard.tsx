import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/**
 * `webglcontextlost`: con `preventDefault` el spec permite restauración sin matar el proceso.
 * **No** remontamos el `<Canvas>` aquí: al reordenar muchas capas, varios remounts en cadena
 * + drivers que disparan el evento pueden provocar OOM y cierre de la pestaña (“Aw, Snap!”).
 * Tras `webglcontextrestored`, `R3fViewportResizeToHost` vuelve a fijar `setSize` + `invalidate`.
 */
export function R3fWebglContextLostGuard() {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (e: Event) => {
      e.preventDefault();
    };
    canvas.addEventListener("webglcontextlost", onLost, false);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost, false);
    };
  }, [gl]);

  return null;
}
