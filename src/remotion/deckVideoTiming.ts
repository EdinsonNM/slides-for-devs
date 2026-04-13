/**
 * Timing del vídeo de presentación alineado con la guía Remotion
 * (animaciones en segundos × fps, ver skills/remotion/rules/timing.md).
 */
import { DECK_VIDEO_FRAMES_PER_SLIDE } from "./deckVideoConstants";

export function secToFrames(fps: number, seconds: number): number {
  return Math.max(1, Math.round(seconds * fps));
}

/** Duración de la fase de salida (ease-in hacia fuera). */
export function deckExitPhaseFrames(fps: number): number {
  return secToFrames(fps, 1.05);
}

/** Primeros frames: velo / entrada global (fundido suave). */
export function deckSceneVeilFrames(fps: number): number {
  return secToFrames(fps, 0.82);
}

/** Fin de la rampa de entrada coordinada (fundido suave). */
export function deckEnterEndFrame(fps: number): number {
  return secToFrames(fps, 1.02);
}

export function deckSlideExitStart(fps: number): number {
  return DECK_VIDEO_FRAMES_PER_SLIDE - deckExitPhaseFrames(fps);
}

/** Último frame donde el contenido principal sigue “estable” antes de la salida. */
export function deckContentLastFrame(fps: number): number {
  return Math.max(0, deckSlideExitStart(fps) - 1);
}

/**
 * Fases de lectura: título → pausa → subtítulo → pausa → imágenes → cuerpo.
 * Si no cabe, acorta primero bloque de imágenes, luego subtítulo, luego título.
 */
export type DeckSlideReadPhases = {
  titleTwStart: number;
  titleTwEnd: number;
  subtitleStart: number;
  subtitleWordsEnd: number;
  imageBlockStart: number;
  imageBlockEnd: number;
  bodyStart: number;
  contentLastFrame: number;
};

export function computeDeckSlideReadPhases(
  fps: number,
  params: {
    subWordCount: number;
    hasSub: boolean;
    bodyWordCount: number;
    hasBody: boolean;
    imageCount: number;
    isChapter: boolean;
  },
): DeckSlideReadPhases {
  const contentLastFrame = deckContentLastFrame(fps);
  const h = (sec: number) => secToFrames(fps, sec);

  const bodyWords = params.hasBody && !params.isChapter ? params.bodyWordCount : 0;
  const heavyBody = bodyWords > 55;
  const subTwMaxSec = heavyBody ? 2.05 : 2.85;

  const titleTwStart = h(0.14);
  /** Fin de la aparición del título (fade/slide), sin typewriter. */
  let titleTwDur = h(0.58);
  let pauseAfterTitle = h(0.62);

  let subtitleWordsDur =
    params.hasSub && params.subWordCount > 0
      ? Math.max(
          h(1.05),
          Math.min(h(subTwMaxSec), params.subWordCount * h(0.125)),
        )
      : 0;
  let pauseAfterSub = params.hasSub && params.subWordCount > 0 ? h(0.48) : h(0.22);

  const imgN = params.isChapter
    ? Math.min(params.imageCount, 2)
    : Math.min(params.imageCount, 3);
  let imageBlockDur =
    imgN > 0
      ? Math.max(h(0.95), Math.min(h(2.15), imgN * h(0.62)))
      : 0;

  const gapBeforeBody = imgN > 0 ? h(0.2) : h(0.35);
  const minBody = params.hasBody && !params.isChapter ? h(1.22) : 0;

  const rebuild = () => {
    const titleTwEnd = titleTwStart + titleTwDur;
    const subtitleStart = titleTwEnd + pauseAfterTitle;
    const subtitleWordsEnd = subtitleStart + subtitleWordsDur;
    const imageBlockStart = subtitleWordsEnd + pauseAfterSub;
    const imageBlockEnd = imageBlockStart + imageBlockDur;
    let bodyStart = imageBlockEnd + gapBeforeBody;
    if (!params.hasBody || params.isChapter) {
      bodyStart = contentLastFrame + 1;
    }
    return {
      titleTwStart,
      titleTwEnd,
      subtitleStart,
      subtitleWordsEnd,
      imageBlockStart,
      imageBlockEnd,
      bodyStart,
      contentLastFrame,
    };
  };

  let phases = rebuild();

  for (let i = 0; i < 500; i++) {
    phases = rebuild();
    if (
      !params.hasBody ||
      params.isChapter ||
      phases.bodyStart + minBody <= contentLastFrame
    ) {
      break;
    }
    if (imageBlockDur > h(0.58) && imgN > 0) {
      imageBlockDur -= 1;
      continue;
    }
    if (pauseAfterSub > h(0.16) && params.subWordCount > 0) {
      pauseAfterSub -= 1;
      continue;
    }
    if (subtitleWordsDur > h(0.68) && params.subWordCount > 0) {
      subtitleWordsDur -= 1;
      continue;
    }
    if (pauseAfterTitle > h(0.22)) {
      pauseAfterTitle -= 1;
      continue;
    }
    if (titleTwDur > h(0.42)) {
      titleTwDur -= 1;
      continue;
    }
    if (subtitleWordsDur > h(0.5) && params.subWordCount > 0) {
      subtitleWordsDur -= 1;
      continue;
    }
    break;
  }

  phases = rebuild();

  if (params.hasBody && !params.isChapter && phases.bodyStart + minBody > contentLastFrame) {
    phases = {
      ...phases,
      bodyStart: Math.max(
        phases.subtitleWordsEnd + h(0.1),
        contentLastFrame - minBody + 1,
      ),
    };
  }

  return phases;
}
