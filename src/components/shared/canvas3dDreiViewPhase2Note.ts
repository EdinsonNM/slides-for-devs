/**
 * Fase 2 (arquitectura, no implementada): varios visores 3D en un slide comparten hoy un
 * `<Canvas>` R3F por `mediaPanel`. Un único `Canvas` a nivel de contenedor/overlay y subs
 * `View` de `@react-three/drei` anclados a refs de cada host DOM permitiría un solo
 * contexto WebGL, recorte por rect y menos fricción con el orden z CSS. Ver documentación
 * de drei 10+ para `View` y multi-viewport.
 */
export {};
