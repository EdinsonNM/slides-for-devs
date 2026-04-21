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
import { X } from "lucide-react";
import { cn } from "../../utils/cn";
import {
  DATA_MOTION_CHART_TYPE,
  type DataMotionChartType,
  type DataMotionRingCard,
  type DataMotionRingState,
  type DataMotionValueFormat,
  defaultDataMotionPalette,
  nearestSpinToAlignCardFront,
} from "../../domain/dataMotionRing/dataMotionRingModel";

function formatDataValue(
  v: number,
  format?: DataMotionValueFormat,
  suffix?: string,
): string {
  const suf = suffix ?? "";
  switch (format) {
    case "currency":
      return `$${v.toFixed(2)}${suf}`;
    case "percent":
      return `${Math.round(v)}%${suf}`;
    case "integer":
      return `${Math.round(v)}${suf}`;
    case "decimal":
      return `${v.toFixed(1)}${suf}`;
    default:
      if (Math.abs(v - Math.round(v)) < 1e-6) return `${Math.round(v)}${suf}`;
      return `${v.toFixed(2)}${suf}`;
  }
}

function paletteForCard(card: DataMotionRingCard, index: number): string[] {
  const d = defaultDataMotionPalette();
  if (card.colors?.length) return card.colors;
  return [d[index % d.length]!];
}

function chartTypeLabelEs(t: DataMotionChartType): string {
  switch (t) {
    case DATA_MOTION_CHART_TYPE.LINE:
      return "Línea";
    case DATA_MOTION_CHART_TYPE.BAR:
      return "Barras verticales";
    case DATA_MOTION_CHART_TYPE.H_BAR:
      return "Barras horizontales";
    case DATA_MOTION_CHART_TYPE.GAUGE:
      return "Gauge";
    case DATA_MOTION_CHART_TYPE.RADAR:
      return "Radar";
    case DATA_MOTION_CHART_TYPE.DONUT:
      return "Donut";
    case DATA_MOTION_CHART_TYPE.BIG_NUMBER:
      return "Número destacado";
    default: {
      const _e: never = t;
      return _e;
    }
  }
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

function CardChart({
  card,
  index,
  variant = "ring",
}: {
  card: DataMotionRingCard;
  index: number;
  variant?: "ring" | "detail";
}) {
  const isDetail = variant === "detail";
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
        <div
          className={cn(
            "flex h-full w-full flex-col items-center justify-center px-1",
            isDetail && "py-6",
          )}
        >
          <p
            className={cn(
              "text-center font-bold leading-none tracking-tight text-stone-900 dark:text-white",
              isDetail
                ? "text-3xl md:text-4xl"
                : "text-[clamp(0.65rem,2.8vw,1.1rem)]",
            )}
          >
            {formatDataValue(vals[0] ?? 0, card.format, card.suffix)}
          </p>
          {card.label ? (
            <p
              className={cn(
                "mt-1 max-w-[100%] text-center font-medium text-stone-500 dark:text-stone-400",
                isDetail ? "text-sm" : "truncate text-[9px]",
              )}
            >
              {card.label}
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

function DataMotionRingCardDetailOverlay({
  card,
  index,
  onClose,
}: {
  card: DataMotionRingCard;
  index: number;
  onClose: () => void;
}) {
  const vals = card.values.length ? card.values : [0];
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center p-3 pt-14 sm:p-6 sm:pt-16">
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-[2px] dark:bg-black/55"
        aria-label="Cerrar vista detallada"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[min(88dvh,720px)] w-[min(96vw,440px)] flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-2xl dark:border-border dark:bg-surface-elevated"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-stone-100 px-4 py-3 dark:border-border">
          <div className="min-w-0 pr-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              Tarjeta {index + 1} · {chartTypeLabelEs(card.chartType)}
            </p>
            {card.label ? (
              <h3 className="mt-0.5 truncate text-base font-semibold text-stone-900 dark:text-white">
                {card.label}
              </h3>
            ) : (
              <h3 className="mt-0.5 text-base font-semibold text-stone-900 dark:text-white">
                Detalle
              </h3>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 text-stone-600 transition-colors hover:bg-stone-50 dark:border-border dark:text-stone-200 dark:hover:bg-white/10"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 min-h-[200px] w-full rounded-xl bg-stone-50/90 p-3 dark:bg-stone-900/50">
            <CardChart card={card} index={index} variant="detail" />
          </div>
          <p className="mb-2 text-xs font-semibold text-stone-700 dark:text-stone-200">
            Valores
          </p>
          <table className="w-full text-left text-xs">
            <tbody>
              {vals.map((v, i) => (
                <tr
                  key={i}
                  className="border-t border-stone-100 first:border-t-0 dark:border-border"
                >
                  <td className="py-1.5 pr-3 text-stone-500 dark:text-stone-400">
                    #{i + 1}
                  </td>
                  <td className="py-1.5 font-mono font-medium text-stone-900 tabular-nums dark:text-white">
                    {formatDataValue(v, card.format, card.suffix)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {card.notes?.trim() ? (
            <>
              <p className="mb-1 mt-4 text-xs font-semibold text-stone-700 dark:text-stone-200">
                Notas
              </p>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                {card.notes.trim()}
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
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

  const spinRef = useRef(0);
  spinRef.current = spin;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);
  const alignRafRef = useRef(0);
  const backdropDragRef = useRef({ active: false, lastX: 0, lastY: 0 });

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

  useEffect(() => {
    if (selectedIndex === null) return;
    const from = spinRef.current;
    const target = nearestSpinToAlignCardFront(from, selectedIndex, step);
    if (Math.abs(target - from) < 0.45) return;
    cancelAnimationFrame(alignRafRef.current);
    const start = performance.now();
    const dur = 520;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const ease = 1 - (1 - t) ** 3;
      setSpin(from + (target - from) * ease);
      if (t < 1) {
        alignRafRef.current = requestAnimationFrame(tick);
      }
    };
    alignRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(alignRafRef.current);
  }, [selectedIndex, step]);

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

  const openCardDetail = useCallback((i: number) => {
    setHoveredCardIndex(null);
    setSelectedIndex(i);
  }, []);

  useEffect(() => {
    if (selectedIndex !== null) setHoveredCardIndex(null);
  }, [selectedIndex]);

  const detailCard = selectedIndex != null ? cards[selectedIndex] : null;

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
      <header className="relative z-10 flex shrink-0 items-start justify-between gap-3 px-5 pb-1 pt-4 md:px-7 md:pt-5">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold tracking-tight text-stone-950 md:text-xl dark:text-white">
            {state.heading}
          </h2>
          <p className="mt-0.5 truncate text-xs font-medium text-stone-500 md:text-sm dark:text-stone-400">
            {state.subtitle}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
          {selectedIndex !== null ? (
            <button
              type="button"
              onClick={() => setSelectedIndex(null)}
              className="rounded-full border border-stone-300/80 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-stone-700 shadow-sm hover:bg-white dark:border-border dark:bg-white/10 dark:text-stone-100 dark:hover:bg-white/15"
            >
              Volver al aro
            </button>
          ) : null}
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
        aria-label="Aro de tarjetas en tres dimensiones. Arrastra el fondo en horizontal para girar el aro, en vertical para inclinar la vista; clic en una tarjeta para el detalle."
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
              opacity: selectedIndex !== null ? 0.38 : 1,
            }}
          >
            {cards.map((card, i) => {
              const angle = i * step;
              const hovered =
                !reducedMotion &&
                selectedIndex === null &&
                hoveredCardIndex === i;
              const zLift = hovered ? 26 : 0;
              const hoverScale = hovered ? 1.06 : 1;
              return (
                <div
                  key={`${i}-${card.chartType}`}
                  className={cn(
                    "pointer-events-auto absolute left-1/2 top-1/2 shrink-0 duration-200 ease-out will-change-transform",
                    !reducedMotion && "transition-[transform,box-shadow]",
                  )}
                  style={{
                    width: cardWpx,
                    height: cardHpx,
                    zIndex: hovered ? 8 : 1,
                    transform: `
                      translate(-50%, -50%)
                      rotateY(${angle}deg)
                      translateZ(${ringRadius + zLift}px)
                      scale(${hoverScale})
                    `,
                    transformOrigin: "center center",
                    opacity: 1,
                    transformStyle: "preserve-3d",
                    backfaceVisibility: "visible",
                  }}
                  onPointerEnter={() => {
                    if (selectedIndex === null) setHoveredCardIndex(i);
                  }}
                  onPointerLeave={() => {
                    setHoveredCardIndex((h) => (h === i ? null : h));
                  }}
                >
                  <button
                    type="button"
                    className="flex h-full w-full flex-col rounded-2xl border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    onClick={() => openCardDetail(i)}
                    aria-label={`Ver detalle de la tarjeta ${i + 1}`}
                  >
                    <div
                      className={cn(
                        "flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-2 shadow-xl duration-200 ease-out",
                        "shadow-stone-900/12 ring-1 ring-black/5 dark:border-white/10 dark:bg-white/[0.94] dark:shadow-black/40",
                        hovered &&
                          "shadow-2xl ring-2 ring-primary/35 dark:ring-primary/40",
                      )}
                    >
                      {card.label &&
                      card.chartType !== DATA_MOTION_CHART_TYPE.BIG_NUMBER ? (
                        <p className="mb-1 truncate text-center text-[9px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-500">
                          {card.label}
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

      {detailCard != null && selectedIndex != null ? (
        <DataMotionRingCardDetailOverlay
          card={detailCard}
          index={selectedIndex}
          onClose={() => setSelectedIndex(null)}
        />
      ) : null}
    </div>
  );
}
