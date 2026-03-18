/**
 * Redimensiona y comprime imágenes raster para slides (local, nube y carga).
 * Prioriza WebP; fallback JPEG si el navegador no codifica WebP.
 */

/** Máximo en el lado largo (px); suficiente para proyector / pantallas HD. */
export const SLIDE_IMAGE_MAX_EDGE = 1920;

const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.86;
/** Si ya es WebP por debajo de esto, no re-encodificar (evita pérdida doble). */
const WEBP_SKIP_REENCODE_BYTES = 450_000;

function dataUrlByteLength(dataUrl: string): number {
  const i = dataUrl.indexOf("base64,");
  if (i === -1) return 0;
  const b64 = dataUrl.slice(i + 7).replace(/\s/g, "");
  return Math.floor((b64.length * 3) / 4);
}

function decodeDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)?;base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const mime = (m[1] || "image/png").split(";")[0].trim();
  const b64 = m[2]!.replace(/\s/g, "");
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime, bytes };
  } catch {
    return null;
  }
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return `data:${mime};base64,${btoa(bin)}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  preferWebp: boolean
): Promise<{ blob: Blob; mime: string } | null> {
  const tryWebp = (): Promise<Blob | null> =>
    new Promise((res) => {
      canvas.toBlob((b) => res(b), "image/webp", WEBP_QUALITY);
    });
  const tryJpeg = (): Promise<Blob | null> =>
    new Promise((res) => {
      canvas.toBlob((b) => res(b), "image/jpeg", JPEG_QUALITY);
    });

  if (preferWebp) {
    const w = await tryWebp();
    if (w && w.size > 0) return { blob: w, mime: "image/webp" };
  }
  const j = await tryJpeg();
  if (j && j.size > 0) return { blob: j, mime: "image/jpeg" };
  if (preferWebp) {
    const w2 = await tryWebp();
    if (w2 && w2.size > 0) return { blob: w2, mime: "image/webp" };
  }
  return null;
}

async function rasterSourceToOptimizedDataUrl(
  src: string,
  originalByteHint: number
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  const img = new Image();
  img.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("image load"));
  });
  img.src = src;
  try {
    await loaded;
  } catch {
    return null;
  }

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (!w || !h) return null;

  const max = SLIDE_IMAGE_MAX_EDGE;
  if (w > max || h > max) {
    if (w >= h) {
      h = Math.max(1, Math.round((h * max) / w));
      w = max;
    } else {
      w = Math.max(1, Math.round((w * max) / h));
      h = max;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  const encoded = await encodeCanvas(canvas, true);
  if (!encoded) return null;
  const buf = new Uint8Array(await encoded.blob.arrayBuffer());
  if (buf.length >= originalByteHint * 0.98 && originalByteHint > 50_000) {
    return null;
  }
  return bytesToDataUrl(buf, encoded.mime);
}

/**
 * Optimiza un data URL de imagen (PNG/JPEG/WebP de IA o archivo).
 * GIF/SVG se devuelven sin cambios.
 */
export async function optimizeImageDataUrl(dataUrl: string): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  const t = dataUrl.trim();
  if (!t.startsWith("data:image/")) return dataUrl;
  const head = t.slice(0, 40).toLowerCase();
  if (head.includes("svg") || head.includes("gif")) return dataUrl;

  const decoded = decodeDataUrl(t);
  if (!decoded) return dataUrl;
  const { mime, bytes } = decoded;
  if (!/^image\/(png|jpe?g|webp)$/i.test(mime)) return dataUrl;

  const isWebp = /^image\/webp$/i.test(mime);
  if (isWebp && bytes.length <= WEBP_SKIP_REENCODE_BYTES) {
    const img = new Image();
    const ok = await new Promise<boolean>((res) => {
      img.onload = () =>
        res(img.naturalWidth <= SLIDE_IMAGE_MAX_EDGE && img.naturalHeight <= SLIDE_IMAGE_MAX_EDGE);
      img.onerror = () => res(false);
      img.src = t;
    });
    if (ok) return t;
  }

  const hint = bytes.length;
  try {
    const out = await rasterSourceToOptimizedDataUrl(t, hint);
    return out ?? t;
  } catch {
    return dataUrl;
  }
}

export type CloudImagePayload = {
  bytes: Uint8Array;
  contentType: string;
  ext: string;
};

function extFromMime(mime: string): string {
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  return "png";
}

/**
 * Prepara bytes para subida a Storage: comprime raster; no toca SVG/GIF.
 */
export async function optimizeRasterBytesForCloud(
  bytes: Uint8Array,
  contentType: string
): Promise<CloudImagePayload | null> {
  if (typeof document === "undefined") return null;
  const mime = contentType.split(";")[0].trim().toLowerCase();
  if (mime === "image/svg+xml" || mime === "image/gif") return null;
  if (!/^image\/(png|jpe?g|webp)$/i.test(mime)) return null;

  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const dataUrl = await rasterSourceToOptimizedDataUrl(url, bytes.length);
    if (!dataUrl) return null;
    const d = decodeDataUrl(dataUrl);
    if (!d) return null;
    return {
      bytes: d.bytes,
      contentType: d.mime,
      ext: extFromMime(d.mime),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Data URL → payload listo para Firebase (comprime si aporta).
 */
export async function dataUrlToCloudImagePayload(dataUrl: string): Promise<CloudImagePayload | null> {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return null;
  const mime = decoded.mime.toLowerCase();
  if (mime === "image/svg+xml" || mime === "image/gif") {
    return {
      bytes: decoded.bytes,
      contentType: decoded.mime,
      ext: mime.includes("gif") ? "gif" : "svg",
    };
  }
  if (!/^image\/(png|jpe?g|webp)$/i.test(mime)) {
    return {
      bytes: decoded.bytes,
      contentType: decoded.mime,
      ext: extFromMime(mime),
    };
  }

  const optimized = await optimizeImageDataUrl(dataUrl);
  const finalDecode = decodeDataUrl(optimized);
  if (!finalDecode) return null;
  return {
    bytes: finalDecode.bytes,
    contentType: finalDecode.mime,
    ext: extFromMime(finalDecode.mime),
  };
}
