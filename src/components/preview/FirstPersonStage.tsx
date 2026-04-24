import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { GripHorizontal } from "lucide-react";
import type { Slide } from "../../types";
import {
  FIRST_PERSON_FLOAT_SCALE_MAX,
  FIRST_PERSON_FLOAT_SCALE_MIN,
  FIRST_PERSON_LAYOUTS,
  type FirstPersonFloatState,
  type FirstPersonLayout,
  readFirstPersonFloat,
  writeFirstPersonFloat,
} from "../../constants/firstPersonLayout";
import { normalizeWebcamPanelState } from "../../domain/webcam/webcamPanelModel";
import { cn } from "../../utils/cn";
import { ClaudeDotFadeLayer } from "../shared/ClaudeDotFadeLayer";
import { SlideWebcamView } from "../shared/SlideWebcamView";
import { PreviewSlideContent } from "./PreviewSlideContent";

const powerPointVariants = {
  enter: (direction: 1 | -1) => ({
    opacity: 0,
    x: direction * 40,
    scale: 0.99,
  }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (direction: 1 | -1) => ({
    opacity: 0,
    x: direction * -40,
    scale: 0.99,
  }),
};

type SlideDirection = 1 | -1;

type FirstPersonStageProps = {
  slide: Slide;
  slideIndex: number;
  slideDirection: SlideDirection;
  imageWidthPercent: number;
  panelHeightPercent: number;
  layout: FirstPersonLayout;
  lightAppearance: boolean;
  shellLight: string;
  shellDark: string;
  registerPresenterMapFlyTo: boolean;
};

/** Fracción del ancho del escenario; tope en px, escalado luego por `scale` o `pipW`. */
function baseWidthPx(
  stageW: number,
  kind: "slide-float" | "cam-pip",
): number {
  if (kind === "slide-float") {
    if (stageW < 1) return 360;
    return Math.min(stageW * 0.36, 440);
  }
  if (stageW < 1) return 300;
  return Math.min(stageW * 0.3, 340);
}

/**
 * Base de alto del PiP cámara.
 * Con `pipW === pipH` (p. ej. 100% ambos) el aspecto default coincide con 16:9 del ancho base;
 * al redimensionar, `pipW` y `pipH` se guardan por separado (relación libre).
 */
function baseHeightPipPx(stageW: number, stageH: number): number {
  if (stageH < 1) return 200;
  const w = baseWidthPx(stageW, "cam-pip");
  const h169 = (w * 9) / 16;
  return Math.min(Math.max(100, h169), stageH * 0.5, 420);
}

export function FirstPersonStage({
  slide,
  slideIndex,
  slideDirection,
  imageWidthPercent,
  panelHeightPercent,
  layout,
  lightAppearance,
  shellLight,
  shellDark,
  registerPresenterMapFlyTo,
}: FirstPersonStageProps) {
  const webcamState = normalizeWebcamPanelState(slide.webcam);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const floatRef = useRef<HTMLDivElement | null>(null);
  const dragLayoutRef = useRef<FirstPersonLayout>(layout);
  const floatStateRef = useRef<FirstPersonFloatState>(readFirstPersonFloat(layout));
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  const [float, setFloat] = useState<FirstPersonFloatState>(() =>
    readFirstPersonFloat(layout),
  );

  useEffect(() => {
    floatStateRef.current = float;
  }, [float]);

  useEffect(() => {
    dragLayoutRef.current = layout;
    const next = readFirstPersonFloat(layout);
    setFloat(next);
    floatStateRef.current = next;
  }, [layout]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setStageSize({ w: r.width, h: r.height });
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  const dragState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: { x: number; y: number };
  } | null>(null);

  const resizeState = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startScale: number;
    startPipW: number;
    startPipH: number;
    contentPipFreeAspect: boolean;
  } | null>(null);

  const GUTTER = 32;
  const GRIP = 32;

  const panelWidthSlideFloat =
    baseWidthPx(stageSize.w, "slide-float") * float.scale;
  const panelHeightSlide = Math.round((panelWidthSlideFloat * 9) / 16);

  const camPipBaseW = baseWidthPx(stageSize.w, "cam-pip");
  const camPipBaseH = baseHeightPipPx(stageSize.w, stageSize.h);
  const pipWf = float.pipW ?? float.scale;
  const pipHf = float.pipH ?? float.scale;
  const isContentCamPip = layout === FIRST_PERSON_LAYOUTS.CONTENT_PRIMARY;
  const panelWidthCamPip = Math.round(camPipBaseW * pipWf);
  const panelHeightCamPip = isContentCamPip
    ? Math.round(camPipBaseH * pipHf)
    : Math.round((panelWidthCamPip * 9) / 16);

  /** Tamaño real del escenario: el slide a pantalla completa en "contenido grande" no es el PIP. */
  const mainFullBleedR3fKey = `firstperson-content-main:${slide.id}:${Math.max(1, Math.round(stageSize.w))}x${Math.max(1, Math.round(stageSize.h))}`;

  const clampCenter = useCallback(
    (nx: number, ny: number, stageW: number, stageH: number) => {
      const el = floatRef.current;
      if (!el || stageW < 8 || stageH < 8) {
        return { x: nx, y: ny };
      }
      const fw = el.offsetWidth;
      const fh = el.offsetHeight;
      const halfW = fw / stageW / 2;
      const halfH = fh / stageH / 2;
      return {
        x: Math.min(1 - halfW, Math.max(halfW, nx)),
        y: Math.min(1 - halfH, Math.max(halfH, ny)),
      };
    },
    [],
  );

  const persistFloat = (next: FirstPersonFloatState) => {
    floatStateRef.current = next;
    writeFirstPersonFloat(dragLayoutRef.current, next);
  };

  const onGripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (layout === FIRST_PERSON_LAYOUTS.SPLIT_50) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const stage = stageRef.current;
    if (!stage) return;
    dragState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: { x: floatStateRef.current.x, y: floatStateRef.current.y },
    };
    dragLayoutRef.current = layout;
  };

  const onGripPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragState.current;
    const stage = stageRef.current;
    if (!d || !stage || e.pointerId !== d.pointerId) return;
    const rect = stage.getBoundingClientRect();
    const dx = (e.clientX - d.startX) / rect.width;
    const dy = (e.clientY - d.startY) / rect.height;
    let nx = d.origin.x + dx;
    let ny = d.origin.y + dy;
    const clamped = clampCenter(nx, ny, rect.width, rect.height);
    const next = { ...floatStateRef.current, x: clamped.x, y: clamped.y };
    floatStateRef.current = next;
    setFloat(next);
  };

  const onGripPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragState.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragState.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    persistFloat(floatStateRef.current);
  };

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const el = floatRef.current;
    const w = el?.offsetWidth ?? 100;
    const h = el?.offsetHeight ?? 100;
    const s = floatStateRef.current;
    const isPip = layout === FIRST_PERSON_LAYOUTS.CONTENT_PRIMARY;
    resizeState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startW: Math.max(1, w),
      startH: Math.max(1, h),
      startScale: s.scale,
      startPipW: s.pipW ?? s.scale,
      startPipH: s.pipH ?? s.scale,
      contentPipFreeAspect: isPip,
    };
  };

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = resizeState.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.contentPipFreeAspect) {
      const dw = e.clientX - d.startX;
      const dh = e.clientY - d.startY;
      const nextPipW = (d.startPipW * (d.startW + dw)) / d.startW;
      const nextPipH = (d.startPipH * (d.startH + dh)) / d.startH;
      const wClamped = Math.min(
        FIRST_PERSON_FLOAT_SCALE_MAX,
        Math.max(FIRST_PERSON_FLOAT_SCALE_MIN, nextPipW),
      );
      const hClamped = Math.min(
        FIRST_PERSON_FLOAT_SCALE_MAX,
        Math.max(FIRST_PERSON_FLOAT_SCALE_MIN, nextPipH),
      );
      const next: FirstPersonFloatState = {
        ...floatStateRef.current,
        pipW: wClamped,
        pipH: hClamped,
        scale: Math.max(wClamped, hClamped),
      };
      floatStateRef.current = next;
      setFloat(next);
      return;
    }
    const dw = e.clientX - d.startX;
    const nextScale = (d.startW + dw) / d.startW * d.startScale;
    const clampedS = Math.min(
      FIRST_PERSON_FLOAT_SCALE_MAX,
      Math.max(FIRST_PERSON_FLOAT_SCALE_MIN, nextScale),
    );
    const next = { ...floatStateRef.current, scale: clampedS };
    floatStateRef.current = next;
    setFloat(next);
  };

  const onResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeState.current || e.pointerId !== resizeState.current.pointerId) {
      return;
    }
    resizeState.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (layout !== FIRST_PERSON_LAYOUTS.SPLIT_50) {
      const stage = stageRef.current;
      if (stage) {
        const rect = stage.getBoundingClientRect();
        const c = clampCenter(
          floatStateRef.current.x,
          floatStateRef.current.y,
          rect.width,
          rect.height,
        );
        const next = { ...floatStateRef.current, x: c.x, y: c.y };
        floatStateRef.current = next;
        setFloat(next);
      }
    }
    persistFloat(floatStateRef.current);
  };

  const floatCardClass = cn(
    "absolute z-20 flex flex-col overflow-hidden rounded-2xl border shadow-2xl",
    lightAppearance
      ? "border-slate-200/90 bg-white/95 shadow-slate-900/15"
      : "border-white/15 bg-stone-950/90 shadow-black/50",
  );

  const mainShell = lightAppearance ? shellLight : shellDark;

  const slideR3fKey = `firstperson-slide:${slide.id}:${Math.round(panelWidthSlideFloat)}`;

  if (layout === FIRST_PERSON_LAYOUTS.SPLIT_50) {
    return (
      <div
        className={cn(
          "relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden md:flex-row",
          mainShell,
        )}
      >
        <ClaudeDotFadeLayer variant={lightAppearance ? "light" : "dark"} className="z-1" />
        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col border-b border-white/10 p-2 md:min-w-0 md:flex-1 md:border-b-0 md:border-r md:p-3">
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl">
            <SlideWebcamView state={webcamState} className="h-full" />
          </div>
        </div>
        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 p-2 md:p-3">
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-white/10">
            <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
              <motion.div
                key={slide.id}
                custom={slideDirection}
                variants={powerPointVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.32, ease: "easeInOut" }}
                className="flex h-full min-h-0 w-full min-w-0 flex-col"
              >
                <PreviewSlideContent
                  layout="fullscreen"
                  slide={slide}
                  imageWidthPercent={imageWidthPercent}
                  panelHeightPercent={panelHeightPercent}
                  slideIndex={slideIndex}
                  disableEntryMotion
                  registerPresenterMapFlyTo={registerPresenterMapFlyTo}
                  r3fHostMeasureKey={`${slideR3fKey}-split`}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  if (layout === FIRST_PERSON_LAYOUTS.CAMERA_PRIMARY) {
    return (
      <div
        ref={stageRef}
        className={cn("relative h-full w-full min-h-0 overflow-hidden", mainShell)}
      >
        <ClaudeDotFadeLayer variant={lightAppearance ? "light" : "dark"} className="z-1" />
        <div className="absolute inset-0 z-10 min-h-0">
          <SlideWebcamView state={webcamState} className="h-full" />
        </div>
        <div
          ref={floatRef}
          className={floatCardClass}
          style={{
            left: `${float.x * 100}%`,
            top: `${float.y * 100}%`,
            width: Math.round(panelWidthSlideFloat),
            maxWidth: `calc(100% - ${GUTTER}px)`,
            maxHeight: `calc(100% - ${GUTTER}px)`,
            transform: "translate(-50%, -50%)",
            touchAction: "none",
          }}
        >
          <div
            className="flex shrink-0 cursor-grab touch-none select-none items-center justify-center gap-1 border-b border-white/10 bg-black/25 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-white/80 active:cursor-grabbing"
            onPointerDown={onGripPointerDown}
            onPointerMove={onGripPointerMove}
            onPointerUp={onGripPointerUp}
            onPointerCancel={onGripPointerUp}
            style={{ minHeight: GRIP }}
            role="separator"
            aria-label="Mover diapositiva flotante"
          >
            <GripHorizontal className="size-3.5 shrink-0 opacity-70" aria-hidden />
            <span>Arrastrar</span>
            <span className="ml-auto tabular-nums text-white/50">
              {Math.round(float.scale * 100)}%
            </span>
          </div>
          <div
            className="flex min-w-0 shrink-0 flex-col overflow-hidden bg-black/5"
            style={{
              width: Math.round(panelWidthSlideFloat),
              height: Math.max(160, panelHeightSlide),
            }}
          >
            <div
              className="flex h-full w-full min-h-0 min-w-0 flex-col"
            >
              <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
                <motion.div
                  key={slide.id}
                  custom={slideDirection}
                  variants={powerPointVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.32, ease: "easeInOut" }}
                  className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
                >
                  <PreviewSlideContent
                    layout="fullscreen"
                    slide={slide}
                    imageWidthPercent={imageWidthPercent}
                    panelHeightPercent={panelHeightPercent}
                    slideIndex={slideIndex}
                    disableEntryMotion
                    registerPresenterMapFlyTo={registerPresenterMapFlyTo}
                    r3fHostMeasureKey={slideR3fKey}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div
            className="pointer-events-auto absolute bottom-0 right-0 z-30 h-5 w-5 cursor-nwse-resize touch-none rounded-tl-md border-t border-l border-white/20 bg-white/10 hover:bg-white/20"
            title="Redimensionar panel"
            aria-label="Redimensionar panel de diapositiva"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
              }
            }}
          />
        </div>
      </div>
    );
  }

  // CONTENT_PRIMARY: slide a pantalla completa; cámara en PiP (misma pila flex+min-h-0 que split para que el lienzo tenga altura)
  return (
    <div
      ref={stageRef}
      className={cn(
        "relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden",
        mainShell,
      )}
    >
      <ClaudeDotFadeLayer
        variant={lightAppearance ? "light" : "dark"}
        className="pointer-events-none absolute inset-0 z-0"
      />
      <div className="relative z-10 flex min-h-0 min-w-0 w-full flex-1 flex-col p-1 md:p-2">
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-white/10">
          <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
            <motion.div
              key={slide.id}
              custom={slideDirection}
              variants={powerPointVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.32, ease: "easeInOut" }}
              className="flex h-full min-h-0 w-full min-w-0 flex-col"
            >
              <PreviewSlideContent
                layout="fullscreen"
                slide={slide}
                imageWidthPercent={imageWidthPercent}
                panelHeightPercent={panelHeightPercent}
                slideIndex={slideIndex}
                disableEntryMotion
                registerPresenterMapFlyTo={registerPresenterMapFlyTo}
                r3fHostMeasureKey={mainFullBleedR3fKey}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div
        ref={floatRef}
        className={floatCardClass}
        style={{
          left: `${float.x * 100}%`,
          top: `${float.y * 100}%`,
          width: Math.round(panelWidthCamPip),
          maxWidth: `calc(100% - ${GUTTER}px)`,
          maxHeight: `calc(100% - ${GUTTER}px)`,
          transform: "translate(-50%, -50%)",
          touchAction: "none",
        }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none select-none items-center justify-center gap-1 border-b border-white/10 bg-black/25 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-white/80 active:cursor-grabbing"
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerUp}
          onPointerCancel={onGripPointerUp}
          style={{ minHeight: GRIP }}
          role="separator"
          aria-label="Mover vista de cámara"
        >
          <GripHorizontal className="size-3.5 shrink-0 opacity-70" aria-hidden />
          <span>Arrastrar</span>
          <span className="ml-auto max-w-32 truncate text-right tabular-nums text-white/50" title="Escala ancho × alto (base)">
            {Math.round(pipWf * 100)}×{Math.round(pipHf * 100)}%
          </span>
        </div>
        <div
          className="min-w-0 shrink-0 overflow-hidden p-1"
          style={{
            width: Math.round(panelWidthCamPip),
            height: Math.max(96, panelHeightCamPip),
          }}
        >
          <SlideWebcamView
            state={webcamState}
            className="h-full min-h-0 w-full"
          />
        </div>
        <div
          className="pointer-events-auto absolute bottom-0 right-0 z-30 h-5 w-5 cursor-nwse-resize touch-none rounded-tl-md border-t border-l border-white/20 bg-white/10 hover:bg-white/20"
          title="Redimensionar cámara (ancho y alto libres)"
          aria-label="Redimensionar panel de cámara"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
          role="button"
          tabIndex={0}
        />
      </div>
    </div>
  );
}
