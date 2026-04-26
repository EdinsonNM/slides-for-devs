import { useCallback, useEffect, useRef, useState } from "react";
import { useLatestRef } from "./useLatestRef";
import type { Slide, Presentation } from "../../types";
import { formatMarkdown } from "../../utils/markdown";
import {
  composeFullDeckModelInput,
  type PromptAttachment,
} from "../../utils/promptAttachments";
import {
  generatePresentation,
  splitSlide as splitSlideUseCase,
  rewriteSlide as rewriteSlideUseCase,
  generateSlideContent as generateSlideContentUseCase,
  generateSlideMatrix as generateSlideMatrixUseCase,
  generateSlideDiagram as generateSlideDiagramUseCase,
  generateImagePromptAlternatives,
  generateImage as generateImageUseCase,
} from "../../composition/container";
import {
  SLIDE_TYPE,
  normalizeSlideMatrixData,
  type SlideCanvasRect,
} from "../../domain/entities";
import {
  normalizeSlidesCanvasScenes,
  ensureSlideCanvasScene,
} from "../../domain/slideCanvas/ensureSlideCanvasScene";
import {
  defaultCanvasTextEditTargets,
  patchSlideMediaPanelByElementId,
  replaceFirstMarkdownCanvasBody,
} from "../../domain/slideCanvas/slideCanvasApplyEditBuffers";
import { syncSlideRootFromCanvas } from "../../domain/slideCanvas/syncSlideRootFromCanvas";
import { readMediaPayloadFromElement } from "../../domain/slideCanvas/slideCanvasPayload";
import {
  appendCanvasElementToScene,
  type AppendCanvasElementOptions,
} from "../../domain/slideCanvas/insertCanvasElement";
import {
  coerceImageDataUrlForSlideFile,
  isUsableSlideImageFile,
} from "../../utils/slideImageFile";
import { optimizeImageDataUrl } from "../../utils/imageOptimize";
import {
  applyImageDataUrlToMediaPanelPayload,
  applyRiveUrlToMediaPanelPayload,
  applyVideoUrlToMediaPanelPayload,
  applyIframeEmbedUrlToMediaPanelPayload,
  applyGeneratedImageToMediaPanelPayload,
} from "./presentationMediaHelpers";
import {
  getGeminiApiKey,
  hasAnyApiConfiguredSync,
} from "../../services/apiConfig";
import { notifyApiConfigurationRequired } from "../../services/apiConfigurationGate";
import {
  savePresentation,
  updatePresentation,
  addGeneratedResource,
} from "../../services/storage";
import { presentationQueryKeys } from "@/presentation/queryKeys";
import {
  generateCodeForSlide as generateCodeForSlideApi,
  generatePresenterNotes as generatePresenterNotesApi,
  generatePresentationReadme as generatePresentationReadmeApi,
  generateSpeechForSlide as generateSpeechForSlideApi,
  generateSpeechForAll as generateSpeechForAllApi,
  refinePresenterNotes as refinePresenterNotesApi,
} from "../../services/gemini";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import { sanitizeIframeEmbedSrc } from "../../utils/iframeEmbedUrl";
import { resolveGeneratedPresentationTitle } from "../../utils/presentationTitle";
import { usesChatCompletionSlideOps } from "../../constants/presentationModels";
import { DEFAULT_OPENAI_IMAGE_MODEL_ID } from "../../constants/openaiImageModels";
import {
  PANEL_CONTENT_KIND,
  normalizePanelContentKind,
} from "../../domain/panelContent";
import type { PresentationAiModalsDeps } from "./presentationAiModalsDeps";

export type PendingGenerationState = {
  topic: string;
  modelInput?: string;
  modelId: string;
  reuseSavedId?: string | null;
  deckNarrativePresetId: string;
  narrativeNotes?: string;
} | null;

export function usePresentationAiModals(deps: PresentationAiModalsDeps) {
  const depsRef = useLatestRef(deps);

  const [pendingGeneration, setPendingGeneration] =
    useState<PendingGenerationState>(null);
  const generationErrorRestoreRef = useRef<{
    slides: Slide[];
    topic: string;
  } | null>(null);

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPromptAlternatives, setIsGeneratingPromptAlternatives] =
    useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generateFullDeckTopic, setGenerateFullDeckTopic] = useState("");
  const [homePromptAttachments, setHomePromptAttachments] = useState<
    PromptAttachment[]
  >([]);
  const [generateFullDeckAttachments, setGenerateFullDeckAttachments] =
    useState<PromptAttachment[]>([]);
  const [generateSlideContentPrompt, setGenerateSlideContentPrompt] =
    useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [splitPrompt, setSplitPrompt] = useState("");
  const [rewritePrompt, setRewritePrompt] = useState("");
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [iframeEmbedUrlInput, setIframeEmbedUrlInput] = useState("");
  const [speechGeneralPrompt, setSpeechGeneralPrompt] = useState("");
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [codeGenPrompt, setCodeGenPrompt] = useState("");
  const [codeGenLanguage, setCodeGenLanguage] = useState("javascript");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isGeneratingReadme, setIsGeneratingReadme] = useState(false);

  const resetHomePromptAttachments = useCallback(() => {
    setHomePromptAttachments([]);
  }, []);

  const clearPendingGeneration = useCallback(() => {
    generationErrorRestoreRef.current = null;
    setPendingGeneration(null);
  }, []);

  useEffect(() => {
    const pending = pendingGeneration;
    if (!pending) return;
    let cancelled = false;
    const run = async () => {
      const d = depsRef.current;
      try {
        const promptForApi = pending.modelInput ?? pending.topic;
        const generated = await generatePresentation.run(
          promptForApi,
          pending.modelId,
          {
            narrativePresetId: pending.deckNarrativePresetId,
            narrativeNotes: pending.narrativeNotes,
          },
        );
        if (cancelled) return;
        const cleanedSlides = normalizeSlidesCanvasScenes(
          generated.slides.map((slide) => ({
            ...slide,
            id: crypto.randomUUID(),
            content: formatMarkdown(slide.content),
          })),
        );
        const resolvedTopic = resolveGeneratedPresentationTitle({
          presentationTitle: generated.presentationTitle,
          slides: cleanedSlides,
          fallbackBrief: pending.topic,
        });
        d.slidesUndoRef.current = [];
        d.slidesRedoRef.current = [];
        d.setSlides(cleanedSlides);
        d.setCurrentIndex(0);
        d.setTopic(resolvedTopic);
        d.setDeckNarrativePresetId(pending.deckNarrativePresetId);
        d.setNarrativeNotes(pending.narrativeNotes ?? "");
        const presentation: Presentation = {
          topic: resolvedTopic,
          slides: cleanedSlides,
          characterId: d.selectedCharacterId ?? undefined,
          deckVisualTheme: d.deckVisualTheme,
          deckNarrativePresetId: pending.deckNarrativePresetId,
          narrativeNotes: pending.narrativeNotes?.trim() || undefined,
          presentationReadme: d.presentationReadme.trim() || undefined,
        };
        let id: string;
        if (pending.reuseSavedId) {
          await updatePresentation(
            pending.reuseSavedId,
            presentation,
            d.localAccountScope,
          );
          id = pending.reuseSavedId;
        } else {
          id = await savePresentation(presentation, d.localAccountScope);
        }
        if (cancelled) return;
        d.setCurrentSavedId(id);
        try {
          sessionStorage.setItem(d.lastOpenedSessionKey, id);
        } catch {
          /* ignore */
        }
        void d.queryClient.invalidateQueries({
          queryKey: presentationQueryKeys.savedPresentations(d.localAccountScope),
        });
        if (d.user && typeof window !== "undefined") {
          void d.runAutoSyncAfterSaveRef.current(id);
        }
        setPendingGeneration(null);
        trackEvent(ANALYTICS_EVENTS.PRESENTATION_GENERATED, {
          slide_count: cleanedSlides.length,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Error generating presentation:", error);
        const errorMessage =
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "Hubo un error al generar la presentación. Por favor intenta de nuevo.";
        alert(`Error al generar la presentación:\n${errorMessage}`);
        setPendingGeneration(null);
        const restore = generationErrorRestoreRef.current;
        generationErrorRestoreRef.current = null;
        if (restore) {
          d.setSlides(restore.slides);
          d.setTopic(restore.topic);
        } else {
          d.setSlides([]);
          d.setTopic("");
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pendingGeneration]);

  useEffect(() => {
    const d = depsRef.current;
    if (d.showImageModal && d.currentSlide) {
      setImagePrompt(d.currentSlide.imagePrompt || "");
    }
  }, [deps.showImageModal, deps.currentIndex, deps.currentSlide?.id]);

  const queueFullDeckGeneration = useCallback(
    (
      displayTopic: string,
      options?: {
        modelInput?: string;
        errorRestore?: { slides: Slide[]; topic: string };
        reuseSavedId?: string | null;
        deckNarrativePresetId?: string;
        narrativeNotes?: string;
      },
    ): boolean => {
      const d = depsRef.current;
      const saved = displayTopic.trim();
      const fullInput = (options?.modelInput ?? saved).trim();
      if (!fullInput) return false;
      if (!hasAnyApiConfiguredSync()) {
        notifyApiConfigurationRequired();
        return false;
      }
      generationErrorRestoreRef.current = options?.errorRestore ?? null;
      d.setTopic(saved);
      const placeholderSlide: Slide = {
        id: crypto.randomUUID(),
        type: "content",
        title: "Generando…",
        content: "Preparando tu presentación.",
      };
      d.setSlides([placeholderSlide]);
      d.setCurrentIndex(0);
      setPendingGeneration({
        topic: saved,
        modelInput: fullInput !== saved ? fullInput : undefined,
        modelId: d.presentationModelId,
        reuseSavedId: options?.reuseSavedId ?? undefined,
        deckNarrativePresetId:
          options?.deckNarrativePresetId ?? d.deckNarrativePresetId,
        narrativeNotes:
          options?.narrativeNotes !== undefined
            ? options.narrativeNotes
            : d.narrativeNotes.trim() || undefined,
      });
      return true;
    },
    [],
  );

  const handleGenerate = useCallback((e: React.FormEvent): boolean => {
    e.preventDefault();
    const d = depsRef.current;
    const { modelInput, displayTopic } = composeFullDeckModelInput(
      d.topic,
      homePromptAttachments,
    );
    if (!modelInput) return false;
    const queued = queueFullDeckGeneration(displayTopic, {
      modelInput: modelInput !== displayTopic ? modelInput : undefined,
    });
    if (queued) setHomePromptAttachments([]);
    return queued;
  }, [homePromptAttachments, queueFullDeckGeneration]);

  const handleGenerateReadmeWithAi = useCallback(async () => {
    const d = depsRef.current;
    if (d.slides.length === 0) {
      alert("No hay diapositivas para analizar y generar un README.");
      return;
    }
    if (!hasAnyApiConfiguredSync()) {
      notifyApiConfigurationRequired();
      return;
    }
    setIsGeneratingReadme(true);
    try {
      const markdown = await generatePresentationReadmeApi(
        d.slides,
        d.topic,
        d.presentationReadme,
        d.modelForGeminiOps,
      );
      if (!markdown.trim()) {
        throw new Error("La IA no devolvió contenido para el README.");
      }
      d.setPresentationReadme(markdown);
    } catch (error) {
      console.error("Error generating presentation README:", error);
      const errorMessage =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "No se pudo generar el README con IA.";
      alert(`Error al generar README:\n${errorMessage}`);
    } finally {
      setIsGeneratingReadme(false);
    }
  }, []);

  const openGenerateFullDeckModal = useCallback(() => {
    const d = depsRef.current;
    setGenerateFullDeckTopic(d.topic.trim());
    setGenerateFullDeckAttachments([]);
    d.setShowGenerateFullDeckModal(true);
  }, []);

  const handleConfirmGenerateFullDeck = useCallback(() => {
    const d = depsRef.current;
    const { modelInput, displayTopic } = composeFullDeckModelInput(
      generateFullDeckTopic,
      generateFullDeckAttachments,
    );
    if (!modelInput) return;
    const backupNeeded =
      d.slides.length > 1 ||
      d.slides.some((s) => {
        const c = (s.content ?? "").trim();
        if (c.length > 0) return true;
        const title = s.title.trim();
        if (title === "Generando…") return false;
        return title.length > 0 && title !== "Nueva diapositiva";
      });
    const errorRestore = backupNeeded
      ? { slides: d.slides.map((s) => ({ ...s })), topic: d.topic }
      : undefined;
    const queued = queueFullDeckGeneration(displayTopic, {
      modelInput: modelInput !== displayTopic ? modelInput : undefined,
      errorRestore,
      reuseSavedId: d.currentSavedId,
    });
    if (!queued) return;
    d.setShowGenerateFullDeckModal(false);
    setGenerateFullDeckTopic("");
    setGenerateFullDeckAttachments([]);
  }, [
    generateFullDeckTopic,
    generateFullDeckAttachments,
    queueFullDeckGeneration,
  ]);

  const addHomePromptAttachment = useCallback((a: PromptAttachment) => {
    setHomePromptAttachments((prev) => [...prev, a]);
  }, []);

  const removeHomePromptAttachment = useCallback((id: string) => {
    setHomePromptAttachments((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const addGenerateFullDeckAttachment = useCallback((a: PromptAttachment) => {
    setGenerateFullDeckAttachments((prev) => [...prev, a]);
  }, []);

  const removeGenerateFullDeckAttachment = useCallback((id: string) => {
    setGenerateFullDeckAttachments((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const handleImageGenerate = useCallback(async () => {
    const d = depsRef.current;
    if (!imagePrompt.trim() || !d.currentSlide) return;
    const patchMediaPanelElementId =
      d.pendingImageGenerateMediaPanelIdRef.current ??
      d.canvasTextTargetsRef.current.mediaPanelElementId;
    d.pendingImageGenerateMediaPanelIdRef.current = null;
    setIsGeneratingImage(true);
    const slideContext = `Título: ${d.currentSlide.title}. Contenido: ${d.currentSlide.content}`;
    const character = d.selectedCharacterId
      ? d.savedCharacters.find((c) => c.id === d.selectedCharacterId)
      : undefined;
    const characterPrompt = character?.description;
    const characterReferenceImageDataUrl =
      d.imageProvider === "gemini" ? character?.referenceImageDataUrl : undefined;
    const characterReferenceImageForOpenAI =
      d.imageProvider === "openai" ? character?.referenceImageDataUrl : undefined;
    const imageModelId =
      d.imageProvider === "gemini"
        ? d.geminiImageModelId
        : DEFAULT_OPENAI_IMAGE_MODEL_ID;
    try {
      const imageUrl = await generateImageUseCase.run({
        providerId: d.imageProvider,
        slideContext,
        userPrompt: imagePrompt,
        stylePrompt: d.selectedStyle.prompt,
        includeBackground: d.includeBackground,
        modelId: imageModelId,
        characterPrompt,
        characterReferenceImageDataUrl:
          d.imageProvider === "openai"
            ? characterReferenceImageForOpenAI
            : characterReferenceImageDataUrl,
      });
      if (imageUrl) {
        const promptUsed = imagePrompt.trim();
        let nextDeck: Slide[] | null = null;
        d.setSlides((prev) => {
          const updated = [...prev];
          const cur = updated[d.currentIndex];
          if (!cur) return prev;
          updated[d.currentIndex] = patchSlideMediaPanelByElementId(
            cur,
            patchMediaPanelElementId,
            (m) => applyGeneratedImageToMediaPanelPayload(m, imageUrl, promptUsed),
          );
          nextDeck = updated;
          return updated;
        });
        if (nextDeck && nextDeck.length > 0) {
          const savedId = await d.savePresentationNow({
            topic: d.topic || "Sin título",
            slides: nextDeck,
            characterId: d.selectedCharacterId ?? undefined,
          });
          if (!savedId) {
            alert(
              "La imagen se aplicó al lienzo pero no se pudo guardar en el almacenamiento local. Revisa el mensaje de estado o pulsa Guardar.",
            );
          }
        }
        d.setShowImageModal(false);
        setImagePrompt("");
        trackEvent(ANALYTICS_EVENTS.IMAGE_GENERATED);
        void addGeneratedResource(
          {
            kind: "image",
            payload: imageUrl,
            prompt: promptUsed,
            source: d.imageProvider,
          },
          d.localAccountScope,
        )
          .then(() =>
            d.queryClient.invalidateQueries({
              queryKey: presentationQueryKeys.generatedResources(
                d.localAccountScope,
              ),
            }),
          )
          .catch((err) => console.error("Biblioteca de recursos:", err));
      }
    } catch (error) {
      console.error("Error generating image:", error);
      alert("Error al generar la imagen.");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [imagePrompt]);

  const handleGeneratePromptAlternatives = useCallback(async () => {
    const d = depsRef.current;
    if (!d.currentSlide) return;
    setIsGeneratingPromptAlternatives(true);
    const slideContext = `Título: ${d.currentSlide.title}. Contenido: ${d.currentSlide.content}`;
    const characterPrompt = d.selectedCharacterId
      ? d.savedCharacters.find((c) => c.id === d.selectedCharacterId)?.description
      : undefined;
    const modelId = usesChatCompletionSlideOps(
      d.presentationModelOption?.provider,
    )
      ? d.presentationModelId
      : d.effectiveGeminiModel;
    try {
      const alternative = await generateImagePromptAlternatives.run(
        slideContext,
        imagePrompt,
        d.selectedStyle.name,
        d.selectedStyle.prompt,
        modelId,
        characterPrompt,
        d.includeBackground,
      );
      if (alternative) setImagePrompt(alternative);
    } catch (error) {
      console.error("Error generating prompt alternatives:", error);
      alert("No se pudo generar una alternativa de prompt.");
    } finally {
      setIsGeneratingPromptAlternatives(false);
    }
  }, [imagePrompt]);

  const handleSplitSlide = useCallback(async () => {
    const d = depsRef.current;
    if (!splitPrompt.trim() || !d.currentSlide) return;
    setIsProcessing(true);
    const modelId = usesChatCompletionSlideOps(
      d.presentationModelOption?.provider,
    )
      ? d.presentationModelId
      : d.effectiveGeminiModel;
    try {
      const newSlides = await splitSlideUseCase.run(
        d.currentSlide,
        splitPrompt,
        modelId,
      );
      if (newSlides.length > 0) {
        const cleanedNewSlides = normalizeSlidesCanvasScenes(
          newSlides.map((slide) => ({
            ...slide,
            id: crypto.randomUUID(),
            content: formatMarkdown(slide.content),
          })),
        );
        d.setSlides((prev) => {
          const updated = [...prev];
          updated.splice(d.currentIndex, 1, ...cleanedNewSlides);
          return updated;
        });
        d.setShowSplitModal(false);
        setSplitPrompt("");
        trackEvent(ANALYTICS_EVENTS.SLIDE_SPLIT, {
          new_slides_count: cleanedNewSlides.length,
        });
      }
    } catch (error) {
      console.error("Error splitting slide:", error);
      alert("Error al dividir la diapositiva.");
    } finally {
      setIsProcessing(false);
    }
  }, [splitPrompt]);

  const handleRewriteSlide = useCallback(async () => {
    const d = depsRef.current;
    if (!rewritePrompt.trim() || !d.currentSlide) return;
    setIsProcessing(true);
    const modelId = usesChatCompletionSlideOps(
      d.presentationModelOption?.provider,
    )
      ? d.presentationModelId
      : d.effectiveGeminiModel;
    try {
      const result = await rewriteSlideUseCase.run(
        d.currentSlide,
        rewritePrompt,
        modelId,
        d.deckNarrativeSlideOptions,
      );
      const formattedContent = formatMarkdown(result.content);
      d.setSlides((prev) => {
        const updated = [...prev];
        const slide = updated[d.currentIndex];
        if (!slide) return prev;
        updated[d.currentIndex] = replaceFirstMarkdownCanvasBody(
          {
            ...slide,
            title: result.title,
            content: formattedContent,
          },
          formattedContent,
        );
        return updated;
      });
      d.setEditTitle(result.title);
      d.setEditContent(formattedContent);
      d.setEditContentRichHtml("");
      d.setEditContentBodyFontScale(1);
      d.setShowRewriteModal(false);
      setRewritePrompt("");
      trackEvent(ANALYTICS_EVENTS.SLIDE_REWRITTEN);
    } catch (error) {
      console.error("Error rewriting slide:", error);
      alert("Error al replantear la diapositiva.");
    } finally {
      setIsProcessing(false);
    }
  }, [rewritePrompt]);

  const handleGenerateSlideContentAi = useCallback(async () => {
    const d = depsRef.current;
    if (!d.currentSlide) return;
    const instr = generateSlideContentPrompt.trim();
    if (!instr) return;
    const modelId = usesChatCompletionSlideOps(
      d.presentationModelOption?.provider,
    )
      ? d.presentationModelId
      : d.effectiveGeminiModel;

    if (d.currentSlide.type === SLIDE_TYPE.MATRIX) {
      setIsProcessing(true);
      try {
        const result = await generateSlideMatrixUseCase.run(
          d.topic.trim(),
          d.currentSlide,
          instr,
          modelId,
          d.deckNarrativeSlideOptions,
        );
        const formattedContent = formatMarkdown(result.content);
        const matrixData = normalizeSlideMatrixData({
          columnHeaders: result.columnHeaders,
          rows: result.rows,
        });
        d.setSlides((prev) => {
          const updated = [...prev];
          const slide = updated[d.currentIndex];
          if (!slide || slide.type !== SLIDE_TYPE.MATRIX) return prev;
          updated[d.currentIndex] = {
            ...slide,
            title: result.title,
            subtitle: result.subtitle.trim() || undefined,
            content: formattedContent,
            matrixData,
          };
          return updated;
        });
        d.setEditTitle(result.title);
        d.setEditSubtitle(result.subtitle);
        d.setEditContent(formattedContent);
        d.setShowGenerateSlideContentModal(false);
        setGenerateSlideContentPrompt("");
        trackEvent(ANALYTICS_EVENTS.SLIDE_MATRIX_GENERATED);
      } catch (error) {
        console.error("Error generating matrix slide:", error);
        alert("No se pudo generar la tabla con IA.");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (d.currentSlide.type === SLIDE_TYPE.DIAGRAM) {
      setIsProcessing(true);
      try {
        const result = await generateSlideDiagramUseCase.run(
          d.topic.trim(),
          d.currentSlide,
          instr,
          modelId,
          d.deckNarrativeSlideOptions,
        );
        const notesText = result.content.trim();
        const formattedNotes = notesText ? formatMarkdown(notesText) : "";
        d.setSlides((prev) => {
          const updated = [...prev];
          const slide = updated[d.currentIndex];
          if (!slide || slide.type !== SLIDE_TYPE.DIAGRAM) return prev;
          updated[d.currentIndex] = {
            ...slide,
            title: result.title,
            ...(formattedNotes ? { content: formattedNotes } : {}),
            excalidrawData: result.excalidrawData,
          };
          return updated;
        });
        d.setEditTitle(result.title);
        if (formattedNotes) d.setEditContent(formattedNotes);
        d.setDiagramRemountToken((n) => n + 1);
        d.setShowGenerateSlideContentModal(false);
        setGenerateSlideContentPrompt("");
        trackEvent(ANALYTICS_EVENTS.SLIDE_DIAGRAM_GENERATED);
      } catch (error) {
        console.error("Error generating diagram slide:", error);
        const detail =
          error instanceof Error && error.message
            ? ` ${error.message}`
            : "";
        alert(
          `No se pudo generar el diagrama con IA.${detail} Prueba un prompt más simple (flujo, arquitectura en cajas y flechas).`,
        );
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (d.currentSlide.type !== SLIDE_TYPE.CONTENT) return;
    setIsProcessing(true);
    try {
      const result = await generateSlideContentUseCase.run(
        d.topic.trim(),
        d.currentSlide,
        instr,
        modelId,
        d.deckNarrativeSlideOptions,
      );
      const formattedContent = formatMarkdown(result.content);
      d.setSlides((prev) => {
        const updated = [...prev];
        const slide = updated[d.currentIndex];
        if (!slide) return prev;
        updated[d.currentIndex] = replaceFirstMarkdownCanvasBody(
          {
            ...slide,
            title: result.title,
            content: formattedContent,
          },
          formattedContent,
        );
        return updated;
      });
      d.setEditTitle(result.title);
      d.setEditContent(formattedContent);
      d.setEditContentRichHtml("");
      d.setEditContentBodyFontScale(1);
      d.setShowGenerateSlideContentModal(false);
      setGenerateSlideContentPrompt("");
      trackEvent(ANALYTICS_EVENTS.SLIDE_CONTENT_GENERATED);
    } catch (error) {
      console.error("Error generating slide content:", error);
      alert("No se pudo generar el contenido de la diapositiva.");
    } finally {
      setIsProcessing(false);
    }
  }, [generateSlideContentPrompt]);

  const handleSaveVideoUrl = useCallback(() => {
    const d = depsRef.current;
    if (!videoUrlInput.trim() || !d.currentSlide) return;
    const patchId =
      d.pendingVideoUrlMediaPanelIdRef.current ??
      d.canvasTextTargetsRef.current.mediaPanelElementId;
    d.pendingVideoUrlMediaPanelIdRef.current = null;
    d.setSlides((prev) => {
      const updated = [...prev];
      const cur = updated[d.currentIndex];
      if (!cur) return prev;
      updated[d.currentIndex] = patchSlideMediaPanelByElementId(
        cur,
        patchId,
        (m) => applyVideoUrlToMediaPanelPayload(m, videoUrlInput.trim()),
      );
      return updated;
    });
    d.setShowVideoModal(false);
    setVideoUrlInput("");
    trackEvent(ANALYTICS_EVENTS.VIDEO_ADDED);
  }, [videoUrlInput]);

  const handleSaveIframeEmbedUrl = useCallback(() => {
    const d = depsRef.current;
    if (!iframeEmbedUrlInput.trim() || !d.currentSlide) return;
    const safe = sanitizeIframeEmbedSrc(iframeEmbedUrlInput);
    if (!safe) {
      alert("URL no válida. Usa una dirección http o https completa.");
      return;
    }
    const patchId =
      d.pendingIframeEmbedUrlMediaPanelIdRef.current ??
      d.canvasTextTargetsRef.current.mediaPanelElementId;
    d.pendingIframeEmbedUrlMediaPanelIdRef.current = null;
    d.setSlides((prev) => {
      const updated = [...prev];
      const cur = updated[d.currentIndex];
      if (!cur) return prev;
      updated[d.currentIndex] = patchSlideMediaPanelByElementId(
        cur,
        patchId,
        (m) => applyIframeEmbedUrlToMediaPanelPayload(m, safe),
      );
      return updated;
    });
    d.setShowIframeEmbedModal(false);
    setIframeEmbedUrlInput("");
    trackEvent(ANALYTICS_EVENTS.IFRAME_EMBED_ADDED);
  }, [iframeEmbedUrlInput]);

  const openImageModal = useCallback(
    (options?: { mediaPanelElementId?: string | null }) => {
      const d = depsRef.current;
      const explicit = options?.mediaPanelElementId;
      d.pendingImageGenerateMediaPanelIdRef.current =
        explicit != null && explicit !== ""
          ? explicit
          : d.canvasTextTargetsRef.current.mediaPanelElementId;
      const slide = d.slidesRef.current[d.currentIndexRef.current];
      setImagePrompt(slide?.imagePrompt || "");
      d.setShowImageModal(true);
    },
    [],
  );

  const openImageUploadModal = useCallback(
    (options?: { mediaPanelElementId?: string | null }) => {
      const d = depsRef.current;
      const explicit = options?.mediaPanelElementId;
      d.pendingImageUploadMediaPanelIdRef.current =
        explicit != null && explicit !== ""
          ? explicit
          : d.canvasTextTargetsRef.current.mediaPanelElementId;
      d.setShowImageUploadModal(true);
    },
    [],
  );

  const openVideoModal = useCallback(
    (options?: {
      mediaPanelElementId?: string | null;
      initialVideoUrl?: string;
    }) => {
      const d = depsRef.current;
      const explicit = options?.mediaPanelElementId;
      d.pendingVideoUrlMediaPanelIdRef.current =
        explicit != null && explicit !== ""
          ? explicit
          : d.canvasTextTargetsRef.current.mediaPanelElementId;
      const slide = d.slidesRef.current[d.currentIndexRef.current];
      setVideoUrlInput(options?.initialVideoUrl ?? slide?.videoUrl ?? "");
      d.setShowVideoModal(true);
    },
    [],
  );

  const openIframeEmbedModal = useCallback(
    (options?: {
      mediaPanelElementId?: string | null;
      initialIframeEmbedUrl?: string;
    }) => {
      const d = depsRef.current;
      const explicit = options?.mediaPanelElementId;
      d.pendingIframeEmbedUrlMediaPanelIdRef.current =
        explicit != null && explicit !== ""
          ? explicit
          : d.canvasTextTargetsRef.current.mediaPanelElementId;
      const slide = d.slidesRef.current[d.currentIndexRef.current];
      setIframeEmbedUrlInput(
        options?.initialIframeEmbedUrl ?? slide?.iframeEmbedUrl ?? "",
      );
      d.setShowIframeEmbedModal(true);
    },
    [],
  );

  const ingestImageFileOnCurrentSlide = useCallback(
    (
      file: File,
      placement: "patchTargetPanel" | "newPanel",
      newPanelRect?: SlideCanvasRect,
      callbacks?: {
        onAfterApply?: () => void;
        patchMediaPanelElementId?: string;
      },
    ) => {
      const d = depsRef.current;
      if (!isUsableSlideImageFile(file)) return;
      const reader = new FileReader();
      reader.onload = () => {
        void (async () => {
          let dataUrl = coerceImageDataUrlForSlideFile(
            reader.result as string,
            file,
          );
          try {
            dataUrl = await optimizeImageDataUrl(dataUrl);
          } catch {
            /* mantener original */
          }
          d.setSlides((prev) => {
            const index = d.currentIndexRef.current;
            const raw = prev[index];
            if (!raw) return prev;
            const cur = ensureSlideCanvasScene(raw);
            const scene = cur.canvasScene;
            if (!scene) return prev;

            if (placement === "newPanel") {
              const appendOpts: AppendCanvasElementOptions = {
                mediaContentType: PANEL_CONTENT_KIND.IMAGE,
                mediaPanelPayloadOverrides: {
                  imageUrl: dataUrl,
                  contentType: PANEL_CONTENT_KIND.IMAGE,
                },
              };
              if (newPanelRect) {
                appendOpts.insertRectOverride = newPanelRect;
              }
              const appended = appendCanvasElementToScene(
                cur,
                scene.elements,
                "mediaPanel",
                appendOpts,
              );
              if (!appended) return prev;
              const { elements: nextElements, created } = appended;
              const updated = [...prev];
              updated[index] = syncSlideRootFromCanvas({
                ...cur,
                canvasScene: { ...scene, elements: nextElements },
              });
              if (created.kind === "mediaPanel") {
                window.setTimeout(() => {
                  d.setCanvasMediaPanelEditTarget(created.id, {
                    rehydrateCodeBuffers: true,
                  });
                }, 0);
              }
              return updated;
            }

            const explicitPatchId = callbacks?.patchMediaPanelElementId?.trim();
            if (explicitPatchId) {
              const el = scene.elements.find((x) => x.id === explicitPatchId);
              if (el?.kind === "mediaPanel") {
                const updated = [...prev];
                updated[index] = patchSlideMediaPanelByElementId(
                  cur,
                  explicitPatchId,
                  (m) => applyImageDataUrlToMediaPanelPayload(m, dataUrl),
                );
                return updated;
              }
            }

            const targetId =
              d.canvasTextTargetsRef.current.mediaPanelElementId ??
              defaultCanvasTextEditTargets(cur).mediaPanelElementId;

            const updated = [...prev];
            if (targetId) {
              updated[index] = patchSlideMediaPanelByElementId(
                cur,
                targetId,
                (m) => applyImageDataUrlToMediaPanelPayload(m, dataUrl),
              );
              return updated;
            }

            const appended = appendCanvasElementToScene(
              cur,
              scene.elements,
              "mediaPanel",
              {
                mediaContentType: PANEL_CONTENT_KIND.IMAGE,
                mediaPanelPayloadOverrides: {
                  imageUrl: dataUrl,
                  contentType: PANEL_CONTENT_KIND.IMAGE,
                },
              },
            );
            if (!appended) return prev;
            const { elements: nextElements, created } = appended;
            updated[index] = syncSlideRootFromCanvas({
              ...cur,
              canvasScene: { ...scene, elements: nextElements },
            });
            if (created.kind === "mediaPanel") {
              window.setTimeout(() => {
                d.setCanvasMediaPanelEditTarget(created.id, {
                  rehydrateCodeBuffers: true,
                });
              }, 0);
            }
            return updated;
          });
          callbacks?.onAfterApply?.();
        })();
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const ingestRiveFileOnCurrentSlide = useCallback((file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".riv")) {
      alert("Elige un archivo con extensión .riv.");
      return;
    }
    const d = depsRef.current;
    const blobUrl = URL.createObjectURL(file);
    d.setSlides((prev) => {
      const index = d.currentIndexRef.current;
      const raw = prev[index];
      if (
        !raw ||
        (raw.type !== SLIDE_TYPE.CONTENT && raw.type !== SLIDE_TYPE.CHAPTER)
      ) {
        URL.revokeObjectURL(blobUrl);
        return prev;
      }
      const cur = ensureSlideCanvasScene(raw);
      const scene = cur.canvasScene;
      if (!scene) {
        URL.revokeObjectURL(blobUrl);
        return prev;
      }
      const targetId =
        d.canvasTextTargetsRef.current.mediaPanelElementId ??
        defaultCanvasTextEditTargets(cur).mediaPanelElementId;
      if (!targetId) {
        URL.revokeObjectURL(blobUrl);
        return prev;
      }
      const el = scene.elements.find((e) => e.id === targetId);
      if (!el || el.kind !== "mediaPanel") {
        URL.revokeObjectURL(blobUrl);
        return prev;
      }
      const prevMedia = readMediaPayloadFromElement(cur, el);
      const old = prevMedia.riveUrl;
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      const updated = [...prev];
      updated[index] = patchSlideMediaPanelByElementId(
        cur,
        targetId,
        (m) => applyRiveUrlToMediaPanelPayload(m, blobUrl),
      );
      return updated;
    });
  }, []);

  const clearRiveFromCurrentMediaPanel = useCallback(() => {
    const d = depsRef.current;
    d.setSlides((prev) => {
      const index = d.currentIndexRef.current;
      const raw = prev[index];
      if (
        !raw ||
        (raw.type !== SLIDE_TYPE.CONTENT && raw.type !== SLIDE_TYPE.CHAPTER)
      ) {
        return prev;
      }
      const cur = ensureSlideCanvasScene(raw);
      const scene = cur.canvasScene;
      if (!scene) return prev;
      const targetId =
        d.canvasTextTargetsRef.current.mediaPanelElementId ??
        defaultCanvasTextEditTargets(cur).mediaPanelElementId;
      if (!targetId) return prev;
      const el = scene.elements.find((e) => e.id === targetId);
      if (!el || el.kind !== "mediaPanel") return prev;
      const prevMedia = readMediaPayloadFromElement(cur, el);
      if (normalizePanelContentKind(prevMedia.contentType) !== PANEL_CONTENT_KIND.RIVE) {
        return prev;
      }
      const old = prevMedia.riveUrl;
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      const updated = [...prev];
      updated[index] = patchSlideMediaPanelByElementId(cur, targetId, (m) => {
        const next = { ...m, contentType: PANEL_CONTENT_KIND.IMAGE };
        delete (next as { riveUrl?: string }).riveUrl;
        delete (next as { riveStateMachineNames?: string }).riveStateMachineNames;
        delete (next as { riveArtboard?: string }).riveArtboard;
        return next;
      });
      return updated;
    });
  }, []);

  const setCurrentSlideRiveArtboard = useCallback((name: string) => {
    const d = depsRef.current;
    d.setSlides((prev) => {
      const index = d.currentIndexRef.current;
      const raw = prev[index];
      if (
        !raw ||
        (raw.type !== SLIDE_TYPE.CONTENT && raw.type !== SLIDE_TYPE.CHAPTER)
      ) {
        return prev;
      }
      const cur = ensureSlideCanvasScene(raw);
      const scene = cur.canvasScene;
      if (!scene) return prev;
      const targetId =
        d.canvasTextTargetsRef.current.mediaPanelElementId ??
        defaultCanvasTextEditTargets(cur).mediaPanelElementId;
      if (!targetId) return prev;
      const el = scene.elements.find((e) => e.id === targetId);
      if (!el || el.kind !== "mediaPanel") return prev;
      const prevMedia = readMediaPayloadFromElement(cur, el);
      if (normalizePanelContentKind(prevMedia.contentType) !== PANEL_CONTENT_KIND.RIVE) {
        return prev;
      }
      const updated = [...prev];
      const trimmed = name.trim();
      updated[index] = patchSlideMediaPanelByElementId(cur, targetId, (m) => ({
        ...m,
        riveArtboard: trimmed.length > 0 ? trimmed : "",
      }));
      return updated;
    });
  }, []);

  const setCurrentSlideRiveStateMachineNames = useCallback((names: string) => {
    const d = depsRef.current;
    d.setSlides((prev) => {
      const index = d.currentIndexRef.current;
      const raw = prev[index];
      if (
        !raw ||
        (raw.type !== SLIDE_TYPE.CONTENT && raw.type !== SLIDE_TYPE.CHAPTER)
      ) {
        return prev;
      }
      const cur = ensureSlideCanvasScene(raw);
      const scene = cur.canvasScene;
      if (!scene) return prev;
      const targetId =
        d.canvasTextTargetsRef.current.mediaPanelElementId ??
        defaultCanvasTextEditTargets(cur).mediaPanelElementId;
      if (!targetId) return prev;
      const el = scene.elements.find((e) => e.id === targetId);
      if (!el || el.kind !== "mediaPanel") return prev;
      const prevMedia = readMediaPayloadFromElement(cur, el);
      if (normalizePanelContentKind(prevMedia.contentType) !== PANEL_CONTENT_KIND.RIVE) {
        return prev;
      }
      const updated = [...prev];
      const trimmed = names.trim();
      updated[index] = patchSlideMediaPanelByElementId(cur, targetId, (m) => ({
        ...m,
        riveStateMachineNames: trimmed.length > 0 ? trimmed : "",
      }));
      return updated;
    });
  }, []);

  const handleImageUpload = useCallback(
    (file: File) => {
      const d = depsRef.current;
      if (!d.currentSlide) return;
      const patchId = d.pendingImageUploadMediaPanelIdRef.current;
      d.pendingImageUploadMediaPanelIdRef.current = null;
      ingestImageFileOnCurrentSlide(file, "patchTargetPanel", undefined, {
        onAfterApply: () => d.setShowImageUploadModal(false),
        patchMediaPanelElementId: patchId ?? undefined,
      });
    },
    [ingestImageFileOnCurrentSlide],
  );

  const openCodeGenModal = useCallback(() => {
    const d = depsRef.current;
    setCodeGenLanguage(d.currentSlide?.language || "javascript");
    setCodeGenPrompt("");
    d.setShowCodeGenModal(true);
  }, []);

  const handleGenerateCode = useCallback(async () => {
    const d = depsRef.current;
    if (!d.currentSlide) return;
    setIsGeneratingCode(true);
    try {
      const { code } = await generateCodeForSlideApi(
        d.currentSlide,
        codeGenLanguage,
        codeGenPrompt.trim() || undefined,
        d.modelForGeminiOps,
      );
      d.setSlides((prev) => {
        const updated = [...prev];
        const cur = updated[d.currentIndex];
        if (!cur) return prev;
        updated[d.currentIndex] = patchSlideMediaPanelByElementId(
          cur,
          d.canvasTextTargetsRef.current.mediaPanelElementId,
          (m) => ({
            ...m,
            code,
            language: codeGenLanguage,
            contentType: PANEL_CONTENT_KIND.CODE,
          }),
        );
        return updated;
      });
      d.setEditCode(code);
      d.setEditLanguage(codeGenLanguage);
      d.setShowCodeGenModal(false);
      setCodeGenPrompt("");
      trackEvent(ANALYTICS_EVENTS.CODE_GENERATED);
    } catch (error) {
      console.error("Error generating code:", error);
      alert("Error al generar el código. Intenta de nuevo.");
    } finally {
      setIsGeneratingCode(false);
    }
  }, [codeGenLanguage, codeGenPrompt]);

  const setPresenterNotesForCurrentSlide = useCallback((notes: string) => {
    const d = depsRef.current;
    if (!d.currentSlide) return;
    d.setSlides((prev) => {
      const updated = [...prev];
      const cur = updated[d.currentIndex];
      if (!cur) return prev;
      updated[d.currentIndex] = { ...cur, presenterNotes: notes };
      return updated;
    });
  }, []);

  const handleGeneratePresenterNotes = useCallback(async () => {
    const d = depsRef.current;
    if (!d.currentSlide) return;
    setIsProcessing(true);
    try {
      const notes = await generatePresenterNotesApi(
        d.currentSlide,
        d.modelForGeminiOps,
      );
      setPresenterNotesForCurrentSlide(notes);
      trackEvent(ANALYTICS_EVENTS.PRESENTER_NOTES_GENERATED);
    } catch (e) {
      console.error(e);
      alert("Error al generar las notas del presentador.");
    } finally {
      setIsProcessing(false);
    }
  }, [setPresenterNotesForCurrentSlide]);

  const handleGenerateSpeechForCurrentSlide = useCallback(
    async (prompt?: string) => {
      const d = depsRef.current;
      if (!d.currentSlide) return;
      setIsGeneratingSpeech(true);
      try {
        const text = await generateSpeechForSlideApi(
          d.currentSlide,
          prompt,
          d.modelForGeminiOps,
        );
        setPresenterNotesForCurrentSlide(text);
        trackEvent(ANALYTICS_EVENTS.SPEECH_SLIDE_GENERATED);
      } catch (e) {
        console.error(e);
        alert("Error al generar el contenido.");
      } finally {
        setIsGeneratingSpeech(false);
      }
    },
    [setPresenterNotesForCurrentSlide],
  );

  const handleRefinePresenterNotes = useCallback(async () => {
    const d = depsRef.current;
    if (!d.currentSlide) return;
    const current = (d.currentSlide.presenterNotes ?? "").trim();
    if (!current) {
      alert("Escribe o genera primero el contenido para refinar.");
      return;
    }
    setIsGeneratingSpeech(true);
    try {
      const refined = await refinePresenterNotesApi(
        d.currentSlide,
        current,
        d.modelForGeminiOps,
      );
      setPresenterNotesForCurrentSlide(refined);
    } catch (e) {
      console.error(e);
      alert("Error al refinar las notas.");
    } finally {
      setIsGeneratingSpeech(false);
    }
  }, [setPresenterNotesForCurrentSlide]);

  const handleGenerateSpeechForAll = useCallback(async () => {
    const d = depsRef.current;
    if (d.slides.length === 0 || !speechGeneralPrompt.trim()) return;
    setIsGeneratingSpeech(true);
    try {
      const results = await generateSpeechForAllApi(
        d.slides,
        speechGeneralPrompt,
        d.modelForGeminiOps,
      );
      d.setSlides((prev) =>
        prev.map((s, i) => ({
          ...s,
          presenterNotes: results[i] ?? s.presenterNotes ?? "",
        })),
      );
      d.setShowSpeechModal(false);
      setSpeechGeneralPrompt("");
      trackEvent(ANALYTICS_EVENTS.SPEECH_ALL_GENERATED, {
        slide_count: d.slides.length,
      });
    } catch (e) {
      console.error(e);
      alert("Error al generar para todas las diapositivas.");
    } finally {
      setIsGeneratingSpeech(false);
    }
  }, [speechGeneralPrompt]);

  return {
    pendingGeneration,
    clearPendingGeneration,
    resetHomePromptAttachments,
    isGeneratingImage,
    isGeneratingPromptAlternatives,
    isProcessing,
    generateFullDeckTopic,
    setGenerateFullDeckTopic,
    homePromptAttachments,
    generateFullDeckAttachments,
    setGenerateFullDeckAttachments,
    generateSlideContentPrompt,
    setGenerateSlideContentPrompt,
    imagePrompt,
    setImagePrompt,
    splitPrompt,
    setSplitPrompt,
    rewritePrompt,
    setRewritePrompt,
    videoUrlInput,
    setVideoUrlInput,
    iframeEmbedUrlInput,
    setIframeEmbedUrlInput,
    speechGeneralPrompt,
    setSpeechGeneralPrompt,
    isGeneratingSpeech,
    codeGenPrompt,
    setCodeGenPrompt,
    codeGenLanguage,
    setCodeGenLanguage,
    isGeneratingCode,
    isGeneratingReadme,
    queueFullDeckGeneration,
    handleGenerate,
    handleGenerateReadmeWithAi,
    openGenerateFullDeckModal,
    handleConfirmGenerateFullDeck,
    addHomePromptAttachment,
    removeHomePromptAttachment,
    addGenerateFullDeckAttachment,
    removeGenerateFullDeckAttachment,
    handleImageGenerate,
    handleGeneratePromptAlternatives,
    handleSplitSlide,
    handleRewriteSlide,
    handleGenerateSlideContentAi,
    handleSaveVideoUrl,
    handleSaveIframeEmbedUrl,
    openImageModal,
    openImageUploadModal,
    openVideoModal,
    openIframeEmbedModal,
    ingestImageFileOnCurrentSlide,
    ingestRiveFileOnCurrentSlide,
    clearRiveFromCurrentMediaPanel,
    setCurrentSlideRiveArtboard,
    setCurrentSlideRiveStateMachineNames,
    handleImageUpload,
    openCodeGenModal,
    handleGenerateCode,
    setPresenterNotesForCurrentSlide,
    handleGeneratePresenterNotes,
    handleGenerateSpeechForCurrentSlide,
    handleRefinePresenterNotes,
    handleGenerateSpeechForAll,
  };
}
