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
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bounds,
  Center,
  Environment,
  OrbitControls,
  useBounds,
  useGLTF,
  useTexture,
  useVideoTexture,
} from "@react-three/drei";
import * as THREE from "three";

type OrbitControlsImpl = React.ElementRef<typeof OrbitControls>;
import { cn } from "../../utils/cn";
import {
  DEVICE_3D_CATALOG,
  PRESENTER_3D_GLTF_NORMAL_SCALE,
  resolveDevice3dGlbUrl,
} from "../../constants/device3d";
import { isDirectVideoTextureUrl } from "../../utils/directVideoUrl";
import {
  DEFAULT_PRESENTER_3D_VIEW,
  type Presenter3dViewState,
  presenter3dViewIsTooTightHeadOn,
} from "../../utils/presenter3dView";
import { useFixedTargetOrbitPan } from "../../hooks/useFixedTargetOrbitPan";
import {
  R3fViewportResizeToHost,
  useHostElementSize,
} from "./r3fHostViewportSync";
import { R3fWebglContextLossRemount } from "./R3fWebglContextLossRemount";

function isScreenMaterial(mesh: THREE.Mesh, mat: THREE.Material): boolean {
  const mn = (mesh.name || "").toLowerCase();
  const name = (mat.name || "").toLowerCase();
  return name === "screen";
}

function applyScreenMap(root: THREE.Object3D, map: THREE.Texture | null) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const m of mats) {
      if (!isScreenMaterial(child, m)) continue;
      const mat = m as THREE.MeshStandardMaterial;
      if (map) {
        mat.map = map;
        mat.map.needsUpdate = true;
        mat.color?.setHex(0xffffff);
      } else {
        mat.map = null;
      }
      mat.needsUpdate = true;
    }
  });
}

function disposeClonedResources(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) {
        for (const m of obj.material) m.dispose();
      } else {
        obj.material?.dispose();
      }
    }
  });
}

/** Tras cargar el GLB / texturas, recalcula el encuadre para que el dispositivo quepa en el panel. */
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

const _pivotBox = new THREE.Box3();
const _pivotCenter = new THREE.Vector3();

/**
 * Mantiene el `target` de OrbitControls en el centro del modelo (AABB mundial).
 * OrbitControls de @react-three/drei ejecuta `update()` en useFrame con prioridad -1;
 * usamos una prioridad menor para corregir el pivote después y evitar que la órbita
 * “arrastre” el modelo respecto a su centro de rotación.
 */
function SyncOrbitPivotToModelRoot({
  modelRef,
}: {
  modelRef: RefObject<THREE.Group | null>;
}) {
  const { controls, invalidate } = useThree();

  useFrame(() => {
    const c = controls as unknown as {
      target: THREE.Vector3;
      update: () => void;
    } | null;
    const root = modelRef.current;
    if (!c || !root) return;

    _pivotBox.setFromObject(root);
    if (_pivotBox.isEmpty()) return;
    _pivotBox.getCenter(_pivotCenter);

    if (c.target.distanceToSquared(_pivotCenter) > 1e-10) {
      c.target.copy(_pivotCenter);
      c.update();
      invalidate();
    }
  }, -2);

  return null;
}

interface GLTFDeviceProps {
  glbUrl: string;
  screenMap: THREE.Texture | null;
}

function cloneWithOwnMaterials(scene: THREE.Object3D): THREE.Object3D {
  const root = scene.clone(true);
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m: THREE.Material) => m.clone());
    } else {
      child.material = child.material.clone();
    }
  });
  return root;
}

function GLTFDevice({ glbUrl, screenMap }: GLTFDeviceProps) {
  const { scene } = useGLTF(glbUrl);
  const root = useMemo(() => cloneWithOwnMaterials(scene), [scene, glbUrl]);

  useEffect(() => {
    applyScreenMap(root, screenMap);
  }, [root, screenMap]);

  useEffect(() => {
    return () => disposeClonedResources(root);
  }, [root]);

  return (
    <Center cacheKey={glbUrl}>
      <group scale={PRESENTER_3D_GLTF_NORMAL_SCALE}>
        <primitive object={root} />
      </group>
    </Center>
  );
}

function ImageTexturedDevice({
  imageUrl,
  glbUrl,
}: {
  imageUrl: string;
  glbUrl: string;
}) {
  const texture = useTexture(imageUrl);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);
  return <GLTFDevice glbUrl={glbUrl} screenMap={texture} />;
}

function VideoTexturedDevice({
  videoUrl,
  glbUrl,
}: {
  videoUrl: string;
  glbUrl: string;
}) {
  const texture = useVideoTexture(videoUrl, {
    crossOrigin: "anonymous",
    muted: true,
    loop: true,
  });
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
  }, [texture]);
  return <GLTFDevice glbUrl={glbUrl} screenMap={texture} />;
}

function PersistedOrbitControls({
  slideId,
  viewState,
  onViewCommit,
  disableControls,
  useAutoframing,
}: {
  slideId: string;
  viewState?: Presenter3dViewState | null;
  onViewCommit?: (s: Presenter3dViewState) => void;
  disableControls?: boolean;
  /** Si es true, no fuerza DEFAULT_PRESENTER_3D_VIEW; Bounds ajusta la cámara al modelo. */
  useAutoframing: boolean;
}) {
  const ref = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const appliedForSlideId = useRef<string | null>(null);
  const pendingApply = useRef(false);

  useFixedTargetOrbitPan(ref, Boolean(!disableControls));

  useEffect(() => {
    pendingApply.current = true;
    appliedForSlideId.current = null;
  }, [slideId]);

  useFrame(() => {
    if (!pendingApply.current) return;
    const ctrl = ref.current;
    if (!ctrl) return;
    if (appliedForSlideId.current === slideId) {
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
    appliedForSlideId.current = slideId;
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
      minPolarAngle={0.35}
      maxPolarAngle={Math.PI - 0.25}
      minDistance={0.12}
      maxDistance={28}
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

export interface Device3DViewportProps {
  /** Identificador estable de la diapositiva (para restaurar la órbita al cambiar de slide). */
  slideId: string;
  /**
   * Cuando hay varios presentadores 3D en el mismo slide (lienzo), p. ej. el id del `mediaPanel`,
   * para no compartir estado de órbita / refresco de Bounds entre instancias.
   */
  orbitScopeSuffix?: string;
  deviceId: string | undefined;
  screenMedia: "image" | "video";
  imageUrl?: string;
  videoUrl?: string;
  viewState?: Presenter3dViewState | null;
  /** Si se pasa, al soltar tras orbitar se guarda la vista (solo editor). */
  onViewStateCommit?: (s: Presenter3dViewState) => void;
  /** Desactiva órbita, zoom y paneo (vista totalmente fija). */
  disableControls?: boolean;
  /** Texto de ayuda bajo el canvas (p. ej. desactivar en vista previa). */
  showInteractionHint?: boolean;
  className?: string;
  /** Margen de `@react-three/drei` Bounds al autoencuadrar (menor = modelo más grande en el viewport). */
  boundsMargin?: number;
  /**
   * Clave opcional para forzar re-medición del host (ResizeObserver + `setSize`) cuando el layout
   * cambia sin mutar el tamaño CSS (p. ej. modo presentación “cámara continua” con transforms).
   */
  hostMeasureKey?: string;
}

export function Device3DViewport({
  slideId,
  orbitScopeSuffix,
  deviceId,
  screenMedia,
  imageUrl,
  videoUrl,
  viewState,
  onViewStateCommit,
  disableControls,
  showInteractionHint = true,
  className,
  boundsMargin = 1.42,
  hostMeasureKey,
}: Device3DViewportProps) {
  const orbitScopeKey = `${slideId}:${orbitScopeSuffix ?? "main"}`;
  const glbUrl = resolveDevice3dGlbUrl(deviceId);
  const hostObserveKey = `${orbitScopeKey}|${hostMeasureKey ?? "static"}`;
  const [hostRef, hostSize] = useHostElementSize(hostObserveKey);

  const [webglRemountGen, setWebglRemountGen] = useState(0);
  const onWebglRemountRequest = useCallback(() => {
    setWebglRemountGen((n) => n + 1);
  }, []);

  useEffect(() => {
    setWebglRemountGen(0);
  }, [
    orbitScopeKey,
    hostMeasureKey,
    deviceId,
    screenMedia,
    imageUrl,
    videoUrl,
  ]);

  const resolvedViewState =
    viewState && !presenter3dViewIsTooTightHeadOn(viewState)
      ? viewState
      : undefined;

  const canVideo =
    Boolean(videoUrl?.trim()) && isDirectVideoTextureUrl(videoUrl!.trim());

  let body: ReactNode;
  if (screenMedia === "image" && imageUrl?.trim()) {
    body = (
      <group key={imageUrl}>
        <ImageTexturedDevice imageUrl={imageUrl} glbUrl={glbUrl} />
      </group>
    );
  } else if (screenMedia === "video" && canVideo) {
    body = (
      <group key={videoUrl}>
        <VideoTexturedDevice videoUrl={videoUrl!.trim()} glbUrl={glbUrl} />
      </group>
    );
  } else {
    body = (
      <group key="bare">
        <GLTFDevice glbUrl={glbUrl} screenMap={null} />
      </group>
    );
  }

  const boundsRefreshKey = `${orbitScopeKey}|${glbUrl}|${imageUrl ?? ""}|${videoUrl ?? ""}|${screenMedia}|${hostObserveKey}|${hostSize.width}x${hostSize.height}`;
  const modelRootRef = useRef<THREE.Group>(null);

  const sceneBody =
    resolvedViewState == null ? (
      <Bounds margin={boundsMargin} clip>
        <group ref={modelRootRef}>{body}</group>
        <BoundsAutoRefresh refreshKey={boundsRefreshKey} />
        <SyncOrbitPivotToModelRoot modelRef={modelRootRef} />
      </Bounds>
    ) : (
      <group ref={modelRootRef}>{body}</group>
    );

  return (
    <div
      key={orbitScopeKey}
      ref={hostRef}
      className={cn(
        "relative min-h-[200px] h-full w-full bg-transparent",
        className,
      )}
    >
      <Fragment key={`${orbitScopeKey}|r3f-${hostObserveKey}-${webglRemountGen}`}>
        <Canvas
          className="absolute inset-0 h-full w-full touch-none select-none"
          camera={{
            position: [...DEFAULT_PRESENTER_3D_VIEW.position] as [
              number,
              number,
              number,
            ],
            fov: 42,
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
            gl.toneMappingExposure = 0.6;
          }}
        >
          <R3fWebglContextLossRemount onRemountRequest={onWebglRemountRequest} />
          <R3fViewportResizeToHost
            width={hostSize.width}
            height={hostSize.height}
            syncKey={hostObserveKey}
          />
          <PersistedOrbitControls
            slideId={orbitScopeKey}
            viewState={resolvedViewState ?? null}
            onViewCommit={onViewStateCommit}
            disableControls={disableControls}
            useAutoframing={resolvedViewState == null}
          />
          <ambientLight intensity={0.22} />
          <directionalLight
            position={[5.5, 7, 5]}
            intensity={1.15}
            color="#fff6ef"
          />
          <directionalLight
            position={[-5.5, 3.5, -3.5]}
            intensity={0.45}
            color="#e8eefc"
          />
          <directionalLight
            position={[0, 3.5, -7]}
            intensity={0.32}
            color="#ffffff"
          />
          <Suspense fallback={null}>
            <Environment preset="studio" environmentIntensity={0.92} />
            {sceneBody}
          </Suspense>
        </Canvas>
      </Fragment>
      {!disableControls && showInteractionHint && (
        <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10px] text-stone-400 dark:text-stone-500">
          Clic + arrastre o trackpad para girar · rueda o pellizco para zoom ·
          clic derecho para desplazar
        </p>
      )}
    </div>
  );
}

for (const d of DEVICE_3D_CATALOG) {
  useGLTF.preload(encodeURI(d.glbPublicPath));
}
