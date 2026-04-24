import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
} from "react";
import { Image as ImageIcon, Plus, Sparkles, Trash2, Upload, User } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import {
  CANVAS_3D_PRIMITIVE_KINDS,
  type Canvas3dPrimitiveKind,
  type Canvas3dSceneData,
  type Canvas3dSceneInstance,
} from "../../domain/entities/Canvas3dSceneData";
import type { GeneratedResourceEntry, SavedCharacter } from "../../types";
import { DEFAULT_CANVAS_3D_MODEL_TRANSFORM } from "../../utils/canvas3dModelTransform";
import { cn } from "../../utils/cn";
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
      <div className="rounded-lg border border-stone-200/90 bg-stone-50/50 p-2.5 dark:border-border dark:bg-white/5">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">
          Fondo del slide
        </p>
        <p className="mb-2 text-[10px] leading-snug text-stone-500 dark:text-stone-400">
          Imagen detrás del 3D (el lienzo es transparente). Carga, URL o reutiliza la
          de la diapositiva; la IA pone la imagen en el slide — luego «Usar imagen del
          slide».
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
        <div className="mt-2 flex flex-wrap items-end gap-1.5">
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
            className="mt-2 text-[10px] text-red-600 hover:underline dark:text-red-400"
          >
            Quitar fondo
          </button>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">
          Formas básicas
        </p>
        <div className="flex flex-wrap gap-1">
          {CANVAS_3D_PRIMITIVE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => addPrimitive(k)}
              className="rounded-md border border-stone-200 px-2 py-1 text-[10px] font-medium hover:bg-violet-50 dark:border-border dark:hover:bg-violet-950/40"
            >
              <Plus className="mr-0.5 inline size-3" strokeWidth={2} />
              {PRIMITIVE_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">
          Modelos en public/models
        </p>
        {publicModels.length === 0 ? (
          <p className="text-[11px] text-stone-500 dark:text-stone-400">
            Vacío: añade <code className="rounded bg-stone-100 px-1 text-[10px] dark:bg-stone-800">.glb</code> y
            entradas en <code className="text-[10px]">catalog.json</code> (ver carpeta).
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
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">
          Tu archivo .glb
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
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-2 py-1.5 text-[11px] font-medium hover:bg-stone-50 dark:border-border dark:hover:bg-white/5"
        >
          <Upload className="size-3.5" aria-hidden />
          Cargar modelo…
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">
          Personajes + Recursos
        </p>
        <div className="grid max-h-36 grid-cols-2 gap-2 overflow-y-auto">
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
          <div className="flex flex-wrap gap-1 pt-1">
            {models3d.map((m) => (
              <button
                key={`solo-${m.id}`}
                type="button"
                onClick={() => addInstanceFromGlb(m.payload)}
                className="rounded-md border border-stone-200 px-2 py-1 text-[10px] font-medium hover:bg-stone-50 dark:border-border dark:hover:bg-white/5"
              >
                + {m.prompt?.trim().slice(0, 20) || "GLB"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">
          En el lienzo ({scene.instances.length})
        </p>
        {scene.instances.length === 0 ? (
          <p className="text-[11px] text-stone-500">Añade un objeto arriba.</p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {scene.instances.map((inst) => {
              const active = inst.id === selectedId;
              return (
                <li
                  key={inst.id}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px]",
                    active
                      ? "border-emerald-500 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-950/30"
                      : "border-stone-200 dark:border-border",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left font-medium"
                    onClick={() => setSelected(inst.id)}
                  >
                    {instanceLabel(inst)}
                  </button>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-stone-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    title="Quitar"
                    onClick={() => removeInstance(inst.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected ? (
        <div className="space-y-2 border-t border-stone-100 pt-3 dark:border-border">
          <p className="text-[10px] font-medium uppercase tracking-wide text-stone-600 dark:text-stone-400">
            Selección
          </p>
          {selected.source === "primitive" ? (
            <label className="block text-[10px] text-stone-500 dark:text-stone-400">
              Color (#rrggbb)
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
          <p className="text-[10px] text-stone-500 dark:text-stone-400">
            En el lienzo: «Mover» / «Girar» / «Escalar» y gizmo, o órbita de cámara.
          </p>
          <button
            type="button"
            className="w-full rounded-md border border-stone-200 px-2 py-1.5 text-xs font-medium hover:bg-stone-50 dark:border-border dark:hover:bg-white/5"
            onClick={() => persist({ ...scene, viewState: undefined })}
          >
            Restablecer cámara (autoencuadre)
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
      ) : null}
    </div>
  );
}
