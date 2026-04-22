import { cn } from "../../../utils/cn.ts";

export type SlideTitleAccentBarVariant = "titleUnderline" | "chapterTop";

const variantClass: Record<SlideTitleAccentBarVariant, string> = {
  titleUnderline: "mt-2 h-1.5 w-20 shrink-0 rounded-full bg-emerald-600",
  chapterTop:
    "mb-3 h-1 w-14 shrink-0 rounded-full bg-emerald-600 md:mb-4",
};

export function SlideTitleAccentBar({
  variant,
  className,
}: {
  variant: SlideTitleAccentBarVariant;
  className?: string;
}) {
  return <div className={cn(variantClass[variant], className)} role="presentation" />;
}
