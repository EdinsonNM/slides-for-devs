export const DECK_VIDEO_FPS = 30;
/** Duración fija por diapositiva en el vídeo exportado (3 s). */
export const DECK_VIDEO_FRAMES_PER_SLIDE = 90;
export const DECK_VIDEO_WIDTH = 1920;
export const DECK_VIDEO_HEIGHT = 1080;

export function getDeckVideoDurationInFrames(slideCount: number): number {
  const n = Math.max(1, slideCount);
  return n * DECK_VIDEO_FRAMES_PER_SLIDE;
}
