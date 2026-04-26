import { SLIDE_TYPE, type SlideType } from "./Slide";

/** Panel «Propiedades del slide» (fondo con imagen): no aplica a isométrico, mapa mental ni mapa. */
export function isInspectorSlidePropertiesSectionVisible(type: SlideType): boolean {
  return (
    type !== SLIDE_TYPE.ISOMETRIC &&
    type !== SLIDE_TYPE.MIND_MAP &&
    type !== SLIDE_TYPE.MAPS &&
    type !== SLIDE_TYPE.DOCUMENT
  );
}

export function isInspectorScene3dSectionVisible(type: SlideType): boolean {
  return type === SLIDE_TYPE.CANVAS_3D;
}

export function isInspectorMapSlideSectionVisible(type: SlideType): boolean {
  return type === SLIDE_TYPE.MAPS;
}

/** Inspector «Cámara»: solo en diapositivas con lienzo y panel de media (contenido / capítulo). */
export function isInspectorCameraSectionVisible(type: SlideType): boolean {
  return type === SLIDE_TYPE.CONTENT || type === SLIDE_TYPE.CHAPTER;
}

/**
 * Tipos donde `slideBackgroundImageUrl` / `slideBackgroundColor` se pintan detrás del lienzo 2D
 * (junto a `DeckBackdrop`).
 */
export function slideTypeUsesSlideDeckBackgroundImage(type: SlideType): boolean {
  return (
    type === SLIDE_TYPE.CONTENT ||
    type === SLIDE_TYPE.CHAPTER ||
    type === SLIDE_TYPE.DIAGRAM ||
    type === SLIDE_TYPE.MATRIX
  );
}
