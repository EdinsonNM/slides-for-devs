import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform float uIntensity;
uniform float uScale;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = vUv * uScale;
  float t = uTime * 0.35;
  float n1 = noise(uv * 2.3 + vec2(t * 0.7, t * 0.5));
  float n2 = noise(uv * 3.1 + vec2(-t * 0.4, t * 0.8));
  float n3 = noise(uv * 1.4 + vec2(t * 0.2, -t * 0.6));
  float f = (n1 * 0.5 + n2 * 0.35 + n3 * 0.15) * uIntensity;
  vec3 deep = vec3(0.01, 0.02, 0.08);
  vec3 mid = vec3(0.05, 0.15, 0.35);
  vec3 glow = vec3(0.15, 0.45, 0.55);
  vec3 col = mix(deep, mid, smoothstep(0.2, 0.65, f));
  col = mix(col, glow, smoothstep(0.55, 1.0, f) * 0.85);
  /* Sin viñeta: en modo presentador/preview full-bleed los bordes deben
   * mantener la misma luminosidad que el centro. */
  col *= 1.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface LiquidEtherBackdropInnerProps {
  intensity: number;
  speed: number;
  scale: number;
}

export function LiquidEtherBackdropInner({
  intensity,
  speed,
  scale,
}: LiquidEtherBackdropInnerProps) {
  const { size } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uIntensity: { value: intensity },
      uScale: { value: scale },
    }),
    [intensity, scale],
  );

  useEffect(() => {
    uniforms.uIntensity.value = intensity;
    uniforms.uScale.value = scale;
  }, [intensity, scale, uniforms]);

  useFrame((_, delta) => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    uniforms.uTime.value += delta * speed;
    uniforms.uResolution.value.set(size.width, size.height);
  });

  return (
    <mesh position={[0, 0, 0]} scale={[2.35, 2.35, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms as unknown as { [key: string]: THREE.IUniform }}
        vertexShader={VERT}
        fragmentShader={FRAG}
        depthWrite={false}
      />
    </mesh>
  );
}
