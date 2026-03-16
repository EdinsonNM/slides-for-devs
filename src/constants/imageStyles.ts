import type { ImageStyle } from "../types";

export const IMAGE_STYLES: ImageStyle[] = [
  {
    id: "minimalist",
    name: "Minimalista",
    prompt:
      "estilo minimalista, limpio, fondo neutro, alta calidad, profesional",
  },
  {
    id: "cinematic",
    name: "Cinematográfico",
    prompt:
      "estilo cinematográfico, iluminación dramática, 8k, hiperdetallado, realista",
  },
  {
    id: "illustration",
    name: "Ilustración",
    prompt:
      "estilo ilustración moderna, colores planos, arte digital, limpio, vectorial",
  },
  {
    id: "3d",
    name: "Render 3D",
    prompt:
      "estilo render 3D, suave, iluminación global, estilo Apple, materiales premium",
  },
  {
    id: "abstract",
    name: "Abstracto",
    prompt:
      "estilo abstracto, formas geométricas, conceptual, artístico, colores vibrantes",
  },
  {
    id: "tech-cartoon",
    name: "Tech Cartoon",
    prompt:
      "estilo cartoon 2D únicamente, plano, no 3D bajo ningún concepto, no render 3D, no realista, no anime, no acuarela, no sketch pesado, sin textura fotográfica, limpio y plano con sombreado simple, composición clara sin sobrecargar",
  },
  {
    id: "realistic-diagram",
    name: "Diagrama realista",
    prompt:
      "diagrama 2D minimalista, máximo 4-5 elementos (cajas o iconos), un solo flujo de izquierda a derecha o arriba abajo, pocas flechas que no se crucen, sin texto ni etiquetas, fondo blanco, hand-drawn limpio, composición simple que transmita una sola idea clara",
  },
];
