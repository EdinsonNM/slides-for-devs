import type { MutableRefObject } from "react";
import type { Slide } from "../../types";
import type { CanvasTextEditTargets } from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";

export type PresentationSlideCanvasMutationsDeps = {
  setSlides: (slides: Slide[] | ((prev: Slide[]) => Slide[])) => void;
  currentIndexRef: MutableRefObject<number>;
  slidesRef: MutableRefObject<Slide[]>;
  canvasTextTargetsRef: MutableRefObject<CanvasTextEditTargets>;
  setCanvasMediaPanelEditTarget: (
    elementId: string | null,
    options?: { rehydrateCodeBuffers?: boolean },
  ) => void;
  resolvePresenter3dMediaPatchElementId: (
    slide: Slide,
    explicitMediaPanelElementId?: string | null,
  ) => string | null;
};
