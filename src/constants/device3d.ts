/**
 * Modelos 3D para el panel "Presentador" (dispositivo + textura en la pantalla del mesh).
 * Los GLB deben vivir en `public/`; la textura se aplica a materiales/meshes cuyo nombre contiene "screen".
 */
export type Device3dId = "iphone";

export interface Device3dDefinition {
  id: Device3dId;
  label: string;
  /** Ruta bajo el origen del sitio (carpeta `public`). */
  glbPublicPath: string;
}

export const DEVICE_3D_CATALOG: Device3dDefinition[] = [
  {
    id: "iphone",
    label: "iPhone",
    glbPublicPath: "/3d models/iphone.glb",
  },
];

export const DEFAULT_DEVICE_3D_ID: Device3dId = "iphone";

/**
 * Escala fija del GLB en el visor (no persistida): el encuadre fino va con órbita/zoom.
 */
export const PRESENTER_3D_GLTF_NORMAL_SCALE = 0.42;

export function resolveDevice3dGlbUrl(deviceId: string | undefined): string {
  const id = (deviceId as Device3dId) || DEFAULT_DEVICE_3D_ID;
  const def = DEVICE_3D_CATALOG.find((d) => d.id === id) ?? DEVICE_3D_CATALOG[0]!;
  return encodeURI(def.glbPublicPath);
}
