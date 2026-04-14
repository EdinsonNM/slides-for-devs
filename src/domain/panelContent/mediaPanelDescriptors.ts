import type { Slide } from "../entities/Slide";
import {
  PANEL_CONTENT_KIND,
  type PanelContentKind,
  normalizePanelContentKind,
} from "./panelContentKind";

/**
 * Comportamiento del panel de media según su tipo: sustituye ramas `if (contentType === "…")`
 * dispersas por polimorfismo (métodos por subclase).
 *
 * Los datos siguen viniendo de `Slide` / JSON; esto no reemplaza el modelo persistido,
 * solo centraliza reglas de UI, exportación y lienzo.
 */
export abstract class MediaPanelDescriptor {
  abstract readonly kind: PanelContentKind;

  /** Lienzo: franja superior para mover el bloque sin interferir con OrbitControls. */
  usesOrbitInteractionChrome(): boolean {
    return false;
  }

  /** Barra IA / layout: mostrar acceso rápido a vídeo. */
  showSlideContentVideoToolbar(): boolean {
    return false;
  }

  /** Lienzo flotante: acciones de imagen en la barra del bloque media. */
  showCanvasToolbarImageActions(): boolean {
    return false;
  }

  showCanvasToolbarCodeActions(): boolean {
    return false;
  }

  showCanvasToolbarVideoModal(): boolean {
    return false;
  }

  /** PPTX: el cuerpo del slide usa layout de dos columnas (panel derecho). */
  splitPanelOccupied(slide: Slide): boolean {
    void slide;
    return false;
  }

  /** Etiqueta corta en el resumen del presentador (null = no mostrar badge por tipo). */
  presenterSummaryBadge(): string | null {
    return null;
  }

  /** Clase de la franja del panel en la miniatura de la barra lateral. */
  sidebarSplitStripSurfaceClass(hasImageUrl: boolean): string {
    void hasImageUrl;
    return "";
  }
}

export class ImageMediaPanelDescriptor extends MediaPanelDescriptor {
  readonly kind = PANEL_CONTENT_KIND.IMAGE;

  override showCanvasToolbarImageActions(): boolean {
    return true;
  }

  override splitPanelOccupied(slide: Slide): boolean {
    return Boolean(slide.imageUrl?.trim());
  }

  override sidebarSplitStripSurfaceClass(hasImageUrl: boolean): string {
    if (!hasImageUrl) {
      return "bg-stone-100 dark:bg-stone-700 animate-pulse";
    }
    return "";
  }
}

export class CodeMediaPanelDescriptor extends MediaPanelDescriptor {
  readonly kind = PANEL_CONTENT_KIND.CODE;

  override showCanvasToolbarCodeActions(): boolean {
    return true;
  }

  override splitPanelOccupied(slide: Slide): boolean {
    return Boolean(slide.code?.trim());
  }

  override presenterSummaryBadge(): string | null {
    return "Código";
  }

  override sidebarSplitStripSurfaceClass(): string {
    return "bg-amber-100/80 dark:bg-amber-900/40";
  }
}

export class VideoMediaPanelDescriptor extends MediaPanelDescriptor {
  readonly kind = PANEL_CONTENT_KIND.VIDEO;

  override showSlideContentVideoToolbar(): boolean {
    return true;
  }

  override showCanvasToolbarVideoModal(): boolean {
    return true;
  }

  override splitPanelOccupied(slide: Slide): boolean {
    return Boolean(slide.videoUrl?.trim());
  }

  override presenterSummaryBadge(): string | null {
    return "Video";
  }

  override sidebarSplitStripSurfaceClass(): string {
    return "bg-sky-100/80 dark:bg-sky-900/40";
  }
}

export class Presenter3dMediaPanelDescriptor extends MediaPanelDescriptor {
  readonly kind = PANEL_CONTENT_KIND.PRESENTER_3D;

  override usesOrbitInteractionChrome(): boolean {
    return true;
  }

  override splitPanelOccupied(): boolean {
    return true;
  }

  override presenterSummaryBadge(): string | null {
    return "Presentador 3D";
  }

  override sidebarSplitStripSurfaceClass(): string {
    return "bg-violet-100/80 dark:bg-violet-900/40";
  }
}

export class Canvas3dMediaPanelDescriptor extends MediaPanelDescriptor {
  readonly kind = PANEL_CONTENT_KIND.CANVAS_3D;

  override usesOrbitInteractionChrome(): boolean {
    return true;
  }

  override splitPanelOccupied(): boolean {
    return true;
  }

  override presenterSummaryBadge(): string | null {
    return "Canvas 3D";
  }

  override sidebarSplitStripSurfaceClass(): string {
    return "bg-teal-100/80 dark:bg-teal-900/40";
  }
}

const DESCRIPTORS: Record<PanelContentKind, MediaPanelDescriptor> = {
  [PANEL_CONTENT_KIND.IMAGE]: new ImageMediaPanelDescriptor(),
  [PANEL_CONTENT_KIND.CODE]: new CodeMediaPanelDescriptor(),
  [PANEL_CONTENT_KIND.VIDEO]: new VideoMediaPanelDescriptor(),
  [PANEL_CONTENT_KIND.PRESENTER_3D]: new Presenter3dMediaPanelDescriptor(),
  [PANEL_CONTENT_KIND.CANVAS_3D]: new Canvas3dMediaPanelDescriptor(),
};

export function resolveMediaPanelDescriptor(
  slide: Pick<Slide, "contentType">,
): MediaPanelDescriptor {
  return DESCRIPTORS[normalizePanelContentKind(slide.contentType)];
}
