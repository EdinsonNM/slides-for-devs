/** Convierte el payload base64 de un data URL en `ArrayBuffer`. */
export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const m = /^data:[^;]+;base64,(.+)$/i.exec(dataUrl.trim());
  if (!m?.[1]) {
    throw new Error("dataUrl inválido: se esperaba base64");
  }
  const binary = atob(m[1]!);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Texto UTF-8 desde data URL (texto o base64). */
export function textFromDataUrl(dataUrl: string): string {
  const s = dataUrl.trim();
  const comma = s.indexOf(",");
  if (comma < 0) return "";
  const header = s.slice(0, comma);
  const payload = s.slice(comma + 1);
  if (header.includes(";base64")) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder("utf-8").decode(bytes);
  }
  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}
