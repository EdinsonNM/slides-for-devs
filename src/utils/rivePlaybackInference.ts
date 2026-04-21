/**
 * Lectura de `rive.contents` para decidir artboard + state machines al cargar
 * sin props explícitas (p. ej. Expression Grid del marketplace: artboard Main, SM "Grid").
 */

type RiveContentsArtboard = {
  name: string;
  animations?: unknown[];
  stateMachines?: { name: string }[];
};

function normalizeStateMachineProp(
  prop: string | string[] | null | undefined,
): string[] {
  if (prop == null) return [];
  if (typeof prop === "string") {
    return prop
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return prop.map((s) => s.trim()).filter(Boolean);
}

function readArtboards(contents: unknown): RiveContentsArtboard[] {
  try {
    const raw = contents as { artboards?: RiveContentsArtboard[] } | undefined;
    const abs = raw?.artboards;
    return abs && abs.length > 0 ? abs : [];
  } catch {
    return [];
  }
}

/**
 * Si el slide no fija `artboard`, devuelve parámetros para `rive.reset` que evitan
 * `atLeastOne` con solo animación lineal cuando también hay state machines.
 */
export function inferImplicitRiveAutoplayReset(params: {
  contents: unknown;
  artboardProp?: string;
  stateMachinesProp?: string | string[] | null;
}): { artboard: string; stateMachines: string[] } | null {
  if (params.artboardProp?.trim()) return null;

  const abs = readArtboards(params.contents);
  if (abs.length === 0) return null;

  const userSm = normalizeStateMachineProp(params.stateMachinesProp);
  if (userSm.length > 0) {
    for (const ab of abs) {
      const names = new Set((ab.stateMachines ?? []).map((s) => s.name));
      if (userSm.every((n) => names.has(n))) {
        return { artboard: ab.name, stateMachines: userSm };
      }
    }
    return null;
  }

  const gridAb = abs.find((a) =>
    (a.stateMachines ?? []).some((s) => s.name === "Grid"),
  );
  if (gridAb) {
    return { artboard: gridAb.name, stateMachines: ["Grid"] };
  }

  const mainAb = abs.find((a) => a.name === "Main");
  if (mainAb) {
    const animCount = Array.isArray(mainAb.animations)
      ? mainAb.animations.length
      : 0;
    const sms = (mainAb.stateMachines ?? []).map((s) => s.name);
    if (sms.length > 0 && animCount > 0) {
      return { artboard: "Main", stateMachines: sms };
    }
  }

  for (const ab of abs) {
    const animCount = Array.isArray(ab.animations) ? ab.animations.length : 0;
    const sms = (ab.stateMachines ?? []).map((s) => s.name);
    if (sms.length > 0 && animCount > 0) {
      return { artboard: ab.name, stateMachines: sms };
    }
  }

  return null;
}
