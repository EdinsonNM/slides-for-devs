import { useThree } from "@react-three/fiber";
import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";

const _offset = new THREE.Vector3();
const _panLeft = new THREE.Vector3();
const _panUp = new THREE.Vector3();

/** Igual que OrbitControls._pan (perspectiva) pero solo desplaza la cámara; el target no cambia. */
function panCameraWithoutMovingTarget(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  deltaX: number,
  deltaY: number,
  target: THREE.Vector3,
  screenSpacePanning: boolean,
) {
  _offset.copy(camera.position).sub(target);
  let targetDistance = _offset.length();
  targetDistance *= Math.tan((camera.fov / 2) * THREE.MathUtils.DEG2RAD);

  const h = domElement.clientHeight || 1;
  const scaleX = (2 * deltaX * targetDistance) / h;
  const scaleY = (2 * deltaY * targetDistance) / h;

  camera.updateMatrixWorld();

  _panLeft.setFromMatrixColumn(camera.matrix, 0).multiplyScalar(-scaleX);

  if (screenSpacePanning) {
    _panUp.setFromMatrixColumn(camera.matrix, 1);
  } else {
    _panUp.setFromMatrixColumn(camera.matrix, 0);
    _panUp.crossVectors(camera.up, _panUp);
  }
  _panUp.multiplyScalar(scaleY);

  camera.position.add(_panLeft).add(_panUp);
}

export interface FixedTargetOrbitPanControlsLike {
  readonly target: THREE.Vector3;
  readonly domElement: HTMLElement;
}

/**
 * Paneo con pivote fijo: mueve solo la posición de la cámara (como truck),
 * de modo que OrbitControls siga rotando alrededor del mismo `target` (p. ej. centro del modelo).
 */
export function useFixedTargetOrbitPan(
  controlsRef: RefObject<FixedTargetOrbitPanControlsLike | null>,
  enabled: boolean,
) {
  const { camera, gl, invalidate } = useThree();
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;
    const screenSpacePanning = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const ctrl = controlsRef.current;
      if (!ctrl || !(camera instanceof THREE.PerspectiveCamera)) return;

      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };

      panCameraWithoutMovingTarget(
        camera,
        ctrl.domElement,
        dx,
        dy,
        ctrl.target,
        screenSpacePanning,
      );
      invalidate();
    };

    const stop = (e: PointerEvent) => {
      if (e.button !== 2) return;
      dragging.current = false;
    };

    const onContextMenu = (e: Event) => {
      e.preventDefault();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
    el.addEventListener("contextmenu", onContextMenu);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", stop);
      el.removeEventListener("pointercancel", stop);
      el.removeEventListener("contextmenu", onContextMenu);
    };
  }, [enabled, camera, gl, controlsRef, invalidate]);
}
