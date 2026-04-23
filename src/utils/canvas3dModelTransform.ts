export interface Canvas3dModelTransform {
  position: [number, number, number];
  rotation: [number, number, number];
}

export const DEFAULT_CANVAS_3D_MODEL_TRANSFORM: Canvas3dModelTransform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
};

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
  return {
    position: obj.position,
    rotation: obj.rotation,
  };
}
