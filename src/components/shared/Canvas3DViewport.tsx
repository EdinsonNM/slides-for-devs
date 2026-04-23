import React, {
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
import {
  Bounds,
  Environment,
  OrbitControls,
  TransformControls,
  useBounds,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinnedScene } from "three/examples/jsm/utils/SkeletonUtils.js";

type OrbitControlsImpl = React.ElementRef<typeof OrbitControls>;
type TransformControlsImpl = React.ElementRef<typeof TransformControls>;
import { cn } from "../../utils/cn";
import {
  DEFAULT_PRESENTER_3D_VIEW,
  type Presenter3dViewState,
} from "../../utils/presenter3dView";
import type { Canvas3dModelTransform } from "../../utils/canvas3dModelTransform";
import { useFixedTargetOrbitPan } from "../../hooks/useFixedTargetOrbitPan";
import {
  R3fViewportResizeToHost,
  useHostElementSize,
} from "./r3fHostViewportSync";

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

function BoundsAutoRefresh({ refreshKey }: { refreshKey: string }) {
  const api = useBounds();
  useLayoutEffect(() => {
    api.refresh().clip().fit();
    const id = requestAnimationFrame(() => {
      api.refresh().clip().fit();
    });
    return () => cancelAnimationFrame(id);
  }, [api, refreshKey]);
  return null;
}

function glbSourceForLoader(url: string): string {
  if (url.startsWith("data:")) return url;
  return encodeURI(url);
}

/**
 * Clon skinned + clips del GLB. `animationClipName`: ausente = primera clip; `""` = ninguna; nombre = esa clip.
 */
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
        animations.find((c) => c.name === animationClipName) ??
        animations[0];
    }
    if (clip) mixer.clipAction(clip).play();
  }, [mixer, animations, animationClipName, glbUrl]);

  useFrame((_, delta) => {
    mixer.update(delta);
  });

  return <primitive object={root} />;
}

function Canvas3DModel({
  glbUrl,
  modelTransform,
  animationClipName,
  onAnimationClipNames,
}: {
  glbUrl: string;
  modelTransform?: Canvas3dModelTransform | null;
  animationClipName?: string;
  onAnimationClipNames?: (names: string[]) => void;
}) {
  return (
    <group
      position={modelTransform?.position ?? [0, 0, 0]}
      rotation={modelTransform?.rotation ?? [0, 0, 0]}
    >
      <SkinnedGltfPrimitive
        glbUrl={glbUrl}
        animationClipName={animationClipName}
        onAnimationClipNames={onAnimationClipNames}
      />
    </group>
  );
}

function Canvas3DTransformControls({
  glbUrl,
  modelTransform,
  animationClipName,
  onAnimationClipNames,
  mode,
  onModelTransformChange,
  onModelTransformCommit,
}: {
  glbUrl: string;
  modelTransform?: Canvas3dModelTransform | null;
  animationClipName?: string;
  onAnimationClipNames?: (names: string[]) => void;
  mode: "translate" | "rotate";
  onModelTransformChange?: (s: Canvas3dModelTransform) => void;
  onModelTransformCommit?: (s: Canvas3dModelTransform) => void;
}) {
  const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);

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
        position={modelTransform?.position ?? [0, 0, 0]}
        rotation={modelTransform?.rotation ?? [0, 0, 0]}
      >
        <SkinnedGltfPrimitive
          glbUrl={glbUrl}
          animationClipName={animationClipName}
          onAnimationClipNames={onAnimationClipNames}
        />
      </group>

      {modelGroup ? (
        <TransformControls
          object={modelGroup}
          mode={mode}
          onObjectChange={() => {
            const next = readFromGroup();
            if (next) onModelTransformChange?.(next);
          }}
          onMouseUp={() => {
            const next = readFromGroup();
            if (next) onModelTransformCommit?.(next);
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
  /** Cambia al cambiar slide o modelo para reaplicar cámara. */
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
    if (viewState) {
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

export interface Canvas3DViewportProps {
  slideId: string;
  glbUrl?: string | null;
  viewState?: Presenter3dViewState | null;
  onViewStateCommit?: (s: Presenter3dViewState) => void;
  disableControls?: boolean;
  showInteractionHint?: boolean;
  /** Rejilla de referencia bajo el modelo (solo útil en edición). */
  showGroundGrid?: boolean;
  className?: string;
  boundsMargin?: number;
  modelTransform?: Canvas3dModelTransform | null;
  /**
   * Clips del GLB: ausente en slide = reproducir la primera; `""` = ninguna; nombre = clip concreta.
   */
  animationClipName?: string;
  onAnimationClipNames?: (names: string[]) => void;
  transformControlsMode?: "translate" | "rotate";
  onModelTransformChange?: (s: Canvas3dModelTransform) => void;
  onModelTransformCommit?: (s: Canvas3dModelTransform) => void;
  /**
   * Clave opcional para forzar re-medición del host cuando el layout cambia sin resize CSS
   * (p. ej. presentación con transforms).
   */
  hostMeasureKey?: string;
}

/**
 * Visor GLB arbitrario con órbita (rotar, zoom, paneo con clic derecho o botón central).
 */
export function Canvas3DViewport({
  slideId,
  glbUrl,
  viewState,
  onViewStateCommit,
  disableControls,
  showInteractionHint = true,
  showGroundGrid = true,
  className,
  boundsMargin = 1.25,
  modelTransform,
  animationClipName,
  onAnimationClipNames,
  transformControlsMode,
  onModelTransformChange,
  onModelTransformCommit,
  hostMeasureKey,
}: Canvas3DViewportProps) {
  const trimmed = glbUrl?.trim() ?? "";
  const controlKey = `${slideId}|${trimmed}`;
  const hostObserveKey = `${controlKey}|${hostMeasureKey ?? "static"}`;
  const [hostRef, hostSize] = useHostElementSize(hostObserveKey);
  const boundsRefreshKey = `${hostObserveKey}|${hostSize.width}x${hostSize.height}`;

  let sceneBody: ReactNode;
  if (!trimmed) {
    sceneBody = null;
  } else if (transformControlsMode) {
    sceneBody = (
      <Canvas3DTransformControls
        glbUrl={trimmed}
        modelTransform={modelTransform}
        animationClipName={animationClipName}
        onAnimationClipNames={onAnimationClipNames}
        mode={transformControlsMode}
        onModelTransformChange={onModelTransformChange}
        onModelTransformCommit={onModelTransformCommit}
      />
    );
  } else if (viewState == null) {
    sceneBody = (
      <Bounds margin={boundsMargin} clip>
        <group key={trimmed}>
          <Canvas3DModel
            glbUrl={trimmed}
            modelTransform={modelTransform}
            animationClipName={animationClipName}
            onAnimationClipNames={onAnimationClipNames}
          />
        </group>
        <BoundsAutoRefresh refreshKey={boundsRefreshKey} />
      </Bounds>
    );
  } else {
    sceneBody = (
      <group key={trimmed}>
        <Canvas3DModel
          glbUrl={trimmed}
          modelTransform={modelTransform}
          animationClipName={animationClipName}
          onAnimationClipNames={onAnimationClipNames}
        />
      </group>
    );
  }

  return (
    <div
      key={slideId}
      ref={hostRef}
      className={cn(
        "relative min-h-[200px] h-full w-full bg-transparent",
        className,
      )}
    >
      <Canvas
        className="absolute inset-0 h-full w-full touch-none select-none"
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
          useAutoframing={viewState == null}
        />
        <ambientLight intensity={0.35} />
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
          <Environment preset="city" environmentIntensity={0.85} />
          {sceneBody}
        </Suspense>
      </Canvas>
      {!trimmed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-stone-500 dark:text-stone-400">
          Indica una URL de modelo .glb o sube un archivo desde el inspector o este panel.
        </div>
      )}
      {!disableControls && showInteractionHint && trimmed && (
        <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] text-stone-400 dark:text-stone-500">
          Clic + arrastre para girar · rueda o pellizco para zoom · clic derecho para desplazar
        </p>
      )}
    </div>
  );
}
