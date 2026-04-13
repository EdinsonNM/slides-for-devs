import { renderMediaOnWeb } from "@remotion/web-renderer";
import { DeckVideoComposition } from "../remotion/DeckVideoComposition";
import {
  DECK_VIDEO_FPS,
  DECK_VIDEO_HEIGHT,
  DECK_VIDEO_WIDTH,
  getDeckVideoDurationInFrames,
} from "../remotion/deckVideoConstants";
import type { DeckRemotionSlide } from "../remotion/deckVideoTypes";
import { isTauri } from "./updater";

function safeFileBasename(topic: string): string {
  const t = (topic || "presentacion")
    .replace(/[^\w\s-áéíóúñüÁÉÍÓÚÑÜ]/gi, "")
    .trim()
    .slice(0, 80);
  return t || "presentacion";
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode.apply(
      null,
      Array.from(sub) as unknown as number[],
    );
  }
  return btoa(binary);
}

export async function renderDeckVideoToBlob(
  slidesPayload: DeckRemotionSlide[],
  opts?: {
    onProgress?: (progress01: number) => void;
    signal?: AbortSignal;
  },
): Promise<Blob> {
  if (slidesPayload.length === 0) {
    throw new Error("No hay diapositivas para exportar.");
  }
  const durationInFrames = getDeckVideoDurationInFrames(slidesPayload.length);
  const { getBlob } = await renderMediaOnWeb({
    composition: {
      id: "SlaimDeckExport",
      component: DeckVideoComposition,
      durationInFrames,
      fps: DECK_VIDEO_FPS,
      width: DECK_VIDEO_WIDTH,
      height: DECK_VIDEO_HEIGHT,
      defaultProps: { slides: slidesPayload },
    },
    inputProps: { slides: slidesPayload },
    muted: true,
    signal: opts?.signal,
    isProduction: false,
    onProgress: opts?.onProgress
      ? ({ progress }) => opts.onProgress!(progress)
      : undefined,
  });
  return getBlob();
}

export async function downloadDeckPresentationMp4(params: {
  topic: string;
  slidesPayload: DeckRemotionSlide[];
  onProgress?: (progress01: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const blob = await renderDeckVideoToBlob(params.slidesPayload, {
    onProgress: params.onProgress,
    signal: params.signal,
  });
  const fileName = `${safeFileBasename(params.topic)}.mp4`;

  if (isTauri()) {
    const base64 = await blobToBase64(blob);
    const { save: openSaveDialog } = await import("@tauri-apps/plugin-dialog");
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await openSaveDialog({
      defaultPath: fileName,
      filters: [{ name: "Video MP4", extensions: ["mp4"] }],
    });
    if (path) {
      await invoke("write_binary_file", {
        path,
        base64Content: base64,
      });
    }
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
