import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../utils/cn";

const POINTER_SHOW_DELAY_MS = 280;

export type RailTooltipProps = {
  label: string;
  detail?: string;
  /** Rail izquierdo → el tooltip se abre a la derecha del icono */
  side?: "right" | "left";
  children: ReactNode;
};

const VIEWPORT_TOOLTIP_PAD_PX = 32;
const MIN_WIDTH_EXTRA_PX = 20;

export function RailTooltip({ label, detail, side = "right", children }: RailTooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  useLayoutEffect(() => {
    if (!open) return;
    const el = tooltipRef.current;
    if (!el) return;

    const applyMinFromNaturalWidth = () => {
      el.style.minWidth = "";
      void el.offsetWidth;
      const natural = Math.ceil(el.getBoundingClientRect().width);
      const cap = Math.max(0, window.innerWidth - VIEWPORT_TOOLTIP_PAD_PX);
      el.style.minWidth = `${Math.min(natural + MIN_WIDTH_EXTRA_PX, cap)}px`;
    };

    applyMinFromNaturalWidth();
    const raf = requestAnimationFrame(applyMinFromNaturalWidth);

    return () => {
      cancelAnimationFrame(raf);
      el.style.minWidth = "";
    };
  }, [open, label, detail]);

  const scheduleOpenFromPointer = () => {
    clearTimer();
    timerRef.current = setTimeout(() => setOpen(true), POINTER_SHOW_DELAY_MS);
  };

  const openNow = () => {
    clearTimer();
    setOpen(true);
  };

  const close = () => {
    clearTimer();
    setOpen(false);
  };

  const positionMotion =
    side === "right"
      ? { initial: { opacity: 0, x: -8 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -6 } }
      : { initial: { opacity: 0, x: 8 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 6 } };

  return (
    <div
      className="relative flex h-9 w-9 shrink-0 items-center justify-center"
      onPointerEnter={scheduleOpenFromPointer}
      onPointerLeave={close}
      onFocusCapture={openNow}
      onBlurCapture={close}
    >
      {children}
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={tooltipRef}
            role="tooltip"
            initial={positionMotion.initial}
            animate={positionMotion.animate}
            exit={positionMotion.exit}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "pointer-events-none absolute z-80 flex w-fit max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-lg px-3 py-2.5 text-left shadow-lg ring-1",
              "bg-stone-900 text-stone-50 ring-white/10 dark:bg-stone-100 dark:text-stone-900 dark:ring-stone-900/10",
              side === "right"
                ? "left-full top-1/2 ml-2 -translate-y-1/2 origin-left"
                : "right-full top-1/2 mr-2 -translate-y-1/2 origin-right",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-1/2 border-y-[6px] border-y-transparent",
                side === "right"
                  ? "left-0 -translate-x-full -translate-y-1/2 border-r-[7px] border-r-stone-900 dark:border-r-stone-100"
                  : "right-0 translate-x-full -translate-y-1/2 border-l-[7px] border-l-stone-900 dark:border-l-stone-100",
              )}
            />
            <span className="relative text-[12px] font-semibold leading-tight tracking-tight">
              {label}
            </span>
            {detail ? (
              <span className="relative text-[11px] font-normal leading-relaxed text-stone-400 dark:text-stone-600">
                {detail}
              </span>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
