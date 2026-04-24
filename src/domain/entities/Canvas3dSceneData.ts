import type { Presenter3dViewState } from "../../utils/presenter3dView";
import { parsePresenter3dViewState } from "../../utils/presenter3dView";
import type { Canvas3dModelTransform } from "../../utils/canvas3dModelTransform";
import {
  DEFAULT_CANVAS_3D_MODEL_TRANSFORM,
  parseCanvas3dModelTransform,
} from "../../utils/canvas3dModelTransform";

export const CANVAS_3D_SCENE_SCHEMA_VERSION = 1 as const;

export const CANVAS_3D_PRIMITIVE_KINDS = [
  "box",
  "sphere",
  "cylinder",
  "cone",
  "torus",
  "capsule",
] as const;

export type Canvas3dPrimitiveKind = (typeof CANVAS_3D_PRIMITIVE_KINDS)[number];

export type Canvas3dSceneSourceKind = "glb" | "primitive";

function isPrimitiveKind(v: unknown): v is Canvas3dPrimitiveKind {
  return (
    typeof v === "string" &&
    (CANVAS_3D_PRIMITIVE_KINDS as readonly string[]).includes(v)
  );
}

/** Una instancia en la escena 3D del slide (GLB animado o forma básica). */
export interface Canvas3dSceneInstance {
  id: string;
  source: Canvas3dSceneSourceKind;
  /** Cuando `source === "glb"`. */
  glbUrl?: string;
  /** Cuando `source === "primitive"`. */
  primitiveKind?: Canvas3dPrimitiveKind;
  /** Color hex para primitivas (p. ej. `#94a3b8`). */
  primitiveColor?: string;
  characterId?: string;
  displayName?: string;
  modelTransform?: Canvas3dModelTransform;
  /**
   * Solo GLB: clip de animación. Ausente = primera clip; cadena vacía = ninguna.
   */
  animationClipName?: string;
}

export interface Canvas3dSceneData {
  schemaVersion: typeof CANVAS_3D_SCENE_SCHEMA_VERSION;
  instances: Canvas3dSceneInstance[];
  viewState?: Presenter3dViewState;
  selectedInstanceId?: string;
  /**
   * Fondo detrás del lienzo 3D (URL https o `data:`). El canvas WebGL va con alpha;
   * la imagen se pinta en capa inferior (editor y presentador).
   */
  backgroundImageUrl?: string;
}

export function createDefaultCanvas3dSceneData(): Canvas3dSceneData {
  return {
    schemaVersion: CANVAS_3D_SCENE_SCHEMA_VERSION,
    instances: [],
  };
}

function normalizeInstance(raw: unknown): Canvas3dSceneInstance | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;

  const mt =
    parseCanvas3dModelTransform(o.modelTransform) ??
    DEFAULT_CANVAS_3D_MODEL_TRANSFORM;

  const primitiveKind = o.primitiveKind;
  const explicitSource = o.source === "primitive" || o.source === "glb" ? o.source : null;

  if (explicitSource === "primitive" || isPrimitiveKind(primitiveKind)) {
    if (!isPrimitiveKind(primitiveKind)) return null;
    const primitiveColor =
      typeof o.primitiveColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(o.primitiveColor)
        ? o.primitiveColor
        : "#94a3b8";
    return {
      id: o.id.trim(),
      source: "primitive",
      primitiveKind,
      primitiveColor,
      characterId:
        typeof o.characterId === "string" ? o.characterId : undefined,
      displayName:
        typeof o.displayName === "string" ? o.displayName : undefined,
      modelTransform: mt,
    };
  }

  const glbUrl =
    typeof o.glbUrl === "string" && o.glbUrl.trim() ? o.glbUrl.trim() : "";
  if (!glbUrl) return null;

  return {
    id: o.id.trim(),
    source: "glb",
    glbUrl,
    characterId:
      typeof o.characterId === "string" ? o.characterId : undefined,
    displayName:
      typeof o.displayName === "string" ? o.displayName : undefined,
    modelTransform: mt,
    animationClipName:
      typeof o.animationClipName === "string" ? o.animationClipName : undefined,
  };
}

export function parseCanvas3dSceneData(raw: string | undefined | null): Canvas3dSceneData {
  const fallback = createDefaultCanvas3dSceneData();
  if (raw == null || typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return fallback;
    const o = j as Record<string, unknown>;
    if (Number(o.schemaVersion) !== CANVAS_3D_SCENE_SCHEMA_VERSION) return fallback;
    if (!Array.isArray(o.instances)) return fallback;
    const instances = o.instances
      .map(normalizeInstance)
      .filter((x): x is Canvas3dSceneInstance => x != null);
    const viewState = parsePresenter3dViewState(o.viewState);
    const selectedInstanceId =
      typeof o.selectedInstanceId === "string" && o.selectedInstanceId.trim()
        ? o.selectedInstanceId
        : undefined;
    const backgroundImageUrl =
      typeof o.backgroundImageUrl === "string" && o.backgroundImageUrl.trim()
        ? o.backgroundImageUrl.trim()
        : undefined;
    return {
      schemaVersion: CANVAS_3D_SCENE_SCHEMA_VERSION,
      instances,
      ...(viewState ? { viewState } : {}),
      ...(selectedInstanceId ? { selectedInstanceId } : {}),
      ...(backgroundImageUrl ? { backgroundImageUrl } : {}),
    };
  } catch {
    return fallback;
  }
}

export function serializeCanvas3dSceneData(data: Canvas3dSceneData): string {
  return JSON.stringify(data);
}
