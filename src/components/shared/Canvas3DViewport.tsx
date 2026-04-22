import React, {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bounds,
  Center,
  Environment,
  OrbitControls,
  useBounds,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";

type OrbitControlsImpl = React.ElementRef<typeof OrbitControls>;
import { cn } from "../../utils/cn";
import {
  DEFAULT_PRESENTER_3D_VIEW,
  type Presenter3dViewState,
} from "../../utils/presenter3dView";
import { useFixedTargetOrbitPan } from "../../hooks/useFixedTargetOrbitPan";

function disposeClonedGeometries(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
    }
  });
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

function ArbitraryGLTF({ glbUrl }: { glbUrl: string }) {
  const src = glbSourceForLoader(glbUrl);
  const { scene } = useGLTF(src);
  const root = useMemo(() => scene.clone(true), [scene, glbUrl]);

  useEffect(() => {
    return () => disposeClonedGeometries(root);
  }, [root]);

  return (
    <Center cacheKey={glbUrl}>
      <primitive object={root} />
    </Center>
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
  className?: string;
  boundsMargin?: number;
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
  className,
  boundsMargin = 1.25,
}: Canvas3DViewportProps) {
  const trimmed = glbUrl?.trim() ?? "";
  const controlKey = `${slideId}|${trimmed}`;

  let sceneBody: ReactNode;
  if (!trimmed) {
    sceneBody = null;
  } else if (viewState == null) {
    sceneBody = (
      <Bounds margin={boundsMargin} clip>
        <group key={trimmed}>
          <ArbitraryGLTF glbUrl={trimmed} />
        </group>
        <BoundsAutoRefresh refreshKey={controlKey} />
      </Bounds>
    );
  } else {
    sceneBody = (
      <group key={trimmed}>
        <ArbitraryGLTF glbUrl={trimmed} />
      </group>
    );
  }

  return (
    <div
      key={slideId}
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
