import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
} from "react";
import {
  Box,
  Image as ImageIcon,
  Layers,
  Maximize2,
  Move,
  RotateCw,
  Sparkles,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import {
  CANVAS_3D_PRIMITIVE_KINDS,
  type Canvas3dPrimitiveKind,
  type Canvas3dSceneData,
  type Canvas3dSceneInstance,
} from "../../domain/entities/Canvas3dSceneData";
import type { GeneratedResourceEntry, SavedCharacter } from "../../types";
import { dispatchCanvas3dTransformMode } from "../../utils/canvas3dEditorBridge";
import { DEFAULT_CANVAS_3D_MODEL_TRANSFORM } from "../../utils/canvas3dModelTransform";
import { cn } from "../../utils/cn";
import { Scene3dPrimitivePreview } from "./Scene3dPrimitivePreviews";
import {
  fetchPublicModelsCatalog,
  type PublicModelsCatalogEntry,
} from "../../services/publicModelsCatalog";

const AUTO_ANIM_VALUE = "__canvas3d_scene_anim_auto__";
const NONE_ANIM_VALUE = "__canvas3d_scene_anim_none__";

const PRIMITIVE_LABELS: Record<Canvas3dPrimitiveKind, string> = {
  box: "Caja",
  sphere: "Esfera",
  cylinder: "Cilindro",
  cone: "Cono",
  torus: "Toro",
  capsule: "Cápsula",
};

export interface Scene3dEditorCoreProps {
  scene: Canvas3dSceneData;
  onPersist: (next: Canvas3dSceneData) => void;
  savedCharacters: SavedCharacter[];
  generatedResources: GeneratedResourceEntry[];
  /** Clases extra del contenedor scroll (p. ej. padding en panel Diapositiva). */
  scrollClassName?: string;
}

/**
 * Formulario de edición de escena 3D (formas, catálogo, GLB, lista, animación).
 * Reutilizable en la pestaña «Escena 3D» y en el panel Diapositiva.
 */
export function Scene3dEditorCore({
  scene,
  onPersist,
  savedCharacters,
  generatedResources,
  scrollClassName,
}: Scene3dEditorCoreProps) {
  const [clipNamesById, setClipNamesById] = useState<Record<string, string[]>>(
    {},
  );
  const [publicModels, setPublicModels] = useState<PublicModelsCatalogEntry[]>(
    [],
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const { patchCurrentSlideCanvas3dScene, currentSlide, setShowImageModal } =
    usePresentation();
  const [bgUrlDraft, setBgUrlDraft] = useState(() =>
    scene.backgroundImageUrl?.trim() ?? "",
  );

  useEffect(() => {
    setBgUrlDraft(scene.backgroundImageUrl?.trim() ?? "");
  }, [scene.backgroundImageUrl]);

  useEffect(() => {
    void fetchPublicModelsCatalog().then(setPublicModels);
  }, []);

  useEffect(() => {
    const onNames = (ev: Event) => {
      const e = ev as CustomEvent<Record<string, string[]>>;
      if (e.detail && typeof e.detail === "object") {
        setClipNamesById(e.detail);
      }
    };
    window.addEventListener("slide:canvas3dSceneClipNames", onNames as EventListener);
    return () =>
      window.removeEventListener(
        "slide:canvas3dSceneClipNames",
        onNames as EventListener,
      );
  }, []);

  const persist = useCallback(
    (next: Canvas3dSceneData) => {
      onPersist(next);
    },
    [onPersist],
  );

  const models3d = useMemo(
    () => generatedResources.filter((r) => r.kind === "model3d"),
    [generatedResources],
  );
  const selectedId = scene.selectedInstanceId;
  const selected = scene.instances.find((i) => i.id === selectedId);

  const addInstanceOffset = (n: number) => {
    const offset = (n - Math.floor(n / 3) * 3) * 1.25 - 1.25;
    const depth = Math.floor(n / 3) * -0.35;
    return {
      position: [offset, 0, depth] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
    };
  };

  const addPrimitive = (kind: Canvas3dPrimitiveKind) => {
    const n = scene.instances.length;
    const { position, rotation } = addInstanceOffset(n);
    const inst: Canvas3dSceneInstance = {
      id: crypto.randomUUID(),
      source: "primitive",
      primitiveKind: kind,
      primitiveColor: "#64748b",
      displayName: PRIMITIVE_LABELS[kind],
      modelTransform: {
        ...DEFAULT_CANVAS_3D_MODEL_TRANSFORM,
        position,
        rotation,
      },
    };
    persist({
      ...scene,
      instances: [...scene.instances, inst],
      selectedInstanceId: inst.id,
      viewState: undefined,
    });
  };

  const addInstanceFromGlb = (
    glbUrl: string,
    meta?: { characterId?: string; displayName?: string },
  ) => {
    const trimmed = glbUrl.trim();
    if (!trimmed) return;
    const n = scene.instances.length;
    const { position, rotation } = addInstanceOffset(n);
    const inst: Canvas3dSceneInstance = {
      id: crypto.randomUUID(),
      source: "glb",
      glbUrl: trimmed,
      characterId: meta?.characterId,
      displayName: meta?.displayName,
      modelTransform: {
        ...DEFAULT_CANVAS_3D_MODEL_TRANSFORM,
        position,
        rotation,
      },
    };
    persist({
      ...scene,
      instances: [...scene.instances, inst],
      selectedInstanceId: inst.id,
      viewState: undefined,
    });
  };

  const setSelected = (id: string | undefined) => {
    persist({ ...scene, selectedInstanceId: id });
  };

  const removeInstance = (id: string) => {
    const nextInstances = scene.instances.filter((i) => i.id !== id);
    const nextSel =
      scene.selectedInstanceId === id
        ? nextInstances[0]?.id
        : scene.selectedInstanceId;
    persist({
      ...scene,
      instances: nextInstances,
      selectedInstanceId: nextSel,
    });
  };

  const patchSelected = (patch: Partial<Canvas3dSceneInstance>) => {
    if (!selectedId) return;
    persist({
      ...scene,
      instances: scene.instances.map((i) =>
        i.id === selectedId ? { ...i, ...patch } : i,
      ),
    });
  };

  const onPickBackgroundImage: ChangeEventHandler<HTMLInputElement> = (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f || !f.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      if (url) {
        patchCurrentSlideCanvas3dScene((d) => ({
          ...d,
          backgroundImageUrl: url,
        }));
      }
    };
    reader.readAsDataURL(f);
  };

  const onPickLocalGlb: ChangeEventHandler<HTMLInputElement> = (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f || !f.name.toLowerCase().endsWith(".glb")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      if (url) addInstanceFromGlb(url, { displayName: f.name });
    };
    reader.readAsDataURL(f);
  };

  const clipOptions =
    selected?.source === "glb" && selectedId
      ? clipNamesById[selectedId] ?? []
      : [];
  const animSelectValue =
    selected?.animationClipName === ""
      ? NONE_ANIM_VALUE
      : selected?.animationClipName ?? AUTO_ANIM_VALUE;

  const instanceLabel = (inst: Canvas3dSceneInstance) =>
    inst.displayName?.trim() ||
    inst.characterId ||
    (inst.source === "primitive" && inst.primitiveKind
      ? PRIMITIVE_LABELS[inst.primitiveKind]
      : "") ||
    inst.glbUrl?.slice(0, 28) ||
    "Objeto";

  return (
    <div
      className={cn(
        "min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3",
        scrollClassName,
      )}
    >
      {/* 1. Outliner (árbol de la escena) */}
      <div className="overflow-hidden rounded-md border border-stone-300/70 bg-stone-100/90 shadow-inner dark:border-zinc-700/90 dark:bg-zinc-950/55">
        <div className="flex items-center gap-1.5 border-b border-stone-300/60 bg-stone-200/50 px-2 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wide text-stone-600 dark:border-zinc-700/80 dark:bg-zinc-900/60 dark:text-zinc-400">
          <Layers className="size-3.5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
          Escena
        </div>
        <ul className="max-h-44 space-y-px overflow-y-auto py-1.5 pl-1 pr-1">
          {scene.instances.length === 0 ? (
            <li className="px-2 py-2 text-[10px] leading-snug text-stone-500 dark:text-zinc-500">
              No hay objetos. Añade una primitiva o un modelo (sección inferior).
            </li>
          ) : (
            scene.instances.map((inst) => {
              const active = inst.id === selectedId;
              return (
                <li
                  key={inst.id}
                  className={cn(
                    "flex min-h-0 items-stretch gap-0.5 rounded-sm border-l-2 pl-1",
                    active
                      ? "border-l-emerald-500 bg-emerald-50/90 dark:border-emerald-500 dark:bg-emerald-950/25"
                      : "border-l-transparent bg-transparent hover:bg-stone-200/50 dark:hover:bg-zinc-800/50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(inst.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 pl-0.5 pr-0.5 text-left"
                  >
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded border border-stone-300/60 bg-stone-50/90 dark:border-zinc-600 dark:bg-zinc-900/60"
                      aria-hidden
                    >
                      {inst.source === "primitive" && inst.primitiveKind ? (
                        <span className="size-4">
                          <Scene3dPrimitivePreview kind={inst.primitiveKind} />
                        </span>
                      ) : (
                        <Box
                          className="size-3.5 text-amber-600/90 dark:text-amber-400/90"
                          strokeWidth={1.75}
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-stone-800 dark:text-zinc-200">
                      {instanceLabel(inst)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 self-center rounded p-1 text-stone-500 transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                    title="Quitar de la escena"
                    onClick={() => removeInstance(inst.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* 2. Propiedades del objeto activo */}
      {selected ? (
        <div className="space-y-2.5 rounded-lg border border-stone-200/90 bg-stone-50/40 p-2.5 dark:border-border dark:bg-white/5">
          <p className="font-mono text-[10px] font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">
            Objeto activo
          </p>
          <div>
            <p className="mb-1 text-[9px] font-medium uppercase text-stone-500 dark:text-stone-500">
              Gizmo
            </p>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => dispatchCanvas3dTransformMode("translate")}
                className="inline-flex flex-col items-center justify-center gap-0.5 rounded border border-stone-200/90 bg-white py-1.5 text-[10px] font-medium text-stone-700 hover:border-emerald-400 hover:bg-emerald-50/80 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/50"
                title="Mover (arrastra el gizmo o el propio cuerpo)"
              >
                <Move className="size-3.5" strokeWidth={2} />
                <span className="text-[9px] leading-none">Mover</span>
              </button>
              <button
                type="button"
                onClick={() => dispatchCanvas3dTransformMode("rotate")}
                className="inline-flex flex-col items-center justify-center gap-0.5 rounded border border-stone-200/90 bg-white py-1.5 text-[10px] font-medium text-stone-700 hover:border-emerald-400 hover:bg-emerald-50/80 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/50"
                title="Girar"
              >
                <RotateCw className="size-3.5" strokeWidth={2} />
                <span className="text-[9px] leading-none">Girar</span>
              </button>
              <button
                type="button"
                onClick={() => dispatchCanvas3dTransformMode("scale")}
                className="inline-flex flex-col items-center justify-center gap-0.5 rounded border border-stone-200/90 bg-white py-1.5 text-[10px] font-medium text-stone-700 hover:border-emerald-400 hover:bg-emerald-50/80 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/50"
                title="Escalar"
              >
                <Maximize2 className="size-3.5" strokeWidth={2} />
                <span className="text-[9px] leading-none">Escalar</span>
              </button>
            </div>
            <p className="mt-1.5 text-[9px] leading-snug text-stone-500 dark:text-stone-500">
              Clic en el vacío: deseleccionar. Arrastre en vacío: orbitar cámara.
            </p>
          </div>

          {selected.source === "primitive" ? (
            <label className="block text-[10px] text-stone-500 dark:text-stone-400">
              Color (hex)
              <input
                type="text"
                className="mt-0.5 w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 font-mono text-xs dark:border-border dark:bg-surface"
                value={selected.primitiveColor ?? "#64748b"}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  patchSelected({ primitiveColor: v || "#64748b" });
                }}
              />
            </label>
          ) : (
            <label className="block text-[10px] text-stone-500 dark:text-stone-400">
              Animación (GLB)
              <select
                className="mt-0.5 w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs dark:border-border dark:bg-surface"
                value={animSelectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === AUTO_ANIM_VALUE) {
                    patchSelected({ animationClipName: undefined });
                  } else if (v === NONE_ANIM_VALUE) {
                    patchSelected({ animationClipName: "" });
                  } else {
                    patchSelected({ animationClipName: v });
                  }
                }}
              >
                <option value={AUTO_ANIM_VALUE}>Primera del GLB</option>
                <option value={NONE_ANIM_VALUE}>Ninguna</option>
                {clipOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            className="w-full rounded-md border border-stone-200 px-2 py-1.5 text-xs font-medium hover:bg-stone-100/80 dark:border-border dark:hover:bg-white/5"
            onClick={() => persist({ ...scene, viewState: undefined })}
          >
            Restablecer cámara
          </button>

          <div className="grid grid-cols-3 gap-1 text-[10px]">
            {(["x", "y", "z"] as const).map((axis, idx) => (
              <label key={axis} className="flex flex-col text-stone-500 dark:text-stone-400">
                Pos {axis}
                <input
                  type="number"
                  step={0.1}
                  className="mt-0.5 rounded border border-stone-200 bg-white px-1 py-0.5 text-[11px] dark:border-border dark:bg-surface"
                  value={
                    (selected.modelTransform ?? DEFAULT_CANVAS_3D_MODEL_TRANSFORM)
                      .position[idx] ?? 0
                  }
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v)) return;
                    const base =
                      selected.modelTransform ?? DEFAULT_CANVAS_3D_MODEL_TRANSFORM;
                    const pos: [number, number, number] = [
                      base.position[0],
                      base.position[1],
                      base.position[2],
                    ];
                    pos[idx] = v;
                    patchSelected({
                      modelTransform: { ...base, position: pos },
                    });
                  }}
                />
              </label>
            ))}
          </div>

          <p className="text-[10px] font-medium text-stone-500 dark:text-stone-400">
            Escala (por eje)
          </p>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            {(["x", "y", "z"] as const).map((axis, idx) => (
              <label
                key={`s-${axis}`}
                className="flex flex-col text-stone-500 dark:text-stone-400"
              >
                S{axis}
                <input
                  type="number"
                  step={0.05}
                  min={0.01}
                  className="mt-0.5 rounded border border-stone-200 bg-white px-1 py-0.5 text-[11px] dark:border-border dark:bg-surface"
                  value={
                    (selected.modelTransform ?? DEFAULT_CANVAS_3D_MODEL_TRANSFORM)
                      .scale[idx] ?? 1
                  }
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isFinite(v) || v < 0.01) return;
                    const base =
                      selected.modelTransform ?? DEFAULT_CANVAS_3D_MODEL_TRANSFORM;
                    const s: [number, number, number] = [
                      base.scale[0],
                      base.scale[1],
                      base.scale[2],
                    ];
                    s[idx] = v;
                    patchSelected({
                      modelTransform: { ...base, scale: s },
                    });
                  }}
                />
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-stone-300/80 bg-stone-50/30 px-2 py-2 text-center text-[10px] text-stone-500 dark:border-zinc-700 dark:bg-zinc-900/20 dark:text-zinc-500">
          Selecciona un objeto en el listado o en el visor.
        </p>
      )}

      {/* 3. Añadir primitivas — rejilla con vista previa */}
      <div>
        <p className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">
          Añadir · Primitivas
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {CANVAS_3D_PRIMITIVE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => addPrimitive(k)}
              className="group flex flex-col items-center gap-1 rounded-lg border border-stone-200/90 bg-linear-to-b from-white to-stone-50/90 px-1.5 py-2 text-center transition hover:border-violet-400/80 hover:shadow-sm dark:border-zinc-600 dark:from-zinc-900/40 dark:to-zinc-950/60 dark:hover:border-violet-500/60"
            >
              <span className="flex size-14 items-center justify-center rounded-md border border-stone-200/80 bg-stone-100/50 dark:border-zinc-600/80 dark:bg-zinc-900/50">
                <span className="size-10 transition group-hover:scale-105">
                  <Scene3dPrimitivePreview kind={k} />
                </span>
              </span>
              <span className="line-clamp-2 w-full px-0.5 font-mono text-[9px] font-medium text-stone-700 dark:text-zinc-300">
                {PRIMITIVE_LABELS[k]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Importar modelos */}
      <details
        className="group rounded-lg border border-stone-200/90 bg-stone-50/30 open:bg-stone-50/50 dark:border-border dark:bg-white/5 open:dark:bg-white/[0.07]"
        open
      >
        <summary className="cursor-pointer list-none px-2.5 py-2 font-mono text-[10px] font-medium uppercase tracking-wide text-stone-600 marker:content-none dark:text-stone-400 [&::-webkit-details-marker]:hidden">
          <span className="mr-0.5 inline-block text-stone-400 transition-transform group-open:rotate-90">
            ▸
          </span>
          Importar modelos
        </summary>
        <div className="space-y-3 border-t border-stone-200/80 px-2.5 pb-2.5 pt-2 dark:border-border">
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase text-stone-500 dark:text-stone-500">
              public/models
            </p>
            {publicModels.length === 0 ? (
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Añade <code className="rounded bg-stone-100 px-1 text-[10px] dark:bg-stone-800">.glb</code> e
                ítems en <code className="text-[10px]">catalog.json</code>.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {publicModels.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => addInstanceFromGlb(e.url, { displayName: e.label })}
                    className="max-w-full truncate rounded-md border border-stone-200 px-2 py-1 text-left text-[10px] font-medium hover:bg-emerald-50 dark:border-border dark:hover:bg-emerald-950/30"
                    title={e.url}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase text-stone-500 dark:text-stone-500">
              Archivo .glb
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".glb,model/gltf-binary"
              className="hidden"
              onChange={onPickLocalGlb}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-2 py-1.5 text-[11px] font-medium hover:bg-stone-100/80 dark:border-border dark:hover:bg-white/5"
            >
              <Upload className="size-3.5" aria-hidden />
              Cargar desde disco…
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase text-stone-500 dark:text-stone-500">
              Personajes y recursos
            </p>
            <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto">
              {savedCharacters.length === 0 ? (
                <span className="col-span-2 text-[11px] text-stone-500 dark:text-stone-400">
                  Sin personajes (opcional). Usa Recursos o public/models.
                </span>
              ) : (
                savedCharacters.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col gap-1 rounded-lg border border-stone-200 p-1.5 dark:border-border"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-stone-100 dark:bg-stone-800">
                        {c.referenceImageDataUrl?.startsWith("data:") ||
                        c.referenceImageDataUrl?.startsWith("http") ? (
                          <img
                            src={c.referenceImageDataUrl}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <User className="size-4 text-stone-400" aria-hidden />
                        )}
                      </div>
                      <span className="line-clamp-2 min-w-0 text-[10px] font-medium leading-tight">
                        {c.name}
                      </span>
                    </div>
                    {models3d.length === 0 ? (
                      <span className="text-[9px] text-amber-700 dark:text-amber-400">
                        Sin GLB en Recursos.
                      </span>
                    ) : (
                      <div className="flex max-h-16 flex-col gap-0.5 overflow-y-auto">
                        {models3d.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() =>
                              addInstanceFromGlb(m.payload, {
                                characterId: c.id,
                                displayName: c.name,
                              })
                            }
                            className="truncate rounded border border-stone-200 px-1 py-0.5 text-left text-[9px] hover:bg-emerald-50 dark:border-border dark:hover:bg-emerald-950/40"
                            title={m.prompt ?? "Modelo 3D"}
                          >
                            + {m.prompt?.slice(0, 22) || "GLB"}…
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {models3d.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {models3d.map((m) => (
                  <button
                    key={`solo-${m.id}`}
                    type="button"
                    onClick={() => addInstanceFromGlb(m.payload)}
                    className="rounded-md border border-stone-200 px-2 py-1 text-[10px] font-medium hover:bg-stone-100/80 dark:border-border dark:hover:bg-white/5"
                  >
                    + {m.prompt?.trim().slice(0, 20) || "GLB"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </details>

      {/* 5. Entorno (fondo) */}
      <details className="group rounded-lg border border-stone-200/90 bg-stone-50/20 dark:border-border dark:bg-zinc-950/30">
        <summary className="cursor-pointer list-none px-2.5 py-2 font-mono text-[10px] font-medium uppercase tracking-wide text-stone-600 marker:content-none dark:text-stone-400 [&::-webkit-details-marker]:hidden">
          <span className="mr-0.5 inline-block text-stone-400 transition-transform group-open:rotate-90">
            ▸
          </span>
          Entorno · Fondo del slide
        </summary>
        <div className="space-y-2 border-t border-stone-200/80 px-2.5 pb-2.5 pt-2 dark:border-border">
          <p className="text-[10px] leading-snug text-stone-500 dark:text-stone-400">
            Imagen detrás del 3D (lienzo transparente). Carga, URL o reutiliza la de la
            diapositiva.
          </p>
          <input
            ref={bgFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickBackgroundImage}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => bgFileRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[10px] font-medium hover:bg-white dark:border-border dark:hover:bg-white/10"
            >
              <ImageIcon className="size-3" aria-hidden />
              Subir…
            </button>
            <button
              type="button"
              onClick={() => {
                setShowImageModal(true);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-800 hover:bg-violet-100 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-900/50"
            >
              <Sparkles className="size-3" aria-hidden />
              Generar (IA)…
            </button>
            {currentSlide?.imageUrl?.trim() ? (
              <button
                type="button"
                onClick={() => {
                  const u = currentSlide.imageUrl?.trim();
                  if (u) {
                    patchCurrentSlideCanvas3dScene((d) => ({
                      ...d,
                      backgroundImageUrl: u,
                    }));
                  }
                }}
                className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
              >
                Usar imagen del slide
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-1.5">
            <label className="min-w-0 flex-1 text-[10px] text-stone-500 dark:text-stone-400">
              URL
              <input
                type="url"
                value={bgUrlDraft}
                onChange={(e) => setBgUrlDraft(e.target.value)}
                placeholder="https://…"
                className="mt-0.5 w-full rounded border border-stone-200 bg-white px-1.5 py-1 font-mono text-[10px] dark:border-border dark:bg-surface"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const t = bgUrlDraft.trim();
                if (t) {
                  patchCurrentSlideCanvas3dScene((d) => ({
                    ...d,
                    backgroundImageUrl: t,
                  }));
                }
              }}
              className="shrink-0 rounded-md border border-stone-200 px-2 py-1 text-[10px] font-medium hover:bg-stone-100 dark:border-border dark:hover:bg-white/10"
            >
              Aplicar
            </button>
          </div>
          {scene.backgroundImageUrl?.trim() ? (
            <button
              type="button"
              onClick={() => {
                patchCurrentSlideCanvas3dScene((d) => {
                  const next: Canvas3dSceneData = { ...d };
                  delete next.backgroundImageUrl;
                  return next;
                });
              }}
              className="text-[10px] text-red-600 hover:underline dark:text-red-400"
            >
              Quitar fondo
            </button>
          ) : null}
        </div>
      </details>
    </div>
  );
}
