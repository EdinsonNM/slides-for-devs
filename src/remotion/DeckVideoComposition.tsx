import type { FC } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SLIDE_TYPE } from "../domain/entities";
import type { DeckRemotionSlide } from "./deckVideoTypes";
import { DECK_VIDEO_FRAMES_PER_SLIDE } from "./deckVideoConstants";
import {
  computeDeckSlideReadPhases,
  deckEnterEndFrame,
  deckSceneVeilFrames,
  deckSlideExitStart,
  secToFrames,
} from "./deckVideoTiming";

export type DeckVideoCompositionProps = {
  slides: DeckRemotionSlide[];
  /** Si se define, sustituye el fondo animado por un degradado/color estático (export MP4). */
  exportBackdropCss?: string;
};

const EASING_ENTER = Easing.bezier(0.16, 1, 0.3, 1);
/** Fundidos lentos y sin brusquedad (aprox. ease-out suave). */
const EASING_FADE = Easing.bezier(0.33, 0, 0.2, 1);
const EASING_HOLD = Easing.bezier(0.45, 0, 0.55, 1);

const PLACEHOLDER_SLIDE: DeckRemotionSlide = {
  id: "empty",
  type: SLIDE_TYPE.CONTENT,
  title: "Sin diapositivas",
  subtitle: "Añade contenido para exportar el vídeo.",
  bodyPlain: "",
  indexLabel: "0 / 0",
  imageUrls: [],
};

function accentFromSlideId(id: string): { primary: string; glow: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const hues = [199, 172, 280, 330, 152, 43, 262];
  const hue = hues[Math.abs(h) % hues.length]!;
  return {
    primary: `hsl(${hue} 85% 62%)`,
    glow: `hsla(${hue} 90% 55% / 0.35)`,
  };
}

const StaticExportBackdrop: FC<{ cssBackground: string }> = ({
  cssBackground,
}) => (
  <AbsoluteFill style={{ background: cssBackground }} />
);

const AnimatedBackdrop: FC<{
  frame: number;
  fps: number;
  isChapter: boolean;
  accentGlow: string;
}> = ({ frame, fps, isChapter, accentGlow }) => {
  const cycles = frame / fps;
  const orbX = 50 + Math.sin(cycles * 1.15) * 8 + Math.cos(cycles * 0.85) * 4;
  const orbY = 42 + Math.cos(cycles * 1.05) * 10;
  const orb2X = 55 + Math.cos(cycles * 0.72) * 12;
  const orb2Y = 58 + Math.sin(cycles * 0.68) * 8;
  const pulsePhase = (Math.sin(frame * 0.12) + 1) / 2;
  const pulse = interpolate(pulsePhase, [0, 1], [0.12, 0.22]);

  const baseTop = isChapter ? "#0c0a09" : "#020617";
  const baseMid = isChapter ? "#1c1410" : "#0f172a";
  const baseBot = isChapter ? "#292524" : "#1e293b";

  return (
    <>
      <AbsoluteFill
        style={{
          background: `linear-gradient(165deg, ${baseTop} 0%, ${baseMid} 48%, ${baseBot} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 85% 70% at ${orbX}% ${orbY}%, ${accentGlow}, transparent 72%)`,
          opacity: 0.85,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 50% at ${orb2X}% ${orb2Y}%, rgba(248, 250, 252, 0.06), transparent 65%)`,
          opacity: 0.7 + pulse * 0.15,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.25) 100%)",
        }}
      />
    </>
  );
};

function wordRevealBetween(
  text: string,
  frame: number,
  startFrame: number,
  endFrame: number,
): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || frame < startFrame) return "";
  const dur = Math.max(1, endFrame - startFrame);
  const k = Math.min(
    words.length,
    Math.max(
      0,
      Math.floor(
        interpolate(frame, [startFrame, endFrame], [0, words.length], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        }),
      ),
    ),
  );
  return words.slice(0, k).join(" ");
}

const DeckImageStrip: FC<{
  urls: string[];
  frame: number;
  fps: number;
  blockStart: number;
  blockEnd: number;
  accent: string;
  variant: "sidebar-right" | "below-centered";
}> = ({ urls, frame, fps, blockStart, blockEnd, accent, variant }) => {
  if (urls.length === 0 || blockEnd <= blockStart) return null;
  const fadeInEnd = blockStart + secToFrames(fps, 0.58);
  const opacity = interpolate(frame, [blockStart, fadeInEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASING_FADE,
  });
  const slideX = interpolate(frame, [blockStart, fadeInEnd], [22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASING_ENTER,
  });
  const scale = interpolate(frame, [blockStart, fadeInEnd], [0.96, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASING_ENTER,
  });
  const lateFade =
    frame > blockEnd - secToFrames(fps, 0.35)
      ? interpolate(
          frame,
          [blockEnd - secToFrames(fps, 0.35), blockEnd],
          [1, 0.9],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASING_FADE,
          },
        )
      : 1;

  const isSidebar = variant === "sidebar-right";

  return (
    <div
      style={{
        width: "100%",
        height: isSidebar ? "100%" : undefined,
        maxHeight: isSidebar ? "100%" : undefined,
        opacity: opacity * lateFade,
        transform: isSidebar
          ? `translateX(${slideX}px) scale(${scale})`
          : `translateX(${slideX * 0.35}px) scale(${scale})`,
        display: "flex",
        flexDirection: isSidebar ? "column" : "row",
        flexWrap: isSidebar ? "nowrap" : "wrap",
        alignItems: isSidebar ? "stretch" : "center",
        justifyContent: isSidebar ? "center" : "center",
        gap: isSidebar ? 14 : 18,
        marginTop: isSidebar ? 0 : 28,
      }}
    >
      {urls.map((src, idx) => (
        <div
          key={`${src}-${idx}`}
          style={{
            flex: isSidebar ? "0 0 auto" : urls.length === 1 ? "1 1 100%" : "1 1 40%",
            width: isSidebar ? "100%" : undefined,
            maxWidth: isSidebar ? "100%" : urls.length === 1 ? "88%" : "48%",
            minWidth: isSidebar ? 0 : 200,
            borderRadius: 14,
            overflow: "hidden",
            border: `1px solid rgba(255,255,255,0.12)`,
            boxShadow: `0 18px 48px rgba(0,0,0,0.45), 0 0 0 1px ${accent}33`,
            background: "rgba(15,23,42,0.5)",
            maxHeight: isSidebar ? 340 : 380,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Img
            src={src}
            style={{
              width: "100%",
              height: "100%",
              maxHeight: isSidebar ? 320 : 380,
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>
      ))}
    </div>
  );
};

const SlideFrame: FC<{
  slide: DeckRemotionSlide;
  exportBackdropCss?: string;
}> = ({ slide, exportBackdropCss }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isChapter = slide.type === SLIDE_TYPE.CHAPTER;
  const last = DECK_VIDEO_FRAMES_PER_SLIDE - 1;
  const exitStart = deckSlideExitStart(fps);
  const enterEnd = deckEnterEndFrame(fps);
  const veilEnd = deckSceneVeilFrames(fps);

  const rawTitle = slide.title.trim() || "Sin título";
  const subRaw = slide.subtitle?.trim() ?? "";
  const bodyRaw = slide.bodyPlain.trim();
  const bodyWords = bodyRaw ? bodyRaw.split(/\s+/).filter(Boolean) : [];
  const imageUrls = slide.imageUrls ?? [];
  const hasRightImages = imageUrls.length > 0;
  /** Contenido tipo “portada”: solo título (misma idea visual que un capítulo centrado). */
  const titleOnly =
    !isChapter && Boolean(rawTitle) && !subRaw && !bodyRaw && !hasRightImages;

  const phases = computeDeckSlideReadPhases(fps, {
    subWordCount: subRaw ? subRaw.split(/\s+/).filter(Boolean).length : 0,
    hasSub: Boolean(subRaw),
    bodyWordCount: bodyWords.length,
    hasBody: Boolean(bodyRaw) && !isChapter,
    imageCount: imageUrls.length,
    isChapter,
  });

  const exitT = interpolate(frame, [exitStart, last], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  const sceneVeil = interpolate(frame, [0, veilEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASING_FADE,
  });

  const holdT = interpolate(frame, [0, last], [0, 1], {
    extrapolateRight: "clamp",
    easing: EASING_HOLD,
  });

  const titleRel = Math.max(0, frame - phases.titleTwStart);
  const titleFadeFrames = secToFrames(fps, titleOnly ? 0.78 : 0.62);
  const titleAppearEnd = phases.titleTwStart + titleFadeFrames;
  const titleOpacity =
    frame < phases.titleTwStart
      ? 0
      : interpolate(frame, [phases.titleTwStart, titleAppearEnd], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASING_FADE,
        });

  const titleSpring = spring({
    frame: titleRel,
    fps,
    config: titleOnly
      ? { damping: 22, mass: 0.92, stiffness: 86 }
      : { damping: 16, mass: 0.78, stiffness: 118 },
  });
  const titleY = interpolate(
    titleSpring,
    [0, 1],
    titleOnly ? [16, 0] : [32, 0],
  );
  const titleScale = interpolate(
    titleSpring,
    [0, 1],
    titleOnly ? [0.97, 1] : [0.94, 1],
  );

  const lineProgressEnd = Math.min(
    phases.titleTwEnd + secToFrames(fps, 0.14),
    phases.titleTwStart + secToFrames(fps, 0.55),
  );
  const lineWidth = interpolate(
    frame,
    [phases.titleTwStart, lineProgressEnd],
    [0, 100],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASING_FADE,
    },
  );

  const badgeIn = interpolate(frame, [secToFrames(fps, 0.08), secToFrames(fps, 0.52)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASING_FADE,
  });
  const badgeX = interpolate(
    spring({ frame: frame - 2, fps, config: { damping: 15 } }),
    [0, 1],
    [18, 0],
  );

  const subShown = subRaw
    ? wordRevealBetween(subRaw, frame, phases.subtitleStart, phases.subtitleWordsEnd)
    : "";
  const subVisible = Boolean(subRaw) && frame >= phases.subtitleStart;
  const subOpacity = subVisible
    ? interpolate(
        frame,
        [phases.subtitleStart, phases.subtitleStart + secToFrames(fps, 0.38)],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASING_FADE,
        },
      )
    : 0;
  const subY = interpolate(
    spring({
      frame: Math.max(0, frame - phases.subtitleStart),
      fps,
      config: { damping: 17, mass: 0.62 },
    }),
    [0, 1],
    [20, 0],
  );

  const bodyAnimCap = 56;
  const bodyToAnimate = bodyWords.slice(0, bodyAnimCap).join(" ");
  const bodyRest =
    bodyWords.length > bodyAnimCap ? ` ${bodyWords.slice(bodyAnimCap).join(" ")}` : "";
  const bodyRevealEnd = Math.max(
    phases.bodyStart + secToFrames(fps, 0.5),
    Math.min(phases.contentLastFrame, exitStart - secToFrames(fps, 0.2)),
  );
  const bodyPrefix =
    !isChapter && bodyRaw && frame >= phases.bodyStart
      ? wordRevealBetween(bodyToAnimate, frame, phases.bodyStart, bodyRevealEnd)
      : "";
  const bodyFullShown =
    frame >= bodyRevealEnd || bodyWords.length <= bodyAnimCap || !bodyRaw || isChapter;
  const bodyShown =
    !isChapter && bodyRaw && frame >= phases.bodyStart
      ? bodyFullShown
        ? bodyPrefix + bodyRest
        : bodyPrefix
      : "";

  const bodyOpacity =
    !isChapter && bodyRaw && frame >= phases.bodyStart
      ? interpolate(
          frame,
          [phases.bodyStart, phases.bodyStart + secToFrames(fps, 0.45)],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASING_FADE,
          },
        )
      : 0;
  const bodyY = interpolate(
    spring({
      frame: Math.max(0, frame - phases.bodyStart),
      fps,
      config: { damping: 18, mass: 0.7 },
    }),
    [0, 1],
    [28, 0],
  );

  const { primary: accent, glow: accentGlow } = accentFromSlideId(slide.id);
  const titleSize = isChapter ? 76 : titleOnly ? 64 : 56;
  const subtitleColor = accent;
  const bodyColor = "rgba(226, 232, 240, 0.88)";

  const exitLift = interpolate(exitT, [0, 1], [0, -22], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const exitScale = interpolate(exitT, [0, 1], [0, 0.045], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  const enterOpacity = interpolate(frame, [0, enterEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASING_FADE,
  });
  const contentOpacity =
    sceneVeil * enterOpacity * (1 - exitT * 0.96) *
    interpolate(holdT, [0.15, 0.92], [1, 1], { extrapolateRight: "clamp" });

  const titleGlow = interpolate(
    frame,
    [0, Math.round(1.4 * fps), last],
    [0.42, 0.62, 0.38],
    { extrapolateRight: "clamp" },
  );

  const textColumnAlign = hasRightImages ? "flex-start" : "center";
  const textTextAlign = hasRightImages ? ("left" as const) : ("center" as const);
  const lineMarginX = hasRightImages ? "0" : "auto";
  const centerVertically = isChapter || titleOnly;

  const titleBlock = (
    <div
      style={{
        opacity: titleOpacity,
        transform: `translateY(${titleY}px) scale(${titleScale})`,
        maxWidth: "100%",
        width: hasRightImages ? "100%" : undefined,
      }}
    >
      <div
        style={{
          fontSize: titleSize,
          fontWeight: 800,
          lineHeight: 1.06,
          letterSpacing: isChapter ? "-0.02em" : "-0.01em",
          textShadow: `0 4px 40px rgba(0,0,0,0.55), 0 0 64px ${accentGlow}, 0 0 ${22 + titleGlow * 22}px ${accentGlow}`,
        }}
      >
        {frame >= phases.titleTwStart ? rawTitle : ""}
      </div>
      <div
        style={{
          marginTop: 18,
          height: 4,
          width: `${lineWidth}%`,
          maxWidth: hasRightImages ? 360 : 420,
          marginLeft: lineMarginX,
          marginRight: lineMarginX,
          borderRadius: 4,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          boxShadow: `0 0 20px ${accentGlow}`,
        }}
      />
    </div>
  );

  const subtitleBlock =
    subRaw ? (
      <div
        style={{
          marginTop: 32,
          opacity: subOpacity * Math.min(1, sceneVeil + 0.001),
          transform: `translateY(${subY}px)`,
          fontSize: isChapter ? 34 : 26,
          fontWeight: 650,
          color: subtitleColor,
          maxWidth: hasRightImages ? "100%" : "92%",
          lineHeight: 1.25,
          textShadow: `0 2px 24px ${accentGlow}`,
          minHeight: subVisible ? undefined : 0,
          width: hasRightImages ? "100%" : undefined,
        }}
      >
        {subShown}
      </div>
    ) : null;

  const bodyBlock =
    !isChapter && bodyRaw ? (
      <div
        style={{
          marginTop: 32,
          width: "100%",
          opacity: bodyOpacity * Math.min(1, sceneVeil + 0.001),
          transform: `translateY(${bodyY}px)`,
          fontSize: 26,
          fontWeight: 480,
          lineHeight: 1.45,
          color: bodyColor,
          textAlign: "left",
          alignSelf: hasRightImages ? "stretch" : "stretch",
          maxHeight: hasRightImages ? "62%" : "50%",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: hasRightImages ? 14 : 11,
          WebkitBoxOrient: "vertical" as const,
          borderLeft: `3px solid ${accent}`,
          paddingLeft: 28,
          paddingTop: 4,
          borderRadius: 2,
          boxSizing: "border-box",
        }}
      >
        {bodyShown}
      </div>
    ) : null;

  const imageStrip = (
    <DeckImageStrip
      urls={imageUrls}
      frame={frame}
      fps={fps}
      blockStart={phases.imageBlockStart}
      blockEnd={phases.imageBlockEnd}
      accent={accent}
      variant={hasRightImages ? "sidebar-right" : "below-centered"}
    />
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, Segoe UI, sans-serif",
        color: "#f8fafc",
        padding: "5% 6.5%",
      }}
    >
      {exportBackdropCss ? (
        <StaticExportBackdrop cssBackground={exportBackdropCss} />
      ) : (
        <AnimatedBackdrop
          frame={frame}
          fps={fps}
          isChapter={isChapter}
          accentGlow={accentGlow}
        />
      )}

      <div
        style={{
          position: "absolute",
          top: 44,
          right: 52,
          opacity: badgeIn,
          transform: `translateX(${badgeX}px)`,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(248, 250, 252, 0.55)",
            padding: "10px 16px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(8px)",
          }}
        >
          {slide.indexLabel}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: hasRightImages ? "row" : "column",
          justifyContent: hasRightImages ? "stretch" : centerVertically ? "center" : "flex-start",
          alignItems: hasRightImages ? "stretch" : "center",
          textAlign: textTextAlign,
          paddingTop: hasRightImages ? "4%" : centerVertically ? 0 : "5%",
          width: "100%",
          maxWidth: hasRightImages ? "96%" : "90%",
          margin: "0 auto",
          opacity: contentOpacity,
          transform: `translateY(${exitLift}px) scale(${1 - exitScale})`,
          gap: hasRightImages ? 36 : 0,
        }}
      >
        {hasRightImages ? (
          <>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: textColumnAlign,
                textAlign: textTextAlign,
                justifyContent: isChapter ? "center" : "flex-start",
              }}
            >
              {titleBlock}
              {subtitleBlock}
              {!isChapter ? bodyBlock : null}
            </div>
            <div
              style={{
                width: "40%",
                maxWidth: 460,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingLeft: 8,
              }}
            >
              {imageStrip}
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: textColumnAlign,
              textAlign: textTextAlign,
              width: "100%",
              minHeight: 0,
              justifyContent: centerVertically ? "center" : "flex-start",
            }}
          >
            {titleBlock}
            {subtitleBlock}
            {imageStrip}
            {bodyBlock}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const DeckVideoComposition: FC<DeckVideoCompositionProps> = ({
  slides,
  exportBackdropCss,
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
          <SlideFrame slide={slide} exportBackdropCss={exportBackdropCss} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
