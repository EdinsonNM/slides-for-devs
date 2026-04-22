import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../../utils/cn.ts";
import type { DeckContentTone } from "../../../domain/entities";
import { deckPrimaryTextClass } from "../../../utils/deckSlideChrome.ts";

export type SlideTitleHeadingSize = "slide" | "chapter";

const fontSize: Record<SlideTitleHeadingSize, CSSProperties["fontSize"]> = {
  slide: "var(--slide-title)",
  chapter: "var(--slide-title-chapter)",
};

export function SlideTitleHeading({
  as: Tag = "h2",
  tone,
  size,
  className,
  style,
  children,
}: {
  as?: "h1" | "h2";
  tone: DeckContentTone;
  size: SlideTitleHeadingSize;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn(
        "min-w-0 w-full max-w-full font-serif italic leading-tight whitespace-pre-wrap wrap-break-word",
        deckPrimaryTextClass(tone),
        className,
      )}
      style={{ fontSize: fontSize[size], ...style }}
    >
      {children}
    </Tag>
  );
}
