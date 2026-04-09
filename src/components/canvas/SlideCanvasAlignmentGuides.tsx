import { cn } from "../../utils/cn";
import type { AlignmentGuideLine } from "../../utils/slideCanvasAlignmentSnap";

const guideColor = "bg-fuchsia-500 dark:bg-fuchsia-400";
const solidClass = cn(guideColor, "opacity-90");
const dashedVerticalClass = cn(
  "h-full w-0 border-l border-dashed border-fuchsia-500 opacity-90 dark:border-fuchsia-400",
);
const dashedHorizontalClass = cn(
  "w-full h-0 border-t border-dashed border-fuchsia-500 opacity-90 dark:border-fuchsia-400",
);

export interface SlideCanvasAlignmentGuidesProps {
  vertical: AlignmentGuideLine[];
  horizontal: AlignmentGuideLine[];
}

/**
 * Superposición de guías alineación (centro, bordes, márgenes, otros bloques) durante el arrastre.
 */
export function SlideCanvasAlignmentGuides({
  vertical,
  horizontal,
}: SlideCanvasAlignmentGuidesProps) {
  if (vertical.length === 0 && horizontal.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-11000"
      aria-hidden
    >
      {vertical.map((g) => (
        <div
          key={`v-${g.posPct.toFixed(3)}`}
          className={cn(
            "absolute bottom-0 top-0 -translate-x-1/2",
            g.stroke === "solid" ? cn("w-px", solidClass) : dashedVerticalClass,
          )}
          style={{ left: `${g.posPct}%` }}
        />
      ))}
      {horizontal.map((g) => (
        <div
          key={`h-${g.posPct.toFixed(3)}`}
          className={cn(
            "absolute left-0 right-0 -translate-y-1/2",
            g.stroke === "solid" ? cn("h-px", solidClass) : dashedHorizontalClass,
          )}
          style={{ top: `${g.posPct}%` }}
        />
      ))}
    </div>
  );
}
