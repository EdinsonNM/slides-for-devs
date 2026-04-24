import React, {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls, TransformControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinnedScene } from "three/examples/jsm/utils/SkeletonUtils.js";

type OrbitControlsImpl = React.ElementRef<typeof OrbitControls>;

import { cn } from "../../utils/cn";
import {
  DEFAULT_PRESENTER_3D_VIEW,
  type Presenter3dViewState,
} from "../../utils/presenter3dView";
import type { Canvas3dModelTransform } from "../../utils/canvas3dModelTransform";
import { DEFAULT_CANVAS_3D_MODEL_TRANSFORM } from "../../utils/canvas3dModelTransform";
import type {
  Canvas3dPrimitiveKind,
  Canvas3dSceneInstance,
} from "../../domain/entities/Canvas3dSceneData";
import { useFixedTargetOrbitPan } from "../../hooks/useFixedTargetOrbitPan";
import {
  R3fViewportResizeToHost,
  useHostElementSize,
} from "./r3fHostViewportSync";
import { R3fWebglContextLostGuard } from "./R3fWebglContextLostGuard";
import { R3fWebglThrottledSnapshot } from "./R3fWebglThrottledSnapshot";

function disposeClonedGeometries(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
    }
  });
}

function centerObjectAtOrigin(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const center = new THREE.Vector3();
  box.getCenter(center);
  root.position.sub(center);
  root.updateMatrixWorld(true);
}

function glbSourceForLoader(url: string): string {
  if (url.startsWith("data:")) return url;
  return encodeURI(url);
}

function BasicPrimitiveMesh({
  kind,
  color,
}: {
  kind: Canvas3dPrimitiveKind;
  color: string;
}) {
  const matColor = useMemo(() => {
    try {
      return new THREE.Color(color);
    } catch {
      return new THREE.Color("#94a3b8");
    }
  }, [color]);
  const mat = (
    <meshStandardMaterial
      color={matColor}
      roughness={0.45}
      metalness={0.12}
    />
  );
  switch (kind) {
    case "box":
      return (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          {mat}
        </mesh>
      );
    case "sphere":
      return (
        <mesh>
          <sphereGeometry args={[0.55, 32, 32]} />
          {mat}
        </mesh>
      );
    case "cylinder":
      return (
        <mesh>
          <cylinderGeometry args={[0.45, 0.45, 1, 32]} />
          {mat}
        </mesh>
      );
    case "cone":
      return (
        <mesh>
          <coneGeometry args={[0.55, 1, 32]} />
          {mat}
        </mesh>
      );
    case "torus":
      return (
        <mesh>
          <torusGeometry args={[0.45, 0.16, 20, 48]} />
          {mat}
        </mesh>
      );
    case "capsule":
      return (
        <mesh>
          <capsuleGeometry args={[0.28, 0.9, 6, 12]} />
          {mat}
        </mesh>
      );
    default:
      return null;
  }
}

function SkinnedGltfPrimitive({
  glbUrl,
  animationClipName,
  onAnimationClipNames,
}: {
  glbUrl: string;
  animationClipName?: string;
  onAnimationClipNames?: (names: string[]) => void;
}) {
  const src = glbSourceForLoader(glbUrl);
  const { scene, animations } = useGLTF(src);
  const root = useMemo(() => {
    const cloned = cloneSkinnedScene(scene);
    centerObjectAtOrigin(cloned);
    return cloned;
  }, [scene, glbUrl]);

  const mixer = useMemo(() => new THREE.AnimationMixer(root), [root]);
  const onNamesRef = useRef(onAnimationClipNames);
  onNamesRef.current = onAnimationClipNames;

  useEffect(() => {
    return () => disposeClonedGeometries(root);
  }, [root]);

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
    };
  }, [mixer]);

  const namesDigest = useMemo(
    () => animations.map((a) => a.name).join("\u0001"),
    [animations],
  );

  useLayoutEffect(() => {
    onNamesRef.current?.(animations.map((a) => a.name));
  }, [animations, namesDigest]);

  useEffect(() => {
    mixer.stopAllAction();
    if (animations.length === 0) return;
    if (animationClipName === "") return;
    let clip: THREE.AnimationClip | undefined;
    if (animationClipName == null) {
      clip = animations[0];
    } else {
      clip =
        animations.find((c) => c.name === animationClipName) ?? animations[0];
    }
    if (clip) mixer.clipAction(clip).play();
  }, [mixer, animations, animationClipName, glbUrl]);

  useFrame((_, delta) => {
    mixer.update(delta);
  });

  return <primitive object={root} />;
}

/** Nombre explícito: en R3F los PascalCase se resuelven contra el catálogo de `three`; evitar `Scene*`. */
function Canvas3dR3fSceneModel({
  instance,
  selected,
  transformMode,
  onTransformCommit,
  onAnimationClipNames,
}: {
  instance: Canvas3dSceneInstance;
  selected: boolean;
  transformMode: "translate" | "rotate" | null;
  onTransformCommit?: (id: string, t: Canvas3dModelTransform) => void;
  onAnimationClipNames?: (id: string, names: string[]) => void;
}) {
  const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);
  const mt = instance.modelTransform ?? DEFAULT_CANVAS_3D_MODEL_TRANSFORM;
  const mtKey = JSON.stringify(mt);

  useLayoutEffect(() => {
    if (!modelGroup) return;
    modelGroup.position.set(mt.position[0], mt.position[1], mt.position[2]);
    modelGroup.rotation.set(mt.rotation[0], mt.rotation[1], mt.rotation[2]);
  }, [modelGroup, mtKey, mt.position, mt.rotation]);

  const readFromGroup = useCallback((): Canvas3dModelTransform | null => {
    if (!modelGroup) return null;
    return {
      position: [
        modelGroup.position.x,
        modelGroup.position.y,
        modelGroup.position.z,
      ],
      rotation: [
        modelGroup.rotation.x,
        modelGroup.rotation.y,
        modelGroup.rotation.z,
      ],
    };
  }, [modelGroup]);

  return (
    <>
      <group
        ref={setModelGroup}
        position={mt.position}
        rotation={mt.rotation}
      >
        {instance.source === "primitive" && instance.primitiveKind ? (
          <BasicPrimitiveMesh
            kind={instance.primitiveKind}
            color={instance.primitiveColor ?? "#94a3b8"}
          />
        ) : instance.glbUrl ? (
          <SkinnedGltfPrimitive
            glbUrl={instance.glbUrl}
            animationClipName={instance.animationClipName}
            onAnimationClipNames={(names) =>
              onAnimationClipNames?.(instance.id, names)
            }
          />
        ) : null}
      </group>
      {selected && transformMode && modelGroup ? (
        <TransformControls
          object={modelGroup}
          mode={transformMode}
          onMouseUp={() => {
            const next = readFromGroup();
            if (next) onTransformCommit?.(instance.id, next);
          }}
        />
      ) : null}
    </>
  );
}

function Canvas3DOrbitControls({
  controlKey,
  viewState,
  onViewCommit,
  disableControls,
  useAutoframing,
}: {
  controlKey: string;
  viewState?: Presenter3dViewState | null;
  onViewCommit?: (s: Presenter3dViewState) => void;
  disableControls?: boolean;
  useAutoframing: boolean;
}) {
  const ref = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const appliedForKey = useRef<string | null>(null);
  const pendingApply = useRef(false);

  useFixedTargetOrbitPan(ref, Boolean(!disableControls));

  useEffect(() => {
    pendingApply.current = true;
    appliedForKey.current = null;
  }, [controlKey]);

  useFrame(() => {
    if (!pendingApply.current) return;
    const ctrl = ref.current;
    if (!ctrl) return;
    if (appliedForKey.current === controlKey) {
      pendingApply.current = false;
      return;
    }
    /* Con instancias, `Bounds` encuadra; no pisar con `viewState` guardado (suele ser de escena vacía). */
    if (viewState && !useAutoframing) {
      const v = viewState;
      camera.position.set(v.position[0], v.position[1], v.position[2]);
      ctrl.target.set(v.target[0], v.target[1], v.target[2]);
    } else if (!useAutoframing) {
      const v = DEFAULT_PRESENTER_3D_VIEW;
      camera.position.set(v.position[0], v.position[1], v.position[2]);
      ctrl.target.set(v.target[0], v.target[1], v.target[2]);
    }
    ctrl.update();
    appliedForKey.current = controlKey;
    pendingApply.current = false;
  });

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.85}
      zoomSpeed={0.9}
      enablePan={false}
      enableRotate={!disableControls}
      enableZoom={!disableControls}
      minPolarAngle={0.08}
      maxPolarAngle={Math.PI - 0.08}
      minDistance={0.05}
      maxDistance={200}
      onEnd={() => {
        if (!onViewCommit || !ref.current) return;
        const c = ref.current;
        const pos = c.object.position;
        const t = c.target;
        onViewCommit({
          position: [pos.x, pos.y, pos.z],
          target: [t.x, t.y, t.z],
        });
      }}
    />
  );
}

export interface Canvas3dSceneViewportProps {
  slideId: string;
  instances: readonly Canvas3dSceneInstance[];
  viewState?: Presenter3dViewState | null;
  onViewStateCommit?: (s: Presenter3dViewState) => void;
  selectedInstanceId?: string | null;
  transformControlsMode?: "translate" | "rotate" | null;
  onInstanceTransformCommit?: (id: string, t: Canvas3dModelTransform) => void;
  onAnimationClipNames?: (instanceId: string, names: string[]) => void;
  disableControls?: boolean;
  showInteractionHint?: boolean;
  showGroundGrid?: boolean;
  className?: string;
  hostMeasureKey?: string;
  stackRevision?: number;
  onThrottledFrameSnapshot?: (dataUrl: string) => void;
  skipEnvironmentMaps?: boolean;
}

/**
 * Escena 3D con varios GLB, una cámara órbita y gizmo en la instancia seleccionada.
 */
export function Canvas3dSceneViewport({
  slideId,
  instances,
  viewState,
  onViewStateCommit,
  selectedInstanceId,
  transformControlsMode = null,
  onInstanceTransformCommit,
  onAnimationClipNames,
  disableControls,
  showInteractionHint = true,
  showGroundGrid = true,
  className,
  hostMeasureKey,
  stackRevision = 0,
  onThrottledFrameSnapshot,
  skipEnvironmentMaps = false,
}: Canvas3dSceneViewportProps) {
  const digest = instances
    .map(
      (i) =>
        `${i.id}:${i.source}:${i.source === "glb" ? (i.glbUrl ?? "") : ""}:${i.primitiveKind ?? ""}:${i.primitiveColor ?? ""}`,
    )
    .join("|");
  const controlKey = `${slideId}|scene|${digest}`;
  const hostObserveKey = `${controlKey}|${hostMeasureKey ?? "static"}|z:${stackRevision}`;
  const [hostRef, hostSize] = useHostElementSize(hostObserveKey);
  const r3fFragmentKey = `${slideId}\u0001scene\u0001${digest}`;

  /** Con instancias, no reinyectar cámara desde `viewState` (evita lucha con la órbita). */
  const useAutoframing = instances.length > 0;

  let sceneBody: ReactNode;
  if (instances.length === 0) {
    sceneBody = null;
  } else {
    sceneBody = (
        <group key={digest}>
          {instances.map((inst) =>
            React.createElement(Canvas3dR3fSceneModel, {
              key: inst.id,
              instance: inst,
              selected: inst.id === selectedInstanceId,
              transformMode: transformControlsMode,
              onTransformCommit: onInstanceTransformCommit,
              onAnimationClipNames,
            }),
          )}
        </group>
       
    );
  }

  const hasModels = instances.length > 0;

  return (
    <div
      key={slideId}
      ref={hostRef}
      className={cn(
        "relative min-h-[200px] h-full w-full bg-transparent",
        className,
      )}
    >
      <Fragment key={`r3f-canvas3d-scene-${r3fFragmentKey}`}>
        <Canvas
          className="absolute inset-0 h-full w-full touch-none select-none"
          dpr={skipEnvironmentMaps ? 1 : undefined}
          camera={{
            position: [...DEFAULT_PRESENTER_3D_VIEW.position] as [
              number,
              number,
              number,
            ],
            fov: 45,
          }}
          gl={{
            antialias: true,
            alpha: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true,
          }}
          onCreated={({ gl, scene }) => {
            scene.background = null;
            gl.setClearColor(0x000000, 0);
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.75;
          }}
        >
          <R3fWebglContextLostGuard />
          {onThrottledFrameSnapshot != null && hasModels ? (
            <R3fWebglThrottledSnapshot onSnapshot={onThrottledFrameSnapshot} />
          ) : null}
          <R3fViewportResizeToHost
            width={hostSize.width}
            height={hostSize.height}
            syncKey={hostObserveKey}
          />
          <Canvas3DOrbitControls
            controlKey={controlKey}
            viewState={viewState ?? null}
            onViewCommit={onViewStateCommit}
            disableControls={disableControls}
            useAutoframing={useAutoframing}
          />
          <ambientLight intensity={skipEnvironmentMaps ? 0.52 : 0.35} />
          <directionalLight
            position={[6, 8, 6]}
            intensity={1.1}
            color="#fff6ef"
          />
          <directionalLight
            position={[-5, 4, -4]}
            intensity={0.5}
            color="#e8eefc"
          />
          <directionalLight
            position={[0, 2, -8]}
            intensity={0.35}
            color="#ffffff"
          />
          {showGroundGrid ? (
            <gridHelper args={[10, 10, 0x888888, 0x444444]} />
          ) : null}
          <Suspense fallback={null}>
            {!skipEnvironmentMaps ? (
              <Environment preset="city" environmentIntensity={0.85} />
            ) : null}
            {sceneBody}
          </Suspense>
        </Canvas>
      </Fragment>
      {!hasModels && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-stone-500 dark:text-stone-400">
          Añade objetos desde la pestaña Escena 3D.
        </div>
      )}
      {!disableControls && showInteractionHint && hasModels && (
        <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] text-stone-400 dark:text-stone-500">
          Clic + arrastre para girar · rueda o pellizco para zoom · clic derecho para
          desplazar
        </p>
      )}
    </div>
  );
}
