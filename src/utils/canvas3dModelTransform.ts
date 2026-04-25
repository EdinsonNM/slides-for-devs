export interface Canvas3dModelTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  /** Escala en cada eje. Por defecto 1,1,1 (tamaño del GLB o primitiva tras su centrado). */
  scale: [number, number, number];
}

export const DEFAULT_CANVAS_3D_MODEL_TRANSFORM: Canvas3dModelTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};

/** Gizmo (drei) en lienzos 3D: mover, rotar o escalar. */
export type Canvas3dTransformGizmoMode = "translate" | "rotate" | "scale";

function isTriplet(v: unknown): v is [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function parseCanvas3dModelTransform(
  raw: unknown,
): Canvas3dModelTransform | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    try {
      return parseCanvas3dModelTransform(JSON.parse(raw) as unknown);
    } catch {
      return undefined;
    }
  }
  if (typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  if (!isTriplet(obj.position) || !isTriplet(obj.rotation)) return undefined;
  const scale: [number, number, number] = isTriplet(obj.scale)
    ? (obj.scale as [number, number, number])
    : [1, 1, 1];
  return {
    position: obj.position,
    rotation: obj.rotation,
    scale,
  };
}
