/**
 * Acepta imágenes para el lienzo / subida: el SO a menudo deja `type` vacío (p. ej. .svg).
 */
const SLIDE_IMAGE_EXT =
  /\.(svg|png|apng|jpe?g|gif|webp|bmp|avif|ico|heic|heif)$/i;

export function isUsableSlideImageFile(file: File): boolean {
  const type = file.type.trim().toLowerCase();
  if (type.startsWith("image/")) return true;
  if (type === "application/octet-stream" || type === "") {
    return SLIDE_IMAGE_EXT.test(file.name);
  }
  if (type === "text/xml" || type === "application/xml") {
    return /\.svg$/i.test(file.name);
  }
  return false;
}

/**
 * Tras `readAsDataURL`, corrige el prefijo MIME cuando el blob venía sin tipo (típico en .svg).
 */
export function coerceImageDataUrlForSlideFile(
  dataUrl: string,
  file: File,
): string {
  const name = file.name.toLowerCase();
  const i = dataUrl.indexOf("base64,");
  if (i === -1) return dataUrl;
  const head = dataUrl.slice(0, i).toLowerCase();
  const b64 = dataUrl.slice(i);

  if (/\.svg$/i.test(name)) {
    if (
      head.includes("image/svg+xml") ||
      head.includes("image/svg%2bxml")
    ) {
      return dataUrl;
    }
    if (
      head.startsWith("data:application/octet-stream") ||
      head.startsWith("data:text/xml") ||
      head.startsWith("data:application/xml") ||
      head === "data:" ||
      head.startsWith("data:;")
    ) {
      return `data:image/svg+xml;${b64}`;
    }
  }

  if (
    head.startsWith("data:application/octet-stream") ||
    head === "data:" ||
    head.startsWith("data:;")
  ) {
    if (/\.jpe?g$/i.test(name)) return `data:image/jpeg;${b64}`;
    if (/\.png$/i.test(name)) return `data:image/png;${b64}`;
    if (/\.webp$/i.test(name)) return `data:image/webp;${b64}`;
    if (/\.gif$/i.test(name)) return `data:image/gif;${b64}`;
  }

  return dataUrl;
}

/** Algunos navegadores / WebViews no listan `Files` en `types` hasta el drop. */
export function dragDataTransferHasFileOffer(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  try {
    if ([...dt.types].includes("Files")) return true;
    for (let i = 0; i < dt.items.length; i++) {
      if (dt.items[i]?.kind === "file") return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function pickImageFileFromClipboardData(
  data: ClipboardEvent["clipboardData"] | null,
): File | null {
  if (!data?.items?.length) return null;
  for (const it of Array.from(data.items)) {
    if (it.kind === "file") {
      const f = it.getAsFile();
      if (f && isUsableSlideImageFile(f)) return f;
    }
    if (it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f && isUsableSlideImageFile(f)) return f;
    }
  }
  return null;
}
