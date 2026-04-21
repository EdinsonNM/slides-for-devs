import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DATA_MOTION_CHART_TYPE,
  type DataMotionRingCard,
  defaultDataMotionPalette,
  formatDataMotionRingValue,
} from "../../domain/dataMotionRing/dataMotionRingModel";
import { cn } from "../../utils/cn";

function useIsDarkDocumentClass() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setDark(root.classList.contains("dark"));
    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

function paletteFor(card: DataMotionRingCard, index: number): string[] {
  const d = defaultDataMotionPalette();
  if (card.colors?.length) return card.colors;
  return [d[index % d.length]!];
}

export interface DataMotionRingInteractiveChartProps {
  card: DataMotionRingCard;
  index: number;
  className?: string;
}

export function DataMotionRingInteractiveChart({
  card,
  index,
  className,
}: DataMotionRingInteractiveChartProps) {
  const dark = useIsDarkDocumentClass();
  const colors = useMemo(() => paletteFor(card, index), [card, index]);
  const primary = colors[0] ?? "#3b82f6";
  const vals = card.values.length ? card.values : [0];

  const axis = dark ? "#a8a29e" : "#78716c";
  const grid = dark ? "#44403c" : "#e7e5e4";
  const tooltipBg = dark ? "#292524" : "#ffffff";
  const tooltipBorder = dark ? "#57534e" : "#e7e5e4";
  const tooltipFg = dark ? "#fafaf9" : "#1c1917";

  const fmt = (v: number) =>
    formatDataMotionRingValue(v, card.format, card.suffix);

  const tooltipStyle = {
    backgroundColor: tooltipBg,
    border: `1px solid ${tooltipBorder}`,
    borderRadius: 10,
    color: tooltipFg,
    fontSize: 12,
    padding: "8px 10px",
  };

  const commonMargin = { top: 8, right: 12, left: 4, bottom: 4 };

  switch (card.chartType) {
    case DATA_MOTION_CHART_TYPE.LINE: {
      const data = vals.map((value, i) => ({
        name: `${i + 1}`,
        value,
      }));
      return (
        <div className={cn("h-[min(320px,42vh)] w-full min-h-[240px]", className)}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={commonMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: grid }} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: grid }} width={40} />
              <Tooltip
                formatter={(v: number) => [fmt(v), "Valor"]}
                labelFormatter={(l) => `Punto ${l}`}
                contentStyle={tooltipStyle}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={primary}
                strokeWidth={2.5}
                dot={{ r: 3, fill: primary, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case DATA_MOTION_CHART_TYPE.BAR: {
      const data = vals.map((value, i) => ({
        name: `${i + 1}`,
        value,
      }));
      return (
        <div className={cn("h-[min(320px,42vh)] w-full min-h-[240px]", className)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={commonMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: grid }} />
              <YAxis tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: grid }} width={40} />
              <Tooltip formatter={(v: number) => [fmt(v), "Valor"]} contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]!} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case DATA_MOTION_CHART_TYPE.H_BAR: {
      const data = vals.map((value, i) => ({
        name: `S${i + 1}`,
        value,
      }));
      return (
        <div className={cn("h-[min(320px,42vh)] w-full min-h-[240px]", className)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: grid }} />
              <YAxis
                type="category"
                dataKey="name"
                width={36}
                tick={{ fill: axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: grid }}
              />
              <Tooltip formatter={(v: number) => [fmt(v), "Valor"]} contentStyle={tooltipStyle} />
              <Bar dataKey="value" layout="vertical" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]!} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case DATA_MOTION_CHART_TYPE.GAUGE: {
      const pct = Math.max(0, Math.min(100, vals[0] ?? 0));
      const track = dark ? "#44403c" : "#e7e5e4";
      const data = [{ name: "v", value: pct, fill: primary }];
      return (
        <div className={cn("flex h-[min(280px,38vh)] w-full min-h-[220px] flex-col items-center justify-end", className)}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="78%"
              innerRadius="72%"
              outerRadius="100%"
              data={data}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar
                background={{ fill: track }}
                dataKey="value"
                cornerRadius={10}
              />
              <text
                x="50%"
                y="78%"
                textAnchor="middle"
                dominantBaseline="middle"
                fill={dark ? "#fafaf9" : "#1c1917"}
                style={{ fontSize: 28, fontWeight: 700 }}
              >
                {Math.round(pct)}%
              </text>
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case DATA_MOTION_CHART_TYPE.RADAR: {
      const data = vals.map((v, i) => ({
        subject: `E${i + 1}`,
        score: v > 1 ? Math.min(100, v) : v * 100,
      }));
      return (
        <div className={cn("h-[min(340px,44vh)] w-full min-h-[260px]", className)}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
              <PolarGrid stroke={grid} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: axis, fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: axis, fontSize: 10 }} tickCount={4} />
              <Radar
                name="Valor"
                dataKey="score"
                stroke={primary}
                fill={primary}
                fillOpacity={0.35}
                strokeWidth={2}
              />
              <Tooltip formatter={(v: number) => [`${Number(v).toFixed(0)} / 100`, ""]} contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case DATA_MOTION_CHART_TYPE.DONUT: {
      const data = vals.map((v, i) => ({
        name: `Parte ${i + 1}`,
        value: Math.abs(v),
      }));
      return (
        <div className={cn("h-[min(320px,42vh)] w-full min-h-[240px]", className)}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="78%"
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]!} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [`${fmt(Number(v))}`, "Valor"]}
                contentStyle={tooltipStyle}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }
    case DATA_MOTION_CHART_TYPE.BIG_NUMBER: {
      return (
        <div
          className={cn(
            "flex min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-xl bg-stone-50/80 px-6 py-10 dark:bg-black/25",
            className,
          )}
        >
          <p className="text-center text-4xl font-bold tabular-nums tracking-tight text-stone-900 sm:text-5xl dark:text-white">
            {formatDataMotionRingValue(vals[0] ?? 0, card.format, card.suffix)}
          </p>
          {card.title?.trim() || card.label?.trim() ? (
            <p className="max-w-full truncate text-center text-sm font-medium text-stone-500 dark:text-stone-400">
              {card.title?.trim() || card.label}
            </p>
          ) : null}
        </div>
      );
    }
    default: {
      const _e: never = card.chartType;
      return _e;
    }
  }
}
