import { Canvas } from "@react-three/fiber";
import { LiquidEtherBackdropInner } from "./LiquidEtherBackdrop";

export interface LiquidEtherBackdropCanvasProps {
  intensity: number;
  speed: number;
  scale: number;
}

/**
 * Canvas WebGL a pantalla completa para el preset animado (carga diferida desde DeckBackdrop).
 */
export default function LiquidEtherBackdropCanvas({
  intensity,
  speed,
  scale,
}: LiquidEtherBackdropCanvasProps) {
  return (
    <Canvas
      className="!absolute inset-0 h-full w-full touch-none"
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
      gl={{ alpha: false, antialias: true, powerPreference: "default" }}
      camera={{ position: [0, 0, 1.85], fov: 42 }}
      dpr={[1, 1.75]}
    >
      <color attach="background" args={["#020617"]} />
      <LiquidEtherBackdropInner
        intensity={intensity}
        speed={speed}
        scale={scale}
      />
    </Canvas>
  );
}
