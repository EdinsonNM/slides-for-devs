import type { CSSProperties, ReactNode } from "react";
import { cn } from "../../../utils/cn.ts";
import type { DeckContentTone } from "../../../domain/entities";
import { deckChapterSubtitleHintClass } from "../../../utils/deckSlideChrome.ts";
import { SlideMarkdown } from "../../../components/shared/SlideMarkdown.tsx";

export type SlideSubtitleMarkdownVariant = "default" | "chapter";

export function SlideSubtitleMarkdownBody({
  tone,
  variant,
  className,
  style,
  children,
}: {
  tone: DeckContentTone;
  variant: SlideSubtitleMarkdownVariant;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <SlideMarkdown
      contentTone={tone}
      className={cn(
        "prose-sm max-w-none min-w-0 w-full",
        variant === "chapter" &&
          cn(
            "text-center font-light normal-case tracking-wide",
            deckChapterSubtitleHintClass(tone),
          ),
        className,
      )}
      style={{ fontSize: "var(--slide-subtitle)", ...style }}
    >
      {children}
    </SlideMarkdown>
  );
}
