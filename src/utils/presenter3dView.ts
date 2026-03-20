/**
 * Vista 3D persistida (posición de cámara + punto de mira de OrbitControls).
 */
export interface Presenter3dViewState {
  position: [number, number, number];
  target: [number, number, number];
}

export const DEFAULT_PRESENTER_3D_VIEW: Presenter3dViewState = {
  position: [0, 0, 3.2],
  target: [0, 0, 0],
};

function isTriplet(v: unknown): v is [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function parsePresenter3dViewState(raw: unknown): Presenter3dViewState | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "string") {
    try {
      return parsePresenter3dViewState(JSON.parse(raw) as unknown);
    } catch {
      return undefined;
    }
  }
  if (typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (!isTriplet(o.position) || !isTriplet(o.target)) return undefined;
  return { position: o.position, target: o.target };
}

export function serializePresenter3dViewState(s: Presenter3dViewState): string {
  return JSON.stringify({
    position: s.position,
    target: s.target,
  });
}
