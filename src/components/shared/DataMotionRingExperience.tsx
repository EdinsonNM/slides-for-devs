import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";
import {
  DATA_MOTION_CHART_TYPE,
  type DataMotionRingCard,
  type DataMotionRingState,
  defaultDataMotionPalette,
  formatDataMotionRingValue,
  nearestSpinToAlignCardFront,
} from "../../domain/dataMotionRing/dataMotionRingModel";
import { DataMotionRingInteractiveChart } from "./DataMotionRingInteractiveChart";

function paletteForCard(card: DataMotionRingCard, index: number): string[] {
  const d = defaultDataMotionPalette();
  if (card.colors?.length) return card.colors;
  return [d[index % d.length]!];
}

function MiniLineChart({
  values,
  color,
  gradientId,
  className,
}: {
  values: number[];
  color: string;
  gradientId: string;
  className?: string;
}) {
  const w = 120;
  const h = 72;
  const pad = 8;
  const xs = values.length
    ? values.map((_, i) => pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2))
    : [pad, w - pad];
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = xs[i] ?? pad;
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  const dPath = values.length > 1 ? `M ${pts.join(" L ")}` : "";
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("h-full w-full", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={pad}
          x2={w - pad}
          y1={pad + t * (h - pad * 2)}
          y2={pad + t * (h - pad * 2)}
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-stone-200/80 dark:text-stone-600/80"
        />
      ))}
      {values.length > 1 && (
        <path
          d={`${dPath} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`}
          fill={`url(#${gradientId})`}
          className="text-inherit"
        />
      )}
      {dPath ? (
        <path
          d={dPath}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

function MiniBars({
  values,
  colors,
  vertical,
}: {
  values: number[];
  colors: string[];
  vertical: boolean;
}) {
  const w = 120;
  const h = 72;
  const pad = 10;
  const max = Math.max(...values, 1);
  if (vertical) {
    const bw = (w - pad * 2) / Math.max(values.length, 1) - 2;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden>
        {values.map((v, i) => {
          const bh = ((v / max) * (h - pad * 2)) / 1;
          const x = pad + i * ((w - pad * 2) / Math.max(values.length, 1));
          const col = colors[i % colors.length]!;
          return (
            <rect
              key={i}
              x={x + 1}
              y={h - pad - bh}
              width={Math.max(3, bw)}
              height={Math.max(2, bh)}
              rx={3}
              fill={col}
            />
          );
        })}
      </svg>
    );
  }
  const rowH = (h - pad * 2) / Math.max(values.length, 1) - 3;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden>
      {values.map((v, i) => {
        const bw = (v / max) * (w - pad * 2);
        const y = pad + i * ((h - pad * 2) / Math.max(values.length, 1));
        const col = colors[i % colors.length]!;
        return (
          <rect
            key={i}
            x={pad}
            y={y + 2}
            width={Math.max(4, bw)}
            height={Math.max(4, rowH)}
            rx={4}
            fill={col}
          />
        );
      })}
    </svg>
  );
}

function MiniGauge({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  const w = 120;
  const h = 72;
  const pct = Math.max(0, Math.min(100, value));
  const r = 28;
  const cx = w / 2;
  const cy = h / 2 + 4;
  const start = Math.PI * 0.75;
  const sweep = Math.PI * 1.5 * (pct / 100);
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(start + sweep);
  const y2 = cy + r * Math.sin(start + sweep);
  const large = sweep > Math.PI ? 1 : 0;
  const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        className="text-stone-200 dark:text-stone-600"
        strokeLinecap="round"
        pathLength={1}
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        className="fill-stone-900 text-[18px] font-semibold dark:fill-white"
      >
        {Math.round(pct)}
      </text>
    </svg>
  );
}

function MiniRadar({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const w = 120;
  const h = 72;
  const cx = w / 2;
  const cy = h / 2;
  const R = 30;
  const n = Math.max(values.length, 3);
  const pts = values.map((raw, i) => {
    const t = (i / n) * Math.PI * 2 - Math.PI / 2;
    const v = Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw));
    const rr = R * v;
    return `${cx + rr * Math.cos(t)},${cy + rr * Math.sin(t)}`;
  });
  const d = pts.length ? `M ${pts.join(" L ")} Z` : "";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden>
      {[0.35, 0.65, 1].map((s) => (
        <polygon
          key={s}
          points={Array.from({ length: n }, (_, i) => {
            const t = (i / n) * Math.PI * 2 - Math.PI / 2;
            const rr = R * s;
            return `${cx + rr * Math.cos(t)},${cy + rr * Math.sin(t)}`;
          }).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.6"
          className="text-stone-200 dark:text-stone-600"
        />
      ))}
      {d ? (
        <path
          d={d}
          fill={color}
          fillOpacity="0.25"
          stroke={color}
          strokeWidth="1.5"
        />
      ) : null}
    </svg>
  );
}

function MiniDonut({
  values,
  colors,
}: {
  values: number[];
  colors: string[];
}) {
  const w = 120;
  const h = 72;
  const cx = w / 2;
  const cy = h / 2;
  const ri = 18;
  const ro = 32;
  const sum = values.reduce((a, b) => a + Math.abs(b), 0) || 1;
  let angle = -Math.PI / 2;
  const segs: ReactNode[] = [];
  values.forEach((v, i) => {
    const frac = Math.abs(v) / sum;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const col = colors[i % colors.length]!;
    const x0o = cx + ro * Math.cos(a0);
    const y0o = cy + ro * Math.sin(a0);
    const x1o = cx + ro * Math.cos(a1);
    const y1o = cy + ro * Math.sin(a1);
    const x0i = cx + ri * Math.cos(a0);
    const y0i = cy + ri * Math.sin(a0);
    const x1i = cx + ri * Math.cos(a1);
    const y1i = cy + ri * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    segs.push(
      <path
        key={i}
        d={`M ${x0o} ${y0o} A ${ro} ${ro} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${ri} ${ri} 0 ${large} 0 ${x0i} ${y0i} Z`}
        fill={col}
      />,
    );
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden>
      {segs}
    </svg>
  );
}

function CardChart({ card, index }: { card: DataMotionRingCard; index: number }) {
  const colors = paletteForCard(card, index);
  const primary = colors[0] ?? "#3b82f6";
  const vals = card.values.length ? card.values : [0];

  switch (card.chartType) {
    case DATA_MOTION_CHART_TYPE.LINE:
      return (
        <MiniLineChart
          values={vals}
          color={primary}
          gradientId={`dm-line-fill-${index}`}
        />
      );
    case DATA_MOTION_CHART_TYPE.BAR:
      return <MiniBars values={vals} colors={colors} vertical />;
    case DATA_MOTION_CHART_TYPE.H_BAR:
      return <MiniBars values={vals} colors={colors} vertical={false} />;
    case DATA_MOTION_CHART_TYPE.GAUGE:
      return <MiniGauge value={vals[0] ?? 0} color={primary} />;
    case DATA_MOTION_CHART_TYPE.RADAR:
      return <MiniRadar values={vals} color={primary} />;
    case DATA_MOTION_CHART_TYPE.DONUT:
      return <MiniDonut values={vals} colors={colors} />;
    case DATA_MOTION_CHART_TYPE.BIG_NUMBER:
      return (
        <div className="flex h-full w-full flex-col items-center justify-center px-1">
          <p className="text-center text-[clamp(0.65rem,2.8vw,1.1rem)] font-bold leading-none tracking-tight text-stone-900 dark:text-white">
            {formatDataMotionRingValue(vals[0] ?? 0, card.format, card.suffix)}
          </p>
          {card.title?.trim() || card.label?.trim() ? (
            <p className="mt-1 max-w-[100%] truncate text-center text-[9px] font-medium text-stone-500 dark:text-stone-400">
              {card.title?.trim() || card.label}
            </p>
          ) : null}
        </div>
      );
    default: {
      const _exhaustive: never = card.chartType;
      return _exhaustive;
    }
  }
}

export interface DataMotionRingExperienceProps {
  state: DataMotionRingState;
  className?: string;
  /** Desactiva arrastre y giro automático (p. ej. capturas estáticas). */
  reducedMotion?: boolean;
}

export function DataMotionRingExperience({
  state,
  className,
  reducedMotion = false,
}: DataMotionRingExperienceProps) {
  const cards = state.cards;
  const n = Math.max(cards.length, 1);
  const step = 360 / n;

  /** Solo el escenario 3D (sin cabecera): el radio debe caber aquí o el lienzo recorta y solo se ve un arco. */
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageMin, setStageMin] = useState(360);
  const [spin, setSpin] = useState(0);
  /** Inclinación vertical de la escena (rotateX), grados; arrastra el fondo en vertical. */
  const [tiltX, setTiltX] = useState(11);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr?.width) return;
      const h = cr.height > 12 ? cr.height : cr.width * 0.58;
      setStageMin(Math.min(cr.width, h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * Radio del aro + perspectiva: más tarjetas ⇒ circunferencia mayor y “cámara” más lejos.
   * Tamaño de tarjeta en px común. La orientación es tangente al aro (sin billboard).
   */
  const { ringRadius, perspectivePx, cardWpx, cardHpx } = useMemo(() => {
    const minDim = Math.max(stageMin, 96);
    const sinHalf = Math.sin(Math.PI / Math.max(n, 1));
    const sinSafe = Math.max(sinHalf, 0.032);
    const cardW = Math.round(Math.min(168, Math.max(104, minDim * 0.26)));
    const cardH = Math.round(cardW / 0.74);
    const minGap = cardW * 1.22;
    const geoMin = minGap / (2 * sinSafe);
    const ringR = Math.max(geoMin, minDim * 0.2);
    const perspective = Math.round(
      Math.min(7200, Math.max(1100, minDim * 1.55 + ringR * 2.65 + n * 32)),
    );
    return {
      ringRadius: ringR,
      perspectivePx: perspective,
      cardWpx: cardW,
      cardHpx: cardH,
    };
  }, [stageMin, n]);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);
  const backdropDragRef = useRef({ active: false, lastX: 0, lastY: 0 });

  const closeSelection = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  const auto =
    Boolean(state.autoRotate) && !reducedMotion && selectedIndex === null;
  const degPerSec = state.autoRotateDegPerSec ?? 9;

  useEffect(() => {
    if (!auto) return;
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const dt = (now - prev) / 1000;
      prev = now;
      setSpin((s) => s + degPerSec * dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto, degPerSec]);

  const onBackdropPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || reducedMotion || selectedIndex !== null) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      backdropDragRef.current = {
        active: true,
        lastX: e.clientX,
        lastY: e.clientY,
      };
    },
    [reducedMotion, selectedIndex],
  );

  const onBackdropPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!backdropDragRef.current.active || selectedIndex !== null) return;
      const dx = e.clientX - backdropDragRef.current.lastX;
      const dy = e.clientY - backdropDragRef.current.lastY;
      backdropDragRef.current.lastX = e.clientX;
      backdropDragRef.current.lastY = e.clientY;
      setSpin((s) => s + dx * 0.45);
      setTiltX((t) => {
        const next = t + dy * 0.42;
        return Math.max(-36, Math.min(36, next));
      });
    },
    [selectedIndex],
  );

  const onBackdropPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (backdropDragRef.current.active) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    }
    backdropDragRef.current.active = false;
  }, []);

  const frontIndex = useMemo(() => {
    const norm = ((spin % 360) + 360) % 360;
    const idx = Math.round(norm / step) % n;
    return (n - idx) % n;
  }, [spin, step, n]);

  const dotActiveIndex = selectedIndex ?? frontIndex;

  const bgMode = state.backgroundMode ?? "default";
  const rootSurfaceStyle: CSSProperties = {};
  if (bgMode === "solid" && state.backgroundColor) {
    rootSurfaceStyle.backgroundColor = state.backgroundColor;
  } else if (bgMode === "transparent") {
    rootSurfaceStyle.backgroundColor = "transparent";
  }

  const openCardDetail = useCallback(
    (i: number) => {
      setHoveredCardIndex(null);
      setSpin((s) => nearestSpinToAlignCardFront(s, i, step));
      setSelectedIndex(i);
    },
    [step],
  );

  useEffect(() => {
    if (selectedIndex !== null) setHoveredCardIndex(null);
  }, [selectedIndex]);

  useEffect(() => {
    if (selectedIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIndex, closeSelection]);

  const detailCard = useMemo(() => {
    if (
      selectedIndex === null ||
      selectedIndex < 0 ||
      selectedIndex >= cards.length
    ) {
      return null;
    }
    return cards[selectedIndex]!;
  }, [selectedIndex, cards]);

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col rounded-2xl select-none",
        "overflow-visible",
        bgMode === "default" &&
          "bg-[#e4e2f3] text-stone-900 dark:bg-[#1e1b2e] dark:text-stone-100",
        bgMode === "solid" && "text-stone-900",
        bgMode === "transparent" && "text-stone-900 dark:text-stone-100",
        className,
      )}
      style={Object.keys(rootSurfaceStyle).length ? rootSurfaceStyle : undefined}
    >
      <header
        className={cn(
          "relative z-10 flex shrink-0 justify-between gap-3 px-5 pb-1 pt-4 md:px-7 md:pt-5",
          state.heading || state.subtitle ? "items-start" : "items-center",
        )}
      >
        <div className="min-w-0 flex-1">
          {state.heading ? (
            <h2 className="truncate text-lg font-bold tracking-tight text-stone-950 md:text-xl dark:text-white">
              {state.heading}
            </h2>
          ) : null}
          {state.subtitle ? (
            <p
              className={cn(
                "truncate text-xs font-medium text-stone-500 md:text-sm dark:text-stone-400",
                state.heading ? "mt-0.5" : null,
              )}
            >
              {state.subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
          <div className="flex items-center gap-1.5" aria-hidden>
            {cards.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === dotActiveIndex
                    ? "w-6 bg-stone-900 dark:bg-white"
                    : "w-1.5 bg-stone-300 dark:bg-stone-600",
                )}
              />
            ))}
          </div>
        </div>
      </header>

      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 touch-none overflow-visible"
        style={{
          perspective: `${perspectivePx}px`,
          perspectiveOrigin: "50% 46%",
          transformStyle: "preserve-3d",
        }}
        role="img"
        aria-label="Aro de tarjetas en tres dimensiones. Arrastra el fondo para girar e inclinar. Al elegir una tarjeta se abre el detalle centrado; ciérralo con Escape o el botón cerrar."
      >
        <div
          className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing"
          title="Arrastra: horizontal = girar, vertical = inclinar la vista"
          onPointerDown={onBackdropPointerDown}
          onPointerMove={onBackdropPointerMove}
          onPointerUp={onBackdropPointerUp}
          onPointerCancel={onBackdropPointerUp}
        />
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible"
          style={{ transformStyle: "preserve-3d" }}
        >
          <div
            className="relative h-[min(72%,420px)] w-full max-w-[920px] overflow-visible transition-opacity duration-300"
            style={{
              transformStyle: "preserve-3d",
              transform: `rotateX(${tiltX}deg) rotateY(${spin}deg)`,
              opacity: 1,
            }}
          >
            {cards.map((card, i) => {
              const angle = i * step;
              const allowHover = selectedIndex === null && !reducedMotion;
              const hovered = allowHover && hoveredCardIndex === i;
              const zLift = hovered ? 26 : 0;
              const hoverScale = hovered ? 1.06 : 1;
              const totalZ = ringRadius + zLift;
              return (
                <div
                  key={`${i}-${card.chartType}`}
                  className={cn(
                    "absolute left-1/2 top-1/2 shrink-0 will-change-transform",
                    allowHover ? "pointer-events-auto" : "pointer-events-none",
                    allowHover &&
                      "transition-[transform,box-shadow] duration-200 ease-out",
                  )}
                  style={{
                    width: cardWpx,
                    height: cardHpx,
                    zIndex: hovered ? 8 : 10 + i,
                    transform: `
                      translate(-50%, -50%)
                      rotateY(${angle}deg)
                      translateZ(${totalZ}px)
                      scale(${hoverScale})
                    `,
                    transformOrigin: "center center",
                    opacity: 1,
                    transformStyle: "preserve-3d",
                    backfaceVisibility: "visible",
                  }}
                  onPointerEnter={() => {
                    if (allowHover) setHoveredCardIndex(i);
                  }}
                  onPointerLeave={() => {
                    setHoveredCardIndex((h) => (h === i ? null : h));
                  }}
                >
                  <button
                    type="button"
                    className="flex h-full w-full flex-col rounded-2xl border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-surface-elevated"
                    onClick={() => openCardDetail(i)}
                    aria-label={`Abrir detalle de la tarjeta ${i + 1}`}
                  >
                    <div
                      className={cn(
                        "flex h-full w-full flex-col overflow-hidden rounded-2xl border p-2 shadow-xl duration-200 ease-out",
                        "border-stone-200/90 bg-white ring-1 ring-black/[0.06] shadow-stone-900/10",
                        "dark:border-border dark:bg-surface-elevated dark:ring-white/10 dark:shadow-black/40",
                        hovered &&
                          "shadow-2xl ring-2 ring-primary/35 dark:ring-primary/40",
                      )}
                    >
                      {(card.title?.trim() || card.label?.trim()) &&
                      card.chartType !== DATA_MOTION_CHART_TYPE.BIG_NUMBER ? (
                        <p className="mb-1 truncate text-center text-[9px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                          {card.title?.trim() || card.label}
                        </p>
                      ) : null}
                      <div className="min-h-0 flex-1">
                        <CardChart card={card} index={i} />
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {detailCard !== null && selectedIndex !== null ? (
          <motion.div
            key={selectedIndex}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dmr-detail-title"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 32,
              mass: 0.82,
            }}
            className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
          >
            <div className="pointer-events-auto relative flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-2xl ring-1 ring-black/5 dark:border-border dark:bg-surface-elevated dark:shadow-black/50 dark:ring-white/10">
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-100 px-4 py-3 dark:border-border">
                <div className="min-w-0 flex-1 pr-2">
                  <p
                    id="dmr-detail-title"
                    className="truncate text-base font-bold text-stone-950 dark:text-white"
                  >
                    {detailCard.title?.trim() ||
                      detailCard.label?.trim() ||
                      `Tarjeta ${selectedIndex + 1}`}
                  </p>
                  {detailCard.title?.trim() && detailCard.label?.trim() ? (
                    <p className="mt-0.5 truncate text-[11px] font-medium text-stone-500 dark:text-stone-400">
                      {detailCard.label.trim()}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={closeSelection}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {detailCard.description?.trim() ? (
                  <p className="mb-4 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                    {detailCard.description.trim()}
                  </p>
                ) : null}
                <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-2 dark:border-border dark:bg-black/20">
                  <DataMotionRingInteractiveChart
                    card={detailCard}
                    index={selectedIndex}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

    </div>
  );
}
