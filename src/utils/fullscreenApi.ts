/** Elemento en pantalla completa (estándar + prefijos legacy). */
export function getFullscreenElement(): Element | null {
  const d = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return (
    document.fullscreenElement ??
    d.webkitFullscreenElement ??
    d.mozFullScreenElement ??
    d.msFullscreenElement ??
    null
  );
}

export function elementSupportsRequestFullscreen(el: HTMLElement): boolean {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => void;
    mozRequestFullScreen?: () => void;
    msRequestFullscreen?: () => void;
  };
  return (
    typeof el.requestFullscreen === "function" ||
    typeof anyEl.webkitRequestFullscreen === "function" ||
    typeof anyEl.mozRequestFullScreen === "function" ||
    typeof anyEl.msRequestFullscreen === "function"
  );
}

export function requestElementFullscreen(el: HTMLElement): Promise<void> {
  const anyEl = el as HTMLElement & {
    webkitRequestFullscreen?: () => void;
    mozRequestFullScreen?: () => void;
    msRequestFullscreen?: () => void;
  };
  if (typeof el.requestFullscreen === "function") {
    return el.requestFullscreen();
  }
  if (typeof anyEl.webkitRequestFullscreen === "function") {
    anyEl.webkitRequestFullscreen();
    return Promise.resolve();
  }
  if (typeof anyEl.mozRequestFullScreen === "function") {
    anyEl.mozRequestFullScreen();
    return Promise.resolve();
  }
  if (typeof anyEl.msRequestFullscreen === "function") {
    anyEl.msRequestFullscreen();
    return Promise.resolve();
  }
  return Promise.reject(new Error("requestFullscreen no disponible"));
}

export function exitDocumentFullscreen(): Promise<void> {
  const d = document as Document & {
    webkitExitFullscreen?: () => void;
    mozCancelFullScreen?: () => void;
    msExitFullscreen?: () => void;
  };
  if (!getFullscreenElement()) return Promise.resolve();
  if (typeof document.exitFullscreen === "function") {
    return document.exitFullscreen();
  }
  if (typeof d.webkitExitFullscreen === "function") {
    d.webkitExitFullscreen();
    return Promise.resolve();
  }
  if (typeof d.mozCancelFullScreen === "function") {
    d.mozCancelFullScreen();
    return Promise.resolve();
  }
  if (typeof d.msExitFullscreen === "function") {
    d.msExitFullscreen();
    return Promise.resolve();
  }
  return Promise.resolve();
}
