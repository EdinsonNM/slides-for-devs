export { slideCountBounds, parseSlideCountFromTopic, DEFAULT_SLIDES, MIN_SLIDES, MAX_SLIDES } from "./constants";
export { generatePresentationPrompt } from "./generatePresentation.prompt";
export { splitSlidePrompt } from "./splitSlide.prompt";
export { rewriteSlidePrompt } from "./rewriteSlide.prompt";
export { generateSlideContentPrompt } from "./generateSlideContent.prompt";
export { generateSlideMatrixPrompt } from "./generateSlideMatrix.prompt";
export {
  imageAlternativesPrompt,
  imageGenerationPrompt,
  refineCharacterPrompt,
  describeCharacterFromImagePrompt,
} from "./image.prompt";
export type { ImageAlternativesInput, ImageGenerationInput, RefineCharacterInput } from "./image.prompt";
export {
  presenterNotesPrompt,
  speechForSlidePrompt,
  refinePresenterNotesPrompt,
  presenterChatPrompt,
} from "./presenter.prompt";
export type {
  PresenterNotesInput,
  SpeechForSlideInput,
  RefinePresenterNotesInput,
  PresenterChatInput,
} from "./presenter.prompt";
export { codeForSlidePrompt } from "./code.prompt";
export type { CodeForSlideInput } from "./code.prompt";
export { slideCountPrompt } from "./slideCount.prompt";
export type { SlideCountInput } from "./slideCount.prompt";
