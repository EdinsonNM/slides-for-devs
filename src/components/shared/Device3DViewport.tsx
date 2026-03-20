import React, {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Center,
  Environment,
  OrbitControls,
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
} from "../../utils/presenter3dView";

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
      }
      mat.needsUpdate = true;
    }
  });
}

function disposeClonedGeometries(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
    }
  });
}

interface GLTFDeviceProps {
  glbUrl: string;
  screenMap: THREE.Texture | null;
}

function GLTFDevice({ glbUrl, screenMap }: GLTFDeviceProps) {
  const { scene } = useGLTF(glbUrl);
  const root = useMemo(() => scene.clone(true), [scene, glbUrl]);

  useEffect(() => {
    applyScreenMap(root, screenMap);
  }, [root, screenMap]);

  useEffect(() => {
    return () => disposeClonedGeometries(root);
  }, [root]);

  return (
    <Center>
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
}: {
  slideId: string;
  viewState?: Presenter3dViewState | null;
  onViewCommit?: (s: Presenter3dViewState) => void;
  disableControls?: boolean;
}) {
  const ref = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const appliedForSlideId = useRef<string | null>(null);
  const pendingApply = useRef(false);

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
    const v = viewState ?? DEFAULT_PRESENTER_3D_VIEW;
    camera.position.set(v.position[0], v.position[1], v.position[2]);
    ctrl.target.set(v.target[0], v.target[1], v.target[2]);
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
      enablePan={!disableControls}
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
}

export function Device3DViewport({
  slideId,
  deviceId,
  screenMedia,
  imageUrl,
  videoUrl,
  viewState,
  onViewStateCommit,
  disableControls,
  showInteractionHint = true,
  className,
}: Device3DViewportProps) {
  const glbUrl = resolveDevice3dGlbUrl(deviceId);

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
          fov: 42,
        }}
        gl={{ antialias: true, alpha: true, premultipliedAlpha: false }}
        onCreated={({ gl, scene }) => {
          scene.background = null;
          gl.setClearColor(0x000000, 0);
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.6;
        }}
      >
        <Suspense fallback={null}>
          <Environment preset="studio" environmentIntensity={0.92} />
          {body}
        </Suspense>
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
        <PersistedOrbitControls
          slideId={slideId}
          viewState={viewState}
          onViewCommit={onViewStateCommit}
          disableControls={disableControls}
        />
      </Canvas>
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
