import { z } from "zod";

export const SlideCanvasRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  z: z.number(),
});

export const DeckVisualThemeSchema = z.object({
  version: z.number().optional(),
  name: z.string().optional(),
  fontFamily: z.string().optional(),
  headingFontFamily: z.string().optional(),
  primaryColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  backgroundKind: z.string().optional(),
});

export const SlideCanvasElementSchema = z.object({
  id: z.string(),
  kind: z.string(),
  rect: SlideCanvasRectSchema,
  payload: z.record(z.string(), z.unknown()), // Generic as element payload is polymorphic
});

export const SlideCanvasSceneSchema = z.object({
  version: z.string(),
  elements: z.array(SlideCanvasElementSchema),
});

export const SlideSchema = z.object({
  type: z.string(),
  contentLayout: z.string().optional(),
  imageWidthPercent: z.number().optional(),
  panelHeightPercent: z.number().optional(),
  canvasScene: SlideCanvasSceneSchema.optional(),
  // Fallbacks for non-canvas
  title: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.string().optional(),
  image: z.string().optional(),
  video: z.string().optional(),
  code: z.string().optional(),
  language: z.string().optional(),
  fontSize: z.number().optional(),
  editorHeight: z.number().optional(),
  presenterNotes: z.string().optional(),
});

export const PresentationSchema = z.object({
  topic: z.string(),
  slides: z.array(SlideSchema),
  characterId: z.string().optional(),
  deckVisualTheme: DeckVisualThemeSchema.optional(),
  deckNarrativePresetId: z.string().optional(),
  narrativeNotes: z.string().optional(),
});

export const SavedPresentationMetaSchema = z.object({
  id: z.string(),
  topic: z.string(),
  savedAt: z.string(),
  slideCount: z.number(),
  cloudId: z.string().optional(),
  cloudSyncedAt: z.string().optional(),
  cloudRevision: z.number().optional(),
  localBodyCleared: z.boolean().optional(),
  sharedCloudSource: z.string().optional(),
});
