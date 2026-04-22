import type { ReactNode } from "react";
import type { DeckContentTone } from "../../../domain/entities";
import { SlideTitleAccentBar } from "../atoms/SlideTitleAccentBar.tsx";
import { SlideTitleHeading } from "../atoms/SlideTitleHeading.tsx";

/** Título principal de slide de contenido (solo lectura): heading + barra. */
export function SlideContentTitleReadOnly({
  tone,
  headingClassName,
  children,
}: {
  tone: DeckContentTone;
  /** Clases extra en el heading (p. ej. miniaturas: `min-h-0 shrink`). */
  headingClassName?: string;
  children: ReactNode;
}) {
  return (
    <>
      <SlideTitleHeading as="h2" tone={tone} size="slide" className={headingClassName}>
        {children}
      </SlideTitleHeading>
      <SlideTitleAccentBar variant="titleUnderline" />
    </>
  );
}
