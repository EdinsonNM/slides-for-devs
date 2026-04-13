import type { FC } from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SLIDE_TYPE } from "../domain/entities";
import type { DeckRemotionSlide } from "./deckVideoTypes";
import { DECK_VIDEO_FRAMES_PER_SLIDE } from "./deckVideoConstants";

export type DeckVideoCompositionProps = {
  slides: DeckRemotionSlide[];
};

const PLACEHOLDER_SLIDE: DeckRemotionSlide = {
  id: "empty",
  type: SLIDE_TYPE.CONTENT,
  title: "Sin diapositivas",
  subtitle: "Añade contenido para exportar el vídeo.",
  bodyPlain: "",
  indexLabel: "0 / 0",
};

const SlideFrame: FC<{ slide: DeckRemotionSlide }> = ({ slide }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isChapter = slide.type === SLIDE_TYPE.CHAPTER;
  const enter = spring({
    frame,
    fps,
    config: { damping: 14 },
  });
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(enter, [0, 1], [18, 0]);

  const titleSize = isChapter ? 72 : 56;
  const subtitleColor = "rgba(148, 163, 184, 0.95)";

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(152deg, #020617 0%, #0f172a 45%, #1e293b 100%)",
        fontFamily: "system-ui, Segoe UI, sans-serif",
        color: "#f8fafc",
        padding: "5% 6%",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 48,
          right: 56,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "rgba(148, 163, 184, 0.85)",
        }}
      >
        {slide.indexLabel}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: isChapter ? "center" : "flex-start",
          alignItems: "center",
          textAlign: "center",
          paddingTop: isChapter ? 0 : "8%",
          opacity,
          transform: `translateY(${y}px)`,
          maxWidth: "88%",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.08,
            textShadow: "0 4px 32px rgba(0,0,0,0.45)",
          }}
        >
          {slide.title.trim() || "Sin título"}
        </div>
        {slide.subtitle?.trim() ? (
          <div
            style={{
              marginTop: 28,
              fontSize: isChapter ? 32 : 28,
              fontWeight: 600,
              color: "#38bdf8",
              maxWidth: "92%",
            }}
          >
            {slide.subtitle.trim()}
          </div>
        ) : null}
        {!isChapter && slide.bodyPlain.trim() ? (
          <div
            style={{
              marginTop: 40,
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1.35,
              color: subtitleColor,
              textAlign: "left",
              alignSelf: "stretch",
              maxHeight: "52%",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 12,
              WebkitBoxOrient: "vertical" as const,
            }}
          >
            {slide.bodyPlain.trim()}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const DeckVideoComposition: FC<DeckVideoCompositionProps> = ({
  slides,
}) => {
  const list = slides.length > 0 ? slides : [PLACEHOLDER_SLIDE];

  return (
    <AbsoluteFill style={{ background: "#020617" }}>
      {list.map((slide, i) => (
        <Sequence
          key={slide.id}
          from={i * DECK_VIDEO_FRAMES_PER_SLIDE}
          durationInFrames={DECK_VIDEO_FRAMES_PER_SLIDE}
        >
          <SlideFrame slide={slide} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
