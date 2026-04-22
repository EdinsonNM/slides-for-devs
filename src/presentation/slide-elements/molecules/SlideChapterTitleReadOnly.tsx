import type { ReactNode } from "react";
import type { DeckContentTone } from "../../../domain/entities";
import { SlideTitleAccentBar } from "../atoms/SlideTitleAccentBar.tsx";
import { SlideTitleHeading } from "../atoms/SlideTitleHeading.tsx";

/** Título de capítulo (solo lectura): barra + heading centrado. */
export function SlideChapterTitleReadOnly({
  tone,
  headingClassName,
  children,
}: {
  tone: DeckContentTone;
  headingClassName?: string;
  children: ReactNode;
}) {
  return (
    <>
      <SlideTitleAccentBar variant="chapterTop" />
      <SlideTitleHeading as="h1" tone={tone} size="chapter" className={headingClassName}>
        {children}
      </SlideTitleHeading>
    </>
  );
}
