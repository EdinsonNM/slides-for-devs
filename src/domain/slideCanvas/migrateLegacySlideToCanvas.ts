import { SLIDE_TYPE, type Slide } from "../entities";
import {
  clampCanvasRect,
  type SlideCanvasElement,
  type SlideCanvasRect,
  type SlideCanvasScene,
  SLIDE_CANVAS_SCENE_VERSION,
} from "../entities/SlideCanvas";

const DEFAULT_IMAGE_WIDTH_PERCENT = 40;
const DEFAULT_PANEL_HEIGHT_PERCENT = 85;

function el(
  id: string,
  kind: SlideCanvasElement["kind"],
  z: number,
  rect: SlideCanvasRect,
): SlideCanvasElement {
  return { id, kind, z, rect: clampCanvasRect(rect) };
}

/**
 * Construye una escena inicial a partir del modelo legacy (tipo, layouts y campos planos).
 * Se usa al abrir slides antiguos o tras cambiar plantilla (cuando se borra `canvasScene`).
 */
export function migrateLegacySlideToCanvas(slide: Slide): SlideCanvasScene {
  switch (slide.type) {
    case SLIDE_TYPE.DIAGRAM:
      return {
        version: SLIDE_CANVAS_SCENE_VERSION,
        elements: [
          el("canvas-excalidraw", "excalidraw", 1, {
            x: 0,
            y: 0,
            w: 100,
            h: 100,
          }),
        ],
      };

    case SLIDE_TYPE.CHAPTER:
      return {
        version: SLIDE_CANVAS_SCENE_VERSION,
        elements: [
          el("canvas-chapter-title", "chapterTitle", 2, {
            x: 8,
            y: 36,
            w: 84,
            h: 20,
          }),
          el("canvas-chapter-subtitle", "chapterSubtitle", 3, {
            x: 10,
            y: 58,
            w: 80,
            h: 12,
          }),
        ],
      };

    case SLIDE_TYPE.MATRIX: {
      const hasSub = Boolean(slide.subtitle?.trim());
      const tableTop = hasSub ? 20 : 12;
      const tableH = hasSub ? 56 : 64;
      return {
        version: SLIDE_CANVAS_SCENE_VERSION,
        elements: [
          el("canvas-matrix-title", "title", 2, { x: 4, y: 3, w: 92, h: 9 }),
          ...(hasSub
            ? [
                el("canvas-matrix-subtitle", "subtitle", 3, {
                  x: 4,
                  y: 12,
                  w: 92,
                  h: 7,
                }),
              ]
            : []),
          el("canvas-matrix-table", "matrix", 4, {
            x: 3,
            y: tableTop,
            w: 94,
            h: tableH,
          }),
          el("canvas-matrix-notes", "matrixNotes", 5, {
            x: 4,
            y: tableTop + tableH + 2,
            w: 92,
            h: Math.max(12, 98 - (tableTop + tableH + 2)),
          }),
        ],
      };
    }

    case SLIDE_TYPE.CONTENT:
    default: {
      const layout = slide.contentLayout ?? "split";
      if (layout === "panel-full") {
        const ph = slide.panelHeightPercent ?? DEFAULT_PANEL_HEIGHT_PERCENT;
        const topH = 100 - ph;
        const titleBlockH = Math.max(topH * 0.42, 10);
        const subH = Math.min(Math.max(topH * 0.22, 6), topH - titleBlockH - 2);
        return {
          version: SLIDE_CANVAS_SCENE_VERSION,
          elements: [
            el("canvas-pf-title", "title", 2, {
              x: 4,
              y: 2,
              w: 92,
              h: titleBlockH,
            }),
            el("canvas-pf-subtitle", "subtitle", 3, {
              x: 4,
              y: 2 + titleBlockH,
              w: 92,
              h: subH,
            }),
            el("canvas-pf-media", "mediaPanel", 5, {
              x: 2,
              y: topH,
              w: 96,
              h: ph,
            }),
          ],
        };
      }
      if (layout === "full") {
        return {
          version: SLIDE_CANVAS_SCENE_VERSION,
          elements: [
            el("canvas-sec", "sectionLabel", 1, { x: 4, y: 3, w: 50, h: 5 }),
            el("canvas-title", "title", 2, { x: 4, y: 9, w: 92, h: 11 }),
            el("canvas-subtitle", "subtitle", 3, { x: 4, y: 21, w: 92, h: 7 }),
            el("canvas-markdown", "markdown", 4, { x: 4, y: 29, w: 92, h: 68 }),
          ],
        };
      }
      /* split */
      const iw = slide.imageWidthPercent ?? DEFAULT_IMAGE_WIDTH_PERCENT;
      const gap = 3;
      const textW = Math.max(28, 100 - iw - gap);
      const mediaX = textW + gap * 0.5;
      const mediaW = Math.min(iw, 100 - mediaX - 2);
      return {
        version: SLIDE_CANVAS_SCENE_VERSION,
        elements: [
          el("canvas-sec", "sectionLabel", 1, { x: 3, y: 3, w: 44, h: 5 }),
          el("canvas-title", "title", 2, { x: 3, y: 9, w: textW - 2, h: 11 }),
          el("canvas-subtitle", "subtitle", 3, { x: 3, y: 21, w: textW - 2, h: 7 }),
          el("canvas-markdown", "markdown", 4, { x: 3, y: 29, w: textW - 2, h: 68 }),
          el("canvas-media", "mediaPanel", 5, {
            x: mediaX,
            y: 3,
            w: mediaW,
            h: 94,
          }),
        ],
      };
    }
  }
}
